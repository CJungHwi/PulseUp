import * as http from 'http'
import * as https from 'https'
import * as url from 'url'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { IPCHandlers } from './ipc-handlers.js'
import { CertUtils } from './cert-utils.js'
import { fileLogger } from './file-logger.js'

export class ElectronHTTPServer {
  private server: https.Server | http.Server
  private port: number
  private ipcHandlers: IPCHandlers
  private useHttps: boolean = true

  constructor(ipcHandlers: IPCHandlers, port: number = 3002) {
    this.ipcHandlers = ipcHandlers
    this.port = port

    // HTTPS 인증서 설치를 건너뛰고 HTTP만 사용
    // 서버 중계 모드에서는 외부 연결이 WebSocket을 통해 이루어지므로 HTTPS 불필요
    // LINKHIIT_USE_HTTPS=1 로 설정하면 HTTPS 사용
    const forceHttps = process.env.LINKHIIT_USE_HTTPS === '1' || 
                       process.env.LINKHIIT_USE_HTTPS === 'true'
    
    if (forceHttps) {
      // HTTPS 모드에서만 인증서 생성
      CertUtils.ensureValidCertificate()
    } else {
      // 기본: HTTP만 사용 (인증서 설치 프롬프트 없음)
      this.useHttps = false
      console.log('ℹ️ HTTP 모드로 실행 (HTTPS 인증서 설치 건너뜀)')
    }

    this.server = this.createServer()
  }

  /**
   * SSL 인증서 로딩
   * cert 폴더에서 server.key와 server.crt를 읽어옴
   */
  private loadSSLCertificates(): https.ServerOptions | null {
    try {
      // 인증서는 항상 userData 기반 경로 사용 (쓰기 가능 + 자동 신뢰 등록과 동일 경로)
      const keyPath = CertUtils.getKeyPath()
      const certPath = CertUtils.getCertPath()

      if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
        console.warn('SSL 인증서가 없습니다. HTTP로 폭백합니다.')
        console.warn('인증서 생성: npm run generate-cert')
        return null
      }

      return {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      }
    } catch (error) {
      console.error('SSL 인증서 로딩 실패:', error)
      return null
    }
  }

  private applyRuntimeConfigFromHeaders(req: http.IncomingMessage) {
    const headerServerUrl = (req.headers['x-api-server-url'] as string | undefined) || (req.headers['x-api-server-url'.toLowerCase()] as string | undefined)
    const headerAuth = (req.headers['authorization'] as string | undefined) || (req.headers['x-auth-token'] as string | undefined)
    if (headerServerUrl || typeof headerAuth !== 'undefined') {
      this.ipcHandlers.applyRuntimeConfig({
        webAppUrl: headerServerUrl ? String(headerServerUrl) : undefined,
        authToken: typeof headerAuth === 'undefined' ? undefined : (headerAuth ? String(headerAuth) : null)
      })
    }
  }

  private createServer(): https.Server | http.Server {
    const requestHandler = async (req: http.IncomingMessage, res: http.ServerResponse) => {
      // Chrome Private Network Access(PNA):
      // - HTTPS origin에서 http://192.168.x.x 같은 사설 네트워크로 fetch하면
      //   preflight에 Access-Control-Request-Private-Network: true가 포함되고,
      //   서버가 Access-Control-Allow-Private-Network: true로 응답하지 않으면 차단된다.
      const wantsPrivateNetwork = String(req.headers['access-control-request-private-network'] || '').toLowerCase() === 'true'

      // CORS 헤더 설정
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Server-URL, X-Api-Server-Url, X-Auth-Token')
      res.setHeader('Electron-Version', process.versions.electron || 'unknown')
      res.setHeader('Electron-Port', String(this.port))
      if (wantsPrivateNetwork) {
        res.setHeader('Access-Control-Allow-Private-Network', 'true')
        // 프리플라이트 헤더 유무에 따라 응답이 달라질 수 있으므로 캐시 분리
        res.setHeader('Vary', 'Access-Control-Request-Private-Network')
      }

      // OPTIONS 요청 처리 (CORS preflight)
      if (req.method === 'OPTIONS') {
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Server-URL, X-Api-Server-Url, X-Auth-Token',
          ...(wantsPrivateNetwork ? { 'Access-Control-Allow-Private-Network': 'true', 'Vary': 'Access-Control-Request-Private-Network' } : {}),
          'Access-Control-Max-Age': '86400'
        })
        res.end()
        return
      }

      try {
        const parsedUrl = url.parse(req.url || '', true)
        const pathname = parsedUrl.pathname || '/'
        const method = req.method

        const isStaticAsset = /\.(js|css|html|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|map)$/i.test(pathname)
        if (!isStaticAsset) {
          console.log(`HTTP 요청: ${method} ${pathname}`)
        }

        // 라우팅
        if (pathname === '/ping' && method === 'GET') {
          await this.handlePing(req, res)
        } else if (pathname === '/info' && method === 'GET') {
          await this.handleInfo(req, res)
        } else if (pathname === '/config' && method === 'GET') {
          await this.handleGetConfig(req, res)
        } else if (pathname === '/config' && method === 'POST') {
          await this.handleSetConfig(req, res)
        } else if (pathname === '/start-workout' && method === 'POST') {
          await this.handleStartWorkout(req, res)
        } else if (pathname === '/stop-workout' && method === 'POST') {
          await this.handleStopWorkout(req, res)
        } else if (pathname === '/sync-playlist' && method === 'POST') {
          await this.handleSyncPlaylist(req, res)
        } else if (pathname === '/pause-workout' && method === 'POST') {
          await this.handlePauseWorkout(req, res)
        } else if (pathname === '/resume-workout' && method === 'POST') {
          await this.handleResumeWorkout(req, res)
        } else if (pathname === '/session-status' && method === 'GET') {
          await this.handleGetSessionStatus(req, res)
        } else if (pathname === '/heart-rate/status' && method === 'GET') {
          await this.handleHeartRateStatus(req, res)
        } else if (pathname === '/heart-rate' && method === 'POST') {
          await this.handleHeartRateData(req, res)
        } else if (pathname === '/create-monitors' && method === 'POST') {
          await this.handleCreateMonitors(req, res)
        } else if (pathname === '/start-workout-play' && method === 'POST') {
          await this.handleStartWorkoutPlay(req, res)
        } else if (pathname === '/play-start' && method === 'POST') {
          await this.handlePlayStart(req, res)
        } else if (pathname === '/play-intro' && method === 'POST') {
          await this.handlePlayIntro(req, res)
        } else if (pathname === '/play-pause' && method === 'POST') {
          await this.handlePlayPause(req, res)
        } else if (pathname === '/play-stop' && method === 'POST') {
          await this.handlePlayStop(req, res)
        } else if (pathname === '/toggle-fullscreen' && method === 'POST') {
          await this.handleToggleFullscreen(req, res)
        } else if (pathname === '/quit-app' && method === 'POST') {
          await this.handleQuitApp(req, res)
        } else if (pathname === '/play-next' && method === 'POST') {
          await this.handlePlayNext(req, res)
        } else if (pathname === '/play-previous' && method === 'POST') {
          await this.handlePlayPrevious(req, res)
        } else {
          // 정적 파일 제공 (HTML, JS, CSS 등)
          await this.serveStaticFile(pathname, res)
        }
      } catch (error) {
        console.error('HTTP 요청 처리 오류:', error)
        this.sendResponse(res, 500, {
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : '알 수 없는 오류'
        })
      }
    }

    // useHttps가 이미 false로 설정되어 있으면 HTTP 서버만 사용
    if (!this.useHttps) {
      console.log('HTTP 서버로 시작합니다.')
      return http.createServer(requestHandler)
    }

    // SSL 인증서 로딩 시도
    const sslOptions = this.loadSSLCertificates()
    if (sslOptions) {
      console.log('HTTPS 서버로 시작합니다.')
      return https.createServer(sslOptions, requestHandler)
    } else {
      this.useHttps = false
      console.log('HTTP 서버로 시작합니다 (SSL 인증서 없음).')
      return http.createServer(requestHandler)
    }
  }

  private async handlePing(req: http.IncomingMessage, res: http.ServerResponse) {
    this.sendResponse(res, 200, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      electronVersion: process.versions.electron,
      port: this.port
    })
  }

  private async handleInfo(_req: http.IncomingMessage, res: http.ServerResponse) {
    const runtime = this.ipcHandlers.getRuntimeInfo()
    this.sendResponse(res, 200, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      port: this.port,
      host: os.hostname(),
      versions: {
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node
      },
      network: this.getNetworkAddresses(),
      runtime
    })
  }

  private getNetworkAddresses() {
    try {
      const nets = os.networkInterfaces()
      const addresses: Array<{ name: string; address: string; family: string }> = []
      Object.entries(nets).forEach(([name, items]) => {
        ; (items || []).forEach((itRaw) => {
          if (!itRaw) return
          const it = itRaw as unknown as { address: string; family: string | number; internal?: boolean }
          const family = typeof it.family === 'string' ? it.family : String(it.family)
          if (it.internal) return
          // iPad에서 접속할 IPv4를 우선 노출
          if (family === 'IPv4') addresses.push({ name, address: it.address, family })
        })
      })
      return { addresses }
    } catch {
      return { addresses: [] }
    }
  }

  private async handleGetConfig(_req: http.IncomingMessage, res: http.ServerResponse) {
    this.sendResponse(res, 200, { success: true, config: this.ipcHandlers.getRuntimeInfo() })
  }

  private async handleSetConfig(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      const body = await this.parseRequestBody(req)
      const headerServerUrl = (req.headers['x-api-server-url'] || req.headers['x-api-server-url'.toLowerCase()]) as string | undefined
      const headerAuth = (req.headers['authorization'] as string | undefined) || (req.headers['x-auth-token'] as string | undefined)

      // 우선순위:
      // - headerServerUrl: 웹앱이 계산한 "Electron이 접근 가능한 API 서버 루트" (운영에서는 linkhiit 도메인으로 치환됨)
      // - body.webAppUrl/apiServerUrl: 구형 클라이언트 호환
      // NOTE: 운영 웹앱에서 body.webAppUrl이 127.0.0.1로 잘못 내려오는 경우가 있어 header를 최우선으로 한다.
      const webAppUrl = headerServerUrl || body.webAppUrl || body.apiServerUrl
      const authToken = typeof body.authToken !== 'undefined' ? body.authToken : headerAuth
      const displayLabel = body.displayLabel

      this.ipcHandlers.applyRuntimeConfig({
        webAppUrl: webAppUrl ? String(webAppUrl) : undefined,
        authToken: typeof authToken === 'undefined' ? undefined : (authToken ? String(authToken) : null),
        displayLabel: displayLabel ? String(displayLabel) : undefined
      })

      // displayLabel이 제공되면 모든 renderer에 브로드캐스트
      if (displayLabel) {
        this.ipcHandlers['broadcastToAllWindows']('config-updated', {
          displayLabel
        })
      }

      this.sendResponse(res, 200, { success: true, config: this.ipcHandlers.getRuntimeInfo() })
    } catch (error) {
      this.sendResponse(res, 400, { success: false, error: error instanceof Error ? error.message : 'Invalid config' })
    }
  }

  private async handleStartWorkout(req: http.IncomingMessage, res: http.ServerResponse) {
    const body = await this.parseRequestBody(req)

    // 호환 처리:
    // - legacy: { playlistId, userId }
    // - web-app electronService(구형): { sessionId, playlistId } 형태로 보내는 케이스가 있어 userId를 선택값으로 처리
    if (!body.playlistId) {
      this.sendResponse(res, 400, { error: 'playlistId가 필요합니다' })
      return
    }

    const normalizedUserId =
      body.userId ??
      body.user_id ??
      body.user?.id ??
      body.sessionId ??
      'unknown'

    // IPC 핸들러를 통해 운동 시작 처리
    const result = await this.ipcHandlers.handleWebStartWorkout({
      playlistId: body.playlistId,
      userId: String(normalizedUserId)
    })

    if (result.success) {
      this.sendResponse(res, 200, result)
    } else {
      this.sendResponse(res, 400, result)
    }
  }

  private async handleStopWorkout(req: http.IncomingMessage, res: http.ServerResponse) {
    const body = await this.parseRequestBody(req)

    // 호환 처리:
    // - legacy: { sessionId }
    // - web-app electronService(구형): body 없이 호출하는 케이스가 있어, 활성 세션이 있으면 그 세션을 종료
    const activeSession = this.ipcHandlers.getActiveSession()
    const sessionId = body.sessionId ?? activeSession?.id
    if (!sessionId) {
      this.sendResponse(res, 400, { error: 'sessionId가 필요합니다' })
      return
    }

    // IPC 핸들러를 통해 운동 종료 처리
    const result = await this.ipcHandlers.handleWebStopWorkout({
      sessionId: String(sessionId),
      caloriesBurned: body.caloriesBurned
    })

    if (result.success) {
      this.sendResponse(res, 200, result)
    } else {
      this.sendResponse(res, 400, result)
    }
  }

  private async handleSyncPlaylist(req: http.IncomingMessage, res: http.ServerResponse) {
    const body = await this.parseRequestBody(req)

    if (!body.id || !body.name) {
      this.sendResponse(res, 400, { error: '플레이리스트 데이터가 올바르지 않습니다' })
      return
    }

    // IPC 핸들러를 통해 플레이리스트 동기화 처리
    const result = await this.ipcHandlers.handleSyncPlaylist(body)

    if (result.success) {
      this.sendResponse(res, 200, result)
    } else {
      this.sendResponse(res, 400, result)
    }
  }

  private async handlePauseWorkout(req: http.IncomingMessage, res: http.ServerResponse) {
    const body = await this.parseRequestBody(req)

    if (!body.sessionId) {
      this.sendResponse(res, 400, { error: 'sessionId가 필요합니다' })
      return
    }

    const result = await this.ipcHandlers.handlePauseWorkout(body.sessionId)

    if (result.success) {
      this.sendResponse(res, 200, result)
    } else {
      this.sendResponse(res, 400, result)
    }
  }

  private async handleResumeWorkout(req: http.IncomingMessage, res: http.ServerResponse) {
    const body = await this.parseRequestBody(req)

    if (!body.sessionId) {
      this.sendResponse(res, 400, { error: 'sessionId가 필요합니다' })
      return
    }

    const result = await this.ipcHandlers.handleResumeWorkout(body.sessionId)

    if (result.success) {
      this.sendResponse(res, 200, result)
    } else {
      this.sendResponse(res, 400, result)
    }
  }

  private async handleGetSessionStatus(req: http.IncomingMessage, res: http.ServerResponse) {
    const status = await this.ipcHandlers.handleGetSessionStatus()
    this.sendResponse(res, 200, status)
  }

  private async handleHeartRateData(req: http.IncomingMessage, res: http.ServerResponse) {
    const body = await this.parseRequestBody(req)

    if (!body.heartRate || !body.timestamp) {
      this.sendResponse(res, 400, { error: 'heartRate와 timestamp가 필요합니다' })
      return
    }

    try {
      // 심박수 데이터를 Date 객체로 변환 (deviceId, deviceName 포함)
      const heartRateData = {
        deviceId: body.deviceId,
        deviceName: body.deviceName,
        heartRate: body.heartRate,
        timestamp: new Date(body.timestamp),
        zone: body.zone
      }

      // 메모리 누수 방지: activeSession에 직접 저장하지 않음
      // (이미 웹 API로 전송되어 DB에 저장되므로 중복 저장 불필요)
      // const activeSession = this.ipcHandlers.getActiveSession()
      // if (activeSession) {
      //   activeSession.heartRateData.push(heartRateData)
      // }

      // 모든 창에 실시간 심박수 데이터 브로드캐스트 (UI 표시용)
      this.ipcHandlers['broadcastToAllWindows']('heart-rate-updated', heartRateData)

      this.sendResponse(res, 200, { success: true, message: '심박수 데이터가 처리되었습니다' })
    } catch (error) {
      console.error('심박수 데이터 처리 오류:', error)
      this.sendResponse(res, 500, {
        success: false,
        error: '심박수 데이터 처리 중 오류가 발생했습니다',
        message: error instanceof Error ? error.message : '알 수 없는 오류'
      })
    }
  }

  private async handleHeartRateStatus(_req: http.IncomingMessage, res: http.ServerResponse) {
    this.sendResponse(res, 200, {
      success: true,
      diagnostics: this.ipcHandlers.getHeartRateDiagnostics()
    })
  }

  private async handleCreateMonitors(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      console.log('📡 HTTP 서버: /create-monitors 요청 받음')

      // IPC 핸들러를 통해 모니터 생성 처리
      const result = await this.ipcHandlers.handleCreateMonitors()

      console.log('📡 HTTP 서버: 모니터 생성 결과:', result)

      if (result.success) {
        this.sendResponse(res, 200, result)
      } else {
        this.sendResponse(res, 400, result)
      }
    } catch (error) {
      console.error('❌ HTTP 서버: 모니터 생성 처리 오류:', error)
      this.sendResponse(res, 500, {
        success: false,
        error: '모니터 생성 중 오류가 발생했습니다',
        message: error instanceof Error ? error.message : '알 수 없는 오류'
      })
    }
  }

  private async handleStartWorkoutPlay(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      console.log('📡 HTTP 서버: /start-workout-play 요청 받음')

      const body = await this.parseRequestBody(req)

      // 런타임 설정 주입(배포 환경에서 필수)
      this.applyRuntimeConfigFromHeaders(req)

      const masterId = body.masterId ? String(body.masterId) : ''
      const userId = body.userId !== null && typeof body.userId !== 'undefined' ? String(body.userId) : ''
      const sequences = body.sequences

      if (!masterId) {
        this.sendResponse(res, 400, { success: false, error: 'masterId가 필요합니다' })
        return
      }

      if (!Array.isArray(sequences)) {
        this.sendResponse(res, 400, {
          success: false,
          error: 'sequences는 배열이어야 합니다'
        })
        return
      }

      // remote-control은 준비 단계에서 빈 sequences를 허용
      const isRemoteControl = masterId === 'remote-control'
      if (!isRemoteControl && (!userId || sequences.length === 0)) {
        this.sendResponse(res, 400, { success: false, error: 'userId와 sequences가 필요합니다' })
        return
      }

      if (sequences.length > 20000) {
        this.sendResponse(res, 413, { success: false, error: 'sequences가 너무 큽니다' })
        return
      }

      console.log('📡 운동 플레이 데이터:', {
        masterId,
        userId,
        sequenceCount: sequences.length,
        metadata: body.metadata
      })

      fileLogger.beginWorkoutLogSession({ masterId, userId })

      // IPC 핸들러를 통해 운동 플레이 처리
      const result = await this.ipcHandlers.handleWorkoutPlay({
        ...body,
        masterId,
        userId,
        sequences
      })

      console.log('📡 HTTP 서버: 운동 플레이 시작 결과:', result)

      if (result.success) {
        this.sendResponse(res, 200, result)
      } else {
        this.sendResponse(res, 400, result)
      }
    } catch (error) {
      console.error('❌ HTTP 서버: 운동 플레이 처리 오류:', error)
      this.sendResponse(res, 500, {
        success: false,
        error: '운동 플레이 시작 중 오류가 발생했습니다',
        message: error instanceof Error ? error.message : '알 수 없는 오류'
      })
    }
  }

  private async handlePlayStart(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      console.log('📡 HTTP 서버: /play-start 요청 받음')

      // 기존 세션 재시작 케이스에서는 /config 없이 /play-start만 호출될 수 있으므로
      // 모든 요청에서 헤더 기반 런타임 설정을 주입한다.
      this.applyRuntimeConfigFromHeaders(req)

      // IPC 핸들러를 통해 운동 시작 처리 (대기 -> 진행)
      const result = await this.ipcHandlers.handlePlayStart()

      console.log('📡 HTTP 서버: 운동 시작 결과:', result)

      if (result.success) {
        this.sendResponse(res, 200, result)
      } else {
        this.sendResponse(res, 400, result)
      }
    } catch (error) {
      console.error('❌ HTTP 서버: 운동 시작 처리 오류:', error)
      this.sendResponse(res, 500, {
        success: false,
        error: '운동 시작 중 오류가 발생했습니다',
        message: error instanceof Error ? error.message : '알 수 없는 오류'
      })
    }
  }

  private async handlePlayIntro(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      console.log('📡 HTTP 서버: /play-intro 요청 받음')
      this.applyRuntimeConfigFromHeaders(req)

      // IPC 핸들러를 통해 인트로 시작 처리
      const result = await this.ipcHandlers.handlePlayIntro()

      console.log('📡 HTTP 서버: 인트로 시작 결과:', result)

      if (result.success) {
        this.sendResponse(res, 200, result)
      } else {
        this.sendResponse(res, 400, result)
      }
    } catch (error) {
      console.error('❌ HTTP 서버: 인트로 시작 처리 오류:', error)
      this.sendResponse(res, 500, {
        success: false,
        error: '인트로 시작 중 오류가 발생했습니다',
        message: error instanceof Error ? error.message : '알 수 없는 오류'
      })
    }
  }

  private async handlePlayPause(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      console.log('📡 HTTP 서버: /play-pause 요청 받음')

      this.applyRuntimeConfigFromHeaders(req)

      // IPC 핸들러를 통해 일시정지/재개 처리
      const result = await this.ipcHandlers.handlePlayPauseToggle()

      console.log('📡 HTTP 서버: 일시정지/재개 결과:', result)

      if (result.success) {
        this.sendResponse(res, 200, result)
      } else {
        this.sendResponse(res, 400, result)
      }
    } catch (error) {
      console.error('❌ HTTP 서버: 일시정지/재개 처리 오류:', error)
      this.sendResponse(res, 500, {
        success: false,
        error: '일시정지/재개 중 오류가 발생했습니다',
        message: error instanceof Error ? error.message : '알 수 없는 오류'
      })
    }
  }

  private async handlePlayStop(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      console.log('📡 HTTP 서버: /play-stop 요청 받음')

      this.applyRuntimeConfigFromHeaders(req)

      // IPC 핸들러를 통해 운동 종료 처리
      const result = await this.ipcHandlers.handlePlayStop()

      console.log('📡 HTTP 서버: 운동 종료 결과:', result)

      if (result.success) {
        this.sendResponse(res, 200, result)
      } else {
        this.sendResponse(res, 400, result)
      }
    } catch (error) {
      console.error('❌ HTTP 서버: 운동 종료 처리 오류:', error)
      this.sendResponse(res, 500, {
        success: false,
        error: '운동 종료 중 오류가 발생했습니다',
        message: error instanceof Error ? error.message : '알 수 없는 오류'
      })
    }
  }

  private async handleToggleFullscreen(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      console.log('📡 HTTP 서버: /toggle-fullscreen 요청 받음')

      this.applyRuntimeConfigFromHeaders(req)

      // IPC 핸들러를 통해 전체화면 토글 처리
      const result = await this.ipcHandlers.handleToggleFullscreen()

      console.log('📡 HTTP 서버: 전체화면 토글 결과:', result)

      if (result.success) {
        this.sendResponse(res, 200, result)
      } else {
        this.sendResponse(res, 400, result)
      }
    } catch (error) {
      console.error('❌ HTTP 서버: 전체화면 토글 처리 오류:', error)
      this.sendResponse(res, 500, {
        success: false,
        error: '전체화면 토글 중 오류가 발생했습니다',
        message: error instanceof Error ? error.message : '알 수 없는 오류'
      })
    }
  }

  private async handleQuitApp(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      console.log('📡 HTTP 서버: /quit-app 요청 받음')

      this.applyRuntimeConfigFromHeaders(req)

      // 먼저 응답을 보낸 후 앱 종료
      this.sendResponse(res, 200, {
        success: true,
        message: '앱을 종료합니다.'
      })

      // 1초 후 앱 종료 (응답이 전송될 시간 확보)
      setTimeout(() => {
        console.log('📡 HTTP 서버: 앱 종료 실행')
        this.ipcHandlers.handleQuitApp()
      }, 1000)

    } catch (error) {
      console.error('❌ HTTP 서버: 앱 종료 처리 오류:', error)
      this.sendResponse(res, 500, {
        success: false,
        error: '앱 종료 중 오류가 발생했습니다',
        message: error instanceof Error ? error.message : '알 수 없는 오류'
      })
    }
  }

  private async handlePlayNext(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      console.log('📡 HTTP 서버: /play-next 요청 받음')

      this.applyRuntimeConfigFromHeaders(req)

      // IPC 핸들러를 통해 다음 운동 단위로 이동
      const result = await this.ipcHandlers.handlePlayNext()

      console.log('📡 HTTP 서버: 다음 운동 이동 결과:', result)

      if (result.success) {
        this.sendResponse(res, 200, result)
      } else {
        this.sendResponse(res, 400, result)
      }
    } catch (error) {
      console.error('❌ HTTP 서버: 다음 운동 이동 처리 오류:', error)
      this.sendResponse(res, 500, {
        success: false,
        error: '다음 운동 이동 중 오류가 발생했습니다',
        message: error instanceof Error ? error.message : '알 수 없는 오류'
      })
    }
  }

  private async handlePlayPrevious(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      console.log('📡 HTTP 서버: /play-previous 요청 받음')

      this.applyRuntimeConfigFromHeaders(req)

      // IPC 핸들러를 통해 이전 운동 단위로 이동
      const result = await this.ipcHandlers.handlePlayPrevious()

      console.log('📡 HTTP 서버: 이전 운동 이동 결과:', result)

      if (result.success) {
        this.sendResponse(res, 200, result)
      } else {
        this.sendResponse(res, 400, result)
      }
    } catch (error) {
      console.error('❌ HTTP 서버: 이전 운동 이동 처리 오류:', error)
      this.sendResponse(res, 500, {
        success: false,
        error: '이전 운동 이동 중 오류가 발생했습니다',
        message: error instanceof Error ? error.message : '알 수 없는 오류'
      })
    }
  }

  // 정적 파일 제공
  private async serveStaticFile(pathname: string, res: http.ServerResponse) {
    try {
      // 루트 경로는 index.html로 리다이렉트
      if (pathname === '/' || pathname === '') {
        pathname = '/index.html'
      }

      // 파일 경로 결정
      const filePath = path.join(__dirname, '../../renderer', pathname)

      // 파일 존재 확인
      if (!fs.existsSync(filePath)) {
        this.sendResponse(res, 404, { error: 'File not found', path: pathname })
        return
      }

      // MIME 타입 결정
      const ext = path.extname(filePath).toLowerCase()
      const mimeTypes: { [key: string]: string } = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.eot': 'application/vnd.ms-fontobject'
      }
      const contentType = mimeTypes[ext] || 'application/octet-stream'

      // 파일 읽기 및 전송
      const content = fs.readFileSync(filePath)
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      })
      res.end(content)
    } catch (error) {
      console.error('정적 파일 제공 오류:', error)
      this.sendResponse(res, 500, {
        error: '파일 읽기 오류',
        message: error instanceof Error ? error.message : '알 수 없는 오류'
      })
    }
  }

  private async parseRequestBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = ''
      const maxBytes = 2 * 1024 * 1024 // 2MB

      req.on('data', chunk => {
        body += chunk.toString()
        if (Buffer.byteLength(body, 'utf-8') > maxBytes) {
          try { req.destroy() } catch { }
          reject(new Error('Payload Too Large'))
        }
      })

      req.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {}
          resolve(parsed)
        } catch (error) {
          reject(new Error('Invalid JSON'))
        }
      })

      req.on('error', reject)
    })
  }

  private sendResponse(res: http.ServerResponse, statusCode: number, data: any) {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Server-URL, X-Api-Server-Url, X-Auth-Token',
      'Electron-Version': process.versions.electron || 'unknown',
      'Electron-Port': String(this.port)
    })
    res.end(JSON.stringify(data))
  }

  // 서버 시작
  start(): Promise<void> {
    // 운영 안정성을 위해 고정 포트(기본 3002)만 사용:
    // - 이미 같은 Electron 서버가 떠 있으면 재사용
    // - 다른 프로세스가 점유 중이면 명확히 실패(웹/리모컨이 3002를 고정으로 쓰는 경우가 많음)
    const fixedPort = this.port
    return new Promise((resolve, reject) => {
      const cleanup = (onError: any, onListening: any) => {
        try { this.server.off('error', onError) } catch { }
        try { this.server.off('listening', onListening) } catch { }
      }

      const pingExisting = () => {
        try {
          // HTTPS 또는 HTTP로 기존 서버 ping
          const protocol = this.useHttps ? https : http
          const options = {
            host: 'localhost',
            port: fixedPort,
            path: '/ping',
            method: 'GET',
            timeout: 1500,
            rejectUnauthorized: false // self-signed 인증서 허용
          }
          const reqPing = protocol.request(options, (resp) => {
            if (resp.statusCode === 200) {
              console.log(`포트 ${fixedPort}에서 기존 Electron 서버가 감지되었습니다. 기존 인스턴스를 사용합니다.`)
              resolve()
            } else {
              reject(new Error(`포트 ${fixedPort}가 사용 중입니다 (Electron 서버 아님)`))
            }
          })
          reqPing.on('error', () => reject(new Error(`포트 ${fixedPort}가 사용 중입니다 (ping 실패)`)))
          reqPing.on('timeout', () => { try { reqPing.destroy() } catch { }; reject(new Error(`포트 ${fixedPort} ping timeout`)) })
          reqPing.end()
        } catch (e) {
          reject(e)
        }
      }

      // 새 서버 인스턴스로 갱신
      this.server = this.createServer()

      const onError = (error: any) => {
        console.error('HTTP 서버 오류:', error)
        cleanup(onError, onListening)
        if (error && (error.code === 'EADDRINUSE' || String(error.message || '').includes('EADDRINUSE'))) {
          pingExisting()
        } else {
          reject(error)
        }
      }

      const onListening = () => {
        const protocol = this.useHttps ? 'HTTPS' : 'HTTP'
        console.log(`Electron ${protocol} 서버가 포트 ${fixedPort}에서 시작되었습니다`)
        cleanup(onError, onListening)
        resolve()
      }

      this.server.on('error', onError)
      this.server.on('listening', onListening)
      this.port = fixedPort
      // 0.0.0.0으로 바인딩하여 외부 네트워크 접속 허용
      this.server.listen(this.port, '0.0.0.0')
    })
  }

  // 서버 중지
  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log('Electron HTTP 서버가 중지되었습니다')
        resolve()
      })
    })
  }

  // 포트 번호 가져오기
  getPort(): number {
    return this.port
  }

  // HTTPS 사용 여부 확인
  isHttps(): boolean {
    return this.useHttps
  }
}