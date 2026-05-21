import WebSocket from 'ws'
import { DeviceManager } from './device-manager.js'
import { IPCHandlers } from './ipc-handlers.js'
import { BrowserWindow } from 'electron'
import { fileLogger } from './file-logger.js'
import type { ElectronLogFilePayload } from './file-logger.js'
import type { HeartRateDiagnosticsSnapshot } from './heart-rate-modules/index.js'

const DEBUG = false
const log = (...args: any[]) => {
  if (DEBUG) console.log(...args)
}

interface RelayCommand {
  command: string
  data: any
  requestId?: string
}

interface WorkoutLogUploadResponse {
  success?: boolean
  error?: string
  fileName?: string
  relativePath?: string
}

export class WebSocketRelay {
  private ws: WebSocket | null = null
  private deviceManager: DeviceManager
  private ipcHandlers: IPCHandlers
  private serverUrl: string
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectTimeout: NodeJS.Timeout | null = null
  private pingInterval: NodeJS.Timeout | null = null
  private isConnecting = false
  private shouldReconnect = true

  // 등록 코드 수신 콜백
  private onRegisterCodeReceived: ((code: string, expiresIn: number) => void) | null = null
  // 등록 완료 콜백
  private onRegistrationComplete: ((data: { deviceToken: string; displayLabel?: string; storeId?: number }) => void) | null = null
  // 연결 상태 변경 콜백
  private onConnectionStateChange: ((connected: boolean, error?: string) => void) | null = null
  // 화면 모드 변경 요청 콜백 (리모컨 → electron)
  private onScreenModeChangeRequest:
    | ((mode: 'three' | 'five') => Promise<{
        success: boolean
        mode?: 'three' | 'five'
        reason?: string
        fallbackToThree?: boolean
        monitorCount?: number
      }>)
    | null = null
  // 화면 모드 조회 콜백
  private onGetScreenModeRequest: (() => 'three' | 'five') | null = null
  private onHeartRateStatusRequest: (() => HeartRateDiagnosticsSnapshot) | null = null

  constructor(
    deviceManager: DeviceManager,
    ipcHandlers: IPCHandlers,
    serverUrl?: string
  ) {
    this.deviceManager = deviceManager
    this.ipcHandlers = ipcHandlers
    
    // 서버 URL 결정 (환경변수 또는 기본값)
    const baseUrl = serverUrl || process.env.API_SERVER_URL || 'https://linkhiit.co.kr'
    // HTTP(S) → WS(S) 변환
    this.serverUrl = baseUrl.replace(/^http/, 'ws')
  }

  /**
   * 콜백 설정
   */
  setCallbacks(callbacks: {
    onRegisterCodeReceived?: (code: string, expiresIn: number) => void
    onRegistrationComplete?: (data: { deviceToken: string; displayLabel?: string; storeId?: number }) => void
    onConnectionStateChange?: (connected: boolean, error?: string) => void
    onScreenModeChangeRequest?: (mode: 'three' | 'five') => Promise<{
      success: boolean
      mode?: 'three' | 'five'
      reason?: string
      fallbackToThree?: boolean
      monitorCount?: number
    }>
    onGetScreenModeRequest?: () => 'three' | 'five'
    onHeartRateStatusRequest?: () => HeartRateDiagnosticsSnapshot
  }): void {
    if (callbacks.onRegisterCodeReceived) {
      this.onRegisterCodeReceived = callbacks.onRegisterCodeReceived
    }
    if (callbacks.onRegistrationComplete) {
      this.onRegistrationComplete = callbacks.onRegistrationComplete
    }
    if (callbacks.onConnectionStateChange) {
      this.onConnectionStateChange = callbacks.onConnectionStateChange
    }
    if (callbacks.onScreenModeChangeRequest) {
      this.onScreenModeChangeRequest = callbacks.onScreenModeChangeRequest
    }
    if (callbacks.onGetScreenModeRequest) {
      this.onGetScreenModeRequest = callbacks.onGetScreenModeRequest
    }
    if (callbacks.onHeartRateStatusRequest) {
      this.onHeartRateStatusRequest = callbacks.onHeartRateStatusRequest
    }
  }

  /**
   * 서버에 연결 시작
   */
  async connect(): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      log('이미 연결 중이거나 연결됨')
      return
    }

    this.shouldReconnect = true
    this.isConnecting = true

    try {
      // 등록 여부 확인
      if (!this.deviceManager.isRegistered()) {
        // 미등록: HTTP로 등록 코드 요청
        await this.requestRegisterCode()
        return
      }

      // 로컬 토큰이 남아 있어도 서버 DB에서 삭제된 경우 새 인증 코드로 전환
      const isRegisteredOnServer = await this.ensureServerRegistration()
      if (!isRegisteredOnServer) {
        await this.requestRegisterCode()
        return
      }

      // WebSocket 연결
      await this.connectWebSocket()
    } catch (error) {
      console.error('연결 실패:', error)
      this.isConnecting = false
      this.scheduleReconnect()
    }
  }

  /**
   * 서버의 최신 등록 상태를 확인하고 로컬 device-config를 동기화한다.
   * 서버에서 디바이스가 삭제되었으면 로컬 토큰도 초기화해 재등록 흐름으로 보낸다.
   */
  private async ensureServerRegistration(): Promise<boolean> {
    try {
      const deviceId = this.deviceManager.getDeviceId()
      const apiUrl = this.serverUrl.replace(/^ws/, 'http')
      const response = await fetch(`${apiUrl}/api/devices/status?deviceId=${deviceId}`)
      const result = await response.json()

      if (result.success && result.registered && result.device?.device_token) {
        const cfg = this.deviceManager.getConfig()
        this.deviceManager.setRegistration({
          deviceToken: result.device.device_token,
          displayLabel: result.device.display_label,
          storeId: result.device.store_id ?? cfg.storeId ?? undefined
        })
        log(`📋 display_label API 동기화: ${result.device.display_label}`)
        return true
      }

      if (result.success && !result.registered) {
        log('📋 서버에 등록된 디바이스가 없어 로컬 등록 정보를 초기화합니다')
        this.deviceManager.clearRegistration()
        return false
      }
    } catch (error) {
      console.warn('서버 등록 상태 확인 실패 (기존 config 유지):', error)
    }

    return true
  }

  /**
   * 등록 코드 요청 (미등록 상태)
   */
  private async requestRegisterCode(): Promise<void> {
    try {
      const deviceId = this.deviceManager.getDeviceId()
      const apiUrl = this.serverUrl.replace(/^ws/, 'http')
      
      log(`📡 등록 코드 요청: ${apiUrl}/api/devices/status?deviceId=${deviceId}`)

      const response = await fetch(`${apiUrl}/api/devices/status?deviceId=${deviceId}`)
      const result = await response.json()

      if (result.success && !result.registered && result.registerCode) {
        log(`📋 등록 코드 수신: ${result.registerCode}`)
        
        if (this.onRegisterCodeReceived) {
          this.onRegisterCodeReceived(result.registerCode, result.expiresIn || 600)
        }

        // 등록 완료 대기를 위해 폴링 시작
        this.startRegistrationPolling()
      } else if (result.registered && result.device?.device_token) {
        // 이미 등록됨 (다른 곳에서 등록한 경우)
        this.deviceManager.setRegistration({
          deviceToken: result.device.device_token,
          displayLabel: result.device.display_label,
          storeId: result.device.store_id
        })
        
        if (this.onRegistrationComplete) {
          this.onRegistrationComplete({
            deviceToken: result.device.device_token,
            displayLabel: result.device.display_label,
            storeId: result.device.store_id
          })
        }

        // WebSocket 연결
        await this.connectWebSocket()
      }
    } catch (error) {
      console.error('등록 코드 요청 실패:', error)
      this.scheduleReconnect()
    } finally {
      this.isConnecting = false
    }
  }

  /**
   * 등록 완료 폴링 (등록 코드 표시 중)
   */
  private pollingInterval: NodeJS.Timeout | null = null
  
  private startRegistrationPolling(): void {
    // 5초마다 등록 상태 확인
    this.pollingInterval = setInterval(async () => {
      try {
        const deviceId = this.deviceManager.getDeviceId()
        const apiUrl = this.serverUrl.replace(/^ws/, 'http')
        
        const response = await fetch(`${apiUrl}/api/devices/status?deviceId=${deviceId}`)
        const result = await response.json()

        if (result.registered && result.device?.device_token) {
          // 등록 완료
          this.stopRegistrationPolling()
          
          this.deviceManager.setRegistration({
            deviceToken: result.device.device_token,
            displayLabel: result.device.display_label,
            storeId: result.device.store_id
          })

          if (this.onRegistrationComplete) {
            this.onRegistrationComplete({
              deviceToken: result.device.device_token,
              displayLabel: result.device.display_label,
              storeId: result.device.store_id
            })
          }

          // WebSocket 연결
          await this.connectWebSocket()
        }
      } catch (error) {
        console.error('등록 상태 폴링 오류:', error)
      }
    }, 5000)
  }

  private stopRegistrationPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
  }

  /**
   * WebSocket 연결
   */
  private async connectWebSocket(): Promise<void> {
    const deviceToken = this.deviceManager.getDeviceToken()
    
    if (!deviceToken) {
      console.error('deviceToken이 없습니다')
      return
    }

    const wsUrl = `${this.serverUrl}/ws/electron?deviceToken=${encodeURIComponent(deviceToken)}`
    log(`🔌 WebSocket 연결 시도: ${wsUrl.replace(deviceToken, '***')}`)

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl, {
          rejectUnauthorized: false // 자체 서명 인증서 허용 (개발용)
        })

        this.ws.on('open', () => {
          log('✅ WebSocket 연결 성공')
          this.isConnecting = false
          this.reconnectAttempts = 0
          
          if (this.onConnectionStateChange) {
            this.onConnectionStateChange(true)
          }

          // 핑 인터벌 시작
          this.startPingInterval()
          resolve()
        })

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString())
            this.handleMessage(message)
          } catch (error) {
            console.error('메시지 파싱 오류:', error)
          }
        })

        this.ws.on('close', (code, reason) => {
          log(`🔌 WebSocket 연결 종료: ${code} - ${reason}`)
          this.cleanup()
          
          if (this.onConnectionStateChange) {
            this.onConnectionStateChange(false, `연결 종료: ${code}`)
          }

          if (this.shouldReconnect) {
            this.scheduleReconnect()
          }
        })

        this.ws.on('error', (error) => {
          console.error('❌ WebSocket 오류:', error)
          this.isConnecting = false
          
          if (this.onConnectionStateChange) {
            this.onConnectionStateChange(false, error.message)
          }
          
          reject(error)
        })

        this.ws.on('pong', () => {
          // 서버로부터 pong 수신
        })
      } catch (error) {
        this.isConnecting = false
        reject(error)
      }
    })
  }

  /**
   * 서버로부터 메시지 수신 처리
   */
  private async handleMessage(message: any): Promise<void> {
    log('📩 메시지 수신:', message.command || message.type)

    // 연결 확인 메시지
    if (message.type === 'connected') {
      log(`📡 서버에 연결됨: ${message.displayLabel} (${message.deviceId})`)
      return
    }

    // 명령 메시지 처리
    if (message.command && message.requestId) {
      const response = await this.executeCommand(message.command, message.data || {})
      
      // 응답 전송
      this.send({
        requestId: message.requestId,
        success: response.success,
        data: response.data,
        error: response.error
      })
    }
  }

  /**
   * API 서버가 릴레이 페이로드에 넣은 JWT로 Electron 측 authToken 갱신 후, 핸들러에는 제거한 data만 전달
   */
  private applyRelayJwtAndStrip(data: any): any {
    if (data && typeof data === 'object' && !Array.isArray(data) && '_relayJwt' in data) {
      const token = (data as { _relayJwt?: unknown })._relayJwt
      if (typeof token === 'string' && token.trim()) {
        this.ipcHandlers.applyRuntimeConfig({ authToken: token.trim() })
      }
      const { _relayJwt: _drop, ...rest } = data as Record<string, unknown>
      return rest
    }
    return data
  }

  private getRelayJwt(data: any): string | null {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null
    const token = (data as { _relayJwt?: unknown })._relayJwt
    return typeof token === 'string' && token.trim() ? token.trim() : null
  }

  private createHeartRateDiagnosticsLogFile(): ElectronLogFilePayload {
    const snapshot = this.ipcHandlers.getHeartRateDiagnostics()
    const content = JSON.stringify({
      type: 'heart-rate-diagnostics',
      description: '리모컨 로그 보내기 시점의 심박계/ANT+/업로드 진단 스냅샷',
      ...snapshot,
    }, null, 2)

    return {
      filename: `heart-rate-diagnostics_${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
      size: Buffer.byteLength(content, 'utf8'),
      modifiedAt: new Date().toISOString(),
      content,
    }
  }

  private async handleSendWorkoutLogs(data: any, relayJwt: string | null): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    if (!relayJwt) {
      return { success: false, error: '로그 업로드 인증 토큰이 없습니다' }
    }

    const runtimeInfo = this.ipcHandlers.getRuntimeInfo()
    const config = this.deviceManager.getConfig()
    const apiUrl = this.serverUrl.replace(/^ws/, 'http')
    const masterId =
      data?.masterId ??
      runtimeInfo?.playSession?.masterId ??
      runtimeInfo?.lastWorkoutPlay?.masterId ??
      null

    const workoutLogFiles = fileLogger.collectCurrentWorkoutSessionLogs(masterId)
    const files = [
      ...workoutLogFiles,
      this.createHeartRateDiagnosticsLogFile(),
    ]

    const basePayload = {
      deviceId: this.deviceManager.getDeviceId(),
      storeId: config.storeId,
      displayLabel: config.displayLabel,
      masterId,
      logDate: new Date().toISOString().slice(0, 10),
    }

    const uploadUrl = `${apiUrl}/api/electron-relay/workout-logs`
    let lastServer: { fileName?: string; relativePath?: string } = {}

    try {
      // 파일마다 별도 POST — 세션 로그가 커질 때 본문 한도(Express/nginx) 초과를 줄임
      for (let i = 0; i < files.length; i++) {
        const payload = {
          ...basePayload,
          sentAt: new Date(Date.now() + i).toISOString(),
          files: [files[i]],
        }

        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${relayJwt}`,
          },
          body: JSON.stringify(payload),
        })

        const raw = await response.text()
        let parsed: WorkoutLogUploadResponse | null = null
        try {
          parsed = raw ? (JSON.parse(raw) as WorkoutLogUploadResponse) : null
        } catch {
          parsed = null
        }

        if (!response.ok || !parsed?.success) {
          const hint =
            (typeof parsed?.error === 'string' && parsed.error) ||
            (raw.length > 0 ? raw.slice(0, 280).replace(/\s+/g, ' ').trim() : '') ||
            response.statusText
          return {
            success: false,
            error: hint || `로그 업로드 실패 (${response.status})`,
          }
        }

        lastServer = { fileName: parsed.fileName, relativePath: parsed.relativePath }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { success: false, error: `로그 업로드 네트워크 오류: ${msg}` }
    }

    return {
      success: true,
      data: {
        fileCount: files.length,
        totalBytes: files.reduce((sum, file) => sum + file.size, 0),
        workoutLogFileCount: workoutLogFiles.length,
        includesHeartRateDiagnostics: true,
        serverFileName: lastServer.fileName,
        relativePath: lastServer.relativePath,
      },
    }
  }

  /**
   * 명령 실행
   */
  private async executeCommand(command: string, data: any): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      log(`🎯 명령 실행: ${command}`)
      const relayJwt = this.getRelayJwt(data)
      const commandData = this.applyRelayJwtAndStrip(data)

      switch (command) {
        case 'start-workout-play':
          fileLogger.beginWorkoutLogSession({
            masterId: commandData?.masterId,
            userId: commandData?.userId,
          })
          const playResult = await this.ipcHandlers.handleWorkoutPlay(commandData)
          return { success: playResult.success, data: playResult, error: playResult.error }

        case 'play-start':
          const startResult = await this.ipcHandlers.handlePlayStart()
          return { success: startResult.success, data: startResult, error: startResult.error }

        case 'play-pause':
          const pauseResult = await this.ipcHandlers.handlePlayPauseToggle()
          return { success: pauseResult.success, data: pauseResult, error: pauseResult.error }

        case 'play-stop':
          const stopResult = await this.ipcHandlers.handlePlayStop()
          return { success: stopResult.success, data: stopResult, error: stopResult.error }

        case 'play-next':
          const nextResult = await this.ipcHandlers.handlePlayNext()
          return { success: nextResult.success, data: nextResult, error: nextResult.error }

        case 'play-previous':
          const prevResult = await this.ipcHandlers.handlePlayPrevious()
          return { success: prevResult.success, data: prevResult, error: prevResult.error }

        case 'toggle-fullscreen':
          const fsResult = await this.ipcHandlers.handleToggleFullscreen()
          return { success: fsResult.success, data: fsResult, error: fsResult.error }

        case 'play-intro':
          const introResult = await this.ipcHandlers.handlePlayIntro()
          return { success: introResult.success, data: introResult, error: introResult.error }

        case 'session-status':
          const status = await this.ipcHandlers.handleGetSessionStatus()
          return { success: true, data: status }

        case 'heart-rate-status':
          return {
            success: true,
            data: this.onHeartRateStatusRequest
              ? this.onHeartRateStatusRequest()
              : this.ipcHandlers.getHeartRateDiagnostics(),
          }

        case 'send-workout-logs':
          return await this.handleSendWorkoutLogs(commandData, relayJwt)

        case 'quit-app':
          log('🔌 앱 종료 명령 수신')
          // 잠시 후 앱 종료 (응답을 먼저 보내기 위해)
          setTimeout(() => {
            const { app } = require('electron')
            app.quit()
          }, 500)
          return { success: true, data: { message: '앱을 종료합니다' } }

        case 'set-display-label':
          log('📺 화면 표시 텍스트 설정:', commandData.displayLabel)
          // IPC를 통해 모든 창에 displayLabel 전달
          const { BrowserWindow } = require('electron')
          BrowserWindow.getAllWindows().forEach((win: any) => {
            win.webContents.send('display-label-updated', { displayLabel: commandData.displayLabel })
          })
          return { success: true, data: { displayLabel: commandData.displayLabel } }

        case 'set-screen-mode': {
          const requestedMode = commandData?.mode
          log(`🖥️ 화면 모드 변경 요청: ${requestedMode}`)
          if (!this.onScreenModeChangeRequest) {
            return { success: false, error: '화면 모드 변경 핸들러가 등록되지 않음' }
          }
          if (requestedMode !== 'three' && requestedMode !== 'five') {
            return { success: false, error: `유효하지 않은 mode: ${String(requestedMode)}` }
          }
          const result = await this.onScreenModeChangeRequest(requestedMode)
          return {
            success: result.success,
            data: {
              mode: result.mode,
              reason: result.reason,
              fallbackToThree: result.fallbackToThree,
              monitorCount: result.monitorCount,
            },
            error: result.success ? undefined : (result.reason || '화면 모드 변경 실패'),
          }
        }

        case 'get-screen-mode': {
          const mode = this.onGetScreenModeRequest ? this.onGetScreenModeRequest() : 'three'
          return { success: true, data: { mode } }
        }

        default:
          console.warn(`알 수 없는 명령: ${command}`)
          return { success: false, error: `알 수 없는 명령: ${command}` }
      }
    } catch (error) {
      console.error(`명령 실행 오류 (${command}):`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      }
    }
  }

  /**
   * 메시지 전송
   */
  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  /**
   * 핑 인터벌 시작
   */
  private startPingInterval(): void {
    this.stopPingInterval()
    
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping()
      }
    }, 25000) // 25초마다 핑
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  /**
   * 재연결 스케줄링
   */
  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('최대 재연결 시도 횟수 초과')
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(false, '최대 재연결 시도 횟수 초과')
      }
      return
    }

    // 지수 백오프: 1초, 2초, 4초, 8초, ... 최대 30초
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    this.reconnectAttempts++

    log(`🔄 ${delay / 1000}초 후 재연결 시도 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    this.reconnectTimeout = setTimeout(() => {
      this.connect()
    }, delay)
  }

  /**
   * 정리
   */
  private cleanup(): void {
    this.stopPingInterval()
    
    if (this.ws) {
      this.ws.removeAllListeners()
      this.ws = null
    }
  }

  /**
   * 연결 종료
   */
  disconnect(): void {
    this.shouldReconnect = false
    this.stopRegistrationPolling()
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.ws) {
      this.ws.close(1000, '정상 종료')
    }
    
    this.cleanup()
  }

  /**
   * 연결 상태 확인
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  /**
   * 등록 상태 확인
   */
  isRegistered(): boolean {
    return this.deviceManager.isRegistered()
  }

  /**
   * 등록 초기화 (테스트/디버그용)
   */
  resetRegistration(): void {
    this.disconnect()
    this.deviceManager.clearRegistration()
  }
}
