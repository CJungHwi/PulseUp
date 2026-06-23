import { describe, expect, it } from 'vitest'

import {
  computeLoopLapIndexInRound,
  resolveLoopQueueSeekPosition,
  sortLoopRoundSequences,
} from './loop-order.js'

const main = (position: string, sequence: number, round = 1) => ({
  id: `${round}-${sequence}`,
  workout_history_master_id: 'master',
  sequence,
  round,
  exercise_type: 'exercise' as const,
  exercise_name: position,
  duration: 30,
  position,
})

describe('loop-order', () => {
  it('keeps the documented Loop round order and MOVE 1-6', () => {
    const roundExercises = [
      main('A1', 1),
      main('A2', 3),
      main('A3', 5),
      main('B3', 7),
      main('B2', 9),
      main('B1', 11),
    ]

    expect(sortLoopRoundSequences(roundExercises).map((seq) => seq.position)).toEqual([
      'A1', 'A2', 'A3', 'B3', 'B2', 'B1',
    ])
    expect(roundExercises.map((seq) => computeLoopLapIndexInRound(roundExercises, seq))).toEqual([
      1, 2, 3, 4, 5, 6,
    ])
  })

  it('does not derive MOVE from B/C prefix when the saved round order is already sequential', () => {
    const roundExercises = [
      main('A1', 1),
      main('A2', 2),
      main('A3', 3),
      main('B3', 4),
      main('B2', 5),
      main('B1', 6),
    ]

    expect(roundExercises.map((seq) => computeLoopLapIndexInRound(roundExercises, seq))).toEqual([
      1, 2, 3, 4, 5, 6,
    ])
  })

  it('resolves queue seek by Loop round half instead of raw position prefix', () => {
    expect(resolveLoopQueueSeekPosition(main('B1', 1, 4), 3)).toBe('C1')
    expect(resolveLoopQueueSeekPosition(main('D2', 1, 5), 3)).toBe('C2')
    expect(resolveLoopQueueSeekPosition(main('B3', 1, 1), 3)).toBe('A3')
  })
})
