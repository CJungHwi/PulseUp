import { normalizeGridPosition } from '../../../../common/grid-position-codes.js'

export const STRESS_GROUP_SIZE = 6

type StressMainSequence = {
  round: number | string
  exercise_type?: string
  exercise_name?: string
  duration?: number
  position?: string
}

export type StressOrderInfo = {
  groupIndex: number
  lapIndex: number
  totalLaps: number
  ordinal: number
  position: string
}

const isStressMainExercise = (seq: StressMainSequence): boolean => {
  const round = Number(seq.round)
  return (
    Number.isFinite(round) &&
    round > 0 &&
    round < 99 &&
    seq.exercise_type === 'exercise' &&
    seq.exercise_name !== '임시운동' &&
    (seq.duration ?? 0) > 0
  )
}

export const collectStressOrderedMainPositions = (
  sequences: StressMainSequence[],
): string[] => {
  const positions: string[] = []
  const seen = new Set<string>()

  for (const seq of sequences) {
    if (!isStressMainExercise(seq)) continue

    const position = normalizeGridPosition(seq.position || '')
    if (!position || seen.has(position)) continue

    seen.add(position)
    positions.push(position)
  }

  return positions
}

export const getStressOrderInfo = (
  sequences: StressMainSequence[],
  sequence: StressMainSequence | null | undefined,
): StressOrderInfo => {
  const position = normalizeGridPosition(sequence?.position || '')
  const orderedPositions = collectStressOrderedMainPositions(sequences)
  const index = Math.max(0, orderedPositions.indexOf(position))
  const ordinal = index + 1

  return {
    groupIndex: Math.floor(index / STRESS_GROUP_SIZE),
    lapIndex: (index % STRESS_GROUP_SIZE) + 1,
    totalLaps: STRESS_GROUP_SIZE,
    ordinal,
    position,
  }
}

export const collectStressGroupExercises = (
  sequences: StressMainSequence[],
  groupIndex: number,
): any[] => {
  const orderedPositions = collectStressOrderedMainPositions(sequences)
  const groupPositions = orderedPositions.slice(
    groupIndex * STRESS_GROUP_SIZE,
    (groupIndex + 1) * STRESS_GROUP_SIZE,
  )

  return groupPositions
    .map((position) => {
      const seq = sequences.find(
        (candidate) =>
          isStressMainExercise(candidate) &&
          normalizeGridPosition(candidate.position || '') === position,
      )
      return seq ? { ...seq, position } : null
    })
    .filter(Boolean)
}
