/**
 * 메인 운동 그리드 position 코드
 * - prefix A/B = 전반(set1) / 후반(set2)
 * - 숫자 1-3 = 좌측 모니터, 4-6 = 우측 모니터
 * - 구형 L/R: normalizeGridPosition 으로 전치(transpose) 변환
 */

export const GRID_FIRST_HALF_PREFIX = 'A' as const
export const GRID_SECOND_HALF_PREFIX = 'B' as const

/** @deprecated A=전반 */
export const GRID_LEFT_PREFIX = GRID_FIRST_HALF_PREFIX
/** @deprecated B=후반 */
export const GRID_RIGHT_PREFIX = GRID_SECOND_HALF_PREFIX

export type GridHalfPrefix = typeof GRID_FIRST_HALF_PREFIX | typeof GRID_SECOND_HALF_PREFIX
export type GridSidePrefix = GridHalfPrefix

export type GridMonitorSide = 'left' | 'right'
export type GridActiveSet = 'set1' | 'set2'

export const MAIN_GRID_POSITION_ORDER: readonly string[] = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6',
  'B1', 'B2', 'B3', 'B4', 'B5', 'B6',
]

/** Stress/Loop snake lap 순서 (반 내 좌→우 스네이크) */
export const STRESS_LAP_ORDER: readonly string[] = [
  'A1', 'A2', 'A3', 'A6', 'A5', 'A4',
  'B1', 'B2', 'B3', 'B6', 'B5', 'B4',
]

export const DEFAULT_GRID_POSITION = 'A1'

export type ParsedGridPosition = {
  prefix: GridHalfPrefix
  num: number
  side: GridMonitorSide
  slot: number
  set: GridActiveSet
}

const LEGACY_LEFT = 'L'
const LEGACY_RIGHT = 'R'

/** 구 L/R position → A/B 전치 */
export const transposeLegacyLrToAb = (legacyPrefix: string, legacyNum: number): string => {
  const half = legacyNum <= 3 ? GRID_FIRST_HALF_PREFIX : GRID_SECOND_HALF_PREFIX
  const slot = ((legacyNum - 1) % 3) + 1
  const num = legacyPrefix.toUpperCase() === LEGACY_LEFT ? slot : slot + 3
  return `${half}${num}`
}

export const normalizeGridPosition = (raw: unknown): string => {
  const s = String(raw ?? '').trim()
  const m = s.match(/^([lLaAbBrR])(\d+)$/)
  if (!m) return s
  const prefixChar = m[1].toUpperCase()
  const num = parseInt(m[2], 10)
  if (prefixChar === GRID_FIRST_HALF_PREFIX || prefixChar === GRID_SECOND_HALF_PREFIX) {
    return `${prefixChar}${num}`
  }
  if (prefixChar === LEGACY_LEFT || prefixChar === LEGACY_RIGHT) {
    return transposeLegacyLrToAb(prefixChar, num)
  }
  return s
}

/** @deprecated normalizeGridPosition 사용 */
export const normalizeLrGridPosition = normalizeGridPosition

export const parseGridPosition = (pos?: string): ParsedGridPosition | null => {
  if (!pos) return null
  const normalized = normalizeGridPosition(pos)
  const m = normalized.match(/^([AB])(\d+)$/i)
  if (!m) return null
  const prefix = m[1].toUpperCase() as GridHalfPrefix
  const num = parseInt(m[2], 10)
  if (num < 1 || num > 6) return null
  return {
    prefix,
    num,
    side: num <= 3 ? 'left' : 'right',
    slot: ((num - 1) % 3) + 1,
    set: prefix === GRID_FIRST_HALF_PREFIX ? 'set1' : 'set2',
  }
}

export const gridSetFromPrefix = (prefix: string): GridActiveSet | null => {
  const p = prefix.toUpperCase()
  if (p === GRID_FIRST_HALF_PREFIX) return 'set1'
  if (p === GRID_SECOND_HALF_PREFIX) return 'set2'
  return null
}

export const numOffsetForSide = (side: GridMonitorSide): number =>
  side === 'left' ? 0 : 3

export const isLeftGridSide = (prefix: string): boolean => {
  const parsed = parseGridPosition(`${prefix}1`)
  return parsed?.side === 'left'
}

export const gridSidePrefix = (isLeft: boolean): GridHalfPrefix =>
  isLeft ? GRID_FIRST_HALF_PREFIX : GRID_SECOND_HALF_PREFIX

export const buildGridPosition = (half: GridHalfPrefix, num: number): string =>
  `${half}${num}`

export const isMainGridPosition = (pos: string): boolean =>
  /^[ABab][1-6]$/.test(pos.trim()) || /^[LRlr][1-6]$/.test(pos.trim())
