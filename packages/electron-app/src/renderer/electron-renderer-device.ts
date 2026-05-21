import { ElectronRendererWorkout } from './electron-renderer-workout.js'
import { buildMainControlPanelHtml } from './renderer-device-views-html.js'

/**
 * 메인 제어 패널 화면 + 운동 상태 버튼 제어 책임만 담당.
 *
 * 과거에 있던 ANT+ 디바이스 페어링 페이지(슬롯 카드 그리드/순차 연결 모드/번호 확인 모드 등)는
 * 더 이상 진입 경로가 없어 일괄 제거했다. 페어링은 main 프로세스가 자동으로 처리한다.
 */
export abstract class ElectronRendererDevice extends ElectronRendererWorkout {
  protected renderControlDisplay(container: HTMLElement) {
    container.className = 'display-container control-display'
    container.innerHTML = buildMainControlPanelHtml(this.isWorkoutActive)
    this.setupControlEventListeners()
    this.updateControlButtonStates('ready')
  }

  protected updateControlButtonStates(status: 'ready' | 'playing' | 'paused') {
    const startBtn = document.getElementById('start-workout-btn') as HTMLButtonElement
    const pauseBtn = document.getElementById('pause-workout-btn') as HTMLButtonElement
    const stopBtn = document.getElementById('stop-workout-btn') as HTMLButtonElement
    const statusText = document.getElementById('workout-status-text')
    const statusIndicator = document.getElementById('status-indicator')

    if (!startBtn || !pauseBtn || !stopBtn || !statusText || !statusIndicator) return

    switch (status) {
      case 'ready':
        startBtn.disabled = false
        startBtn.style.opacity = '1'
        startBtn.style.cursor = 'pointer'

        pauseBtn.disabled = true
        pauseBtn.style.opacity = '0.5'
        pauseBtn.style.cursor = 'not-allowed'
        pauseBtn.textContent = '⏸ 일시정지'

        stopBtn.disabled = true
        stopBtn.style.opacity = '0.5'
        stopBtn.style.cursor = 'not-allowed'

        statusText.textContent = '대기중'
        statusText.style.color = '#1976d2'
        statusIndicator.className = 'status-indicator status-inactive'
        break

      case 'playing':
        startBtn.disabled = true
        startBtn.style.opacity = '0.5'
        startBtn.style.cursor = 'not-allowed'

        pauseBtn.disabled = false
        pauseBtn.style.opacity = '1'
        pauseBtn.style.cursor = 'pointer'
        pauseBtn.textContent = '⏸ 일시정지'

        stopBtn.disabled = false
        stopBtn.style.opacity = '1'
        stopBtn.style.cursor = 'pointer'

        statusText.textContent = '진행중'
        statusText.style.color = '#4caf50'
        statusIndicator.className = 'status-indicator status-active'
        break

      case 'paused':
        startBtn.disabled = true
        startBtn.style.opacity = '0.5'
        startBtn.style.cursor = 'not-allowed'

        pauseBtn.disabled = false
        pauseBtn.style.opacity = '1'
        pauseBtn.style.cursor = 'pointer'
        pauseBtn.textContent = '▶ 재개'

        stopBtn.disabled = false
        stopBtn.style.opacity = '1'
        stopBtn.style.cursor = 'pointer'

        statusText.textContent = '일시정지'
        statusText.style.color = '#ff9800'
        statusIndicator.className = 'status-indicator status-inactive'
        break
    }
  }

  protected setupControlEventListeners() {
    const startBtn = document.getElementById('start-workout-btn')
    const pauseBtn = document.getElementById('pause-workout-btn')
    const stopBtn = document.getElementById('stop-workout-btn')
    const quitBtn = document.getElementById('quit-app-btn')
    const toggleFullscreenBtn = document.getElementById('toggle-fullscreen-btn')
    const logoutBtn = document.getElementById('logout-btn')

    startBtn?.addEventListener('click', () => this.startWorkout())
    pauseBtn?.addEventListener('click', () => this.pauseWorkout())
    stopBtn?.addEventListener('click', () => this.stopWorkout())
    quitBtn?.addEventListener('click', () => this.quitApp())
    toggleFullscreenBtn?.addEventListener('click', () => this.toggleFullscreen())
    logoutBtn?.addEventListener('click', () => this.logout())
  }
}
