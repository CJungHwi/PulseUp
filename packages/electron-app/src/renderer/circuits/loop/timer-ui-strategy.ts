import type { RoundCellsContext, RoundCellsResult, TimerUiStrategy } from '../timer-ui-strategy-types.js'

const fillLoopRoundCells = (ctx: RoundCellsContext): RoundCellsResult => {
  const { data } = ctx
  if (data.currentSet && data.totalSets) {
    return {
      currentText: String(data.currentSet),
      totalText: String(data.totalSets),
      debugLog: `🔢 Loop SET 표시: ${data.currentSet}/${data.totalSets}`,
    }
  }
  return { currentText: null, totalText: null }
}

export const loopTimerUiStrategy: TimerUiStrategy = {
  mainTrainingRoundColumnLabel: 'SET',
  exerciseCountMode: 'loop-sets',
  fillRoundCells: fillLoopRoundCells,
  useMmSsCountdownInPhase: (phase) => {
    void phase
    return false
  },
}
