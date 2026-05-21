import type { RoundCellsContext, RoundCellsResult, TimerUiStrategy } from '../timer-ui-strategy-types.js'

export const fillStressLikeRoundCells = (ctx: RoundCellsContext): RoundCellsResult => {
  const { data, currentRound, selfTotalRounds } = ctx
  const nextSelfTotalRounds = data.totalRounds || 1
  const totalText: string | null = String(nextSelfTotalRounds)
  const out: RoundCellsResult = {
    currentText: null,
    totalText,
    nextSelfTotalRounds,
  }

  if (currentRound === 99) {
    out.currentText = String(selfTotalRounds)
  } else if (currentRound !== 0 && currentRound !== 99) {
    out.currentText = String(currentRound)
    out.nextSelfCurrentRound = currentRound
  }

  return out
}

export const stressTimerUiStrategy: TimerUiStrategy = {
  mainTrainingRoundColumnLabel: 'RND',
  exerciseCountMode: 'per-sequence',
  fillRoundCells: fillStressLikeRoundCells,
  useMmSsCountdownInPhase: (phase) => {
    void phase
    return false
  },
}
