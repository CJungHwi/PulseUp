import type { ActiveSet, ExerciseSequence } from '../../../types'
import {
  STRESS_LAP_ORDER,
} from '../../../../common/grid-position-codes.js'
import {
  computeLoopLapIndexInRound,
  getLoopRoundGroupIndex,
  sortLoopRoundSequences,
} from './loop-order'

/**
 * Loop 메인 순서 — dynamic stretching 메인 구간과 동일
 * 전반전: A1→A2→A3→B3→B2→B1, 후반전: C1→C2→C3→D3→D2→D1
 */
export const LOOP_LAP_ORDER = STRESS_LAP_ORDER

export const getLoopHalfGroupIndex = (
  round: number,
  halfRounds: number,
): 0 | 1 => getLoopRoundGroupIndex(round, halfRounds)

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
  _round: number,
  roundExercises: ExerciseSequence[],
  _halfRounds: number,
): ExerciseSequence[] => sortLoopRoundSequences(roundExercises)

/** Loop 라운드 안 저장 실행 순서 기준 lap 표시. */
export const computeLoopLapIndex = (
  roundExercises: ExerciseSequence[],
  sequence: ExerciseSequence | null | undefined,
): number => computeLoopLapIndexInRound(roundExercises, sequence)
