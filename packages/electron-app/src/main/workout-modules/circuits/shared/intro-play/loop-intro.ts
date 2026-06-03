/**
 * Loop: 인트로 중앙 패널 및 프리뷰 position 힌트. 영상 그리드는 intro-grid-sequences.ts.
 */
import type { WorkoutModuleContext } from '../base-module'
import { MAIN_GRID_POSITION_ORDER } from '../../../../../common/grid-position-codes.js'
import type { PreloadManager } from '../preload-manager'
import { sortLoopDisplaySequences } from '../../loop/loop-constants'
import { collectHalfLapIntroGridSequences, composeHalfLapMainPreviewOrdered } from './intro-grid-sequences'

export const collectLoopIntroSequences = <T extends { round: number | string; position?: string }>(
  allExercises: T[],
  mainRound: number,
  rounds: number[],
  halfRoundsCount: number,
  isStretchingOrCoolDownRound: (r: number) => boolean,
): T[] =>
  collectHalfLapIntroGridSequences(
    allExercises,
    rounds,
    mainRound,
    isStretchingOrCoolDownRound,
    halfRoundsCount,
    sortLoopDisplaySequences,
  )

export const buildLoopPreviewFirstRoundOrdered = (
  exercises: any[],
  _minRound: number,
  isStretchingRound: boolean,
  firstRoundExercises: any[],
  isStretchingOrCoolDownRound: (r: number) => boolean,
  halfRoundsCount: number,
): any[] => {
  if (isStretchingRound || firstRoundExercises.length === 0) return firstRoundExercises
  return composeHalfLapMainPreviewOrdered(
    exercises,
    isStretchingOrCoolDownRound,
    halfRoundsCount,
    sortLoopDisplaySequences,
  )
}

export const orderLoopPreviewSequences = (
  round: number,
  roundExercises: any[],
  halfRoundsCount: number,
): any[] => sortLoopDisplaySequences(round, roundExercises, halfRoundsCount)

export const primeLoopIntroStartPreload = (
  ctx: WorkoutModuleContext,
  preloadManager: PreloadManager,
  round: number,
): void => {
  preloadManager.requestPreloadForMainRoundGroup(ctx, round, 0)
}

/** 카운트다운 프리뷰: Loop 전용 — position 비어 있을 때 그리드 순서 부여 */
export const tryAssignLoopPreviewGridPosition = (seq: any, selectedLength: number): void => {
  let pos = String(seq.position || '')
  if (!pos) {
    const positionOrder = [...MAIN_GRID_POSITION_ORDER].slice(0, 6)
    pos = positionOrder[selectedLength] || ''
    if (pos) seq.position = pos
  }
}
