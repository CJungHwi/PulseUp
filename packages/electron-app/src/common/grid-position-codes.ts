/**
 * 메인 운동 그리드 position 코드
 * - A/B/C/D = 모니터 구역 4분할 (각 1~3 슬롯)
 * - 3화면 좌측 모니터 = A(전반)·C(후반) / 우측 모니터 = B(전반)·D(후반)
 * - A,B = 전반(set1) / C,D = 후반(set2)
 * - 구형 A/B(1~6), L/R: normalizeGridPosition 으로 A~D(1~3) 변환
 */

export const GRID_GROUP_PREFIXES = ['A', 'B', 'C', 'D'] as const
export type GridGroupPrefix = (typeof GRID_GROUP_PREFIXES)[number]

/** @deprecated 좌측 모니터 전반(set1) 구역 — A */
export const GRID_FIRST_HALF_PREFIX = 'A' as const
/** @deprecated 좌측 모니터 후반(set2) 구역 — C */
export const GRID_SECOND_HALF_PREFIX = 'C' as const

/** @deprecated 좌측 모니터 전반 — A */
export const GRID_LEFT_PREFIX = GRID_FIRST_HALF_PREFIX
/** @deprecated 좌측 모니터 후반 — B */
export const GRID_RIGHT_PREFIX = GRID_SECOND_HALF_PREFIX

export type GridHalfPrefix = typeof GRID_FIRST_HALF_PREFIX | typeof GRID_SECOND_HALF_PREFIX
export type GridSidePrefix = GridHalfPrefix | 'C' | 'D'

export type GridMonitorSide = 'left' | 'right'
export type GridActiveSet = 'set1' | 'set2'

export const MAIN_GRID_POSITION_ORDER: readonly string[] = [
  'A1', 'A2', 'A3', 'B1', 'B2', 'B3',
  'C1', 'C2', 'C3', 'D1', 'D2', 'D3',
]

/**
 * Main snake lap 순서 (전반: 좌측 A→우측 B 스네이크, 후반: 좌측 C→우측 D)
 * 전반(set1): A1→A2→A3→B3→B2→B1, 후반(set2): C1→C2→C3→D3→D2→D1
 */
export const STRESS_LAP_ORDER: readonly string[] = [
  'A1', 'A2', 'A3', 'B3', 'B2', 'B1',
  'C1', 'C2', 'C3', 'D3', 'D2', 'D1',
]

export const DEFAULT_GRID_POSITION = 'A1'

export type ParsedGridPosition = {
  prefix: GridGroupPrefix
  num: number
  side: GridMonitorSide
  slot: number
  set: GridActiveSet
}

const LEGACY_LEFT = 'L'
const LEGACY_RIGHT = 'R'

const OLD_AB_TO_NEW: Readonly<Record<string, string>> = {
  A1: 'A1', A2: 'A2', A3: 'A3', A4: 'C1', A5: 'C2', A6: 'C3',
  B1: 'B1', B2: 'B2', B3: 'B3', B4: 'D1', B5: 'D2', B6: 'D3',
}

const isGridGroupPrefix = (raw: string): raw is GridGroupPrefix =>
  GRID_GROUP_PREFIXES.includes(raw as GridGroupPrefix)

const migrateOldAbPosition = (prefix: 'A' | 'B', num: number): string | null => {
  if (num < 1 || num > 6) return null
  return OLD_AB_TO_NEW[`${prefix}${num}`] ?? null
}

/** 구 A/B(1~6)·L/R 저장 데이터인지 판별 */
export const isLegacyMainGridFormat = (positions: (string | undefined)[]): boolean => {
  const ps = positions.map((p) => String(p ?? '').trim().toUpperCase()).filter(Boolean)
  if (ps.some((p) => /^[CD]\d+$/.test(p))) return false
  if (ps.some((p) => /^[LR]\d+$/.test(p) || /^A[4-6]$/.test(p) || /^B[4-6]$/.test(p))) return true
  const aNums = ps.filter((p) => /^A(\d+)$/.test(p)).map((p) => parseInt(p.slice(1), 10))
  const hasB = ps.some((p) => /^B[1-3]$/.test(p))
  if (hasB && aNums.length >= 6) return true
  return false
}

/** 구 MAIN position(A/B 1~6, L/R) → A~D(1~3) 일괄 변환 */
export const migrateOldMainGridPosition = (raw: unknown): string => {
  const s = String(raw ?? '').trim()
  const m = s.match(/^([lLaAbBrR])(\d+)$/i)
  if (!m) return s
  const prefixChar = m[1].toUpperCase()
  const num = parseInt(m[2], 10)
  if (prefixChar === LEGACY_LEFT || prefixChar === LEGACY_RIGHT) {
    return transposeLegacyLrToAb(prefixChar, num)
  }
  if (prefixChar === 'A' || prefixChar === 'B') {
    return migrateOldAbPosition(prefixChar, num) ?? s
  }
  return s
}

/** 구 L/R position → A~D: L1→A1, L4→C1, R1→B1, R4→D1 … */
export const transposeLegacyLrToAb = (legacyPrefix: string, legacyNum: number): string => {
  const isLeftMonitor = legacyPrefix.toUpperCase() === LEGACY_LEFT
  const groupIndex = isLeftMonitor
    ? legacyNum <= 3 ? 0 : 2
    : legacyNum <= 3 ? 1 : 3
  const slot = ((legacyNum - 1) % 3) + 1
  return `${GRID_GROUP_PREFIXES[groupIndex]}${slot}`
}

export const normalizeGridPosition = (raw: unknown): string => {
  const s = String(raw ?? '').trim()
  const m = s.match(/^([lLaAbBcCdDrR])(\d+)$/i)
  if (!m) return s
  const prefixChar = m[1].toUpperCase()
  const num = parseInt(m[2], 10)

  if (prefixChar === LEGACY_LEFT || prefixChar === LEGACY_RIGHT) {
    return transposeLegacyLrToAb(prefixChar, num)
  }

  if (isGridGroupPrefix(prefixChar) && num >= 1 && num <= 3) {
    return `${prefixChar}${num}`
  }

  if ((prefixChar === 'A' || prefixChar === 'B') && num >= 4 && num <= 6) {
    return migrateOldAbPosition(prefixChar, num) ?? s
  }

  return s
}

/** @deprecated normalizeGridPosition 사용 */
export const normalizeLrGridPosition = normalizeGridPosition

export const parseGridPosition = (pos?: string): ParsedGridPosition | null => {
  if (!pos) return null
  const normalized = normalizeGridPosition(pos)
  const m = normalized.match(/^([ABCD])(\d+)$/i)
  if (!m) return null
  const prefix = m[1].toUpperCase() as GridGroupPrefix
  const num = parseInt(m[2], 10)
  if (num < 1 || num > 3) return null
  const set: GridActiveSet = prefix === 'A' || prefix === 'B' ? 'set1' : 'set2'
  const side: GridMonitorSide = prefix === 'A' || prefix === 'C' ? 'left' : 'right'
  return {
    prefix,
    num,
    side,
    slot: num,
    set,
  }
}

export const gridSetFromPrefix = (prefix: string): GridActiveSet | null => {
  const p = prefix.toUpperCase()
  if (p === 'A' || p === 'B') return 'set1'
  if (p === 'C' || p === 'D') return 'set2'
  return null
}

export const numOffsetForSide = (side: GridMonitorSide): number =>
  side === 'left' ? 0 : 3

export const isLeftGridSide = (prefix: string): boolean => {
  const parsed = parseGridPosition(`${prefix}1`)
  return parsed?.side === 'left'
}

/** 모니터 좌/우의 전반(set1) 구역 prefix — 좌측 A, 우측 B */
export const gridSidePrefix = (isLeft: boolean): GridGroupPrefix =>
  isLeft ? 'A' : 'B'

export const buildGridPosition = (group: GridGroupPrefix, num: number): string =>
  `${group}${num}`

/**
 * 모든 서킷은 3화면 기준 전반 A/B, 후반 C/D 배치를 사용한다.
 * 과거 AMRAP/EMOM 보정용 훅은 호환을 위해 남기되 더 이상 스왑하지 않는다.
 */
export const circuitNeedsHalfSwap = (circuitType?: string): boolean => {
  void circuitType
  return false
}

/** @deprecated 모든 서킷이 같은 3화면 배치를 쓰므로 더 이상 호출 경로에서 사용하지 않는다. */
export const swapGridHalfPosition = (raw: unknown): string => {
  const s = normalizeGridPosition(raw)
  const m = s.match(/^([ABCD])([1-3])$/)
  if (!m) return s
  const prefix = m[1]
  const swapped = prefix === 'B' ? 'C' : prefix === 'C' ? 'B' : prefix
  return `${swapped}${m[2]}`
}

/** @deprecated 모든 서킷이 같은 3화면 배치를 쓰므로 항상 입력값을 그대로 반환한다. */
export const applyCircuitHalfSwap = (raw: unknown, circuitType?: string): string => {
  const s = String(raw ?? '')
  if (!circuitNeedsHalfSwap(circuitType)) return s
  const m = s.match(/^([ABCD])([1-3])$/)
  if (!m) return s
  return swapGridHalfPosition(s)
}

export const isMainGridPosition = (pos: string): boolean =>
  /^[ABCDabcd][1-3]$/.test(pos.trim())
  || /^[ABab][4-6]$/.test(pos.trim())
  || /^[LRlr][1-6]$/.test(pos.trim())
