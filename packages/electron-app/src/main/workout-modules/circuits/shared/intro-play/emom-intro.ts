/**
 * EMOM: 인트로 중앙 패널(프리뷰 정렬, 라운드 표시 등). 영상 그리드는 intro-grid-sequences.ts.
 */
import type { WorkoutModuleContext } from '../base-module'
import type { PreloadManager } from '../preload-manager'
import { sortEmomDisplaySequences } from '../../emom/emom-constants'
import { collectHalfLapIntroGridSequences, composeHalfLapMainPreviewOrdered } from './intro-grid-sequences'

export const collectEmomIntroSequences = <T extends { round: number | string; position?: string }>(
  allExercises: T[],
  rounds: number[],
  mainRound: number,
  isStretchingOrCoolDownRound: (r: number) => boolean,
  halfRoundsCount: number = 3,
): T[] =>
  collectHalfLapIntroGridSequences(
    allExercises,
    rounds,
    mainRound,
    isStretchingOrCoolDownRound,
    halfRoundsCount,
    sortEmomDisplaySequences,
  )

export const buildEmomPreviewFirstRoundOrdered = (
  exercises: any[],
  minRound: number,
  isStretchingRound: boolean,
  firstRoundExercises: any[],
  isStretchingOrCoolDownRound: (r: number) => boolean,
  halfRoundsCount: number = 3,
): any[] => {
  let firstRoundOrdered = firstRoundExercises
  if (!isStretchingRound && firstRoundExercises.length > 0) {
    firstRoundOrdered = composeHalfLapMainPreviewOrdered(
      exercises,
      isStretchingOrCoolDownRound,
      halfRoundsCount,
      sortEmomDisplaySequences,
    )
  } else if (firstRoundExercises.length > 0) {
    firstRoundOrdered = sortEmomDisplaySequences(
      minRound,
      [...firstRoundExercises],
      halfRoundsCount,
    )
  }
  return firstRoundOrdered
}

export const orderEmomPreviewSequences = (
  round: number,
  roundExercises: any[],
  halfRoundsCount: number,
): any[] => sortEmomDisplaySequences(round, roundExercises, halfRoundsCount)

export const primeEmomIntroStartPreload = (
  ctx: WorkoutModuleContext,
  preloadManager: PreloadManager,
  round: number,
): void => {
  preloadManager.requestPreloadForMainRoundGroup(ctx, round, 0)
}
