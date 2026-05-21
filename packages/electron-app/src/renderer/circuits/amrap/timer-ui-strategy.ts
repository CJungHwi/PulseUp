import { fillStressLikeRoundCells, stressTimerUiStrategy } from '../stress/timer-ui-strategy.js'
import type { TimerUiStrategy } from '../timer-ui-strategy-types.js'

export const amrapTimerUiStrategy: TimerUiStrategy = {
  ...stressTimerUiStrategy,
  fillRoundCells: fillStressLikeRoundCells,
  useMmSsCountdownInPhase: (phase) => phase !== 0 && phase !== 99,
}
