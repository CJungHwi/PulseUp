import { describe, expect, it } from 'vitest'

import {
  resolveWorkoutCircuitType,
  resolveWorkoutMethodType,
} from './workout-timer-circuit.js'
import { emomGridCategoryLine } from '../circuits/emom/grid-display-strategy.js'

describe('workout-timer-circuit', () => {
  it('resolves EMOM-Stress as EMOM playback with stress method', () => {
    const data = {
      metadata: {
        workoutCategory: 'EMOM',
        circuitType: 'stress',
      },
    }

    expect(resolveWorkoutCircuitType(data)).toBe('emom')
    expect(resolveWorkoutMethodType(data)).toBe('stress')
  })

  it('resolves EMOM-Stress method from explicit counter mode', () => {
    expect(resolveWorkoutMethodType({
      counterMode: 'emom-stress',
      metadata: { workoutCategory: 'EMOM', circuitType: 'emom' },
    })).toBe('stress')
  })

  it('shows EMOM-Stress main grid title', () => {
    expect(emomGridCategoryLine('emom', 'A1', 'stress')).toBe('EMOM (Stress)')
    expect(emomGridCategoryLine('emom', 'A1', 'loop')).toBe('EMOM')
  })
})
