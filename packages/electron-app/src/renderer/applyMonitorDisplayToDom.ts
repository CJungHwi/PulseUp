/**
 * applyMonitorDisplayToDom — 스플래시/오버레이에 모니터 표시 적용
 */

export type ResolvedMonitorDisplay = {
  leftImageUrl: string
  centerImageUrl: string
  rightImageUrl: string
  displayText: string
}

export type MonitorDisplaySide = 'left' | 'center' | 'right'

export const displayTypeToMonitorSide = (displayType: string): MonitorDisplaySide | null => {
  if (
    displayType === 'workout-left' ||
    displayType === 'workout-left-2' ||
    displayType === 'workout'
  ) {
    return 'left'
  }
  if (displayType === 'timer') return 'center'
  if (
    displayType === 'workout-right' ||
    displayType === 'workout-right-2'
  ) {
    return 'right'
  }
  return null
}

const sideToImageUrl = (side: MonitorDisplaySide, display: ResolvedMonitorDisplay): string => {
  if (side === 'left') return display.leftImageUrl
  if (side === 'center') return display.centerImageUrl
  return display.rightImageUrl
}

export const applyMonitorDisplayToDom = (
  displayType: string,
  display: ResolvedMonitorDisplay
): void => {
  const side = displayTypeToMonitorSide(displayType)
  const bgEl = document.getElementById('monitor-display-bg')
  const bgImg = document.getElementById('monitor-display-bg-image') as HTMLImageElement | null
  const labelEl = document.getElementById('splash-label')

  if (labelEl && display.displayText.trim()) {
    labelEl.textContent = display.displayText.trim()
  }

  if (!side || !bgEl || !bgImg) return

  const url = sideToImageUrl(side, display).trim()
  if (url) {
    bgImg.src = url
    bgImg.style.display = 'block'
    bgEl.style.display = 'block'
  } else {
    bgImg.removeAttribute('src')
    bgImg.style.display = 'none'
    bgEl.style.display = 'none'
  }
}

export const applyIntroMonitorImage = (
  displayType: string,
  display: ResolvedMonitorDisplay
): string | undefined => {
  const side = displayTypeToMonitorSide(displayType)
  if (!side) return undefined
  const url = sideToImageUrl(side, display).trim()
  return url || undefined
}
