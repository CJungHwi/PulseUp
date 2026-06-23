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
 * → 3화면 전반 A/B · 후반 C/D 배치
 */
export const STRESS_LAP_ORDER: readonly string[] = [
  'A1', 'A2', 'A3', 'B3', 'B2', 'B1',
  'C1', 'C2', 'C3', 'D3', 'D2', 'D1',
]

/**
 * AMRAP/EMOM snake lap 순서 — 현재 모든 Main 서킷과 동일
 * 전반(블록1): A1→A2→A3→B3→B2→B1,
 * 후반(블록2): C1→C2→C3→D3→D2→D1
 * 6개씩 그룹핑되어 한 블록이 좌3+우3 동시 재생된다.
 */
export const AMRAP_EMOM_LAP_ORDER: readonly string[] = [
  'A1', 'A2', 'A3', 'B3', 'B2', 'B1',
  'C1', 'C2', 'C3', 'D3', 'D2', 'D1',
]

/** 서킷 타입별 lap 순서 — 모든 서킷은 전반 A/B, 후반 C/D */
export const lapOrderForCircuit = (circuitType?: string): readonly string[] => {
  void circuitType
  return AMRAP_EMOM_LAP_ORDER
}

export const DEFAULT_GRID_POSITION = 'A1'

export type ParsedGridPosition = {
  prefix: GridGroupPrefix
  num: number
  /** 모니터 좌/우 — A,C=left / B,D=right */
  side: GridMonitorSide
  /** 구역 내 슬롯 1-3 */
  slot: number
  /** set1=전반(A,B), set2=후반(C,D) */
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

/** 구 A/B(1~6)·L/R 저장 데이터인지 판별 — C/D 또는 신규 B1~B3 단독은 제외 */
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

/** L/R·구 A/B(1~6)·신 A~D position을 canonical A~D(1~3) 형식으로 정규화. DS/CD 등은 그대로 반환 */
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

/** 인덱스(0-based)로 메인 position 부여 — A1~A3, B1~B3, C1~C3, D1~D3 순차 */
export const positionFromMainIndex = (idx: number): string => {
  const groupIdx = Math.min(Math.floor(idx / 3), GRID_GROUP_PREFIXES.length - 1)
  const slot = (idx % 3) + 1
  return `${GRID_GROUP_PREFIXES[groupIdx]}${slot}`
}

/** position 기준 정렬 값 */
export const getMainPositionSortValue = (pos?: string): number => {
  if (!pos) return 999
  const normalized = normalizeGridPosition(pos)
  const m = normalized.match(/^([ABCD])(\d+)$/i)
  if (m) {
    const groupIdx = GRID_GROUP_PREFIXES.indexOf(m[1].toUpperCase() as GridGroupPrefix)
    const num = parseInt(m[2], 10)
    if (groupIdx >= 0 && num >= 1 && num <= 3) {
      return groupIdx * 3 + (num - 1)
    }
  }

  const legacy = pos.match(/([A-Z]+)(\d+)/)
  if (!legacy) {
    const n = parseInt(pos, 10)
    return Number.isNaN(n) ? 999 : n
  }
  const p = legacy[1]
  const n = parseInt(legacy[2], 10)
  if (p === 'DS' || p === 'CD') return n
  return 999
}

export const isMainGridPosition = (pos: string): boolean =>
  /^[ABCDabcd][1-3]$/.test(pos.trim())
  || /^[ABab][4-6]$/.test(pos.trim())
  || /^[LRlr][1-6]$/.test(pos.trim())
