import type { WorkoutModuleContext } from '../shared/base-module'
import { log } from '../shared/base-module'
import { PreloadManager } from '../shared/preload-manager'
import { collectMainHalfGroupExercises, getMainHalfGroupIndexFromPosition } from '../shared/main-half-group-utils'
import { buildTimelineForLoop, getPreloadWindow } from '../shared/timeline-utils'
import { getScreenMode } from '../../../screen-mode-store'
import { getHalfRoundsCountFromSession } from '../shared/half-rounds-meta'
import { getLoopHalfGroupIndex } from './loop-constants'
import { resolveLoopQueueSeekPosition } from './loop-order'

/** Stress와 동일한 패턴: 타임라인 프리로드 + 다음 A/B 그룹 6슬롯 + CD 프리로드 */
export const preloadLoopFromTimeline = (ctx: WorkoutModuleContext, currentIndex: number): void => {
  if (!ctx.activePlaySession) return
  try {
    const { flat } = buildTimelineForLoop(ctx.activePlaySession.sequences)
    const window = getPreloadWindow(flat, currentIndex, 6)
    if (window.length === 0) return
    const sequences = window.map((e) => ({ ...e.sequence, position: e.position }))
    const preloadKey = `loop-timeline:${currentIndex}`
    if (ctx.preloadedGroupKeys.has(preloadKey)) return
    ctx.preloadedGroupKeys.add(preloadKey)
    ctx.broadcastToAllWindows('workout-play-preload', {
      round: 0,
      groupIndex: 0,
      sequences,
      syncStartAtMs: Date.now(),
      metadata: ctx.activePlaySession.metadata,
    })
    log(`📹 [LoopModule] 타임라인 프리로드: ${sequences.length}개 (currentIndex: ${currentIndex})`)
  } catch (err) {
    log(`⚠️ [LoopModule] 타임라인 프리로드 실패:`, err)
  }
}

const collectGroupSequences = (
  ctx: WorkoutModuleContext,
  currentGroupIndex: number,
): any[] =>
  Array.from(
    collectMainHalfGroupExercises(ctx.activePlaySession!.sequences, currentGroupIndex + 1).values(),
  )

/** 다음 A/B 그룹(6포지션) 영상 프리로드 — Stress preloadNextStressGroup 와 동일 구조 */
export const preloadNextLoopGroup = (
  ctx: WorkoutModuleContext,
  loopGroupIndex: number,
  currentRound: number,
): void => {
  const nextGroupSeqs = collectGroupSequences(ctx, loopGroupIndex)
  if (nextGroupSeqs.length === 0) return
  const nextKey = `loop:${loopGroupIndex + 1}`
  if (ctx.preloadedGroupKeys.has(nextKey)) return
  ctx.preloadedGroupKeys.add(nextKey)
  ctx.broadcastToAllWindows('workout-play-preload', {
    round: currentRound,
    groupIndex: loopGroupIndex + 1,
    sequences: nextGroupSeqs,
    syncStartAtMs: Date.now(),
    metadata: ctx.activePlaySession!.metadata,
  })
}

export const preloadCoolDownForLoop = (ctx: WorkoutModuleContext, preloadManager: PreloadManager): void => {
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
  log('📹 [LoopModule] CD 영상 프리로드 요청')
}

/** 물보충 중 다음 메인 그룹 영상 선로드 — Stress preloadNextGroupDuringWater 대응 */
export const preloadNextLoopGroupDuringWater = (
  ctx: WorkoutModuleContext,
  currentSeq: any,
  currentIndex: number,
  currentRound: number,
): void => {
  const nextExercise = ctx.activePlaySession!.sequences.slice(currentIndex + 1).find(
    (s) =>
      s.round > 0 &&
      s.round < 99 &&
      s.exercise_type === 'exercise' &&
      s.exercise_name !== '임시운동' &&
      s.duration > 0,
  )
  if (!nextExercise) return

  const halfRounds = getHalfRoundsCountFromSession(ctx.activePlaySession)
  const nextRound = Number(nextExercise.round)
  const nextLoopGroupIndex = getLoopHalfGroupIndex(nextRound, halfRounds)
  const nextPosMap = collectMainHalfGroupExercises(
    ctx.activePlaySession!.sequences,
    nextLoopGroupIndex,
  )
  const seekPosition = resolveLoopQueueSeekPosition(nextExercise, halfRounds)

  const nextActiveSet = {
    left: nextLoopGroupIndex > 0 ? 'set2' : 'set1',
    right: nextLoopGroupIndex > 0 ? 'set2' : 'set1',
  } as const

  const isFiveScreenMode = getScreenMode() === 'five'
  if (isFiveScreenMode) {
    log('💧 [LoopModule] 5-screen: 물보충 중 다음 그룹 seek 생략')
  } else {
    log(`💧 [LoopModule] 물보충 중 다음 그룹으로 큐 seek (Group ${nextLoopGroupIndex + 1}, position ${seekPosition}, source ${nextExercise.position})`)
    ctx.broadcastToAllWindows('workout-seek-queue', {
      round: nextRound,
      position: seekPosition,
    })
    ctx.setLastStressGroupIndex(nextLoopGroupIndex)
  }

  log(`💧 [LoopModule] 물보충 중 다음 그룹 영상 로드 (Group ${nextLoopGroupIndex + 1})`)
  const syncStartAtMs = Date.now() + 1000
  for (const k of nextPosMap.keys()) {
    const seq = nextPosMap.get(k)!
    ctx.broadcastToAllWindows('workout-play-sequence', {
      sequence: seq,
      round: currentRound,
      totalRounds: ctx.activePlaySession!.totalRounds,
      duration: currentSeq.duration,
      position: seq.position,
      activeSet: nextActiveSet,
      sequenceIndex: currentIndex,
      totalSequences: ctx.activePlaySession!.sequences.length,
      metadata: ctx.activePlaySession!.metadata,
      syncStartAtMs,
      isVideoPreload: true,
    })
  }
}
