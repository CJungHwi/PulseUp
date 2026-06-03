import type { DisplayType } from './renderer-display-types.js'
import { isWorkoutGridDisplayType } from './renderer-display-types.js'
import { removeOverlayElementById } from './renderer-overlay-utils.js'
import { WorkoutTimerSound } from './components/workout-play-timer-sound.js'

export type CountdownPhase = 'session-start' | 'segment-transition'

export type CountdownModalContext = {
  getDisplay: () => DisplayType
  setCountdownInterval: (v: ReturnType<typeof setInterval> | null) => void
  /** 운동 시작 버튼 직후: 타이머 창에도 전체화면 모달. 구간 전환 Ready: 타이머는 패널만 */
  countdownPhase?: CountdownPhase
}

const countdownSound = new WorkoutTimerSound()

export const showCountdownModal = (ctx: CountdownModalContext): void => {
  const currentDisplay = ctx.getDisplay()
  const phase: CountdownPhase = ctx.countdownPhase ?? 'segment-transition'

  console.log(`🎬 [DEBUG] showCountdownModal (Display: ${currentDisplay}, phase: ${phase})`)

  // 좌·우 영상 모니터: 전체화면 카운트다운 모달 없음 (카운트는 전용 타이머 창 등에서만)
  if (isWorkoutGridDisplayType(currentDisplay)) {
    console.log('🎬 [DEBUG] 좌우 영상 화면: 카운트다운 모달 스킵')
    return
  }

  // 타이머 창: 운동 시작(session-start)은 패널 카운트 / 구간 전환은 패널(#countdown-left)만
  if (currentDisplay === 'timer') {
    console.log('🎬 [DEBUG] 타이머 화면: 패널 카운트다운 사용 — 모달 스킵')
    return
  }

  const allowedDisplays: DisplayType[] = ['workout', 'timer']
  if (!allowedDisplays.includes(currentDisplay)) {
    console.log('🎬 [DEBUG] 카운트다운 표시 대상 화면이 아님 (스킵)')
    return
  }

  const totalSeconds = phase === 'session-start' ? 6 : 5

  console.log('🎬 [DEBUG] 카운트다운 모달 생성 시작')

  removeOverlayElementById('congrats-modal')
  removeOverlayElementById('end-modal')
  removeOverlayElementById('end-fireworks-canvas')
  removeOverlayElementById('end-modal-style')
  removeOverlayElementById('congrats-modal-style')
  removeOverlayElementById('end-counter-image-modal')

  const modal = document.createElement('div')
  modal.id = 'countdown-modal'
  modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      animation: fadeIn 0.3s ease-out;
    `

  const countdownText = document.createElement('div')
  countdownText.id = 'countdown-text'
  countdownText.style.cssText = `
      font-size: 400px;
      font-weight: bold;
      color: #FFA500;
      text-shadow: 0 0 100px rgba(255, 165, 0, 0.8);
      animation: pulse 1s ease-in-out;
    `
  countdownText.textContent = String(totalSeconds)

  modal.appendChild(countdownText)
  document.body.appendChild(modal)

  const style = document.createElement('style')
  style.id = 'countdown-modal-style'
  style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      @keyframes pulse {
        0%, 100% { 
          transform: scale(1); 
          opacity: 1;
        }
        50% { 
          transform: scale(1.2); 
          opacity: 0.8;
        }
      }
      
      @keyframes explode {
        0% { 
          transform: scale(1); 
          opacity: 1;
        }
        50% { 
          transform: scale(1.5); 
          opacity: 0.8;
        }
        100% { 
          transform: scale(3); 
          opacity: 0;
          filter: blur(20px);
        }
      }
      
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
    `
  document.head.appendChild(style)

  let count = totalSeconds
  const interval = setInterval(() => {
    count--
    if (count > 0) {
      countdownText.textContent = count.toString()
      countdownText.style.animation = 'none'
      setTimeout(() => {
        countdownText.style.animation = 'pulse 1s ease-in-out'
      }, 10)

      if (phase === 'session-start' && currentDisplay === 'workout') {
        if (count === 3) {
          void countdownSound.playStartBell()
        }
      }
    } else {
      clearInterval(interval)
      ctx.setCountdownInterval(null)

      countdownText.textContent = 'START'
      countdownText.style.color = '#4CAF50'
      countdownText.style.textShadow = '0 0 120px rgba(76, 175, 80, 1)'
      countdownText.style.animation = 'explode 1s ease-out forwards'

      setTimeout(() => {
        modal.style.animation = 'fadeOut 0.5s ease-out forwards'

        setTimeout(() => {
          modal.remove()
          style.remove()
        }, 500)
      }, 800)
    }
  }, 1000)

  ctx.setCountdownInterval(interval)
}
