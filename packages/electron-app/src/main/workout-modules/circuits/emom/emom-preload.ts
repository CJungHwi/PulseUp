import type { WorkoutModuleContext } from '../shared/base-module'
import { log } from '../shared/base-module'
import type { PreloadManager } from '../shared/preload-manager'
import { collectMainHalfGroupExercises, getMainHalfGroupIndexFromPosition } from '../shared/main-half-group-utils'
import { buildTimelineForEMOM, getPreloadWindow } from '../shared/timeline-utils'
import { resolveEmomStepDurationSec } from './emom-constants'

export const preloadEmomFromTimeline = (
  ctx: WorkoutModuleContext,
  currentIndex: number,
): void => {
  if (!ctx.activePlaySession) return
  try {
    const { flat } = buildTimelineForEMOM(ctx.activePlaySession.sequences)
    const window = getPreloadWindow(flat, currentIndex, 6)
    if (window.length === 0) return
    const sequences = window.map((e) => ({ ...e.sequence, position: e.position }))
    const preloadKey = `emom-timeline:${currentIndex}`
    if (ctx.preloadedGroupKeys.has(preloadKey)) return
    ctx.preloadedGroupKeys.add(preloadKey)
    ctx.broadcastToAllWindows('workout-play-preload', {
      round: 0,
      groupIndex: 0,
      sequences,
      syncStartAtMs: Date.now(),
      metadata: ctx.activePlaySession.metadata,
    })
    log(`📹 [EmomModule] 타임라인 프리로드: ${sequences.length}개 (currentIndex: ${currentIndex})`)
  } catch (err) {
    log(`⚠️ [EmomModule] 타임라인 프리로드 실패:`, err)
  }
}

/** EMOM 전반(A/B) 기준으로 그다음 후반(C/D) 포지션 블록 수집. */
const collectNextGroupSequences = (
  ctx: WorkoutModuleContext,
  /** 0 → C1–C3/D1–D3 프리로드 */
  physicalThreeSlotGroupIndex: number,
): any[] => {
  return Array.from(
    collectMainHalfGroupExercises(ctx.activePlaySession!.sequences, physicalThreeSlotGroupIndex + 1).values(),
  )
}

/** 전반(A/B) 구간일 때 후반(C/D) 6포지션 선프리로드 — 인자는 항상 0 (첫 블록의 다음) */
export const preloadNextEmomGroup = (
  ctx: WorkoutModuleContext,
  /** 반드시 0 — 전반 전용(다음 블록=C/D). 후반에서는 호출하지 않음 */
  physicalThreeSlotGroupIndex: number,
  currentRound: number,
): void => {
  const nextGroupSeqs = collectNextGroupSequences(ctx, physicalThreeSlotGroupIndex)
  if (nextGroupSeqs.length === 0) return
  const nextKey = `emom:${physicalThreeSlotGroupIndex + 1}`
  if (ctx.preloadedGroupKeys.has(nextKey)) return
  ctx.preloadedGroupKeys.add(nextKey)
  ctx.broadcastToAllWindows('workout-play-preload', {
    round: currentRound,
    groupIndex: physicalThreeSlotGroupIndex + 1,
    sequences: nextGroupSeqs,
    syncStartAtMs: Date.now(),
    metadata: ctx.activePlaySession!.metadata,
  })
}

/** 현재 메인 라운드 표시 순서(6랩) 그대로 프리로드 — 전·후반 전환 시 빠진 슬롯 보강 */
export const preloadEmomCurrentRoundGrid = (
  ctx: WorkoutModuleContext,
  currentRound: number,
  displaySequences: any[],
): void => {
  if (!ctx.activePlaySession || displaySequences.length === 0) return
  const preloadKey = `emom-round-grid:${currentRound}`
  if (ctx.preloadedGroupKeys.has(preloadKey)) return
  ctx.preloadedGroupKeys.add(preloadKey)
  ctx.broadcastToAllWindows('workout-play-preload', {
    round: currentRound,
    groupIndex: 0,
    sequences: displaySequences.map((seq) => ({ ...seq, position: seq.position })),
    syncStartAtMs: Date.now(),
    metadata: ctx.activePlaySession.metadata,
  })
  log(`📹 [EmomModule] 라운드 그리드 프리로드: ${displaySequences.length}개 (round ${currentRound})`)
}

export const preloadCoolDownForEmom = (
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
  log('📹 [EmomModule] CD 영상 프리로드 요청')
}

/** 물보충 중 다음 메인 그룹 영상 선로드 */
export const preloadNextEmomGroupDuringWater = (
  ctx: WorkoutModuleContext,
  currentSeq: any,
  currentIndex: number,
  currentRound: number,
): void => {
  const nextExercise = ctx.activePlaySession!.sequences
    .slice(currentIndex + 1)
    .find(
      (s) =>
        s.round > 0 &&
        s.round < 99 &&
        s.exercise_type === 'exercise' &&
        s.exercise_name !== '임시운동' &&
        s.duration > 0,
    )
  if (!nextExercise) return

  const nextEmomGroupIndex = getMainHalfGroupIndexFromPosition(nextExercise.position || '')
  const nextPosMap = collectMainHalfGroupExercises(
    ctx.activePlaySession!.sequences,
    nextEmomGroupIndex,
  )

  const nextActiveSet = {
    left: nextEmomGroupIndex > 0 ? 'set2' : 'set1',
    right: nextEmomGroupIndex > 0 ? 'set2' : 'set1',
  } as const

  log(`💧 [EmomModule] 물보충 중 다음 그룹 영상 로드 (Group ${nextEmomGroupIndex + 1})`)
  const syncStartAtMs = Date.now() + 1000
  for (const k of nextPosMap.keys()) {
    const seq = nextPosMap.get(k)!
    ctx.broadcastToAllWindows('workout-play-sequence', {
      sequence: seq,
      round: currentRound,
      totalRounds: ctx.activePlaySession!.totalRounds,
      duration: resolveEmomStepDurationSec(currentSeq.duration),
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
