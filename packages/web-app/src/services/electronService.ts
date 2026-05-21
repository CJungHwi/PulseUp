// Electron 앱과의 통신을 위한 서비스

export interface ElectronWorkoutSession {
  id: string
  playlistId: string
  playlistName: string
  startTime: Date
  endTime?: Date
  duration: number
  heartRateData: HeartRateReading[]
  caloriesBurned?: number
  averageHeartRate?: number
  maxHeartRate?: number
  status: 'active' | 'completed' | 'cancelled'
}

export interface HeartRateReading {
  timestamp: Date
  heartRate: number
  zone?: string
}

export interface ElectronConnectionStatus {
  connected: boolean
  lastPing?: Date
  electronVersion?: string
}

class ElectronService {
  private connectionStatus: ElectronConnectionStatus = { connected: false }
  private electronPort = 3002 // Electron IPC 서버 포트 (동적 변경될 수 있음)
  private pingInterval: NodeJS.Timeout | null = null
  private useHttps = true // HTTPS 사용 여부

  constructor() {
    this.startConnectionMonitoring()
  }

  /**
   * 호스트에 따라 프로토콜 결정
   * localhost/127.0.0.1은 HTTP도 허용, 외부 IP는 HTTPS 필수
   */
  private getProtocol(host: string = 'localhost'): string {
    // checkConnection에서 설정된 useHttps 플래그 사용
    return this.useHttps ? 'https' : 'http'
  }

  // Electron 앱 연결 상태 모니터링 시작
  private startConnectionMonitoring() {
    // ping 기능 비활성화 (개발 중 429 에러 방지)
    // this.pingInterval = setInterval(async () => {
    //   await this.checkConnection()
    // }, 5000) // 5초마다 연결 상태 확인

    // // 초기 연결 확인
    // this.checkConnection()
  }

  // Electron 앱 연결 상태 확인
  async checkConnection(): Promise<boolean> {
    // 3002~3005 포트 스캔하여 최초 응답 포트를 채택
    const candidatePorts = [this.electronPort, 3003, 3004, 3005]

    const tryPing = async (port: number): Promise<Response | null> => {
      // HTTPS 먼저 시도, 실패 시 HTTP 시도 (localhost만)
      const protocols = this.useHttps ? ['https', 'http'] : ['http']

      for (const protocol of protocols) {
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 2500)
          const resp = await fetch(`${protocol}://localhost:${port}/ping`, {
            method: 'GET',
            signal: controller.signal
          } as any)
          clearTimeout(timeout)
          if (resp.ok) {
            // 성공한 프로토콜 기억
            this.useHttps = protocol === 'https'
            return resp
          }
        } catch {
          continue
        }
      }
      return null
    }

    for (const port of candidatePorts) {
      const response = await tryPing(port)
      if (response && response.ok) {
        this.electronPort = port
        this.connectionStatus = {
          connected: true,
          lastPing: new Date(),
          electronVersion: response.headers.get('electron-version') || undefined
        }
        return true
      }
    }

    this.connectionStatus = { connected: false, lastPing: new Date() }
    return false
  }

  // 운동 세션 시작 요청
  async startWorkout(data: { sessionId: string; playlistId: string }): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.connectionStatus.connected) {
        console.warn('Electron 앱이 연결되지 않음 - 웹에서만 운동 진행')
        return { success: true }
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      try {
        const response = await fetch(`${this.getProtocol()}://localhost:${this.electronPort}/start-workout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data),
          signal: controller.signal
        } as any)

        clearTimeout(timeout)

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || '운동 시작 요청 실패')
        }

        console.log('운동 시작 요청 성공:', result)
        return result
      } catch (fetchError) {
        clearTimeout(timeout)
        throw fetchError
      }
    } catch (error) {
      console.error('운동 시작 요청 실패:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      }
    }
  }

  // 운동 세션 종료 요청
  async stopWorkout(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.connectionStatus.connected) {
        console.warn('Electron 앱이 연결되지 않음 - 웹에서만 운동 종료')
        return { success: true }
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      try {
        const response = await fetch(`${this.getProtocol()}://localhost:${this.electronPort}/stop-workout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        } as any)

        clearTimeout(timeout)

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || '운동 종료 요청 실패')
        }

        console.log('운동 종료 요청 성공:', result)
        return result
      } catch (fetchError) {
        clearTimeout(timeout)
        throw fetchError
      }
    } catch (error) {
      console.error('운동 종료 요청 실패:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      }
    }
  }

  // 플레이리스트 동기화
  async syncPlaylist(playlistData: any): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.connectionStatus.connected) {
        throw new Error('Electron 앱이 연결되지 않았습니다')
      }

      const response = await fetch(`${this.getProtocol()}://localhost:${this.electronPort}/sync-playlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(playlistData)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '플레이리스트 동기화 실패')
      }

      console.log('플레이리스트 동기화 성공:', result)
      return result
    } catch (error) {
      console.error('플레이리스트 동기화 실패:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      }
    }
  }

  // 운동 일시정지
  async pauseWorkout(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.connectionStatus.connected) {
        throw new Error('Electron 앱이 연결되지 않았습니다')
      }

      const response = await fetch(`${this.getProtocol()}://localhost:${this.electronPort}/pause-workout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId })
      })

      const result = await response.json()
      return result
    } catch (error) {
      console.error('운동 일시정지 실패:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      }
    }
  }

  // 운동 재개
  async resumeWorkout(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.connectionStatus.connected) {
        throw new Error('Electron 앱이 연결되지 않았습니다')
      }

      const response = await fetch(`${this.getProtocol()}://localhost:${this.electronPort}/resume-workout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId })
      })

      const result = await response.json()
      return result
    } catch (error) {
      console.error('운동 재개 실패:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      }
    }
  }

  // 현재 세션 상태 조회
  async getSessionStatus(): Promise<{ hasActiveSession: boolean; session?: ElectronWorkoutSession; heartRateCount?: number }> {
    try {
      if (!this.connectionStatus.connected) {
        return { hasActiveSession: false }
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      try {
        const response = await fetch(`${this.getProtocol()}://localhost:${this.electronPort}/session-status`, {
          signal: controller.signal
        } as any)
        
        clearTimeout(timeout)
        
        const result = await response.json()
        return result
      } catch (fetchError) {
        clearTimeout(timeout)
        throw fetchError
      }
    } catch (error) {
      console.error('세션 상태 조회 실패:', error)
      return { hasActiveSession: false }
    }
  }

  // 심박수 데이터 전송
  async sendHeartRateData(heartRateData: HeartRateReading): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.connectionStatus.connected) {
        // Electron 앱이 연결되지 않은 경우 로컬에만 저장
        console.warn('Electron 앱이 연결되지 않음 - 심박수 데이터를 로컬에만 저장')
        return { success: true }
      }

      // 타임아웃 설정 (5초)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      try {
        const response = await fetch(`${this.getProtocol()}://localhost:${this.electronPort}/heart-rate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            heartRate: heartRateData.heartRate,
            timestamp: heartRateData.timestamp.toISOString(),
            zone: heartRateData.zone
          }),
          signal: controller.signal
        } as any)

        clearTimeout(timeout)

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || '심박수 데이터 전송 실패')
        }

        return result
      } catch (fetchError) {
        clearTimeout(timeout)
        throw fetchError
      }
    } catch (error) {
      console.error('심박수 데이터 전송 실패:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      }
    }
  }

  // 배치로 심박수 데이터 전송
  async sendHeartRateDataBatch(heartRateDataList: HeartRateReading[]): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.connectionStatus.connected) {
        console.warn('Electron 앱이 연결되지 않음 - 심박수 데이터 배치를 로컬에만 저장')
        return { success: true }
      }

      // 각 데이터를 개별적으로 전송 (또는 배치 엔드포인트가 있다면 사용)
      const results = await Promise.allSettled(
        heartRateDataList.map(data => this.sendHeartRateData(data))
      )

      const failedCount = results.filter(result => result.status === 'rejected').length

      if (failedCount > 0) {
        console.warn(`심박수 데이터 배치 전송 중 ${failedCount}개 실패`)
      }

      return {
        success: failedCount === 0,
        error: failedCount > 0 ? `${failedCount}개 데이터 전송 실패` : undefined
      }
    } catch (error) {
      console.error('심박수 데이터 배치 전송 실패:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      }
    }
  }

  // 모니터 3개 생성
  async createMonitors(): Promise<{ success: boolean; error?: string; message?: string; windowCount?: number }> {
    try {
      if (!this.connectionStatus.connected) {
        throw new Error(`
❌ Electron 앱이 실행되지 않았습니다.

🔧 해결 방법:
1. 새 터미널 창을 열어주세요
2. 다음 명령을 실행해주세요:
   cd packages/electron-app
   npm run electron:dev
3. Electron 창들이 나타나면 다시 버튼을 클릭해주세요

💡 실제 배포 시에는 각 체육관 PC에 Electron 앱이 설치되어
   웹에서 버튼 클릭 시 자동으로 실행됩니다.
        `)
      }

      const response = await fetch(`${this.getProtocol()}://localhost:${this.electronPort}/create-monitors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '모니터 생성 요청 실패')
      }

      console.log('모니터 생성 요청 성공:', result)
      return result
    } catch (error) {
      console.error('모니터 생성 요청 실패:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      }
    }
  }

  // Electron 앱 실행 (시스템 명령)
  async launchElectronApp(): Promise<{ success: boolean; error?: string }> {
    try {
      // 웹에서 직접 Electron 앱을 실행할 수는 없으므로
      // 사용자에게 수동 실행을 안내하거나 다른 방법을 사용해야 함
      console.log('Electron 앱 실행 요청 - 사용자가 수동으로 실행해야 합니다')

      return {
        success: false,
        error: 'Electron 앱을 수동으로 실행해주세요'
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      }
    }
  }

  // 연결 상태 가져오기
  getConnectionStatus(): ElectronConnectionStatus {
    return { ...this.connectionStatus }
  }

  // 연결 상태 변경 이벤트 리스너
  onConnectionChange(callback: (status: ElectronConnectionStatus) => void) {
    // 실제 구현에서는 EventEmitter 패턴을 사용할 수 있음
    const checkAndNotify = () => {
      callback(this.connectionStatus)
    }

    // 주기적으로 상태 변경 확인
    setInterval(checkAndNotify, 1000)
  }

  // 서비스 정리
  destroy() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }
}

// 싱글톤 인스턴스
export const electronService = new ElectronService()

// 기본 내보내기
export default electronService