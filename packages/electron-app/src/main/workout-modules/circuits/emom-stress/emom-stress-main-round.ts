/**
 * 소스 요약 — EMOM-Stress 메인 재생
 *
 * 기능: EMOM 카테고리 중 method_type=stress로 저장된 workout_exercises를 운동 우선 순서로 재생한다.
 * 호출 프로시저: 없음(Electron 재생 모듈, API에서 받은 workout_exercises 세션 사용).
 * 관련 components/modules: `emom-stress-module.ts`, `../emom/emom-constants.ts`, `../emom/emom-preload.ts`, `../stress/stress-order.ts`, Renderer `WorkoutPlayTimerUI`.
 * 흐름: 현재 시퀀스 position 기준 6개 그룹과 MOVE를 계산 → 그룹 변경 시 해당 6개 슬롯 영상을 표시 → 같은 그룹의 다음 SET/운동은 KEEP_VIDEO로 타이머만 갱신 → waterbreak 시 다음 그룹으로 seek.
 */
import type { WorkoutModuleContext, ActiveSet } from '../shared/base-module'
import { log } from '../shared/base-module'
import type { PreloadManager } from '../shared/preload-manager'
import { getScreenMode } from '../../../screen-mode-store'
import { DEFAULT_GRID_POSITION, normalizeGridPosition } from '../../../../common/grid-position-codes.js'
import {
  collectStressGroupExercises,
  getStressOrderInfo,
} from '../stress/stress-order'
import {
  preloadCoolDownForEmom,
  preloadEmomFromTimeline,
} from '../emom/emom-preload'
import {
  resolveEmomStepDurationSec,
} from '../emom/emom-constants'
import { getHalfRoundsCountFromSession } from '../shared/half-rounds-meta'

export interface EmomStressMainRoundController {
  stopped: () => boolean
  preloadManager: PreloadManager
  executeNext: () => void
}

type EmomStressSequence = {
  round: number | string
  exercise_type?: string
  exercise_name?: string
  duration?: number
  position?: string
}

const EMOM_STRESS_COUNTER_MODE = 'emom-stress'

const getEmomStressMetadata = (metadata?: Record<string, unknown> | null): Record<string, unknown> => ({
  ...(metadata || {}),
  emomCircuitType: 'stress',
  method_type: 'stress',
})

export const getEmomStressStepInfo = (
  sequences: EmomStressSequence[],
  sequence: EmomStressSequence | null | undefined,
  totalSets: number,
) => {
  const orderInfo = getStressOrderInfo(sequences, sequence)
  const setIndex = Math.min(
    Math.max(1, Number(sequence?.round) || 1),
    Math.max(1, totalSets),
  )

  return {
    ...orderInfo,
    setIndex,
    totalSets: Math.max(1, totalSets),
  }
}

const getActiveSetForGroup = (groupIndex: number): ActiveSet => {
  const set = groupIndex > 0 ? 'set2' : 'set1'
  return { left: set, right: set }
}

/**
 * 현재 운동의 다음 메인 운동이 "같은 위치(=같은 운동의 다음 SET)"인지 판별.
 * true이면 SET 연속 전환이므로 종료 벨을 울리지 않는다(MOVE가 바뀌는 마지막 SET에서만 벨).
 */
const isSameMoveContinuation = (
  sequences: EmomStressSequence[],
  currentIndex: number,
  currentPosition: string | undefined,
): boolean => {
  const nextMain = sequences
    .slice(currentIndex + 1)
    .find(
      (seq) =>
        Number(seq.round) > 0 &&
        Number(seq.round) < 99 &&
        seq.exercise_type === 'exercise' &&
        seq.exercise_name !== '임시운동' &&
        (seq.duration ?? 0) > 0,
    )
  if (!nextMain) return false
  const cur = normalizeGridPosition(currentPosition || '')
  const next = normalizeGridPosition(nextMain.position || '')
  return !!cur && cur === next
}

export const runEmomStressMainRound = (
  ctx: WorkoutModuleContext,
  ctrl: EmomStressMainRoundController,
  currentIndex: number,
  currentRound: number,
): void => {
  if (!ctx.activePlaySession) return

  const seq = ctx.activePlaySession.sequences[currentIndex]
  if (!seq) {
    ctrl.executeNext()
    return
  }

  if (seq.exercise_type === 'exercise') {
    runEmomStressExercise(ctx, ctrl, seq, currentIndex, currentRound)
    return
  }

  if (seq.exercise_type === 'rest' || seq.exercise_type === 'water') {
    runEmomStressRestOrWater(ctx, ctrl, seq, currentIndex, currentRound)
    return
  }

  ctx.activePlaySession.currentSequenceIndex++
  ctrl.executeNext()
}

const runEmomStressExercise = (
  ctx: WorkoutModuleContext,
  ctrl: EmomStressMainRoundController,
  currentSeq: any,
  currentIndex: number,
  currentRound: number,
): void => {
  if (!ctx.activePlaySession) return

  const totalSets = getHalfRoundsCountFromSession(ctx.activePlaySession)
  const stepInfo = getEmomStressStepInfo(
    ctx.activePlaySession.sequences,
    currentSeq,
    totalSets,
  )
  const groupIndex = stepInfo.groupIndex
  const currentGroup = collectStressGroupExercises(
    ctx.activePlaySession.sequences,
    groupIndex,
  )
  const activeSet = getActiveSetForGroup(groupIndex)
  const isFiveScreenMode = getScreenMode() === 'five'

  const prevGroupIndex = ctx._lastStressGroupIndex
  ctx.setLastStressGroupIndex(groupIndex)
  const isGroupChanged = prevGroupIndex !== groupIndex

  // 같은 운동의 다음 SET으로 이어지는 경우(SET 연속)에는 종료 벨을 울리지 않는다.
  // MOVE(운동)가 바뀌는 마지막 SET에서만 벨이 울린다.
  const suppressCountdownBell = isSameMoveContinuation(
    ctx.activePlaySession.sequences,
    currentIndex,
    currentSeq.position,
  )

  log(
    `[EmomStressModule] ${currentSeq.exercise_name} - SET ${stepInfo.setIndex}/${stepInfo.totalSets}, MOVE ${stepInfo.lapIndex}/${stepInfo.totalLaps} (pos ${currentSeq.position}, round ${currentRound})`,
  )

  if (isGroupChanged) {
    if (groupIndex > 0 && prevGroupIndex >= 0) {
      if (isFiveScreenMode) {
        log('🎬 [EmomStressModule] 5-screen: C/D 전용 패널 사용으로 슬롯 advance 생략')
      } else {
        ctx.broadcastToAllWindows('workout-advance-slots', { slots: [1, 2, 3] })
      }
    }

    const syncStartAtMs = Date.now() + 2500
    const stepSec = resolveEmomStepDurationSec(currentSeq.duration)
    currentGroup.forEach((groupSeq) => {
      ctx.broadcastToAllWindows('workout-play-sequence', {
        sequence: groupSeq,
        round: currentRound,
        totalRounds: ctx.activePlaySession!.totalRounds,
        duration: stepSec,
        position: groupSeq.position || DEFAULT_GRID_POSITION,
        activeSet,
        sequenceIndex: currentIndex,
        totalSequences: ctx.activePlaySession!.sequences.length,
        metadata: getEmomStressMetadata(ctx.activePlaySession!.metadata as Record<string, unknown>),
        counterMode: EMOM_STRESS_COUNTER_MODE,
        emomCircuitType: 'stress',
        syncStartAtMs,
        currentSet: stepInfo.setIndex,
        totalSets: stepInfo.totalSets,
        setIndex: stepInfo.setIndex,
        lapIndex: stepInfo.lapIndex,
        totalLaps: stepInfo.totalLaps,
        emomExerciseOrdinal: stepInfo.ordinal,
        emomExerciseTotal: currentGroup.length,
        suppressCountdownBell,
      })
    })

    if (!isFiveScreenMode) {
      preloadEmomFromTimeline(ctx, currentIndex)
    } else {
      log('📹 [EmomStressModule] 5-screen: main 구간 추가 preload 생략')
    }
    preloadCoolDownForEmom(ctx, ctrl.preloadManager)
  } else {
    const stepSec = resolveEmomStepDurationSec(currentSeq.duration)
    if (!isFiveScreenMode) {
      preloadEmomFromTimeline(ctx, currentIndex)
    }
    ctx.broadcastToAllWindows('workout-play-sequence', {
      sequence: currentSeq,
      round: currentRound,
      totalRounds: ctx.activePlaySession.totalRounds,
      duration: stepSec,
      position: 'KEEP_VIDEO',
      activeSet,
      sequenceIndex: currentIndex,
      totalSequences: ctx.activePlaySession.sequences.length,
      metadata: getEmomStressMetadata(ctx.activePlaySession.metadata as Record<string, unknown>),
      counterMode: EMOM_STRESS_COUNTER_MODE,
      emomCircuitType: 'stress',
      currentSet: stepInfo.setIndex,
      totalSets: stepInfo.totalSets,
      setIndex: stepInfo.setIndex,
      lapIndex: stepInfo.lapIndex,
      totalLaps: stepInfo.totalLaps,
      emomExerciseOrdinal: stepInfo.ordinal,
      emomExerciseTotal: currentGroup.length,
      suppressCountdownBell,
    })
  }

  ctx.schedulePlayTimer(() => {
    if (ctrl.stopped() || !ctx.activePlaySession) return
    ctx.activePlaySession.currentSequenceIndex++
    ctrl.executeNext()
  }, resolveEmomStepDurationSec(currentSeq.duration) * 1000)
}

const runEmomStressRestOrWater = (
  ctx: WorkoutModuleContext,
  ctrl: EmomStressMainRoundController,
  currentSeq: any,
  currentIndex: number,
  currentRound: number,
): void => {
  if (!ctx.activePlaySession) return

  const nextSeq = ctx.activePlaySession.sequences[currentIndex + 1]
  if (
    nextSeq &&
    (nextSeq.exercise_type === 'countdown' ||
      ctx.isStretchingOrCoolDownRound(nextSeq.round))
  ) {
    log(`⏭️ [EmomStressModule] 전환 직전 ${currentSeq.exercise_type} 스킵`)
    ctx.activePlaySession.currentSequenceIndex++
    ctrl.executeNext()
    return
  }

  const totalSets = getHalfRoundsCountFromSession(ctx.activePlaySession)
  const prevExercise = ctx.activePlaySession.sequences
    .slice(0, currentIndex)
    .reverse()
    .find((seq) => seq.exercise_type === 'exercise')
  const stepInfo = getEmomStressStepInfo(
    ctx.activePlaySession.sequences,
    prevExercise || currentSeq,
    totalSets,
  )
  const activeSet = getActiveSetForGroup(stepInfo.groupIndex)
  const stepSec = resolveEmomStepDurationSec(currentSeq.duration)
  const isWater = currentSeq.exercise_type === 'water'

  log(
    `[EmomStressModule] ${isWater ? '물보충' : '휴식'} - SET ${stepInfo.setIndex}/${stepInfo.totalSets}, MOVE ${stepInfo.lapIndex}/${stepInfo.totalLaps}`,
  )

  ctx.broadcastToAllWindows('workout-play-sequence', {
    sequence: currentSeq,
    round: currentRound,
    totalRounds: ctx.activePlaySession.totalRounds,
    duration: stepSec,
    position: 'KEEP_VIDEO',
    activeSet,
    sequenceIndex: currentIndex,
    totalSequences: ctx.activePlaySession.sequences.length,
    metadata: getEmomStressMetadata(ctx.activePlaySession.metadata as Record<string, unknown>),
    counterMode: EMOM_STRESS_COUNTER_MODE,
    emomCircuitType: 'stress',
    currentSet: stepInfo.setIndex,
    totalSets: stepInfo.totalSets,
    setIndex: stepInfo.setIndex,
    lapIndex: stepInfo.lapIndex,
    totalLaps: stepInfo.totalLaps,
    emomExerciseOrdinal: stepInfo.ordinal,
  })

  if (isWater) {
    handleEmomStressWaterSeek(ctx, currentIndex)
  }
  if (getScreenMode() !== 'five') {
    preloadEmomFromTimeline(ctx, currentIndex)
  }

  ctx.schedulePlayTimer(() => {
    if (ctrl.stopped() || !ctx.activePlaySession) return
    ctx.activePlaySession.currentSequenceIndex++
    ctrl.executeNext()
  }, stepSec * 1000)
}

const handleEmomStressWaterSeek = (
  ctx: WorkoutModuleContext,
  currentIndex: number,
): void => {
  if (!ctx.activePlaySession) return
  if (getScreenMode() === 'five') {
    log('💧 [EmomStressModule] 5-screen: 물보충 중 main 그룹 seek 생략')
    return
  }

  const nextExercise = ctx.activePlaySession.sequences
    .slice(currentIndex + 1)
    .find(
      (seq) =>
        Number(seq.round) > 0 &&
        Number(seq.round) < 99 &&
        seq.exercise_type === 'exercise' &&
        seq.exercise_name !== '임시운동' &&
        (seq.duration ?? 0) > 0,
    )
  if (!nextExercise) return

  const nextInfo = getStressOrderInfo(ctx.activePlaySession.sequences, nextExercise)
  ctx.setLastStressGroupIndex(nextInfo.groupIndex)
  ctx.broadcastToAllWindows('workout-seek-queue', {
    round: Number(nextExercise.round),
    position: String(nextExercise.position || DEFAULT_GRID_POSITION),
  })
}
