/// <reference path="../../types/electron.d.ts" />

import { workoutInfoDevLog } from '../workout-dev-log.js'

export interface TimerState {
  currentTime: number
  isRunning: boolean
  isPaused: boolean
  startTime: Date | null
  pausedTime: number
  totalPausedDuration: number
}

export class WorkoutTimer {
  private state: TimerState = {
    currentTime: 0,
    isRunning: false,
    isPaused: false,
    startTime: null,
    pausedTime: 0,
    totalPausedDuration: 0
  }

  private interval: NodeJS.Timeout | null = null
  private onTick?: (time: number) => void
  private onStart?: () => void
  private onPause?: () => void
  private onResume?: () => void
  private onStop?: () => void
  private onReset?: () => void

  constructor() {
    this.setupEventListeners()
  }

  private setupEventListeners() {
    // Electron IPC 이벤트 리스너 (다른 창과 동기화)
    if (window.electronAPI) {
      window.electronAPI.onWorkoutStarted(() => {
        this.start()
      })

      window.electronAPI.onWorkoutStopped(() => {
        this.stop()
      })
    }
  }

  // 타이머 시작
  start() {
    if (this.state.isRunning) return

    this.state.isRunning = true
    this.state.isPaused = false
    this.state.startTime = new Date()
    this.state.currentTime = 0
    this.state.totalPausedDuration = 0

    this.startInterval()

    if (this.onStart) {
      this.onStart()
    }

    workoutInfoDevLog('타이머 시작')
  }

  // 타이머 일시정지
  pause() {
    if (!this.state.isRunning || this.state.isPaused) return

    this.state.isPaused = true
    this.state.pausedTime = Date.now()
    this.stopInterval()

    if (this.onPause) {
      this.onPause()
    }

    workoutInfoDevLog('타이머 일시정지')
  }

  // 타이머 재개
  resume() {
    if (!this.state.isRunning || !this.state.isPaused) return

    this.state.isPaused = false
    this.state.totalPausedDuration += Date.now() - this.state.pausedTime
    this.startInterval()

    if (this.onResume) {
      this.onResume()
    }

    workoutInfoDevLog('타이머 재개')
  }

  // 타이머 정지
  stop() {
    this.state.isRunning = false
    this.state.isPaused = false
    this.stopInterval()

    if (this.onStop) {
      this.onStop()
    }

    workoutInfoDevLog('타이머 정지')
  }

  // 타이머 리셋
  reset() {
    this.stop()
    this.state.currentTime = 0
    this.state.startTime = null
    this.state.pausedTime = 0
    this.state.totalPausedDuration = 0

    if (this.onReset) {
      this.onReset()
    }

    // UI 업데이트
    if (this.onTick) {
      this.onTick(0)
    }

    workoutInfoDevLog('타이머 리셋')
  }

  // 타이머 토글 (시작/일시정지)
  toggle() {
    if (!this.state.isRunning) {
      this.start()
    } else if (this.state.isPaused) {
      this.resume()
    } else {
      this.pause()
    }
  }

  private startInterval() {
    this.stopInterval()
    this.interval = setInterval(() => {
      this.updateTime()
    }, 1000)
  }

  private stopInterval() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  private updateTime() {
    if (!this.state.startTime || this.state.isPaused) return

    const now = Date.now()
    const elapsed = now - this.state.startTime.getTime() - this.state.totalPausedDuration
    this.state.currentTime = Math.floor(elapsed / 1000)

    if (this.onTick) {
      this.onTick(this.state.currentTime)
    }
  }

  // 현재 시간 가져오기 (초 단위)
  getCurrentTime(): number {
    return this.state.currentTime
  }

  // 현재 상태 가져오기
  getState(): TimerState {
    return { ...this.state }
  }

  // 실행 중인지 확인
  isRunning(): boolean {
    return this.state.isRunning
  }

  // 일시정지 중인지 확인
  isPaused(): boolean {
    return this.state.isPaused
  }

  // 시간 포맷팅 (HH:MM:SS 또는 MM:SS)
  formatTime(seconds?: number): string {
    const time = seconds ?? this.state.currentTime
    const hours = Math.floor(time / 3600)
    const minutes = Math.floor((time % 3600) / 60)
    const secs = time % 60

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    } else {
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
  }

  // 진행률 계산 (목표 시간 대비)
  getProgress(targetSeconds: number): number {
    if (targetSeconds <= 0) return 0
    return Math.min((this.state.currentTime / targetSeconds) * 100, 100)
  }

  // 이벤트 리스너 등록
  onTimerTick(callback: (time: number) => void) {
    this.onTick = callback
  }

  onTimerStart(callback: () => void) {
    this.onStart = callback
  }

  onTimerPause(callback: () => void) {
    this.onPause = callback
  }

  onTimerResume(callback: () => void) {
    this.onResume = callback
  }

  onTimerStop(callback: () => void) {
    this.onStop = callback
  }

  onTimerReset(callback: () => void) {
    this.onReset = callback
  }

  // 정리
  destroy() {
    this.stop()
  }
}

// 타이머 UI 컴포넌트
export class TimerUI {
  private timer: WorkoutTimer
  private container: HTMLElement
  private timeDisplay: HTMLElement | null = null
  private progressBar: HTMLElement | null = null
  private statusIndicator: HTMLElement | null = null
  private targetTime: number = 0

  constructor(container: HTMLElement, targetTime: number = 0) {
    this.container = container
    this.targetTime = targetTime
    this.timer = new WorkoutTimer()
    
    this.createUI()
    this.setupTimerEvents()
  }

  private createUI() {
    this.container.innerHTML = `
      <div class="timer-ui">
        <div class="timer-status" id="timer-status">
          <span class="status-indicator" id="status-indicator"></span>
          <span class="status-text">준비</span>
        </div>
        <div class="timer-display" id="timer-display">00:00</div>
        <div class="timer-progress" id="timer-progress" style="display: ${this.targetTime > 0 ? 'block' : 'none'}">
          <div class="progress-bar">
            <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
          </div>
          <div class="progress-text" id="progress-text">0%</div>
        </div>
        <div class="timer-controls" id="timer-controls">
          <button class="timer-btn" id="start-btn">시작</button>
          <button class="timer-btn" id="pause-btn" disabled>일시정지</button>
          <button class="timer-btn" id="reset-btn">리셋</button>
        </div>
      </div>
    `

    // 요소 참조 저장
    this.timeDisplay = document.getElementById('timer-display')
    this.progressBar = document.getElementById('progress-fill')
    this.statusIndicator = document.getElementById('status-indicator')

    // 버튼 이벤트 리스너
    this.setupButtonEvents()
  }

  private setupButtonEvents() {
    const startBtn = document.getElementById('start-btn')
    const pauseBtn = document.getElementById('pause-btn')
    const resetBtn = document.getElementById('reset-btn')

    startBtn?.addEventListener('click', () => {
      this.timer.start()
    })

    pauseBtn?.addEventListener('click', () => {
      if (this.timer.isPaused()) {
        this.timer.resume()
      } else {
        this.timer.pause()
      }
    })

    resetBtn?.addEventListener('click', () => {
      this.timer.reset()
    })
  }

  private setupTimerEvents() {
    this.timer.onTimerTick((time) => {
      this.updateDisplay(time)
    })

    this.timer.onTimerStart(() => {
      this.updateStatus('실행 중', 'running')
      this.updateButtons(true, false, true)
    })

    this.timer.onTimerPause(() => {
      this.updateStatus('일시정지', 'paused')
      this.updateButtons(false, true, true)
    })

    this.timer.onTimerResume(() => {
      this.updateStatus('실행 중', 'running')
      this.updateButtons(true, false, true)
    })

    this.timer.onTimerStop(() => {
      this.updateStatus('정지', 'stopped')
      this.updateButtons(false, true, true)
    })

    this.timer.onTimerReset(() => {
      this.updateStatus('준비', 'ready')
      this.updateButtons(false, true, false)
      this.updateDisplay(0)
    })
  }

  private updateDisplay(time: number) {
    if (this.timeDisplay) {
      this.timeDisplay.textContent = this.timer.formatTime(time)
    }

    if (this.targetTime > 0 && this.progressBar) {
      const progress = this.timer.getProgress(this.targetTime)
      this.progressBar.style.width = `${progress}%`
      
      const progressText = document.getElementById('progress-text')
      if (progressText) {
        progressText.textContent = `${Math.round(progress)}%`
      }
    }
  }

  private updateStatus(text: string, status: string) {
    const statusText = this.container.querySelector('.status-text')
    if (statusText) {
      statusText.textContent = text
    }

    if (this.statusIndicator) {
      this.statusIndicator.className = `status-indicator status-${status}`
    }
  }

  private updateButtons(startDisabled: boolean, pauseDisabled: boolean, resetDisabled: boolean) {
    const startBtn = document.getElementById('start-btn') as HTMLButtonElement
    const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement
    const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement

    if (startBtn) startBtn.disabled = startDisabled
    if (pauseBtn) pauseBtn.disabled = pauseDisabled
    if (resetBtn) resetBtn.disabled = resetDisabled

    // 일시정지 버튼 텍스트 업데이트
    if (pauseBtn && !pauseDisabled) {
      pauseBtn.textContent = this.timer.isPaused() ? '재개' : '일시정지'
    }
  }

  // 목표 시간 설정
  setTargetTime(seconds: number) {
    this.targetTime = seconds
    const progressContainer = document.getElementById('timer-progress')
    if (progressContainer) {
      progressContainer.style.display = seconds > 0 ? 'block' : 'none'
    }
  }

  // 타이머 인스턴스 가져오기
  getTimer(): WorkoutTimer {
    return this.timer
  }

  // 정리
  destroy() {
    this.timer.destroy()
  }
}