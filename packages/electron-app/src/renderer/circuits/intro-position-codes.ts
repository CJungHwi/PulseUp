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

/**
 * position → DOM 슬롯 (1–6 인트로 / 1–3 메인)
 * - 인트로 6슬롯: num 1–3 → 좌열, 4–6 → 우열 (좌측 모니터 A*, 우측 모니터 B*)
 * - 메인 3슬롯: num → slot 1–3
 */
export const mapGridPositionToDomSlot = (
  position: string,
  options: { introLayout: boolean; maxSlots: number },
): number => {
  const parsed = parseGridPosition(normalizeGridPosition(position))
  if (parsed) {
    if (options.introLayout && options.maxSlots >= 6) {
      return parsed.num
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

/** 인트로 오버레이: 실제 position 코드 그대로 표시 */
export const internalPositionToDisplayCode = (
  internalPosition: string,
  _side: WorkoutGridSide,
): string => normalizeGridPosition(internalPosition)

/** 슬롯 placeholder 라벨 — 3분할은 좌 A1~A6/우 B1~B6, 5분할은 패널별 3칸 */
export const getIntroSlotDefaultLabel = (
  side: WorkoutGridSide,
  slotNum: number,
  options: { fiveScreen?: boolean } = {},
): string => {
  if (options.fiveScreen) {
    if (side === 'left') return `A${slotNum}`
    if (side === 'left-2') return `A${slotNum + 3}`
    if (side === 'right') return `B${slotNum}`
    if (side === 'right-2') return `B${slotNum + 3}`
  }
  if (side === 'left') return `A${slotNum}`
  if (side === 'right') return `B${slotNum}`
  return `C${slotNum}`
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
  const parsed = parseGridPosition(position)
  if (!parsed || parsed.num < 1 || parsed.num > 6) return false

  if (options.fiveScreen) {
    const panel = displayTypeToFivePanel(display)
    if (panel === 'L1') return parsed.prefix === 'A' && parsed.num <= 3
    if (panel === 'L2') return parsed.prefix === 'A' && parsed.num >= 4
    if (panel === 'R1') return parsed.prefix === 'B' && parsed.num <= 3
    if (panel === 'R2') return parsed.prefix === 'B' && parsed.num >= 4
    return false
  }

  return isLeftMonitorDisplay(display)
    ? parsed.prefix === 'A'
    : parsed.prefix === 'B'
}
