import { describe, expect, it } from 'vitest'

import {
  buildMainHalfGroupPositionSet,
  collectMainHalfGroupExercises,
  getMainHalfGroupIndexFromPosition,
  isSecondMainHalfPosition,
} from './main-half-group-utils.js'

describe('main-half-group-utils', () => {
  it('group index from A~D position (전반 A/B, 후반 C/D)', () => {
    expect(getMainHalfGroupIndexFromPosition('A1')).toBe(0)
    expect(getMainHalfGroupIndexFromPosition('B1')).toBe(0)
    expect(getMainHalfGroupIndexFromPosition('C3')).toBe(1)
    expect(isSecondMainHalfPosition('D3')).toBe(true)
  })

  it('buildMainHalfGroupPositionSet', () => {
    expect([...buildMainHalfGroupPositionSet(0)].sort()).toEqual([
      'A1', 'A2', 'A3', 'B1', 'B2', 'B3',
    ])
    expect([...buildMainHalfGroupPositionSet(1)].sort()).toEqual([
      'C1', 'C2', 'C3', 'D1', 'D2', 'D3',
    ])
    expect(buildMainHalfGroupPositionSet(2).size).toBe(0)
  })

  it('collectMainHalfGroupExercises', () => {
    const seqs = [
      { round: 1, exercise_type: 'exercise', exercise_name: 'X', duration: 30, position: 'A1' },
      { round: 1, exercise_type: 'exercise', exercise_name: 'Y', duration: 30, position: 'A2' },
      { round: 1, exercise_type: 'exercise', exercise_name: 'Z', duration: 30, position: 'B1' },
    ]
    const g0 = collectMainHalfGroupExercises(seqs, 0)
    expect(g0.size).toBe(3)
    expect(g0.has('A1')).toBe(true)
    expect(g0.has('A2')).toBe(true)
    expect(g0.has('B1')).toBe(true)
  })
})
