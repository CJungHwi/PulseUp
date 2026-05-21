import type { ExerciseSequence, ActiveSet } from '../../../types'

/**
 * Loop 메인 순서 — dynamic stretching 메인 구간과 동일
 * 전반전: L1→L2→L3→R3→R2→R1, 후반전: L4→L5→L6→R6→R5→R4
 */
export const LOOP_LAP_ORDER: readonly string[] = [
  'L1', 'L2', 'L3', 'R3', 'R2', 'R1',
  'L4', 'L5', 'L6', 'R6', 'R5', 'R4',
]

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
    const pos = seq.position || 'L1'
    if (!positionMap.has(pos)) positionMap.set(pos, seq)
  }
  const half = getLoopHalfGroupIndex(round, halfRounds)
  const order = LOOP_LAP_ORDER.slice(half * 6, half * 6 + 6)
  return order.map((pos) => positionMap.get(pos)).filter((s): s is ExerciseSequence => !!s)
}

/** Stress와 동일한 lap 표시 (후반전은 1~6 랩으로 정규화) */
export const computeLoopLapIndex = (position: string | undefined, round: number): number => {
  const idx = LOOP_LAP_ORDER.indexOf(position || '')
  const lapIndexRaw = idx >= 0 ? idx + 1 : 1
  const posMatch = (position || '').match(/^[LR](\d+)$/)
  const posNum = posMatch ? parseInt(posMatch[1], 10) : 1
  const isSecondHalf = posNum >= 4
  return isSecondHalf ? ((lapIndexRaw - 1) % 6) + 1 : lapIndexRaw <= 6 ? lapIndexRaw : 1
}
