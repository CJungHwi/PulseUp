/// <reference path="../../types/electron.d.ts" />

import { WorkoutTimer } from './WorkoutTimer.js'
import { TimerDisplayHeartRate } from '../heart-rate-modules/timer-display-heart-rate.js'
import { subscribeRendererHeartIpc } from '../heart-rate-modules/renderer-heart-ipc.js'

export type { HeartRateData } from '../heart-rate-modules/timer-display-heart-rate.js'

export interface WorkoutProgress {
  currentVideoIndex: number
  totalVideos: number
  currentVideoTitle: string
  currentVideoProgress: number
  totalWorkoutProgress: number
}

export class TimerDisplayUI {
  private container: HTMLElement
  private timer: WorkoutTimer
  private readonly heartRateView = new TimerDisplayHeartRate()
  private unsubscribeHeartIpc: (() => void) | null = null
  private workoutProgress: WorkoutProgress | null = null
  private isConnected = false

  constructor(container: HTMLElement) {
    this.container = container
    this.timer = new WorkoutTimer()
    
    this.createUI()
    this.setupEventListeners()
    this.heartRateView.startDevSimulation(this.timer)
  }

  private createUI() {
    this.container.innerHTML = `
      <div class="timer-display-ui">
        <!-- 메인 타이머 -->
        <div class="main-timer-section">
          <div class="timer-value" id="main-timer">00:00</div>
          <div class="timer-label">운동 시간</div>
        </div>

        <!-- 심박수 섹션 -->
        <div class="heart-rate-section">
          <div class="heart-rate-main">
            <div class="heart-rate-icon">❤️</div>
            <div class="heart-rate-value" id="heart-rate-value">0</div>
            <div class="heart-rate-unit">BPM</div>
          </div>
          <div class="heart-rate-zone" id="heart-rate-zone">Rest</div>
          <div class="connection-status" id="connection-status">
            <span class="status-dot ${this.isConnected ? 'connected' : 'disconnected'}"></span>
            ${this.isConnected ? '연결됨' : '연결 안됨'}
          </div>
        </div>

        <!-- 운동 진행률 섹션 -->
        <div class="workout-progress-section" id="workout-progress" style="display: none;">
          <div class="progress-title">운동 진행률</div>
          <div class="current-video" id="current-video">
            <div class="video-title" id="video-title">-</div>
            <div class="video-progress">
              <div class="progress-bar">
                <div class="progress-fill" id="video-progress-fill" style="width: 0%"></div>
              </div>
              <div class="progress-text" id="video-progress-text">0%</div>
            </div>
          </div>
          <div class="total-progress">
            <div class="progress-label">전체 진행률</div>
            <div class="progress-bar">
              <div class="progress-fill" id="total-progress-fill" style="width: 0%"></div>
            </div>
            <div class="progress-text" id="total-progress-text">0% (0/0)</div>
          </div>
        </div>

        <!-- 심박수 차트 섹션 -->
        <div class="heart-rate-chart-section">
          <div class="chart-title">심박수 추이</div>
          <div class="heart-rate-chart" id="heart-rate-chart">
            <canvas id="heart-rate-canvas" width="300" height="100"></canvas>
          </div>
          <div class="heart-rate-stats">
            <div class="stat-item">
              <div class="stat-label">평균</div>
              <div class="stat-value" id="avg-heart-rate">-</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">최대</div>
              <div class="stat-value" id="max-heart-rate">-</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">최소</div>
              <div class="stat-value" id="min-heart-rate">-</div>
            </div>
          </div>
        </div>

        <!-- 운동 정보 섹션 -->
        <div class="workout-info-section" id="workout-info" style="display: none;">
          <div class="info-title">운동 정보</div>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">칼로리</div>
              <div class="info-value" id="calories">0 kcal</div>
            </div>
            <div class="info-item">
              <div class="info-label">거리</div>
              <div class="info-value" id="distance">0 km</div>
            </div>
            <div class="info-item">
              <div class="info-label">강도</div>
              <div class="info-value" id="intensity">보통</div>
            </div>
          </div>
        </div>
      </div>
    `

    this.setupStyles()
  }

  private setupStyles() {
    const style = document.createElement('style')
    style.textContent = `
      .timer-display-ui {
        display: flex;
        flex-direction: column;
        gap: 30px;
        padding: 40px;
        height: 100vh;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      }

      .main-timer-section {
        text-align: center;
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        border-radius: 20px;
        padding: 30px;
      }

      .timer-value {
        font-size: 4rem;
        font-weight: bold;
        font-family: 'Courier New', monospace;
        margin-bottom: 10px;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
      }

      .timer-label {
        font-size: 1.2rem;
        opacity: 0.8;
      }

      .heart-rate-section {
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        border-radius: 20px;
        padding: 25px;
        text-align: center;
      }

      .heart-rate-main {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 15px;
        margin-bottom: 15px;
      }

      .heart-rate-icon {
        font-size: 2rem;
        animation: heartbeat 1.5s ease-in-out infinite;
      }

      @keyframes heartbeat {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }

      .heart-rate-value {
        font-size: 3rem;
        font-weight: bold;
        color: #ff4757;
        font-family: 'Courier New', monospace;
      }

      .heart-rate-unit {
        font-size: 1.2rem;
        opacity: 0.8;
      }

      .heart-rate-zone {
        font-size: 1.1rem;
        margin-bottom: 10px;
        padding: 5px 15px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 15px;
        display: inline-block;
      }

      .connection-status {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-size: 0.9rem;
        opacity: 0.8;
      }

      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }

      .status-dot.connected {
        background: #2ed573;
        animation: pulse 2s infinite;
      }

      .status-dot.disconnected {
        background: #ff4757;
      }

      .workout-progress-section, .workout-info-section {
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        border-radius: 20px;
        padding: 20px;
      }

      .progress-title, .info-title {
        font-size: 1.2rem;
        font-weight: bold;
        margin-bottom: 15px;
        text-align: center;
      }

      .progress-bar {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 10px;
        height: 8px;
        overflow: hidden;
        margin: 8px 0;
      }

      .progress-fill {
        background: linear-gradient(90deg, #2ed573, #7bed9f);
        height: 100%;
        border-radius: 10px;
        transition: width 0.3s ease;
      }

      .progress-text {
        font-size: 0.9rem;
        text-align: center;
        opacity: 0.8;
      }

      .video-title {
        font-weight: bold;
        margin-bottom: 8px;
      }

      .heart-rate-chart-section {
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        border-radius: 20px;
        padding: 20px;
      }

      .chart-title {
        font-size: 1.1rem;
        font-weight: bold;
        margin-bottom: 15px;
        text-align: center;
      }

      .heart-rate-chart {
        margin-bottom: 15px;
        text-align: center;
      }

      .heart-rate-stats {
        display: flex;
        justify-content: space-around;
      }

      .stat-item {
        text-align: center;
      }

      .stat-label {
        font-size: 0.9rem;
        opacity: 0.8;
        margin-bottom: 5px;
      }

      .stat-value {
        font-size: 1.1rem;
        font-weight: bold;
      }

      .info-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 15px;
      }

      .info-item {
        text-align: center;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        padding: 15px;
      }

      .info-label {
        font-size: 0.9rem;
        opacity: 0.8;
        margin-bottom: 5px;
      }

      .info-value {
        font-size: 1.2rem;
        font-weight: bold;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `
    document.head.appendChild(style)
  }

  private setupEventListeners() {
    // 타이머 이벤트
    this.timer.onTimerTick((time) => {
      this.updateTimerDisplay(time)
    })

    // Electron IPC (심박은 renderer-heart-ipc 단일 구독 → 팬아웃)
    if (window.electronAPI) {
      this.unsubscribeHeartIpc?.()
      this.unsubscribeHeartIpc = subscribeRendererHeartIpc({
        onHeartRate: (data) => this.heartRateView.updateHeartRate(data.heartRate),
      })

      window.electronAPI.onWorkoutStarted(() => {
        this.showWorkoutInfo()
      })

      window.electronAPI.onWorkoutStopped(() => {
        this.hideWorkoutInfo()
        this.resetStats()
      })

      window.electronAPI.onPlaylistLoaded((data: any) => {
        this.updateWorkoutProgress({
          currentVideoIndex: 0,
          totalVideos: data.videos?.length || 0,
          currentVideoTitle: data.videos?.[0]?.title || '',
          currentVideoProgress: 0,
          totalWorkoutProgress: 0
        })
      })
    }
  }

  private updateTimerDisplay(time: number) {
    const timerElement = document.getElementById('main-timer')
    if (timerElement) {
      timerElement.textContent = this.timer.formatTime(time)
    }

    // 칼로리 계산 (대략적인 추정)
    this.updateCalories(time)
  }

  private updateWorkoutProgress(progress: WorkoutProgress) {
    this.workoutProgress = progress

    const progressSection = document.getElementById('workout-progress')
    const videoTitle = document.getElementById('video-title')
    const videoProgressFill = document.getElementById('video-progress-fill')
    const videoProgressText = document.getElementById('video-progress-text')
    const totalProgressFill = document.getElementById('total-progress-fill')
    const totalProgressText = document.getElementById('total-progress-text')

    if (progressSection) progressSection.style.display = 'block'
    if (videoTitle) videoTitle.textContent = progress.currentVideoTitle
    if (videoProgressFill) videoProgressFill.style.width = `${progress.currentVideoProgress}%`
    if (videoProgressText) videoProgressText.textContent = `${Math.round(progress.currentVideoProgress)}%`
    if (totalProgressFill) totalProgressFill.style.width = `${progress.totalWorkoutProgress}%`
    if (totalProgressText) {
      totalProgressText.textContent = `${Math.round(progress.totalWorkoutProgress)}% (${progress.currentVideoIndex + 1}/${progress.totalVideos})`
    }
  }

  private updateCalories(timeInSeconds: number) {
    // 간단한 칼로리 계산 (심박수와 시간 기반)
    const avgHeartRate = this.heartRateView.getAverageHeartRateForCalories()

    // 대략적인 칼로리 계산 공식
    const caloriesPerMinute = (avgHeartRate - 70) * 0.1 + 5
    const calories = Math.round((timeInSeconds / 60) * caloriesPerMinute)

    const caloriesElement = document.getElementById('calories')
    if (caloriesElement) {
      caloriesElement.textContent = `${calories} kcal`
    }
  }

  private showWorkoutInfo() {
    const workoutInfo = document.getElementById('workout-info')
    if (workoutInfo) {
      workoutInfo.style.display = 'block'
    }
  }

  private hideWorkoutInfo() {
    const workoutInfo = document.getElementById('workout-info')
    if (workoutInfo) {
      workoutInfo.style.display = 'none'
    }
  }

  private resetStats() {
    this.heartRateView.resetStats()

    const caloriesElement = document.getElementById('calories')
    if (caloriesElement) {
      caloriesElement.textContent = '0 kcal'
    }
  }

  // 연결 상태 업데이트
  updateConnectionStatus(connected: boolean) {
    this.isConnected = connected
    const statusElement = document.getElementById('connection-status')
    if (statusElement) {
      statusElement.innerHTML = `
        <span class="status-dot ${connected ? 'connected' : 'disconnected'}"></span>
        ${connected ? '연결됨' : '연결 안됨'}
      `
    }
  }

  // 정리
  destroy() {
    this.timer.destroy()
  }
}