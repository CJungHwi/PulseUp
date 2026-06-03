import { describe, expect, it } from 'vitest'

import {
  buildMainHalfGroupPositionSet,
  collectMainHalfGroupExercises,
  getMainHalfGroupIndexFromPosition,
  isSecondMainHalfPosition,
} from './main-half-group-utils.js'

describe('main-half-group-utils', () => {
  it('group index from A/B position', () => {
    expect(getMainHalfGroupIndexFromPosition('A1')).toBe(0)
    expect(getMainHalfGroupIndexFromPosition('A4')).toBe(0)
    expect(getMainHalfGroupIndexFromPosition('B3')).toBe(1)
    expect(isSecondMainHalfPosition('B6')).toBe(true)
  })

  it('buildMainHalfGroupPositionSet', () => {
    expect([...buildMainHalfGroupPositionSet(0)].sort()).toEqual([
      'A1', 'A2', 'A3', 'A4', 'A5', 'A6',
    ])
    expect([...buildMainHalfGroupPositionSet(1)].sort()).toEqual([
      'B1', 'B2', 'B3', 'B4', 'B5', 'B6',
    ])
    expect(buildMainHalfGroupPositionSet(2).size).toBe(0)
  })

  it('collectMainHalfGroupExercises', () => {
    const seqs = [
      { round: 1, exercise_type: 'exercise', exercise_name: 'X', duration: 30, position: 'A1' },
      { round: 1, exercise_type: 'exercise', exercise_name: 'Y', duration: 30, position: 'A2' },
      { round: 1, exercise_type: 'exercise', exercise_name: 'Z', duration: 30, position: 'A4' },
    ]
    const g0 = collectMainHalfGroupExercises(seqs, 0)
    expect(g0.size).toBe(3)
    expect(g0.has('A1')).toBe(true)
    expect(g0.has('A2')).toBe(true)
    expect(g0.has('A4')).toBe(true)
  })
})
