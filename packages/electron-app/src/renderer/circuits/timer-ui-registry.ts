import type { WorkoutCircuitType } from '../components/workout-timer-circuit.js'
import { amrapTimerUiStrategy } from './amrap/timer-ui-strategy.js'
import { emomTimerUiStrategy } from './emom/timer-ui-strategy.js'
import { loopTimerUiStrategy } from './loop/timer-ui-strategy.js'
import { stressTimerUiStrategy } from './stress/timer-ui-strategy.js'
import type { TimerUiStrategy } from './timer-ui-strategy-types.js'

export type { TimerUiStrategy, ExerciseCountMode, RoundCellsContext, RoundCellsResult } from './timer-ui-strategy-types.js'

export const getTimerUiStrategy = (circuitType: WorkoutCircuitType): TimerUiStrategy => {
  switch (circuitType) {
    case 'loop':
      return loopTimerUiStrategy
    case 'amrap':
      return amrapTimerUiStrategy
    case 'emom':
      return emomTimerUiStrategy
    case 'stress':
    default:
      return stressTimerUiStrategy
  }
}
