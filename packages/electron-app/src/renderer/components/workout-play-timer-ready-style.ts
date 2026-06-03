/** Ready 카운트다운 색상 — 검은 배경 + 흰 READY + 회색 그림자 숫자 */

import {
  adjustActivityLabelFontSize,
  fitCountdownToContainer,
} from './workout-play-timer-dom-fit.js'

export const READY_COUNTDOWN_BG = '#000000'
export const READY_NUMBER_SHADOW = '8px 10px 0 rgba(140, 140, 140, 0.85)'

export const applyReadyCountdownSectionBackground = (side: 'left' | 'right' = 'left'): void => {
  const activitySection = document.getElementById(`activity-section-${side}`)
  const timerContainer = document.getElementById(`timer-container-${side}`)
  const bottomSection = document.getElementById(`bottom-time-section-${side}`)

  if (activitySection) activitySection.style.background = READY_COUNTDOWN_BG
  if (timerContainer) timerContainer.style.background = READY_COUNTDOWN_BG
  if (bottomSection) bottomSection.style.background = READY_COUNTDOWN_BG
}

export const applyReadyActivityLabelStyle = (activityLabel: HTMLElement): void => {
  activityLabel.textContent = 'READY'
  activityLabel.style.color = '#ffffff'
  activityLabel.style.textShadow = 'none'
  activityLabel.style.fontWeight = '700'
  activityLabel.style.letterSpacing = '0.12em'
  adjustActivityLabelFontSize(activityLabel)
}

export const applyReadyCountdownNumberStyle = (el: HTMLElement, fontSize?: string): void => {
  el.style.color = '#ffffff'
  el.style.textShadow = READY_NUMBER_SHADOW
  el.style.fontWeight = '900'
  if (fontSize) el.style.fontSize = fontSize
}

export const updateReadyCountdownNumberDisplay = (
  el: HTMLElement,
  value: number,
  defaultFontSize: string,
): void => {
  el.textContent = String(value)
  applyReadyCountdownNumberStyle(el, defaultFontSize)
  el.style.animation = value <= 5 && value > 0 ? 'pulse 0.5s ease-in-out infinite' : 'none'
  fitCountdownToContainer(el)
}

/** 운동 시작(session-start) — SET/MOVE 유지, READY·숫자 영역만 첨부 색상 */
export const applySessionStartCountdownPanelStyle = (side: 'left' | 'right' = 'left'): void => {
  applyReadyCountdownSectionBackground(side)

  const activityLabel = document.getElementById(`activity-label-${side}`)
  const countdownEl = document.getElementById(`countdown-${side}`)

  if (activityLabel) applyReadyActivityLabelStyle(activityLabel)
  if (countdownEl) applyReadyCountdownNumberStyle(countdownEl)
}

export const updateSessionStartCountdownNumber = (
  el: HTMLElement,
  value: number,
  defaultFontSize: string,
): void => {
  updateReadyCountdownNumberDisplay(el, value, defaultFontSize)
}
