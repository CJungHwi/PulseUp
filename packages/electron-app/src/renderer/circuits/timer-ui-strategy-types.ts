export type ExerciseCountMode = 'loop-sets' | 'per-sequence'

export type RoundCellsContext = {
  data: any
  currentRound: number
  selfTotalRounds: number
  selfCurrentRound: number
}

export type RoundCellsResult = {
  currentText: string | null
  totalText: string | null
  nextSelfTotalRounds?: number
  nextSelfCurrentRound?: number
  debugLog?: string
}

export type TimerUiStrategy = {
  mainTrainingRoundColumnLabel: 'SET' | 'RND'
  exerciseCountMode: ExerciseCountMode
  fillRoundCells: (ctx: RoundCellsContext) => RoundCellsResult
  useMmSsCountdownInPhase: (countdownViewRound: number) => boolean
}
