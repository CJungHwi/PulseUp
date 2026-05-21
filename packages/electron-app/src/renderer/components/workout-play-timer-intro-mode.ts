import {
  formatIntroSecondsAsWholeMinutes,
  getEmomIntroRoundCountFromMetadata,
  isEmomIntroMetadata,
} from '../circuits/emom/intro-panel-emom.js'
import { introOverlayTitleFromMetadata } from '../circuits/shared/intro-overlay-title.js'
import {
  fitIntroCells,
  fitTextToContainer,
} from './workout-play-timer-dom-fit.js'

type IntroModeDeps = {
  reset: () => void
  setPlaySessionMetadata: (metadata: Record<string, unknown>) => void
}

export const showWorkoutTimerIntroMode = (metadata: any, deps: IntroModeDeps): void => {
  deps.reset()
  if (metadata && typeof metadata === 'object') {
    deps.setPlaySessionMetadata(metadata as Record<string, unknown>)
  }

  const overlay = document.getElementById('intro-overlay')
  if (overlay) overlay.style.display = 'flex'

  const titleEl = document.getElementById('intro-workout-title')
  if (titleEl) {
    titleEl.textContent = introOverlayTitleFromMetadata(metadata)
    fitTextToContainer(titleEl)
  }

  const workoutPlans = metadata?.workoutPlans || []
  const waterBreakPlan = workoutPlans.find((p: any) => p.waterBreakTime > 0 || p.hydration > 0 || p.water_break > 0)
  const waterBreakTime = waterBreakPlan?.waterBreakTime || waterBreakPlan?.hydration || waterBreakPlan?.water_break || 0
  const waterBreakEl = document.getElementById('intro-water-break-time')
  const emomIntro = isEmomIntroMetadata(metadata)
  if (waterBreakEl) {
    if (waterBreakTime <= 0) {
      waterBreakEl.textContent = ''
    } else if (emomIntro) {
      waterBreakEl.textContent = formatIntroSecondsAsWholeMinutes(waterBreakTime)
    } else {
      waterBreakEl.textContent = `${waterBreakTime}`
    }
  }

  updateIntroInfoPanel(metadata)

  const countdownEl = document.getElementById('countdown-left')
  if (countdownEl) {
    countdownEl.textContent = 'START'
    countdownEl.style.fontSize = 'clamp(80px, 15vw, 240px)'
    countdownEl.style.color = '#e53935'
  }
}

const resolveCircuitKind = (metadata?: any): string => {
  const wc = String(metadata?.workoutCategory ?? '').toUpperCase()
  const ct = String(metadata?.circuitType ?? '').toLowerCase()
  if (wc === 'EMOM' || ct === 'emom') return 'emom'
  if (wc === 'AMRAP' || ct === 'amrap') return 'amrap'
  if (wc === 'LOOP' || ct === 'loop') return 'loop'
  return 'stress'
}

const updateIntroInfoPanel = (metadata?: any): void => {
  const emomIntro = isEmomIntroMetadata(metadata)
  const circuitType = resolveCircuitKind(metadata)
  const setsWrap = document.getElementById('intro-sets-wrapper')
  const roundsWrap = document.getElementById('intro-rounds-wrapper')
  const timeCaption = document.getElementById('intro-total-time-caption')

  const showSet = circuitType === 'stress'
  const showRound = circuitType !== 'stress'

  if (setsWrap) setsWrap.style.display = showSet ? '' : 'none'
  if (roundsWrap) roundsWrap.style.display = showRound ? '' : 'none'
  if (timeCaption) timeCaption.textContent = emomIntro ? 'MIN' : 'TIME'

  const workoutPlans = metadata?.workoutPlans || []
  const exerciseCount = metadata?.exerciseCount || 0
  const totalDuration = metadata?.totalDuration || 0
  const totalSets = metadata?.totalSets || workoutPlans.length || 0
  const totalRounds = metadata?.totalRounds || 0

  const timeDisplay = emomIntro
    ? formatIntroSecondsAsWholeMinutes(totalDuration)
    : (() => {
        const minutes = Math.floor(totalDuration / 60)
        const seconds = totalDuration % 60
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      })()

  const timeEl = document.getElementById('intro-total-time')
  if (timeEl) timeEl.textContent = timeDisplay

  const exerciseCountEl = document.getElementById('intro-exercise-count')
  if (exerciseCountEl) exerciseCountEl.textContent = String(exerciseCount)

  const plansContainer = document.getElementById('intro-workout-plans')
  if (plansContainer && workoutPlans.length > 0) {
    const plansHtml = workoutPlans.map((plan: any) => {
      const timeSec = plan.exerciseTime || plan.time || plan.exercise_time || 0
      const breakSec = Number(
        plan.restTime ??
          plan.rest ??
          plan.rest_time ??
          plan.breakTime ??
          plan.break_time ??
          0,
      )
      const workLabel = emomIntro ? formatIntroSecondsAsWholeMinutes(Number(timeSec) || 0) : String(timeSec)
      const restLabel = emomIntro ? formatIntroSecondsAsWholeMinutes(breakSec || 0) : String(breakSec)
      return `<div style="display: flex; gap: clamp(8px, 1.5vw, 20px); justify-content: center; align-items: center;">
        <span style="font-size: clamp(29px, 4.8vw, 72px); font-weight: 900; font-style: italic; color: #fff; min-width: clamp(50px, 6vw, 80px); text-align: right; line-height: 1;">${workLabel}</span>
        <span style="font-size: clamp(29px, 4.8vw, 72px); font-weight: 900; color: rgba(255,255,255,0.5); line-height: 1;">-</span>
        <span style="font-size: clamp(29px, 4.8vw, 72px); font-weight: 900; font-style: italic; color: #fff; min-width: clamp(50px, 6vw, 80px); line-height: 1;">${restLabel}</span>
      </div>`
    }).join('')
    plansContainer.innerHTML = plansHtml
  }

  const setsEl = document.getElementById('intro-sets')
  if (setsEl) setsEl.textContent = String(totalSets)

  const roundsEl = document.getElementById('intro-rounds')
  if (roundsEl) {
    roundsEl.textContent = emomIntro ? String(getEmomIntroRoundCountFromMetadata(metadata)) : String(totalRounds)
    const roundsOuter = roundsEl.parentElement as HTMLElement | null
    if (roundsOuter) {
      roundsOuter.style.marginTop = emomIntro ? '0' : ''
    }
  }

  fitIntroCells()
}
