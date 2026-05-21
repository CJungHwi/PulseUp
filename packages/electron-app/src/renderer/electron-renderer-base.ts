/// <reference path="../types/electron.d.ts" />

import type { DisplayType } from './renderer-display-types.js'

import { MultiMonitorManager } from './components/MultiMonitorManager.js'
import { WorkoutGridDisplay } from './components/WorkoutGridDisplay.js'
import { WorkoutPlayTimerUI } from './components/WorkoutPlayTimerUI.js'
import type { SequenceRenderer } from './workout-renderers/index.js'
import { RestRenderer } from './workout-renderers/rest-renderer.js'
import { StretchingRenderer } from './workout-renderers/stretching-renderer.js'
import { ReadyRenderer } from './workout-renderers/ready-renderer.js'
import { MainRenderer } from './workout-renderers/main-renderer.js'

export abstract class ElectronRendererBase {
  protected currentDisplay: DisplayType = 'workout'
  protected isWorkoutActive = false
  protected workoutTimer = 0
  protected timerInterval: NodeJS.Timeout | null = null
  protected currentPlaylist: any = null
  protected multiMonitorManager: MultiMonitorManager | null = null

  // 운동 플레이 관련
  protected workoutGridDisplay: WorkoutGridDisplay | null = null
  protected workoutPlayTimerUI: WorkoutPlayTimerUI | null = null
  protected currentActiveSet: 'set1' | 'set2' = 'set2'
  protected currentRound: number = 0 // 현재 Round 추적
  protected hasCountdownPreview: boolean = false // 카운트다운 중 프리뷰 영상이 표시되었는지
  /** 인트로(대기 화면) 구간 — 이 동안 workout-play-preload 무시 */
  protected introPlaybackActive = false
  protected introEndNotifyTimer: ReturnType<typeof setTimeout> | null = null
  protected countdownModalInterval: ReturnType<typeof setInterval> | null = null // 카운트다운 모달 setInterval (운동 종료 시 취소용)
  protected sequenceRenderers: SequenceRenderer[] = [
    new RestRenderer(),
    new StretchingRenderer(),
    new ReadyRenderer(),
    new MainRenderer()
  ]

  protected isWorkoutCompletedSequence: boolean = false // 정상적인 운동 완료 시퀀스 진행 중인지 여부

  constructor() {
    void this.bootstrap()
  }

  protected async bootstrap() {
    this.initSplashScreen()
    this.currentDisplay = this.getDisplayTypeFromHash()
    this.registerEventListeners()
    this.renderDisplay()
    this.setupMovableWindowUI()
    this.multiMonitorManager = new MultiMonitorManager(this.currentDisplay)
    await this.loadDisplayInfo()
  }

  protected abstract registerEventListeners(): void

  protected setupMovableWindowUI() {
    // 제어 화면은 제외
    if (this.currentDisplay === 'control') return

    // 드래그 핸들 생성 (frame:false 창도 이동 가능하게 함)
    const existing = document.getElementById('window-drag-handle')
    if (!existing) {
      const handle = document.createElement('div')
      handle.id = 'window-drag-handle'
      handle.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 32px;
        z-index: 2147483647;
        background: rgba(0, 0, 0, 0.35);
        backdrop-filter: blur(2px);
        -webkit-app-region: drag;
        pointer-events: auto;
        display: none;
      `

      const label = document.createElement('div')
      label.id = 'window-drag-handle-label'
      label.style.cssText = `
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(255, 255, 255, 0.75);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 1px;
        user-select: none;
        pointer-events: none;
      `
      label.textContent = ''
      handle.appendChild(label)
      document.body.appendChild(handle)
    }

    const updateVisibility = (isFullscreen?: boolean) => {
      const handle = document.getElementById('window-drag-handle')
      if (!handle) return
      // 일반화면(=전체화면 아님)일 때만 드래그 바 표시
      handle.style.display = isFullscreen ? 'none' : 'block'
    }

    // 초기 상태 조회
    void window.electronAPI
      ?.getWindowMode?.()
      .then((data: any) => updateVisibility(Boolean(data?.isFullscreen)))
      .catch(() => updateVisibility(false))

    // 모드 변경 이벤트 구독 (HTTP/IPC 토글 포함)
    window.electronAPI?.onWindowModeChanged?.((data: any) => {
      updateVisibility(Boolean(data?.isFullscreen))
    })
  }

  protected getDisplayTypeFromHash(): DisplayType {
    const hash = window.location.hash.replace('#/', '')
    console.log('🔍 현재 URL:', window.location.href)
    console.log('🔍 Hash:', window.location.hash)
    console.log('🔍 처리된 hash:', hash)

    let displayType: DisplayType

    switch (hash) {
      case 'workout-display-left':
        displayType = 'workout-left'
        break
      case 'workout-display-left-2':
        displayType = 'workout-left-2'
        break
      case 'workout-display-right':
        displayType = 'workout-right'
        break
      case 'workout-display-right-2':
        displayType = 'workout-right-2'
        break
      case 'workout-display':
        displayType = 'workout'
        break
      case 'timer-display':
        displayType = 'timer'
        break
      case 'background-display':
        displayType = 'background'
        break
      default:
        displayType = 'workout'
    }

    console.log('✅ 결정된 displayType:', displayType)
    return displayType
  }
  // Splash 화면 초기화
  protected initSplashScreen() {
    // localStorage에서 캐시된 레이블 로드
    const cachedLabel = localStorage.getItem('displayLabel') || '링크힛 운동 시스템'
    this.updateSplashLabel(cachedLabel)

    // config 업데이트 이벤트 리스너 (미래 Phase 4에서 사용)
    window.electronAPI.onConfigUpdated?.((config: any) => {
      if (config.displayLabel) {
        localStorage.setItem('displayLabel', config.displayLabel)
        this.updateSplashLabel(config.displayLabel)
      }
    })

    // 디바이스 등록 코드 이벤트 리스너
    window.electronAPI.onDeviceRegisterCode?.((data: { code: string; expiresIn: number; deviceId: string }) => {
      console.log(`📋 등록 코드 수신: ${data.code}`)
      this.showRegisterCode(data.code, data.expiresIn)
    })

    // 디바이스 등록 완료 이벤트 리스너
    window.electronAPI.onDeviceRegistered?.((data: { displayLabel?: string; storeId?: number }) => {
      console.log(`✅ 디바이스 등록 완료:`, data)
      this.showRegistered()
      
      // displayLabel 업데이트
      if (data.displayLabel) {
        localStorage.setItem('displayLabel', data.displayLabel)
        this.updateSplashLabel(data.displayLabel)
      }
    })

    // 화면 표시 텍스트 업데이트 이벤트 리스너
    window.electronAPI.onDisplayLabelUpdated?.((data: { displayLabel: string }) => {
      console.log(`📺 화면 표시 텍스트 업데이트:`, data.displayLabel)
      if (data.displayLabel) {
        localStorage.setItem('displayLabel', data.displayLabel)
        this.updateSplashLabel(data.displayLabel)
      }
    })

    // 초기화 시 현재 등록 코드 확인 (창 로드 후 이벤트가 이미 발생한 경우 대비)
    this.checkInitialRegisterCode()
  }

  // 초기 등록 코드 확인
  protected async checkInitialRegisterCode() {
    try {
      const deviceInfo = await window.electronAPI.getDeviceInfo?.()
      console.log('📋 초기 디바이스 정보:', deviceInfo)
      
      if (deviceInfo) {
        if (deviceInfo.isRegistered) {
          // 이미 등록됨
          this.showRegistered()
          if (deviceInfo.displayLabel) {
            localStorage.setItem('displayLabel', deviceInfo.displayLabel)
            this.updateSplashLabel(deviceInfo.displayLabel)
          }
        } else if (deviceInfo.registerCode && deviceInfo.registerCodeExpiresAt) {
          // 등록 코드가 있음
          const remainingMs = deviceInfo.registerCodeExpiresAt - Date.now()
          if (remainingMs > 0) {
            const expiresIn = Math.floor(remainingMs / 1000)
            console.log(`📋 초기 등록 코드 표시: ${deviceInfo.registerCode}`)
            this.showRegisterCode(deviceInfo.registerCode, expiresIn)
          }
        }
      }
    } catch (error) {
      console.error('디바이스 정보 조회 실패:', error)
    }
  }

  // 등록 코드 표시
  protected showRegisterCode(code: string, expiresIn: number) {
    const container = document.getElementById('register-code-container')
    const codeEl = document.getElementById('register-code')
    const expireEl = document.getElementById('register-code-expire')

    if (container && codeEl) {
      container.style.display = 'block'
      codeEl.textContent = code
      
      if (expireEl) {
        const minutes = Math.floor(expiresIn / 60)
        expireEl.textContent = `${minutes}분 후 만료`
        
        // 만료 시간 카운트다운
        let remaining = expiresIn
        const timer = setInterval(() => {
          remaining--
          if (remaining <= 0) {
            clearInterval(timer)
            expireEl.textContent = '만료됨'
            codeEl.textContent = '------'
          } else {
            const m = Math.floor(remaining / 60)
            const s = remaining % 60
            expireEl.textContent = `${m}분 ${s}초 후 만료`
          }
        }, 1000)
      }
    }
  }

  // 등록 완료 표시
  protected showRegistered() {
    const container = document.getElementById('register-code-container')
    const codeEl = document.getElementById('register-code')
    const expireEl = document.getElementById('register-code-expire')
    const titleEl = container?.querySelector('.register-code-title') as HTMLElement

    if (container && codeEl) {
      container.classList.add('registered')
      if (titleEl) titleEl.textContent = '등록 완료!'
      codeEl.textContent = '✓'
      codeEl.style.letterSpacing = '0'
      if (expireEl) expireEl.textContent = '웹앱에서 이 디바이스를 선택할 수 있습니다'
    }
  }

  // Splash 화면 레이블 업데이트
  protected updateSplashLabel(label: string) {
    const labelElement = document.getElementById('splash-label')
    if (labelElement) {
      labelElement.textContent = label
    }
  }

  // Splash 화면 숨기기
  protected hideSplashScreen() {
    const splash = document.getElementById('splash-screen')
    if (splash) {
      // 즉시 숨김 (페이드 아웃 제거)
      splash.style.display = 'none'
      splash.classList.remove('fade-out') // 혹시 남아있을 수 있는 클래스 제거
    }
  }

  // Splash 화면 보이기
  protected showSplashScreen() {
    console.log('🔄 Splash 화면 복귀')
    const splash = document.getElementById('splash-screen')
    if (splash) {
      // 최신 레이블 업데이트
      const cachedLabel = localStorage.getItem('displayLabel') || '링크힛 운동 시스템'
      this.updateSplashLabel(cachedLabel)

      this.isWorkoutCompletedSequence = false // 플래그 초기화


      splash.style.display = 'flex'
      // 약간의 지연 후 fade-in (display 적용 후 transition 적용 위함)
      requestAnimationFrame(() => {
        splash.classList.remove('fade-out')
      })
    }
  }
  protected renderDisplay() {
    const app = document.getElementById('app')
    if (!app) return

    switch (this.currentDisplay) {
      case 'workout-left':
        this.renderWorkoutGridDisplay(app, 'left')
        break
      case 'workout-left-2':
        this.renderWorkoutGridDisplay(app, 'left-2')
        break
      case 'workout-right':
        this.renderWorkoutGridDisplay(app, 'right')
        break
      case 'workout-right-2':
        this.renderWorkoutGridDisplay(app, 'right-2')
        break
      case 'workout':
        this.renderWorkoutDisplay(app)
        break
      case 'timer':
        this.renderWorkoutPlayTimerDisplay(app)
        break
      case 'background':
        this.renderBackgroundDisplay(app)
        break
    }
  }

  protected renderWorkoutGridDisplay(container: HTMLElement, side: 'left' | 'left-2' | 'right' | 'right-2') {
    this.workoutGridDisplay = new WorkoutGridDisplay(container, side)
  }

  /** 4종 운동 그리드 화면 여부 (left/left-2/right/right-2) */
  protected isWorkoutGridDisplay(display: DisplayType): boolean {
    return (
      display === 'workout-left' ||
      display === 'workout-left-2' ||
      display === 'workout-right' ||
      display === 'workout-right-2'
    )
  }

  protected renderWorkoutPlayTimerDisplay(container: HTMLElement) {
    this.workoutPlayTimerUI = new WorkoutPlayTimerUI(container)

    // 심박: WorkoutPlayTimerUI → WorkoutHeartRatePanel(renderer-heart-ipc)
    console.log('✅ 타이머 화면 렌더링 완료')
  }

  protected renderWorkoutDisplay(container: HTMLElement) {
    container.className = 'display-container workout-display'
    container.innerHTML = `
      <div id="workout-video-container" class="video-container"></div>
      <div class="overlay" id="workout-overlay">
        <div class="display-title">운동 비디오</div>
        <div class="display-subtitle">
          ${this.isWorkoutActive ? '운동이 진행 중입니다' : '운동을 시작하려면 제어판을 사용하세요'}
        </div>
      </div>
      <div class="workout-info" id="workout-info" style="display: none;">
        <div class="workout-title" id="workout-title">운동 제목</div>
        <div class="workout-description" id="workout-description">운동 설명</div>
      </div>
    `
  }


  protected renderBackgroundDisplay(container: HTMLElement) {
    container.className = 'display-container background-display'
    container.innerHTML = `
      <div id="background-video-container" class="video-container"></div>
      <div class="overlay">
        <div class="display-title">배경 비디오</div>
        <div class="display-subtitle">운동 분위기를 위한 배경 영상</div>
      </div>
    `
  }

  protected abstract renderControlDisplay(container: HTMLElement): void

  protected abstract updateControlButtonStates(status: 'ready' | 'playing' | 'paused'): void

  protected async pauseWorkout() {
    try {
      const result = await window.electronAPI.pauseWorkout()

      if (result.success) {
        console.log('운동 일시정지/재개:', result.status)
        // UI 업데이트
        if (result.status === 'paused') {
          this.updateControlButtonStates('paused')
        } else if (result.status === 'playing') {
          this.updateControlButtonStates('playing')
        }
      }
    } catch (error) {
      console.error('운동 일시정지 실패:', error)
    }
  }

  protected async startWorkout() {
    try {
      // 클릭 즉시 API 호출 → countdown-started + preview 동시 전송 → 영상이 카운트다운과 함께 바로 표시
      await this.executeStartWorkout()
    } catch (error) {
      console.error('운동 시작 실패:', error)
    }
  }

  protected async executeStartWorkout() {
    try {
      const result = await window.electronAPI.startWorkout({
        playlistId: this.currentPlaylist?.id,
        startTime: new Date().toISOString()
      })

      if (result.success) {
        console.log('운동 시작 성공')
        // UI 업데이트
        this.updateControlButtonStates('playing')
      }
    } catch (error) {
      console.error('실제 운동 시작 실패:', error)
    }
  }

  protected async stopWorkout() {
    try {
      const result = await window.electronAPI.stopWorkout()

      if (result.success) {
        console.log('운동 종료 성공')
        // UI 업데이트
        this.updateControlButtonStates('ready')
      }
    } catch (error) {
      console.error('운동 종료 실패:', error)
    }
  }

  protected async quitApp() {
    if (confirm('앱을 종료하시겠습니까?')) {
      try {
        await window.electronAPI.quitApp()
      } catch (error) {
        console.error('앱 종료 실패:', error)
      }
    }
  }

  protected async toggleFullscreen() {
    try {
      const result = await window.electronAPI.toggleFullscreen()

      const btnText = document.getElementById('fullscreen-btn-text')
      if (result.success && btnText) {
        // 토글 후 상태에 따라 버튼 텍스트 변경
        // isFullscreen이 true면 현재 전체화면 상태이므로 "일반보기" 버튼 표시
        // isFullscreen이 false면 현재 일반보기 상태이므로 "전체보기" 버튼 표시
        btnText.textContent = result.isFullscreen ? '🖥 일반보기' : '🖥 전체보기'
        console.log('화면 모드 변경:', result.isFullscreen ? '전체화면' : '일반보기')
      }
    } catch (error) {
      console.error('화면 모드 변경 실패:', error)
    }
  }

  protected async logout() {
    if (confirm('로그아웃 하시겠습니까?')) {
      try {
        // 로그인 페이지로 이동
        window.location.href = 'index.html'
      } catch (error) {
        console.error('로그아웃 실패:', error)
      }
    }
  }
  protected startWorkoutTimer() {
    this.workoutTimer = 0
    this.timerInterval = setInterval(() => {
      this.workoutTimer++
      this.updateTimerDisplay()
    }, 1000)
  }

  protected stopWorkoutTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
    this.workoutTimer = 0
    this.updateTimerDisplay()
  }

  protected updateDisplay() {
    if (this.currentDisplay === 'control') {
      this.renderControlDisplay(document.getElementById('app')!)
    } else if (this.currentDisplay === 'workout') {
      const overlay = document.getElementById('workout-overlay')
      if (overlay) {
        overlay.innerHTML = `
          <div class="display-title">운동 비디오</div>
          <div class="display-subtitle">
            ${this.isWorkoutActive ? '운동이 진행 중입니다' : '운동을 시작하려면 제어판을 사용하세요'}
          </div>
        `
      }
    }
  }

  protected updateTimerDisplay() {
    const timerElement = document.getElementById('timer-value')
    if (timerElement) {
      timerElement.textContent = this.formatTime(this.workoutTimer)
    }
  }

  protected formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    } else {
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
  }

  protected async loadDisplayInfo() {
    try {
      const displays = await window.electronAPI.getDisplays()
      console.log(`현재 디스플레이 타입: ${this.currentDisplay}`)
      console.log('사용 가능한 디스플레이:', displays)
    } catch (error) {
      console.error('디스플레이 정보 로드 실패:', error)
    }
  }

  protected handleResize() {
    // 창 크기 변경 시 필요한 처리
    console.log('창 크기 변경됨')
  }

  protected handleKeyPress(event: KeyboardEvent) {
    // 키보드 단축키 처리
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 's':
          event.preventDefault()
          if (this.currentDisplay === 'control') {
            this.startWorkout()
          }
          break
        case 'e':
          event.preventDefault()
          if (this.currentDisplay === 'control') {
            this.stopWorkout()
          }
          break
        case 'q':
          event.preventDefault()
          this.quitApp()
          break
      }
    }

    // ESC 키로 전체화면 토글 (개발 중에만)
    if (event.key === 'Escape' && window.location.hostname === 'localhost') {
      // 전체화면 토글 로직 (필요시 구현)
    }
  }
}
