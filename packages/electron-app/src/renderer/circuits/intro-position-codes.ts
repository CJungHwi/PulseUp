import type { WorkoutGridShellSide } from '../components/workout-grid-display-shell.js'
import type { IntroFocusTarget as CommonIntroFocusTarget } from '../../common/intro-position-codes.js'
import {
  parseIntroFocusTarget,
  parseIntroFocusPositionCode,
} from '../../common/intro-position-codes.js'
import {
  normalizeGridPosition,
  parseGridPosition,
} from '../../common/grid-position-codes.js'
import { displayTypeToFivePanel, isLeftMonitorDisplay, type DisplayType } from '../renderer-display-types.js'

export type IntroFocusTarget = CommonIntroFocusTarget
export type WorkoutGridSide = WorkoutGridShellSide

export { parseIntroFocusTarget, parseIntroFocusPositionCode }

const normalizeIntroGridPosition = (position: string): string => {
  const raw = String(position || '').trim().toUpperCase()
  const legacy = raw.match(/^([AB])([1-6])$/)
  if (legacy) {
    const prefix = legacy[1]
    const num = Number(legacy[2])
    if (num > 3) {
      return `${prefix === 'A' ? 'B' : 'D'}${num - 3}`
    }
    return `${prefix}${num}`
  }
  return normalizeGridPosition(raw)
}

/**
 * position → DOM 슬롯 (1–6 인트로 / 1–3 메인)
 * - 인트로 3슬롯: A/B/C/D 각 구역의 slot 1–3
 * - 메인 3슬롯: num → slot 1–3
 */
export const mapGridPositionToDomSlot = (
  position: string,
  options: { introLayout: boolean; maxSlots: number },
): number => {
  const parsed = parseGridPosition(
    options.introLayout ? normalizeIntroGridPosition(position) : normalizeGridPosition(position),
  )
  if (parsed) {
    if (options.introLayout && options.maxSlots >= 6) {
      const isSecondColumn = parsed.prefix === 'B' || parsed.prefix === 'D'
      return isSecondColumn ? parsed.slot + 3 : parsed.slot
    }
    return parsed.slot
  }

  const match = String(position).match(/(\d+)$/)
  if (match) {
    const num = parseInt(match[1], 10)
    const max = Math.max(1, options.maxSlots)
    return ((num - 1) % max) + 1
  }
  return 1
}

/** 인트로 오버레이: 3화면 2열 표시용 position(A4~A6 → B1~B3 등) */
export const internalPositionToDisplayCode = (
  internalPosition: string,
  _side: WorkoutGridSide,
): string => normalizeIntroGridPosition(internalPosition)

/** 슬롯 placeholder 라벨 — 3분할 좌 A/B·우 C/D, 5분할 좌부터 A/B/C/D */
export const getIntroSlotDefaultLabel = (
  side: WorkoutGridSide,
  slotNum: number,
  options: { fiveScreen?: boolean } = {},
): string => {
  if (options.fiveScreen) {
    if (side === 'left') return `A${slotNum}`
    if (side === 'left-2') return `B${slotNum}`
    if (side === 'right') return `C${slotNum}`
    if (side === 'right-2') return `D${slotNum}`
  }
  const slot = ((slotNum - 1) % 3) + 1
  if (side === 'left') return `${slotNum <= 3 ? 'A' : 'B'}${slot}`
  if (side === 'right') return `${slotNum <= 3 ? 'C' : 'D'}${slot}`
  if (side === 'left-2') return `B${slot}`
  return `D${slot}`
}

/** 선택보기: 선택한 영상을 모든 운동 그리드 창 하단 포커스 영역에 동일 표시 */
export const resolveIntroFocusForMonitor = (
  target: IntroFocusTarget,
  _side: WorkoutGridSide,
  options: { introLayout: boolean; maxSlots: number },
): { internalPosition: string; slot: number; displayCode: string } | null => {
  const internalPosition = normalizeGridPosition(target.internalPosition)
  const slot = mapGridPositionToDomSlot(internalPosition, options)

  return {
    internalPosition,
    slot,
    displayCode: target.positionCode,
  }
}

/** 인트로 재생 그리드 필터 */
export const isIntroGridPositionForDisplay = (
  position: string,
  display: DisplayType,
  options: { fiveScreen?: boolean } = {},
): boolean => {
  const parsed = parseGridPosition(normalizeIntroGridPosition(position))
  if (!parsed) return false

  if (options.fiveScreen) {
    const panel = displayTypeToFivePanel(display)
    if (panel === 'L1') return parsed.prefix === 'A'
    if (panel === 'L2') return parsed.prefix === 'B'
    if (panel === 'R1') return parsed.prefix === 'C'
    if (panel === 'R2') return parsed.prefix === 'D'
    return false
  }

  if (display === 'workout-left') return parsed.prefix === 'A' || parsed.prefix === 'B'
  if (display === 'workout-right') return parsed.prefix === 'C' || parsed.prefix === 'D'
  if (display === 'workout-left-2') return parsed.prefix === 'B'
  if (display === 'workout-right-2') return parsed.prefix === 'D'
  return isLeftMonitorDisplay(display)
}
