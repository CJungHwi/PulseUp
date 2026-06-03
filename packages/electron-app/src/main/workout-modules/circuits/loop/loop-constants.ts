import type { ExerciseSequence, ActiveSet } from '../../../types'
import {
  DEFAULT_GRID_POSITION,
  STRESS_LAP_ORDER,
  normalizeGridPosition,
  parseGridPosition,
} from '../../../../common/grid-position-codes.js'

/**
 * Loop 메인 순서 — dynamic stretching 메인 구간과 동일
 * 전반전: A1→A2→A3→B3→B2→B1, 후반전: A4→A5→A6→B6→B5→B4
 */
export const LOOP_LAP_ORDER = STRESS_LAP_ORDER

export const getLoopHalfGroupIndex = (
  round: number,
  halfRounds: number,
): 0 | 1 => {
  const hr = Math.max(1, Math.floor(halfRounds))
  return round <= hr ? 0 : 1
}

export const getActiveSetForLoopRound = (
  round: number,
  halfRounds: number,
): ActiveSet => {
  const gi = getLoopHalfGroupIndex(round, halfRounds)
  const set = gi === 0 ? 'set1' : 'set2'
  return { left: set, right: set }
}

/** 라운드에 속한 운동 시퀀스를 LAP_ORDER 기준으로 정렬 (DB 순서와 무관) */
export const sortLoopDisplaySequences = (
  round: number,
  roundExercises: ExerciseSequence[],
  halfRounds: number,
): ExerciseSequence[] => {
  const positionMap = new Map<string, ExerciseSequence>()
  for (const seq of roundExercises) {
    const pos = normalizeGridPosition(seq.position || DEFAULT_GRID_POSITION)
    if (!positionMap.has(pos)) positionMap.set(pos, seq)
  }
  const half = getLoopHalfGroupIndex(round, halfRounds)
  const order = LOOP_LAP_ORDER.slice(half * 6, half * 6 + 6)
  return order.map((pos) => positionMap.get(pos)).filter((s): s is ExerciseSequence => !!s)
}

/** Stress와 동일한 lap 표시 (후반전 prefix B는 1~6 랩으로 정규화) */
export const computeLoopLapIndex = (position: string | undefined, _round: number): number => {
  const normalized = normalizeGridPosition(position || '')
  const idx = LOOP_LAP_ORDER.indexOf(normalized)
  const lapIndexRaw = idx >= 0 ? idx + 1 : 1
  const parsed = parseGridPosition(normalized)
  const isSecondHalf = parsed?.prefix === 'B'
  return isSecondHalf ? ((lapIndexRaw - 1) % 6) + 1 : lapIndexRaw <= 6 ? lapIndexRaw : 1
}
