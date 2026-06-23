import { getTimerUiStrategy } from '../circuits/timer-ui-registry.js'
import type { WorkoutCircuitType } from './workout-timer-circuit.js'
import { WorkoutTimerSound } from './workout-play-timer-sound.js'
import {
  adjustActivityLabelFontSize,
  fitCountdownToContainer,
} from './workout-play-timer-dom-fit.js'
import {
  applySessionStartCountdownPanelStyle,
  applyReadyCountdownNumberStyle,
  updateSessionStartCountdownNumber,
} from './workout-play-timer-ready-style.js'

type CountdownInterval = ReturnType<typeof setInterval> | null

export type WorkoutTimerCountdownDeps = {
  sound: WorkoutTimerSound
  defaultCountdownFontSize: string
  mmSsCountdownFontSize: string
  getCountdown: () => number
  setCountdown: (value: number) => void
  getCountdownInterval: () => CountdownInterval
  setCountdownInterval: (value: CountdownInterval) => void
  getCurrentSequenceType: () => string
  setCurrentSequenceType: (value: string) => void
  getSuppressCountdownBell: () => boolean
  getCurrentCircuitType: () => string
  getCountdownViewRound: () => number
  setStartCountdownActive: (value: boolean) => void
  applySessionStartCountdownHeader: () => void
}

/** 카운트다운 벨: 운동/REST/Water Break + 구간 전환 READY(countdown) */
const SEQUENCE_TYPES_WITH_BELLS = new Set(['exercise', 'rest', 'water', 'countdown'])

const clearCountdownInterval = (deps: WorkoutTimerCountdownDeps): void => {
  const interval = deps.getCountdownInterval()
  if (!interval) return
  clearInterval(interval)
  deps.setCountdownInterval(null)
}

const maybePlayBellForCountdown = (deps: WorkoutTimerCountdownDeps): void => {
  if (!SEQUENCE_TYPES_WITH_BELLS.has(deps.getCurrentSequenceType())) return
  // EMOM-Stress 등에서 같은 운동의 SET 연속 전환 시 종료 벨을 끈다.
  if (deps.getSuppressCountdownBell()) return
  const countdown = deps.getCountdown()
  if (countdown === 3) {
    void deps.sound.playStartBell()
    return
  }
  // PulseFinishBell.MP3 는 파일 자체에 종소리가 2회 들어 있어 비활성화 (사용자 요청)
  // if (countdown === 1) {
  //   void deps.sound.playFinishBell()
  // }
}

export const startSessionReadyCountdown = (
  deps: WorkoutTimerCountdownDeps,
  totalSeconds: number,
): void => {
  deps.setStartCountdownActive(true)
  deps.applySessionStartCountdownHeader()
  applySessionStartCountdownPanelStyle('left')

  let count = totalSeconds
  const countdownEl = document.getElementById('countdown-left')
  if (countdownEl) {
    updateSessionStartCountdownNumber(countdownEl, count, deps.defaultCountdownFontSize)
  }

  clearCountdownInterval(deps)

  const interval = setInterval(() => {
    count--

    if (count > 0 && countdownEl) {
      updateSessionStartCountdownNumber(countdownEl, count, deps.defaultCountdownFontSize)
      if (count === 3) {
        void deps.sound.playStartBell()
      }
    } else if (count <= 0) {
      clearInterval(interval)
      deps.setCountdownInterval(null)
      deps.setStartCountdownActive(false)
    }
  }, 1000)

  deps.setCountdownInterval(interval)
}

export const startPreWorkoutCountdown = (
  deps: WorkoutTimerCountdownDeps,
  callback: () => void,
): void => {
  deps.setStartCountdownActive(true)
  let count = 5
  const side = 'left'

  deps.applySessionStartCountdownHeader()

  const activityLabel = document.getElementById(`activity-label-${side}`)
  if (activityLabel) {
    activityLabel.textContent = 'START'
    activityLabel.style.color = '#FFA500'
    activityLabel.style.textShadow = '0 4px 20px rgba(255, 165, 0, 0.8)'
    adjustActivityLabelFontSize(activityLabel)
  }

  const interval = setInterval(() => {
    const countdownEl = document.getElementById(`countdown-${side}`)
    if (!countdownEl) return

    if (count > 0) {
      countdownEl.textContent = count.toString()
      countdownEl.style.fontSize = deps.defaultCountdownFontSize
      countdownEl.style.color = '#FFA500'
      countdownEl.style.textShadow = '0 8px 60px rgba(255, 165, 0, 0.8)'

      if (count === 3) {
        void deps.sound.playStartBell()
      }
      // PulseFinishBell.MP3 는 파일 자체에 종소리가 2회 들어 있어 비활성화 (사용자 요청)
      // else if (count === 1) {
      //   void deps.sound.playFinishBell()
      // }
    } else if (count === 0) {
      countdownEl.textContent = 'GO!'
      countdownEl.style.fontSize = deps.defaultCountdownFontSize
      countdownEl.style.color = '#4CAF50'
      countdownEl.style.textShadow = '0 8px 80px rgba(76, 175, 80, 1)'
    }

    count--

    if (count < 0) {
      clearInterval(interval)
      deps.setStartCountdownActive(false)
      callback()
    }
  }, 1000)
}

export const startSequenceCountdown = (
  deps: WorkoutTimerCountdownDeps,
  duration: number,
  nextSequenceType: string = '',
): void => {
  clearCountdownInterval(deps)
  deps.setCurrentSequenceType(nextSequenceType)
  deps.setCountdown(duration)
  updateTimerCountdownDisplay(deps)

  deps.setCountdownInterval(setInterval(() => {
    tickSequenceCountdown(deps)
  }, 1000))
}

export const resumeSequenceCountdown = (deps: WorkoutTimerCountdownDeps): void => {
  if (deps.getCountdownInterval()) return
  deps.setCountdownInterval(setInterval(() => {
    tickSequenceCountdown(deps)
  }, 1000))
}

const tickSequenceCountdown = (deps: WorkoutTimerCountdownDeps): void => {
  deps.setCountdown(deps.getCountdown() - 1)

  if (deps.getCountdown() <= 0) {
    deps.setCountdown(0)
    clearCountdownInterval(deps)
    updateTimerCountdownDisplay(deps)
    return
  }

  updateTimerCountdownDisplay(deps)
  maybePlayBellForCountdown(deps)
}

export const updateTimerCountdownDisplay = (deps: WorkoutTimerCountdownDeps): void => {
  const countdownEl = document.getElementById('countdown-left')
  if (!countdownEl) return

  const ctRaw = deps.getCurrentCircuitType()
  const ct: WorkoutCircuitType =
    ctRaw === 'loop' || ctRaw === 'stress' || ctRaw === 'amrap' || ctRaw === 'emom' ? ctRaw : 'stress'
  const showMmSs = getTimerUiStrategy(ct).useMmSsCountdownInPhase(deps.getCountdownViewRound())
  const countdown = deps.getCountdown()

  if (deps.getCurrentSequenceType() === 'countdown') {
    countdownEl.textContent = countdown.toString()
    applyReadyCountdownNumberStyle(countdownEl, deps.defaultCountdownFontSize)
    fitCountdownToContainer(countdownEl)
    countdownEl.style.animation = countdown <= 5 && countdown > 0 ? 'pulse 0.5s ease-in-out infinite' : 'none'
    return
  }

  if (showMmSs) {
    const mins = Math.floor(countdown / 60)
    const secs = countdown % 60
    countdownEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    countdownEl.style.fontSize = deps.mmSsCountdownFontSize
  } else {
    countdownEl.textContent = countdown.toString()
    countdownEl.style.fontSize = deps.defaultCountdownFontSize
  }

  fitCountdownToContainer(countdownEl)
  countdownEl.style.animation = countdown <= 5 && countdown > 0 ? 'pulse 0.5s ease-in-out infinite' : 'none'
}
