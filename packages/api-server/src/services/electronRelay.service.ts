import { WebSocket, WebSocketServer } from 'ws'
import { Server as HTTPServer } from 'http'
import { DeviceService, type Device } from './device.service.js'
import { DeviceControlLockService } from './deviceControlLock.service.js'

interface ConnectedDevice {
  ws: WebSocket
  device: Device
  lastPing: number
}

interface RelayCommand {
  command: string
  data: any
  requestId?: string
}

interface RelayResponse {
  requestId: string
  success: boolean
  data?: any
  error?: string
}

// 연결된 디바이스 관리 (deviceId -> ConnectedDevice)
const connectedDevices = new Map<string, ConnectedDevice>()

// 대기 중인 요청 (requestId -> resolve/reject)
const pendingRequests = new Map<string, {
  resolve: (value: any) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}>()

export class ElectronRelayService {
  private static wss: WebSocketServer | null = null
  private static heartbeatInterval: NodeJS.Timeout | null = null

  /**
   * WebSocket 서버 초기화
   */
  static initialize(server: HTTPServer): void {
    this.wss = new WebSocketServer({ noServer: true })

    // HTTP 서버의 upgrade 이벤트 처리
    server.on('upgrade', async (request, socket, head) => {
      const url = new URL(request.url || '', `http://${request.headers.host}`)
      
      // /ws/electron 경로만 처리
      if (url.pathname !== '/ws/electron') {
        socket.destroy()
        return
      }

      const deviceToken = url.searchParams.get('deviceToken')
      
      if (!deviceToken) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
        return
      }

      // deviceToken 검증
      const device = await DeviceService.getDeviceByToken(deviceToken)
      
      if (!device) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
        return
      }

      // WebSocket 연결 업그레이드
      this.wss!.handleUpgrade(request, socket, head, (ws) => {
        this.handleConnection(ws, device)
      })
    })

    // 주기적인 heartbeat 체크 (30초마다)
    this.heartbeatInterval = setInterval(() => {
      this.checkHeartbeats()
    }, 30000)

    console.log('📡 Electron WebSocket Relay 서비스가 초기화되었습니다')
  }

  /**
   * 새 WebSocket 연결 처리
   */
  private static handleConnection(ws: WebSocket, device: Device): void {
    const deviceId = device.device_id

    // 기존 연결이 있으면 종료
    const existing = connectedDevices.get(deviceId)
    if (existing) {
      existing.ws.close(1000, '새 연결로 대체됨')
    }

    // 새 연결 등록
    connectedDevices.set(deviceId, {
      ws,
      device,
      lastPing: Date.now()
    })

    console.log(`🔗 디바이스 연결됨: ${device.display_label} (${deviceId})`)

    // 연결 시 마지막 접속 시간 업데이트
    DeviceService.updateLastSeen(deviceId)

    // 메시지 수신 처리
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())
        this.handleMessage(deviceId, message)
      } catch (error) {
        console.error('WebSocket 메시지 파싱 오류:', error)
      }
    })

    // 연결 종료 처리
    ws.on('close', () => {
      connectedDevices.delete(deviceId)
      DeviceControlLockService.releaseDevice(deviceId)
      console.log(`🔌 디바이스 연결 해제: ${device.display_label} (${deviceId})`)
    })

    // 에러 처리
    ws.on('error', (error) => {
      console.error(`WebSocket 에러 (${deviceId}):`, error)
      connectedDevices.delete(deviceId)
      DeviceControlLockService.releaseDevice(deviceId)
    })

    // pong 응답 처리
    ws.on('pong', () => {
      const conn = connectedDevices.get(deviceId)
      if (conn) {
        conn.lastPing = Date.now()
      }
    })

    // 연결 성공 메시지 전송
    ws.send(JSON.stringify({
      type: 'connected',
      deviceId,
      displayLabel: device.display_label,
      timestamp: new Date().toISOString()
    }))
  }

  /**
   * 디바이스로부터 메시지 수신 처리
   */
  private static handleMessage(deviceId: string, message: any): void {
    // 응답 메시지 처리
    if (message.requestId && pendingRequests.has(message.requestId)) {
      const pending = pendingRequests.get(message.requestId)!
      pendingRequests.delete(message.requestId)
      clearTimeout(pending.timeout)

      if (message.success) {
        pending.resolve(message.data || {})
      } else {
        pending.reject(new Error(message.error || '알 수 없는 오류'))
      }
      return
    }

    // 상태 업데이트 등 다른 메시지 처리
    if (message.type === 'status') {
      // 디바이스 상태 업데이트 (필요시 구현)
      console.log(`📊 디바이스 상태: ${deviceId}`, message.status)
    }
  }

  /**
   * 주기적인 heartbeat 체크
   */
  private static checkHeartbeats(): void {
    const now = Date.now()
    const timeout = 60000 // 1분 타임아웃

    connectedDevices.forEach((conn, deviceId) => {
      if (now - conn.lastPing > timeout) {
        console.log(`⏰ 디바이스 타임아웃: ${deviceId}`)
        conn.ws.terminate()
        connectedDevices.delete(deviceId)
        DeviceControlLockService.releaseDevice(deviceId)
      } else {
        // ping 전송
        if (conn.ws.readyState === WebSocket.OPEN) {
          conn.ws.ping()
        }
      }
    })
  }

  /**
   * 특정 디바이스에 명령 전송
   */
  static async sendCommand(
    deviceId: string,
    command: string,
    data: any = {},
    timeoutMs: number = 30000
  ): Promise<any> {
    const conn = connectedDevices.get(deviceId)
    
    if (!conn) {
      throw new Error('디바이스가 연결되어 있지 않습니다')
    }

    if (conn.ws.readyState !== WebSocket.OPEN) {
      throw new Error('디바이스 연결이 닫혀 있습니다')
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    return new Promise((resolve, reject) => {
      // 타임아웃 설정
      const timeout = setTimeout(() => {
        pendingRequests.delete(requestId)
        reject(new Error('요청 시간이 초과되었습니다'))
      }, timeoutMs)

      // 대기 요청 등록
      pendingRequests.set(requestId, { resolve, reject, timeout })

      // 명령 전송
      const message: RelayCommand = {
        command,
        data,
        requestId
      }

      conn.ws.send(JSON.stringify(message))
    })
  }

  /**
   * 특정 매장의 모든 디바이스에 명령 전송 (브로드캐스트)
   */
  static async broadcastToStore(
    storeId: number,
    command: string,
    data: any = {}
  ): Promise<{ deviceId: string; success: boolean; error?: string }[]> {
    const results: { deviceId: string; success: boolean; error?: string }[] = []

    for (const [deviceId, conn] of connectedDevices.entries()) {
      if (conn.device.store_id === storeId) {
        try {
          await this.sendCommand(deviceId, command, data)
          results.push({ deviceId, success: true })
        } catch (error) {
          results.push({
            deviceId,
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류'
          })
        }
      }
    }

    return results
  }

  /**
   * 디바이스 연결 상태 확인
   */
  static isDeviceConnected(deviceId: string): boolean {
    const conn = connectedDevices.get(deviceId)
    return conn !== undefined && conn.ws.readyState === WebSocket.OPEN
  }

  /**
   * 연결된 디바이스 목록 (특정 매장)
   */
  static getConnectedDevices(storeId?: number): Array<{
    deviceId: string
    displayLabel: string
    storeId: number | null
  }> {
    const devices: Array<{
      deviceId: string
      displayLabel: string
      storeId: number | null
    }> = []

    for (const [deviceId, conn] of connectedDevices.entries()) {
      if (storeId === undefined || conn.device.store_id === storeId) {
        devices.push({
          deviceId,
          displayLabel: (conn.device.display_label && conn.device.display_label !== '디바이스')
            ? conn.device.display_label
            : '링크힛',
          storeId: conn.device.store_id
        })
      }
    }

    return devices
  }

  /**
   * 서비스 종료
   */
  static shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    // 모든 연결 종료
    connectedDevices.forEach((conn) => {
      conn.ws.close(1000, '서버 종료')
    })
    connectedDevices.clear()

    if (this.wss) {
      this.wss.close()
      this.wss = null
    }

    console.log('📡 Electron WebSocket Relay 서비스가 종료되었습니다')
  }
}
