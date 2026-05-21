import type { RoundCellsContext, RoundCellsResult, TimerUiStrategy } from '../timer-ui-strategy-types.js'

const fillEmomRoundCells = (ctx: RoundCellsContext): RoundCellsResult => {
  const { data, currentRound, selfTotalRounds } = ctx
  const exTotAll = Number(data.emomExerciseTotal)
  const tr =
    Number.isFinite(exTotAll) && exTotAll > 0 ? exTotAll : data.totalRounds || selfTotalRounds || 1
  const totalText = String(tr)
  const nextSelfTotalRounds = data.totalRounds || tr || 1

  const out: RoundCellsResult = {
    currentText: null,
    totalText,
    nextSelfTotalRounds,
  }

  if (currentRound > 0 && currentRound < 99) {
    const exOrd = Number(data.emomExerciseOrdinal)
    const exTot = Number(data.emomExerciseTotal)
    if (Number.isFinite(exOrd) && exOrd > 0 && Number.isFinite(exTot) && exTot > 0) {
      out.currentText = String(exOrd)
    } else {
      out.currentText = String(currentRound)
    }
    out.debugLog = `🔢 EMOM RND(운동 순번): ${data.emomExerciseOrdinal ?? currentRound}/${data.emomExerciseTotal ?? data.totalRounds ?? selfTotalRounds}`
  } else {
    if (currentRound === 99) {
      out.currentText = String(selfTotalRounds)
    } else if (currentRound !== 0) {
      out.nextSelfCurrentRound = currentRound
      out.currentText = String(currentRound)
    }
  }

  return out
}

export const emomTimerUiStrategy: TimerUiStrategy = {
  mainTrainingRoundColumnLabel: 'RND',
  exerciseCountMode: 'per-sequence',
  fillRoundCells: fillEmomRoundCells,
  useMmSsCountdownInPhase: (phase) => phase !== 0 && phase !== 99,
}
