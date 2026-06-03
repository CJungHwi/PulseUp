import type { DisplayType } from './renderer-display-types.js'
import {
  GRID_FIRST_HALF_PREFIX,
  GRID_SECOND_HALF_PREFIX,
  normalizeGridPosition,
  parseGridPosition,
} from '../common/grid-position-codes.js'
import { displayTypeToFivePanel, isLeftMonitorDisplay } from './renderer-display-types.js'

export type ResolveMainSeekLabelOptions = {
  /** 5분할: 패널별 큐(L1/L2/R1/R2). 3분할이면 false */
  fiveScreen?: boolean
}

/**
 * 메인 seek position → 현재 화면 큐 label
 *
 * 3분할: 좌 num1-3 / 우 num4-6 (A1→우측 A4)
 * 5분할: L1 A1-3, L2 A4-6, R1 B1-3, R2 B4-6
 */
export function resolveMainPhaseSeekLabel(
  display: DisplayType,
  position: string,
  options: ResolveMainSeekLabelOptions = {},
): string | null {
  const normalized = normalizeGridPosition(position)
  const parsed = parseGridPosition(normalized)
  if (!parsed) return null

  const { slot } = parsed

  if (options.fiveScreen) {
    const panel = displayTypeToFivePanel(display)
    if (panel === 'L1') return `${GRID_FIRST_HALF_PREFIX}${slot}`
    if (panel === 'L2') return `${GRID_FIRST_HALF_PREFIX}${slot + 3}`
    if (panel === 'R1') return `${GRID_SECOND_HALF_PREFIX}${slot}`
    if (panel === 'R2') return `${GRID_SECOND_HALF_PREFIX}${slot + 3}`
    return null
  }

  if (isLeftMonitorDisplay(display)) {
    return `${parsed.prefix}${slot}`
  }

  return `${parsed.prefix}${slot + 3}`
}

/** playVideo 등 DOM position — resolveMainPhaseSeekLabel 과 동일 */
export const mapMainPositionToDisplayLabel = resolveMainPhaseSeekLabel
