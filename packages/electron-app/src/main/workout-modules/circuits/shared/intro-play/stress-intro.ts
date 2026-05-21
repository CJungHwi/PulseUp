/**
 * Stress: 인트로 프리뷰 정렬. 영상 그리드는 intro-grid-sequences의 첫 메인 라운드 정렬.
 */
import type { WorkoutModuleContext } from '../base-module'
import type { PreloadManager } from '../preload-manager'
import { sortIntroMainPreviewSequences } from '../intro-shared'
import { collectFirstMainSortedIntroGridSequences } from './intro-grid-sequences'

export const collectStressIntroSequences = <T extends { round: number | string; position?: string }>(
  allExercises: T[],
  mainRound: number,
): T[] => collectFirstMainSortedIntroGridSequences(allExercises, mainRound)

export const buildStressPreviewFirstRoundOrdered = (
  _exercises: any[],
  _minRound: number,
  isStretchingRound: boolean,
  firstRoundExercises: any[],
): any[] =>
  isStretchingRound ? firstRoundExercises : sortIntroMainPreviewSequences(firstRoundExercises)

export const primeStressIntroStartPreload = (
  ctx: WorkoutModuleContext,
  preloadManager: PreloadManager,
  round: number,
): void => {
  preloadManager.requestPreloadForMainRoundGroup(ctx, round, 0)
}
