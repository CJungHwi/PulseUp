import {
  normalizeGridPosition,
  parseGridPosition,
} from '../../../../common/grid-position-codes.js'

/** prefix A/B → 0(set1, 전반), C/D → 1(set2, 후반) */
export const getMainHalfGroupIndexFromPosition = (position: string): number => {
  const parsed = parseGridPosition(normalizeGridPosition(position))
  if (!parsed) return 0
  return parsed.set === 'set1' ? 0 : 1
}

export const getGridNumFromPosition = (position: string): number => {
  const parsed = parseGridPosition(normalizeGridPosition(position))
  return parsed?.num ?? 1
}

export const isSecondMainHalfPosition = (position: string): boolean =>
  getMainHalfGroupIndexFromPosition(position) === 1

/** group 0(전반) → A1–A3/B1–B3, group 1(후반) → C1–C3/D1–D3 */
export const buildMainHalfGroupPositionSet = (groupIndex: number): Set<string> => {
  if (groupIndex !== 0 && groupIndex !== 1) return new Set<string>()
  const prefixes = groupIndex === 0 ? ['A', 'B'] : ['C', 'D']
  const set = new Set<string>()
  for (const prefix of prefixes) {
    for (let num = 1; num <= 3; num++) {
      set.add(`${prefix}${num}`)
    }
  }
  return set
}

export const collectMainHalfGroupExercises = (
  sequences: Array<{ round: number | string; exercise_type?: string; exercise_name?: string; duration?: number; position?: string }>,
  groupIndex: number,
): Map<string, any> => {
  const groupPositions = buildMainHalfGroupPositionSet(groupIndex)
  const map = new Map<string, any>()
  for (const seq of sequences) {
    const r = Number(seq.round)
    const position = normalizeGridPosition(seq.position)
    if (
      r > 0 &&
      r < 99 &&
      seq.exercise_type === 'exercise' &&
      seq.exercise_name !== '임시운동' &&
      (seq.duration ?? 0) > 0 &&
      groupPositions.has(position) &&
      !map.has(position)
    ) {
      map.set(position, { ...seq, position })
    }
  }
  return map
}
