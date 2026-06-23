import type { DisplayType } from './renderer-display-types.js'
import {
  normalizeGridPosition,
  parseGridPosition,
} from '../common/grid-position-codes.js'
import { displayTypeToFivePanel, isLeftMonitorDisplay } from './renderer-display-types.js'

export type ResolveMainSeekLabelOptions = {
  /** 5분할: 패널별 큐(L1/L2/R1/R2). 3분할이면 false */
  fiveScreen?: boolean
}

const FIVE_PANEL_PREFIX: Record<'L1' | 'L2' | 'R1' | 'R2', 'A' | 'B' | 'C' | 'D'> = {
  L1: 'A',
  L2: 'B',
  R1: 'C',
  R2: 'D',
}

/**
 * 메인 seek position → 현재 화면 큐 label
 *
 * seek 대상은 "다음 구간(메인)의 첫 운동" position(보통 'A1')이며, 모든 창에 동일하게
 * 브로드캐스트된다. 각 화면은 자신이 담당하는 구역의 같은 슬롯 라벨로 변환해야 한다.
 * (이전에는 다른 구역 position이면 null 을 반환해 해당 화면이 DS 에 멈추는 버그가 있었음)
 *
 * 3분할: 좌 A/C, 우 B/D  (set1=A·B, set2=C·D)
 * 5분할: L1=A, L2=B, R1=C, R2=D (4개 화면이 동시에 같은 슬롯으로 진행)
 */
export function resolveMainPhaseSeekLabel(
  display: DisplayType,
  position: string,
  options: ResolveMainSeekLabelOptions = {},
): string | null {
  const normalized = normalizeGridPosition(position)
  const parsed = parseGridPosition(normalized)
  if (!parsed) return null

  if (options.fiveScreen) {
    const panel = displayTypeToFivePanel(display)
    if (!panel) return null
    // 5분할은 4개 화면이 동시에 진행하므로, 어떤 구역 position 이 와도
    // 각 패널의 같은 슬롯 번호 라벨로 변환한다.
    return `${FIVE_PANEL_PREFIX[panel]}${parsed.slot}`
  }

  // 3분할: 같은 set(전반/후반)을 유지하되, 화면의 좌/우 구역으로 변환한다.
  // 좌측 모니터: 전반 A / 후반 C, 우측 모니터: 전반 B / 후반 D
  if (isLeftMonitorDisplay(display)) {
    const prefix = parsed.set === 'set1' ? 'A' : 'C'
    return `${prefix}${parsed.slot}`
  }
  const prefix = parsed.set === 'set1' ? 'B' : 'D'
  return `${prefix}${parsed.slot}`
}

/** playVideo 등 DOM position — resolveMainPhaseSeekLabel 과 동일 */
export const mapMainPositionToDisplayLabel = resolveMainPhaseSeekLabel
