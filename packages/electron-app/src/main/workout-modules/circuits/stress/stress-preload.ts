import type { WorkoutModuleContext } from '../shared/base-module'
import { log } from '../shared/base-module'
import { collectMainHalfGroupExercises } from '../shared/main-half-group-utils'
import { buildTimelineForStress, getPreloadWindow } from '../shared/timeline-utils'

/** CD 스트레칭 프리로드 위임 (보통 `PreloadManager`) */
export interface StressCooldownPreloadDelegate {
  requestPreloadForStretchingGroup(
    ctx: WorkoutModuleContext,
    round: number,
    groupIndex: number,
  ): void
}

export const preloadStressFromTimeline = (ctx: WorkoutModuleContext, currentIndex: number): void => {
  if (!ctx.activePlaySession) return
  try {
    const { flat } = buildTimelineForStress(ctx.activePlaySession.sequences)
    const window = getPreloadWindow(flat, currentIndex, 6)
    if (window.length === 0) return
    const sequences = window.map((e) => ({ ...e.sequence, position: e.position }))
    const preloadKey = `stress-timeline:${currentIndex}`
    if (ctx.preloadedGroupKeys.has(preloadKey)) return
    ctx.preloadedGroupKeys.add(preloadKey)
    ctx.broadcastToAllWindows('workout-play-preload', {
      round: 0,
      groupIndex: 0,
      sequences,
      syncStartAtMs: Date.now(),
      metadata: ctx.activePlaySession.metadata,
    })
    log(`📹 [StressModule] 타임라인 프리로드: ${sequences.length}개 (currentIndex: ${currentIndex})`)
  } catch (err) {
    log(`⚠️ [StressModule] 타임라인 프리로드 실패:`, err)
  }
}

export const preloadNextStressGroup = (
  ctx: WorkoutModuleContext,
  stressGroupIndex: number,
  currentRound: number,
): void => {
  const nextPosMap = collectMainHalfGroupExercises(
    ctx.activePlaySession!.sequences,
    stressGroupIndex + 1,
  )
  const nextGroupSeqs = Array.from(nextPosMap.values())
  if (nextGroupSeqs.length > 0) {
    const nextKey = `stress:${stressGroupIndex + 1}`
    if (!ctx.preloadedGroupKeys.has(nextKey)) {
      ctx.preloadedGroupKeys.add(nextKey)
      ctx.broadcastToAllWindows('workout-play-preload', {
        round: currentRound,
        groupIndex: stressGroupIndex + 1,
        sequences: nextGroupSeqs,
        syncStartAtMs: Date.now(),
        metadata: ctx.activePlaySession!.metadata,
      })
    }
  }
}

/** Stress 메인 구간 중 CD(round=99) 영상 프리로드 */
export const preloadCoolDownForStress = (
  ctx: WorkoutModuleContext,
  delegate: StressCooldownPreloadDelegate,
): void => {
  if (!ctx.activePlaySession) return
  const hasCd = ctx.activePlaySession.sequences.some(
    (s) =>
      Number(s.round) === 99 &&
      s.exercise_type === 'exercise' &&
      s.exercise_name !== '임시운동' &&
      s.duration > 0,
  )
  if (!hasCd) return
  delegate.requestPreloadForStretchingGroup(ctx, 99, 0)
  log('📹 [StressModule] CD 영상 프리로드 요청')
}
