import { describe, expect, it } from 'vitest'

import {
  collectStressGroupExercises,
  collectStressOrderedMainPositions,
  getStressOrderInfo,
} from './stress-order.js'

const main = (position: string, round = 1) => ({
  round,
  exercise_type: 'exercise',
  exercise_name: position,
  duration: 30,
  position,
})

describe('stress-order', () => {
  it('uses the documented Stress order as a six-move block', () => {
    const sequences = [
      main('A1'),
      main('A2'),
      main('A3'),
      main('B3'),
      main('B2'),
      main('B1'),
      main('C1'),
      main('C2'),
      main('C3'),
      main('D3'),
      main('D2'),
      main('D1'),
    ]

    expect(collectStressOrderedMainPositions(sequences)).toEqual([
      'A1', 'A2', 'A3', 'B3', 'B2', 'B1',
      'C1', 'C2', 'C3', 'D3', 'D2', 'D1',
    ])
    expect(sequences.slice(0, 6).map((seq) => getStressOrderInfo(sequences, seq).lapIndex)).toEqual([
      1, 2, 3, 4, 5, 6,
    ])
    expect(sequences.slice(6).map((seq) => getStressOrderInfo(sequences, seq).lapIndex)).toEqual([
      1, 2, 3, 4, 5, 6,
    ])
  })

  it('keeps MOVE increasing for the first A/B block', () => {
    const sequences = [
      main('A1'),
      main('A2'),
      main('A3'),
      main('B3'),
      main('B2'),
      main('B1'),
    ]

    expect(sequences.map((seq) => getStressOrderInfo(sequences, seq).lapIndex)).toEqual([
      1, 2, 3, 4, 5, 6,
    ])
    expect(collectStressGroupExercises(sequences, 0).map((seq) => seq.position)).toEqual([
      'A1', 'A2', 'A3', 'B3', 'B2', 'B1',
    ])
  })
})
