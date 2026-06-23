import type { WorkoutModuleContext, ActiveSet } from '../shared/base-module'
import { log } from '../shared/base-module'
import type { ExerciseSequence } from '../../../types'
import type { PreloadManager } from '../shared/preload-manager'
import { preloadAmrapFromTimeline, preloadCoolDownForAmrap } from './amrap-preload'
import { getScreenMode } from '../../../screen-mode-store'
import {
  DEFAULT_GRID_POSITION,
  normalizeGridPosition,
} from '../../../../common/grid-position-codes.js'
import { getMainHalfGroupIndexFromPosition, isSecondMainHalfPosition } from '../shared/main-half-group-utils'

const isRestOrWaterType = (t: string | undefined): boolean =>
  t === 'rest' || t === 'water'

const normalizeMainGridPosition = normalizeGridPosition

/**
 * AMRAP 메인만: 마지막 메인 블록 다음에 오는 휴식/물보충은 재생하지 않고,
 * countdown 또는 CD(round 99)·DS(round 0) 직전까지 연속된 rest/water를 한 번에 건너뛴다.
 *
 * 주의: ipc의 isStretchingOrCoolDownRound(round)는 round≠0,99일 때 major_category로
 * DS/CD를 추정한다. Round 2 메인 운동에 CD류 카테고리가 끼면 전·후반 사이 휴식까지 스킵되므로
 * 여기서는 round 번호(0·99)와 countdown만 본다.
 */
export const shouldSkipAmrapRestWaterBeforeCD = (
  sequences: ExerciseSequence[],
  currentIndex: number,
): boolean => {
  const cur = sequences[currentIndex]
  if (!cur || !isRestOrWaterType(cur.exercise_type)) return false

  let j = currentIndex + 1
  while (j < sequences.length && isRestOrWaterType(sequences[j].exercise_type)) {
    j++
  }
  if (j >= sequences.length) return false

  const next = sequences[j]
  if (next.exercise_type === 'countdown') return true

  const r = Number(next.round)
  return Number.isFinite(r) && (r === 0 || r === 99)
}

export interface AmrapMainRoundController {
  stopped: () => boolean
  preloadManager: PreloadManager
  executeNext: () => void
}

export const runAmrapRestOrWater = (
  ctx: WorkoutModuleContext,
  ctrl: AmrapMainRoundController,
  currentSeq: any,
  currentIndex: number,
  currentRound: number,
): void => {
  log(`🎬 [AmrapModule] 휴식/물보충:`, {
    type: currentSeq.exercise_type,
    duration: currentSeq.duration,
  })

  const prevExercises = ctx.activePlaySession!.sequences
    .slice(0, currentIndex)
    .filter((s) => s.exercise_type === 'exercise' && s.round > 0 && s.round < 99)
  const lastExPos = prevExercises.length > 0 ? (prevExercises[prevExercises.length - 1].position || '') : ''
  const amrapRestGroupIndex = getMainHalfGroupIndexFromPosition(lastExPos)
  const activeSet: ActiveSet = {
    left: amrapRestGroupIndex > 0 ? 'set2' : 'set1',
    right: amrapRestGroupIndex > 0 ? 'set2' : 'set1',
  }

  ctx.broadcastToAllWindows('workout-play-sequence', {
    sequence: currentSeq,
    round: currentRound,
    totalRounds: ctx.activePlaySession!.totalRounds,
    duration: currentSeq.duration,
    position: 'KEEP_VIDEO',
    activeSet,
    sequenceIndex: currentIndex,
    totalSequences: ctx.activePlaySession!.sequences.length,
    metadata: ctx.activePlaySession!.metadata,
  })

  ctx.schedulePlayTimer(() => {
    if (ctrl.stopped() || !ctx.activePlaySession) return
    ctx.activePlaySession.currentSequenceIndex++
    ctrl.executeNext()
  }, currentSeq.duration * 1000)
}

export const runAmrapMainRound = (
  ctx: WorkoutModuleContext,
  ctrl: AmrapMainRoundController,
  currentIndex: number,
  currentRound: number,
): void => {
  const cr = Number(currentRound)
  const allRoundExercises = ctx.activePlaySession!.sequences.filter(
    (s) => Number(s.round) === cr && s.exercise_type === 'exercise',
  )

  if (allRoundExercises.length === 0) {
    log(`⚠️ [AmrapModule] Round ${currentRound} 유효 운동 0개 — strict round/타입 불일치 가능, 인덱스만 진행`)
    ctx.activePlaySession!.currentSequenceIndex++
    ctrl.executeNext()
    return
  }

  log(`🎬 [AmrapModule] Round ${currentRound} 운동 동시 실행:`, {
    count: allRoundExercises.length,
    exercises: allRoundExercises.map((s) => ({
      name: s.exercise_name,
      position: s.position,
      reps: s.reps,
    })),
  })

  // Loop/EMOM과 동일: 후반(C/D) 블록 진입 시 슬롯 큐를 한 칸 진행 (A/B → C/D 영상 전환)
  const amrapHalfGroupIndex: 0 | 1 = allRoundExercises.some((s) =>
    isSecondMainHalfPosition(String(s.position || '')),
  )
    ? 1
    : 0

  const prevGroup = ctx._lastStressGroupIndex
  ctx.setLastStressGroupIndex(amrapHalfGroupIndex)
  const isGroupChanged = prevGroup !== amrapHalfGroupIndex
  const isFiveScreenMode = getScreenMode() === 'five'
  if (isGroupChanged && amrapHalfGroupIndex > 0 && prevGroup >= 0) {
    if (isFiveScreenMode) {
      log('🎬 [AmrapModule] 5-screen: 후반 전용 패널 사용으로 슬롯 advance 생략')
    } else {
      log('🎬 [AmrapModule] 전반→후반 슬롯 전환 (workout-advance-slots)')
      ctx.broadcastToAllWindows('workout-advance-slots', { slots: [1, 2, 3] })
    }
  }

  // 예시2(2-6): 후반 C/D 블록 없이 라운드만 바뀌면 큐 블록도 한 칸 advance 필요.
  const lastPlayedAmrapRound = ctx._lastAmrapMainRoundNumber
  const needSameSlotRoundAdvance =
    lastPlayedAmrapRound != null &&
    cr > lastPlayedAmrapRound &&
    amrapHalfGroupIndex === 0
  if (needSameSlotRoundAdvance) {
    if (isFiveScreenMode) {
      log('🎬 [AmrapModule] 5-screen: 동일 슬롯 라운드 advance 생략')
    } else {
      log('🎬 [AmrapModule] 동일 A/B 슬롯으로 메인 라운드만 증가(예: 설정2·운동6) — 슬롯 advance')
      ctx.broadcastToAllWindows('workout-advance-slots', { slots: [1, 2, 3] })
    }
  }

  ctx.setLastAmrapMainRoundNumber(cr)

  if (!isFiveScreenMode) {
    preloadAmrapFromTimeline(ctx, currentIndex)
  } else {
    log('📹 [AmrapModule] 5-screen: main 구간 추가 preload 생략')
  }
  preloadCoolDownForAmrap(ctx, ctrl.preloadManager)

  const maxDuration = Math.max(...allRoundExercises.map((s) => s.duration))
  const setId: 'set1' | 'set2' = amrapHalfGroupIndex === 0 ? 'set1' : 'set2'
  const activeSet: ActiveSet = { left: setId, right: setId }

  const syncStartAtMs = Date.now() + 2500
  allRoundExercises.forEach((seq) => {
    ctx.broadcastToAllWindows('workout-play-sequence', {
      sequence: seq,
      round: seq.round,
      totalRounds: ctx.activePlaySession!.totalRounds,
      duration: seq.duration,
      position: normalizeMainGridPosition(seq.position || DEFAULT_GRID_POSITION),
      activeSet,
      sequenceIndex: currentIndex,
      totalSequences: ctx.activePlaySession!.sequences.length,
      metadata: ctx.activePlaySession!.metadata,
      syncStartAtMs,
    })
  })

  ctx.schedulePlayTimer(() => {
    if (ctrl.stopped() || !ctx.activePlaySession) return
    ctx.activePlaySession.currentSequenceIndex += allRoundExercises.length
    ctrl.executeNext()
  }, maxDuration * 1000)
}
