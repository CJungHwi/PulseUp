import type { ExerciseSequence } from '../../../types'
import {
  normalizeGridPosition,
  parseGridPosition,
} from '../../../../common/grid-position-codes.js'

export const LOOP_GROUP_SIZE = 6

type LoopSequence = ExerciseSequence & {
  sequence?: number
  __srcIndex?: number
}

const isLoopMainExercise = (seq: LoopSequence): boolean => {
  const round = Number(seq.round)
  return (
    Number.isFinite(round) &&
    round > 0 &&
    round < 99 &&
    seq.exercise_type === 'exercise' &&
    seq.exercise_name !== '임시운동' &&
    seq.duration > 0
  )
}

const byStoredSequence = (a: LoopSequence, b: LoopSequence): number => {
  const as = Number(a.sequence ?? 0)
  const bs = Number(b.sequence ?? 0)
  if (as !== bs) return as - bs
  return Number(a.__srcIndex ?? 0) - Number(b.__srcIndex ?? 0)
}

export const sortLoopRoundSequences = (
  roundExercises: LoopSequence[],
): ExerciseSequence[] =>
  [...roundExercises]
    .filter(isLoopMainExercise)
    .sort(byStoredSequence)
    .map((seq) => ({
      ...seq,
      position: normalizeGridPosition(seq.position || ''),
    }))

export const computeLoopLapIndexInRound = (
  roundExercises: LoopSequence[],
  sequence: LoopSequence | null | undefined,
): number => {
  const position = normalizeGridPosition(sequence?.position || '')
  const ordered = sortLoopRoundSequences(roundExercises)
  const index = Math.max(0, ordered.findIndex((seq) => normalizeGridPosition(seq.position || '') === position))
  return (index % LOOP_GROUP_SIZE) + 1
}

export const getLoopRoundGroupIndex = (
  round: number,
  halfRounds: number,
): 0 | 1 => {
  const hr = Math.max(1, Math.floor(halfRounds))
  return round <= hr ? 0 : 1
}

export const resolveLoopQueueSeekPosition = (
  sequence: Pick<LoopSequence, 'round' | 'position'>,
  halfRounds: number,
): string => {
  const round = Number(sequence.round)
  const groupIndex = getLoopRoundGroupIndex(round, halfRounds)
  const slot = parseGridPosition(sequence.position || '')?.slot ?? 1
  return `${groupIndex > 0 ? 'C' : 'A'}${slot}`
}
