import { adjustActivityLabelFontSize } from './workout-play-timer-dom-fit.js'
import {
  applyReadyActivityLabelStyle,
  applyReadyCountdownNumberStyle,
  applyReadyCountdownSectionBackground,
} from './workout-play-timer-ready-style.js'

type ActivityLabelInput = {
  sequence: any
  side: 'left' | 'right'
  currentRound: number
  metadata?: any
}

const isUUID = (str: string): boolean => {
  if (!str || typeof str !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

export const updateWorkoutTimerActivityLabel = (input: ActivityLabelInput): string => {
  const { sequence, side, currentRound, metadata } = input
  const activityLabel = document.getElementById(`activity-label-${side}`)
  const countdownEl = document.getElementById(`countdown-${side}`)
  if (!activityLabel) return 'MAIN'

  const activitySection = document.getElementById('activity-section-left')
  const timerContainer = document.getElementById('timer-container-left')
  const bottomSection = document.getElementById('bottom-time-section-left')

  const applyBgColor = (color: string) => {
    if (activitySection) activitySection.style.background = color
    if (timerContainer) timerContainer.style.background = color
    if (bottomSection) bottomSection.style.background = color
  }

  const applyCommonTextStyle = (label: string, bgColor: string): void => {
    activityLabel.textContent = label
    activityLabel.style.color = '#fff'
    activityLabel.style.textShadow = '0 4px 20px rgba(0,0,0,0.5)'
    applyBgColor(bgColor)
    if (countdownEl) {
      countdownEl.style.color = '#fff'
      countdownEl.style.textShadow = '0 8px 40px rgba(0,0,0,0.4)'
    }
  }

  let activityType = 'MAIN'
  if (sequence.exercise_type === 'countdown') {
    activityType = 'Ready'
    applyReadyCountdownSectionBackground(side)
    applyReadyActivityLabelStyle(activityLabel)
    if (countdownEl) applyReadyCountdownNumberStyle(countdownEl)
  } else if (sequence.exercise_type === 'rest') {
    activityType = 'Rest'
    applyCommonTextStyle('REST', '#4CAF50')
  } else if (sequence.exercise_type === 'water') {
    activityType = 'Water Break'
    applyCommonTextStyle('Water Break', '#00BFFF')
  } else {
    let exerciseLabel = 'MAIN'
    if (currentRound === 0) {
      exerciseLabel = 'STRETCHING'
      activityType = 'Dynamic Stretching'
    } else if (currentRound >= 1 && currentRound < 99) {
      let workoutCategory = metadata?.workoutCategory || ''
      if (!workoutCategory || isUUID(workoutCategory)) {
        workoutCategory = metadata?.major_category || metadata?.major_category_name || 'MAIN'
      }
      if (isUUID(workoutCategory)) workoutCategory = 'MAIN'
      exerciseLabel = String(workoutCategory).toUpperCase()
      activityType = workoutCategory
    } else if (currentRound === 99) {
      exerciseLabel = 'COOL DOWN'
      activityType = 'Cool Down'
    }
    applyCommonTextStyle(exerciseLabel, '#FF0000')
  }

  adjustActivityLabelFontSize(activityLabel)
  return activityType
}
