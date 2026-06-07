/**
 * sequencePositions — linear(1,2,3…) position 부여·정렬
 * Totalexercises(grid)는 @/utils/gridPositionCodes 사용
 */
import type { Exercise } from './types'

export const positionFromSequentialIndex = (idx: number): string => String(idx + 1)

export const getSequentialPositionSortValue = (pos?: string): number => {
  if (!pos) return 999
  const m = pos.match(/^(DS|CD)(\d+)$/i)
  if (m) return parseInt(m[2], 10)
  const n = parseInt(pos, 10)
  return Number.isNaN(n) ? 999 : n
}

export const sortExercisesLinear = (exercises: Exercise[]): Exercise[] => {
  return [...exercises].sort(
    (a, b) => getSequentialPositionSortValue(a.position) - getSequentialPositionSortValue(b.position),
  )
}

export const reorderPositionsLinear = (
  list: Exercise[],
  type: 'main' | 'dynamic' | 'cooldown',
): Exercise[] => {
  return list.map((ex, idx) => {
    let position = ''
    if (type === 'dynamic') position = `DS${idx + 1}`
    else if (type === 'cooldown') position = `CD${idx + 1}`
    else position = positionFromSequentialIndex(idx)
    return { ...ex, position }
  })
}
