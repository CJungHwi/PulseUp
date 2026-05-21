import type { WorkoutModuleContext } from '../shared/base-module'
import { log } from '../shared/base-module'
import type { PreloadManager } from '../shared/preload-manager'
import { buildTimelineForAMRAP, getPreloadWindow } from '../shared/timeline-utils'

export const preloadCoolDownForAmrap = (
  ctx: WorkoutModuleContext,
  preloadManager: PreloadManager,
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
  preloadManager.requestPreloadForStretchingGroup(ctx, 99, 0)
  log('📹 [AmrapModule] CD 영상 프리로드 요청')
}

export const preloadAmrapFromTimeline = (ctx: WorkoutModuleContext, currentIndex: number): void => {
  if (!ctx.activePlaySession) return
  try {
    const { flat } = buildTimelineForAMRAP(ctx.activePlaySession.sequences)
    const entries = getPreloadWindow(flat, currentIndex, 6)
    if (entries.length === 0) return
    const sequences = entries.map((e) => ({ ...e.sequence, position: e.position }))
    const preloadKey = `amrap-timeline:${currentIndex}`
    if (ctx.preloadedGroupKeys.has(preloadKey)) return
    ctx.preloadedGroupKeys.add(preloadKey)
    ctx.broadcastToAllWindows('workout-play-preload', {
      round: 0,
      groupIndex: 0,
      sequences,
      syncStartAtMs: Date.now(),
      metadata: ctx.activePlaySession.metadata,
    })
    log(`📹 [AmrapModule] 타임라인 프리로드: ${sequences.length}개 (currentIndex: ${currentIndex})`)
  } catch (err) {
    log(`⚠️ [AmrapModule] 타임라인 프리로드 실패:`, err)
  }
}
