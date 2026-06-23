import { describe, expect, it } from 'vitest'

import { getEmomStressStepInfo } from './emom-stress-main-round.js'
import { isEmomStressPlayback } from './emom-stress-detect.js'

const main = (position: string, round: number, sequence: number) => ({
  round,
  sequence,
  exercise_type: 'exercise',
  exercise_name: `${position}-${round}`,
  duration: 60,
  position,
})

describe('emom-stress-main-round', () => {
  it('detects EMOM-Stress from sequence shape after circuitType is normalized to emom', () => {
    const stressSequences = [
      main('A1', 1, 1),
      main('A1', 2, 2),
      main('A1', 3, 3),
      main('A2', 1, 4),
    ]
    const loopSequences = [
      main('A1', 1, 1),
      main('A2', 1, 2),
      main('A3', 1, 3),
      main('B3', 1, 4),
    ]

    expect(isEmomStressPlayback({ workoutCategory: 'EMOM', circuitType: 'emom' }, stressSequences)).toBe(true)
    expect(isEmomStressPlayback({ workoutCategory: 'EMOM', circuitType: 'emom' }, loopSequences)).toBe(false)
  })

  it('keeps EMOM-Stress playback order by exercise first, then set', () => {
    const sequences = [
      main('A1', 1, 1),
      main('A1', 2, 2),
      main('A1', 3, 3),
      main('A2', 1, 4),
      main('A2', 2, 5),
      main('A2', 3, 6),
      main('A3', 1, 7),
      main('A3', 2, 8),
      main('A3', 3, 9),
      main('B3', 1, 10),
      main('B3', 2, 11),
      main('B3', 3, 12),
      main('B2', 1, 13),
      main('B2', 2, 14),
      main('B2', 3, 15),
      main('B1', 1, 16),
      main('B1', 2, 17),
      main('B1', 3, 18),
      main('C1', 1, 19),
      main('C1', 2, 20),
      main('C1', 3, 21),
      main('C2', 1, 22),
      main('C2', 2, 23),
      main('C2', 3, 24),
      main('C3', 1, 25),
      main('C3', 2, 26),
      main('C3', 3, 27),
      main('D3', 1, 28),
      main('D3', 2, 29),
      main('D3', 3, 30),
      main('D2', 1, 31),
      main('D2', 2, 32),
      main('D2', 3, 33),
      main('D1', 1, 34),
      main('D1', 2, 35),
      main('D1', 3, 36),
    ]

    expect(getEmomStressStepInfo(sequences, sequences[0], 3)).toMatchObject({
      groupIndex: 0,
      lapIndex: 1,
      setIndex: 1,
      totalSets: 3,
    })
    expect(getEmomStressStepInfo(sequences, sequences[1], 3)).toMatchObject({
      groupIndex: 0,
      lapIndex: 1,
      setIndex: 2,
    })
    expect(getEmomStressStepInfo(sequences, sequences[15], 3)).toMatchObject({
      groupIndex: 0,
      lapIndex: 6,
      setIndex: 1,
    })
    expect(getEmomStressStepInfo(sequences, sequences[18], 3)).toMatchObject({
      groupIndex: 1,
      lapIndex: 1,
      setIndex: 1,
    })
    expect(getEmomStressStepInfo(sequences, sequences[35], 3)).toMatchObject({
      groupIndex: 1,
      lapIndex: 6,
      setIndex: 3,
      totalSets: 3,
    })
  })
})
