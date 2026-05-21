import './load-local-env.js'
import { app, BrowserWindow, screen, ipcMain, Menu } from 'electron'
import * as path from 'path'
import { fileLogger } from './file-logger.js'

fileLogger.initialize()
import { IPCHandlers } from './ipc-handlers.js'
import { ElectronHTTPServer } from './http-server.js'
import { HeartRateANTManager } from './heart-rate-modules/index.js'
import { DeviceManager } from './device-manager.js'
import { WebSocketRelay } from './ws-relay.js'
import { getScreenMode, setScreenMode, type ScreenMode } from './screen-mode-store.js'
import {
  buildWindowPlan,
  urlForWindowType,
  type WindowPlan,
  type WindowPlanItem,
  type WindowType,
} from './window-layout.js'

// __dirname은 CommonJS에서 자동으로 제공됩니다

const DEBUG = false
const log = (...args: any[]) => {
  if (DEBUG) console.log(...args)
}

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false
  return ['1', 'true', 'yes', 'y', 'on'].includes(value.trim().toLowerCase())
}

function isBluetoothDeviceBlacklisted(deviceName: string | undefined | null): boolean {
  const name = (deviceName || '').trim()
  if (!name) return false

  // 기본 블랙리스트: Garmin USB Stick 계열이 BLE 선택 목록에 끼어들어 자동선택/로그에 등장하는 문제 방지
  const defaultBlacklist = ['GarminStick', 'Garmin Stick', 'Garmin ANT', 'ANTUSB']
  const extra = (process.env.LINKHIIT_BLE_DEVICE_NAME_BLACKLIST || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  const blacklist = [...defaultBlacklist, ...extra]
  return blacklist.some(b => name.includes(b))
}

interface MonitorWindow {
  id: number
  window: BrowserWindow
  display: Electron.Display
  type: WindowType
}

class MultiMonitorWorkoutApp {
  private windows: MonitorWindow[] = []
  private isSimulatedFullscreen = true
  private ipcHandlers: IPCHandlers
  private httpServer: ElectronHTTPServer
  private antManager?: HeartRateANTManager
  private deviceManager: DeviceManager
  private wsRelay: WebSocketRelay
  private registerCode: string | null = null
  private registerCodeExpiresAt: number | null = null
  private screenMode: ScreenMode = 'three'
  // 5-screen ↔ 3-screen 모드 전환 중에는 잠시 모든 창이 닫힐 수 있다.
  // 이 동안 'window-all-closed' 가 트리거되어 app.quit() 되는 것을 차단하기 위한 플래그.
  private isScreenModeChanging = false

  constructor() {
    this.ipcHandlers = new IPCHandlers()
    this.httpServer = new ElectronHTTPServer(this.ipcHandlers, 3002) // 포트 3002 사용
    this.screenMode = getScreenMode()
    
    // 디바이스 매니저 및 WebSocket Relay 초기화
    this.deviceManager = new DeviceManager()
    this.wsRelay = new WebSocketRelay(this.deviceManager, this.ipcHandlers)
    
    // ANT+가 필요 없는 환경에서 불필요한 동글 스캔/로그(예: GarminStick3)를 방지하기 위해 비활성화 옵션 제공
    if (!isTruthyEnv(process.env.LINKHIIT_DISABLE_ANT)) {
      this.antManager = new HeartRateANTManager()
    } else {
      log('ℹ️ LINKHIIT_DISABLE_ANT=1 설정으로 ANT+ 기능이 비활성화되었습니다')
    }
    this.ipcHandlers.setHeartRateAntDiagnosticsProvider(() => {
      if (this.antManager) return this.antManager.getDiagnostics()
      return {
        state: 'disabled',
        ready: false,
        staleTimeoutMs: 30000,
        gracePeriodMs: 60000,
        lastError: 'LINKHIIT_DISABLE_ANT 설정으로 ANT+ 기능이 비활성화되었습니다.',
        slots: [],
      }
    })
    this.initializeApp()
  }

  private initializeApp() {
    // HTTPS 인증서 에러 무시 (로컬 개발용)
    app.commandLine.appendSwitch('ignore-certificate-errors')

    // AudioContext 자동재생 허용 (사용자 제스처 없이도 종소리/음성 재생)
    app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

    // OS DPI 배율 무시 — 물리 해상도 1:1 매핑 (32인치 개발 vs 55인치 TV 레이아웃 동일화)
    app.commandLine.appendSwitch('force-device-scale-factor', '1')

    // GPU 가속 및 비디오 디코딩 최적화
    app.commandLine.appendSwitch('enable-gpu-rasterization')
    app.commandLine.appendSwitch('enable-zero-copy')
    app.commandLine.appendSwitch('enable-hardware-overlays', 'single-fullscreen,single-on-top,underlay')
    app.commandLine.appendSwitch('ignore-gpu-blocklist')

    // 앱이 준비되면 창 생성
    app.whenReady().then(async () => {
      // HTTP 서버 시작 (renderer를 http://localhost:3002 로 제공)
      // - 프로덕션(file://)에서 Vimeo 임베드 도메인 제한이 걸리는 문제를 우회하기 위해
      //   개발/프로덕션 모두 동일하게 localhost origin을 사용한다.
      try {
        await this.httpServer.start()
        log('웹-Electron 통신 서버가 시작되었습니다')
      } catch (error) {
        console.error('HTTP 서버 시작 실패:', error)
      }

      // 창 생성 및 IPC/메뉴 설정
      this.createWindows()
      this.setupIPC()
      this.setupMenu()

      // ANT+ 매니저 초기화
      if (this.antManager) {
        try {
          const initialized = await this.antManager.initialize()
          if (initialized) {
            log('✅ ANT+ 심박계 매니저 초기화 성공')
            this.setupANTCallbacks()
          } else {
            console.warn('⚠️ ANT+ 심박계 매니저 초기화 실패')
          }
        } catch (error) {
          console.error('❌ ANT+ 초기화 오류:', error)
        }
      }

      // WebSocket Relay 콜백 설정 및 연결 시작
      this.setupWebSocketRelay()

      // 시스템 진단 로그 시작 (메모리/GPU 상태 주기적 기록)
      fileLogger.startSystemDiagnostics()
    })

    app.on('will-quit', () => {
      fileLogger.shutdown()
    })

    // 모든 창이 닫히면 앱 종료 (macOS 제외)
    // 단, 화면 모드 전환 중(창 재생성 사이의 일시 공백)이면 quit 하지 않는다.
    app.on('window-all-closed', () => {
      if (this.isScreenModeChanging) {
        log('ℹ️ 화면 모드 전환 중이라 window-all-closed 이벤트의 quit를 무시합니다')
        return
      }
      if (process.platform !== 'darwin') {
        app.quit()
      }
    })

    // macOS에서 앱 아이콘 클릭 시 창 재생성
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindows()
      }
    })

    // 커스텀 프로토콜(linkhiit://) 등록 및 딥링크 처리
    const gotLock = app.requestSingleInstanceLock()
    if (!gotLock) {
      app.quit()
      return
    }

    // 프로토콜 등록
    if (process.defaultApp) {
      // 개발 모드에서는 electron 실행 파일과 현재 스크립트 경로를 사용
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('linkhiit', process.execPath, [path.resolve(process.argv[1])])
      }
    } else {
      // 패키지된 앱에서는 실행 파일만 사용
      app.setAsDefaultProtocolClient('linkhiit')
    }

    // 실행 시 명령행 인수에서 딥링크 확인
    if (process.argv.length > 1) {
      const deeplink = process.argv.find(arg => arg.startsWith('linkhiit://'))
      if (deeplink) {
        setTimeout(() => this.handleDeepLink(deeplink), 1000)
      }
    }

    app.on('second-instance', (_event, argv) => {
      log('second-instance 이벤트:', argv)
      const deeplink = argv.find(a => typeof a === 'string' && (a as string).startsWith('linkhiit://')) as string | undefined
      if (deeplink) {
        log('딥링크 감지:', deeplink)
        this.handleDeepLink(deeplink)
      }
      const win = BrowserWindow.getAllWindows()[0]
      if (win) {
        if (win.isMinimized()) win.restore()
        win.focus()
      }
    })

    app.on('open-url', (event: any, urlStr: string) => {
      event.preventDefault()
      log('open-url 이벤트:', urlStr)
      this.handleDeepLink(urlStr)
    })

    // 보안 설정 + 렌더러 콘솔 로그 캡처 + 크래시/로드실패 감지
    app.on('web-contents-created', (_, contents) => {
      contents.on('console-message', (_event: any, level: number, message: string, line: number, sourceId: string) => {
        fileLogger.appendRendererLog(level, message, line, sourceId)
      })

      contents.on('render-process-gone', (_event: any, details: any) => {
        console.error(`💀 [렌더러 크래시] reason=${details?.reason}, exitCode=${details?.exitCode}`)
      })

      contents.on('did-fail-load', (_event: any, errorCode: number, errorDescription: string, validatedURL: string) => {
        console.error(`🚫 [페이지 로드 실패] code=${errorCode}, desc="${errorDescription}", url=${validatedURL}`)
      })

      contents.on('unresponsive', () => {
        console.error('🔴 [렌더러 응답없음] 렌더러 프로세스가 응답하지 않습니다')
      })

      contents.on('responsive', () => {
        console.warn('🟢 [렌더러 복구] 렌더러 프로세스가 응답을 재개했습니다')
      })

      contents.on('did-finish-load', () => {
        console.log(`📄 [페이지 로드 완료] ${contents.getURL()}`)
      })

      contents.on('new-window', (navigationEvent: any) => {
        navigationEvent.preventDefault()
      })

      // Bluetooth 기기 선택 핸들러
      contents.on('select-bluetooth-device', (event: any, deviceList: any, callback: any) => {
        event.preventDefault()
        const originalCount = Array.isArray(deviceList) ? deviceList.length : 0
        const filteredList = (Array.isArray(deviceList) ? deviceList : []).filter((d: any) => !isBluetoothDeviceBlacklisted(d?.deviceName))
        log(`🔍 블루투스 기기 검색: ${originalCount}개 발견 (필터 후 ${filteredList.length}개)`)

        if (filteredList.length === 0) {
          console.warn('⚠️ 검색된 블루투스 기기가 없습니다')
          callback('')
          return
        }

        // 필요 시에만 상세 로그 출력
        if (isTruthyEnv(process.env.LINKHIIT_DEBUG_BLE_DEVICES)) {
          filteredList.forEach((device: any, index: number) => {
            log(`  [${index}] ${device.deviceName || 'Unknown'} (${device.deviceId})`)
          })
        }

        // HW9 기기 우선 선택
        const hw9Device = filteredList.find((d: any) =>
          d.deviceName && (d.deviceName.includes('HW9') || d.deviceName.includes('Coospo'))
        )

        // HW9가 없으면 "블랙리스트 제외 + 이름이 있는 첫번째"만 선택. (무작정 deviceList[0] 선택으로 GarminStick3 등이 잡히는 문제 방지)
        const fallbackDevice = filteredList.find((d: any) => !!(d?.deviceName && String(d.deviceName).trim()))
        const selectedDevice = hw9Device || fallbackDevice

        if (!selectedDevice) {
          console.warn('⚠️ 선택 가능한 블루투스 기기가 없습니다')
          callback('')
          return
        }
        log(`✅ 자동 선택: ${selectedDevice.deviceName || 'Unknown'} (${selectedDevice.deviceId})`)

        callback(selectedDevice.deviceId)
      })
    })
  }

  /**
   * Windows의 "디스플레이 배치(가상 좌표계)"와 동일한 순서로 모니터를 정렬합니다.
   * - 좌 -> 우 (x 오름차순)
   * - 같은 열이면 상 -> 하 (y 오름차순)
   *
   * 참고: screen.getAllDisplays()의 반환 순서는 OS "모니터 번호"와 일치가 보장되지 않으므로,
   * 창 타입(workout-left/timer/workout-right)을 index에 매핑할 때는 정렬된 배열을 사용합니다.
   */
  private getOrderedDisplays() {
    const displays = screen.getAllDisplays()
    return [...displays].sort((a, b) => {
      if (a.bounds.x !== b.bounds.x) return a.bounds.x - b.bounds.x
      if (a.bounds.y !== b.bounds.y) return a.bounds.y - b.bounds.y
      return a.id - b.id
    })
  }

  /**
   * 현재 화면 모드 + 감지된 모니터에 맞는 창 배치 계획을 만든다.
   */
  private buildCurrentPlan(): WindowPlan {
    return buildWindowPlan(this.getOrderedDisplays(), this.screenMode)
  }

  public createWindows() {
    log('🖥️ createWindows 메서드 호출됨')
    const plan = this.buildCurrentPlan()
    log(`감지된 모니터 수: ${plan.monitorCount}, 화면 모드: ${this.screenMode}`)

    if (plan.items.length === 0) {
      console.warn('⚠️ 연결된 모니터가 없습니다.')
      return
    }
    if (plan.fallbackToThree) {
      console.warn(`⚠️ 5-screen 모드 요청되었으나 모니터가 ${plan.monitorCount}개. 타이머만 표시합니다.`)
    }

    plan.items.forEach((item) => {
      this.createWindowFromPlan(item)
    })

    log(`✅ 총 ${this.windows.length}개의 창이 생성되었습니다`)
  }

  /**
   * 단일 plan item으로 BrowserWindow를 생성한다.
   * - bounds로 모니터 영역(또는 분할 영역)을 꽉 채우는 방식으로 시뮬레이션 풀스크린 구성.
   */
  private createWindowFromPlan(item: WindowPlanItem) {
    const { type, display, bounds } = item

    const window = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      fullscreen: false,
      frame: false,
      movable: false,
      resizable: false,
      show: false,
      backgroundColor: '#000000',
      ...(process.platform === 'win32' ? { roundedCorners: false } : {}),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../../preload/preload.js'),
        webSecurity: true,
        backgroundThrottling: false,
      },
    })

    const protocol = this.httpServer.isHttps() ? 'https' : 'http'
    const baseUrl = `${protocol}://localhost:3002`
    window.loadURL(urlForWindowType(baseUrl, type))

    window.webContents.setBackgroundThrottling(false)

    const applyBounds = () => {
      window.setBounds(bounds)
    }
    window.once('ready-to-show', () => {
      applyBounds()
      window.show()
    })
    window.webContents.once('did-finish-load', applyBounds)

    if (process.env.NODE_ENV === 'development') {
      window.webContents.openDevTools()
    }

    window.webContents.on('before-input-event', (_event, input) => {
      if (input.control && input.shift && input.key.toLowerCase() === 'i') {
        window.webContents.toggleDevTools()
      }
      if (input.key === 'F12') {
        window.webContents.toggleDevTools()
      }
    })

    this.windows.push({
      id: display.id,
      window,
      display,
      type,
    })

    log(`✅ ${type} 창 생성 (display=${display.id}, ${bounds.width}x${bounds.height} @${bounds.x},${bounds.y})`)
  }

  private setupIPC() {
    ipcMain.on('workout-queue-preload-ready', (_event: any, side: string) => {
      this.ipcHandlers.handleQueuePreloadReady(side)
    })

    // 운동 세션 시작 (대기 -> 진행)
    ipcMain.handle('start-workout', async (event: any, data: any) => {
      log('운동 시작 버튼 클릭')
      return await this.ipcHandlers.handlePlayStart()
    })

    ipcMain.handle('intro-playback-ended', async () => {
      return this.ipcHandlers.handleIntroPlaybackEnded()
    })

    // 운동 세션 일시정지/재개 토글
    ipcMain.handle('pause-workout', async (event: any) => {
      log('일시정지/재개 버튼 클릭')
      return await this.ipcHandlers.handlePlayPauseToggle()
    })

    // 운동 세션 종료
    ipcMain.handle('stop-workout', async (event: any) => {
      log('운동 종료 버튼 클릭')
      return await this.ipcHandlers.handlePlayStop()
    })

    // 플레이리스트 데이터 전송
    ipcMain.handle('load-playlist', async (event: any, playlistData: any) => {
      log('플레이리스트 로드:', playlistData.name)

      // 운동 비디오 창에 플레이리스트 전송
      const workoutWindow = this.windows.find(w => w.type === 'workout')
      if (workoutWindow) {
        workoutWindow.window.webContents.send('playlist-loaded', playlistData)
      }

      return { success: true }
    })

    // 심박수 데이터 전송
    ipcMain.handle('update-heart-rate', async (event: any, heartRateData: any) => {
      // 타이머 창에 심박수 데이터 전송
      const timerWindow = this.windows.find(w => w.type === 'timer')
      if (timerWindow) {
        timerWindow.window.webContents.send('heart-rate-updated', heartRateData)
      }

      return { success: true }
    })

    // 모니터 정보 조회
    ipcMain.handle('get-displays', async () => {
      const displays = this.getOrderedDisplays()
      const plan = this.buildCurrentPlan()
      return displays.map((display: Electron.Display, index: number) => {
        // 한 모니터에 여러 창이 들어갈 수 있으므로 모든 창 type을 함께 반환
        const types = plan.items.filter(it => it.display.id === display.id).map(it => it.type)
        return {
          id: display.id,
          index,
          bounds: display.bounds,
          workArea: display.workArea,
          scaleFactor: display.scaleFactor,
          rotation: display.rotation,
          primary: display === screen.getPrimaryDisplay(),
          // 호환: 이전엔 단일 type 반환 → 첫 번째를 type, 전체는 types 로 노출
          type: types[0] ?? 'background',
          types,
        }
      })
    })

    // 현재 창의 모드(전체화면 여부) 조회 (setBounds 방식이므로 movable 여부로 판단)
    ipcMain.handle('get-window-mode', async (event) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      return { isFullscreen: win ? !win.isMovable() : true }
    })

    // 창 위치 재조정 (현재 plan에 맞게 다시 적용)
    ipcMain.handle('reposition-windows', async () => {
      this.applyCurrentPlanBounds()
      return { success: true }
    })

    // 앱 종료
    ipcMain.handle('quit-app', async () => {
      this.wsRelay.disconnect()
      app.quit()
    })

    // 현재 화면 모드 조회
    ipcMain.handle('get-screen-mode', async () => {
      return { mode: this.screenMode }
    })

    // 화면 모드 변경 (운동 진행 중이면 거절)
    ipcMain.handle('set-screen-mode', async (_event: any, payload: { mode: ScreenMode }) => {
      return this.applyScreenModeChange(payload?.mode)
    })

    // 디바이스 정보 조회
    ipcMain.handle('get-device-info', async () => {
      return {
        deviceId: this.deviceManager.getDeviceId(),
        isRegistered: this.deviceManager.isRegistered(),
        displayLabel: this.deviceManager.getDisplayLabel(),
        registerCode: this.registerCode,
        registerCodeExpiresAt: this.registerCodeExpiresAt,
        isWsConnected: this.wsRelay.isConnected()
      }
    })

    // WebSocket 재연결
    ipcMain.handle('ws-reconnect', async () => {
      await this.wsRelay.connect()
      return { success: true }
    })

    // 등록 초기화 (테스트용)
    ipcMain.handle('reset-device-registration', async () => {
      this.wsRelay.resetRegistration()
      return { success: true }
    })

    // ANT+ 모든 기기 정보 조회
    ipcMain.handle('ant-get-all-devices', async () => {
      if (!this.antManager) return []
      return this.antManager.getAllDevices()
    })

    // ANT+ 모든 기기 연결 해제
    ipcMain.handle('ant-disconnect-all', async () => {
      if (this.antManager) await this.antManager.disconnectAll()
      return { success: true }
    })

    // 전체화면 토글 (창 재생성 없이 setBounds 방식 — 영상 끊김 방지)
    // 현재 화면 모드 + 모니터 수에 맞춰 buildWindowPlan 결과로 다시 적용한다.
    ipcMain.handle('toggle-fullscreen', async () => {
      if (this.windows.length === 0) {
        return { success: false, isFullscreen: this.isSimulatedFullscreen }
      }

      const nextFullscreen = !this.isSimulatedFullscreen
      this.applyCurrentPlanBounds()

      this.windows.forEach(({ window }) => {
        window.setMovable(!nextFullscreen)
        window.setResizable(!nextFullscreen)
        try {
          window.webContents.send('window-mode-changed', { isFullscreen: nextFullscreen })
        } catch { }
      })

      this.isSimulatedFullscreen = nextFullscreen
      log(`🖥️ 전체화면 ${nextFullscreen ? '활성화' : '비활성화'} (setBounds 방식)`)
      return { success: true, isFullscreen: nextFullscreen }
    })
  }

  private setupANTCallbacks() {
    const ant = this.antManager
    if (!ant) return
    // ANT+ 심박수 업데이트 콜백
    ant.setOnHeartRateUpdate((slotNumber: number, heartRate: number) => {
      const deviceId = ant.getDeviceId(slotNumber)
      const deviceName = ant.getDeviceName(slotNumber)

      if (process.env.LINKHIIT_ANT_HR_VERBOSE === '1' && heartRate > 0) {
        console.log(`💓 ANT+ 슬롯 ${slotNumber} (${deviceName}): ${heartRate} BPM`)
      }

      void this.ipcHandlers
        .collectHeartRateFromANT(slotNumber, deviceId, deviceName, heartRate)
        .catch((err: unknown) => console.error('ANT 심박 수집 실패:', err))
    })

    // ANT+ 연결 상태 변경 콜백
    ant.setOnConnectionStatusChange((slotNumber: number, isConnected: boolean, deviceName: string, meta?: any) => {
      log(`ANT+ 슬롯 ${slotNumber}: ${isConnected ? '연결됨' : '연결 해제'} - ${deviceName}`)

      // 연결 상태를 모든 창에 브로드캐스트
      this.windows.forEach(({ window }) => {
        window.webContents.send('ant-connection-status', {
          slotNumber,
          isConnected,
          deviceName,
          ...(meta || {})
        })
      })
    })
  }

  private setupWebSocketRelay() {
    log('📡 WebSocket Relay 초기화 중...')
    log(`📋 Device ID: ${this.deviceManager.getDeviceId()}`)
    log(`📋 등록 상태: ${this.deviceManager.isRegistered() ? '등록됨' : '미등록'}`)

    this.wsRelay.setCallbacks({
      onRegisterCodeReceived: (code: string, expiresIn: number) => {
        log(`📋 등록 코드 수신: ${code} (${expiresIn}초 후 만료)`)
        this.registerCode = code
        this.registerCodeExpiresAt = Date.now() + expiresIn * 1000
        
        // 모든 창에 등록 코드 브로드캐스트
        this.windows.forEach(({ window }) => {
          window.webContents.send('device-register-code', {
            code,
            expiresIn,
            deviceId: this.deviceManager.getDeviceId()
          })
        })
      },

      onRegistrationComplete: (data) => {
        log('✅ 디바이스 등록 완료:', data)
        this.registerCode = null
        this.registerCodeExpiresAt = null
        
        // 모든 창에 등록 완료 알림
        this.windows.forEach(({ window }) => {
          window.webContents.send('device-registered', {
            displayLabel: data.displayLabel,
            storeId: data.storeId
          })
        })
      },

      onConnectionStateChange: (connected: boolean, error?: string) => {
        log(`🔌 WebSocket 연결 상태: ${connected ? '연결됨' : '연결 해제'}${error ? ` (${error})` : ''}`)
        
        // 모든 창에 연결 상태 브로드캐스트
        this.windows.forEach(({ window }) => {
          window.webContents.send('ws-relay-status', {
            connected,
            error
          })
        })
      },

      onScreenModeChangeRequest: async (mode) => {
        return await this.applyScreenModeChange(mode)
      },

      onGetScreenModeRequest: () => this.screenMode,
      onHeartRateStatusRequest: () => this.ipcHandlers.getHeartRateDiagnostics(),
    })

    // 서버 중계 모드 항상 활성화 (직접 연결은 LINKHIIT_DIRECT_MODE=1로 사용)
    const useDirectMode = isTruthyEnv(process.env.LINKHIIT_DIRECT_MODE)
    
    if (!useDirectMode) {
      log('📡 서버 중계 모드 활성화 - WebSocket 연결 시작')
      this.wsRelay.connect().catch(error => {
        console.error('WebSocket 연결 실패:', error)
      })
    } else {
      log('ℹ️ 직접 연결 모드 활성화 (LINKHIIT_DIRECT_MODE=1)')
    }
  }

  private setupMenu() {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: '파일',
        submenu: [
          { type: 'separator' },
          {
            label: '종료',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              app.quit()
            },
          },
        ],
      },
      {
        label: '보기',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      {
        label: '창',
        submenu: [
          { role: 'minimize' },
          { role: 'close' },
          {
            label: '모든 창 표시',
            click: () => {
              this.windows.forEach(({ window }) => {
                window.show()
              })
            },
          },
          {
            label: '창 위치 재조정',
            click: () => {
              this.repositionAllWindows()
            },
          },
        ],
      },
    ]

    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
  }

  /**
   * 화면 모드 변경 (3-screen ↔ 5-screen). 운동 진행 중이면 거절.
   * - 모든 기존 창을 닫고 새 모드로 createWindows() 재호출.
   * - electron-store(파일)에 영속화.
   * - WebSocket Relay 콜백에서도 동일 진입점으로 호출됨.
   *
   * 응답:
   *   success            : 모드 변경/유지 성공 여부
   *   mode               : 실제 적용된(저장된) 모드
   *   reason             : 실패 사유 ('invalid-mode' | 'workout-active')
   *   fallbackToThree    : 5-mode 요청했지만 모니터 부족으로 3-screen 레이아웃이 적용된 경우 true
   *   monitorCount       : 현재 감지된 모니터 수 (폴백 안내용)
   */
  public async applyScreenModeChange(mode: ScreenMode | undefined): Promise<{
    success: boolean
    mode?: ScreenMode
    reason?: string
    fallbackToThree?: boolean
    monitorCount?: number
  }> {
    if (mode !== 'three' && mode !== 'five') {
      return { success: false, reason: 'invalid-mode' }
    }

    // 운동 진행 중(playing/paused)이면 모드 변경 불가
    const runtime = this.ipcHandlers.getRuntimeInfo()
    const playStatus = runtime?.playSession?.status
    if (playStatus === 'playing' || playStatus === 'paused') {
      console.warn(`⚠️ 운동 진행 중(status=${playStatus})이라 화면 모드 변경 거절`)
      return { success: false, reason: 'workout-active' }
    }

    // 새 buildWindowPlan 규칙: 5분할은 모니터 2대 이상이면 정상 표시(2모니터는 1/4분할,
    // 3·4모니터는 좌·우 모니터 안에 1/2분할). 1모니터일 때만 영상 표시 불가 → 폴백.
    const displays = this.getOrderedDisplays()
    const monitorCount = displays.length
    const willFallback = mode === 'five' && monitorCount < 2

    // 같은 모드 재선택 + 폴백 상황도 아닌 경우 → 변경 없이 현재 상태 그대로 반환
    if (mode === this.screenMode && !willFallback) {
      return { success: true, mode, monitorCount }
    }

    if (willFallback) {
      console.warn(`⚠️ 5분할 요청 받았으나 모니터가 ${monitorCount}대뿐 — 영상 표시 불가, 타이머만 표시`)
    }

    log(`🖥️ 화면 모드 변경: ${this.screenMode} → ${mode}${willFallback ? ' (폴백 적용)' : ''}`)

    setScreenMode(mode)
    this.screenMode = mode

    // 모드 전환 동안 window-all-closed → app.quit() 차단
    this.isScreenModeChanging = true
    try {
      const existingWindows = [...this.windows]
      this.windows = []
      for (const mw of existingWindows) {
        try {
          if (!mw.window.isDestroyed()) {
            mw.window.close()
          }
        } catch (err) {
          console.error('기존 창 닫기 실패:', err)
        }
      }

      // close 이벤트 처리 시간 확보 후 재생성
      await new Promise((resolve) => setTimeout(resolve, 200))
      this.createWindows()
    } finally {
      // 새 창들이 ready 가 늦을 수 있으므로 약간의 여유 후 플래그 해제
      setTimeout(() => {
        this.isScreenModeChanging = false
      }, 1000)
    }

    return {
      success: true,
      mode,
      monitorCount,
      ...(willFallback ? { fallbackToThree: true } : {}),
    }
  }

  public getScreenMode(): ScreenMode {
    return this.screenMode
  }

  private repositionAllWindows() {
    this.applyCurrentPlanBounds()
  }

  /**
   * 현재 plan의 bounds를 기존 창들에 다시 적용. (각 창 type 으로 매칭)
   */
  private applyCurrentPlanBounds() {
    const plan = this.buildCurrentPlan()
    for (const item of plan.items) {
      const mw = this.windows.find(w => w.type === item.type)
      if (!mw) continue
      try {
        mw.window.setBounds(item.bounds)
        mw.display = item.display
      } catch (err) {
        console.error(`창 bounds 적용 실패 (${item.type}):`, err)
      }
    }
  }

  private handleDeepLink(urlStr: string) {
    try {
      const u = new URL(urlStr)
      const action = u.hostname // linkhiit://start → 'start'
      if (action === 'start' || action === 'create-monitors') {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createWindows()
        } else if (action === 'create-monitors') {
          this.createWindows()
        }
      }
    } catch (e) {
      console.error('딥링크 처리 실패:', e)
    }
  }
}

// 앱 인스턴스 생성 및 전역 참조 설정
const multiMonitorApp = new MultiMonitorWorkoutApp()
  ; (global as any).multiMonitorApp = multiMonitorApp