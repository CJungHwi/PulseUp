import type { WorkoutModuleContext } from '../shared/base-module'
import { log } from '../shared/base-module'
import type { PreloadManager } from '../shared/preload-manager'
import {
  computeEmomLapIndex,
  computeEmomPlanRowInHalf,
  getActiveSetForEmomRound,
  getEmomHalfGroupIndex,
  resolveEmomStepDurationSec,
  sortEmomDisplaySequences,
} from './emom-constants'
import { getHalfRoundsCountFromSession } from '../shared/half-rounds-meta'
import {
  preloadCoolDownForEmom,
  preloadEmomCurrentRoundGrid,
  preloadEmomFromTimeline,
  preloadNextEmomGroup,
  preloadNextEmomGroupDuringWater,
} from './emom-preload'
import { getScreenMode } from '../../../screen-mode-store'

export interface EmomMainRoundController {
  stopped: () => boolean
  preloadManager: PreloadManager
  executeNext: () => void
}

export const runEmomMainRound = (
  ctx: WorkoutModuleContext,
  ctrl: EmomMainRoundController,
  currentIndex: number,
  currentRound: number,
): void => {
  if (!ctx.activePlaySession) return

  const roundExercises = ctx.activePlaySession.sequences.filter(
    (s) =>
      s.round === currentRound &&
      s.exercise_type === 'exercise' &&
      s.exercise_name !== '임시운동' &&
      s.duration > 0,
  )

  if (roundExercises.length === 0) {
    ctx.activePlaySession.currentSequenceIndex++
    ctrl.executeNext()
    return
  }

  const halfRounds = getHalfRoundsCountFromSession(ctx.activePlaySession)
  const displaySequences = sortEmomDisplaySequences(
    currentRound,
    roundExercises,
    halfRounds,
  )
  const activeSet = getActiveSetForEmomRound(currentRound, halfRounds)
  const emomGroupIndex = getEmomHalfGroupIndex(currentRound, halfRounds)

  const prevGroup = ctx._lastStressGroupIndex
  ctx.setLastStressGroupIndex(emomGroupIndex)
  const isGroupChanged = prevGroup !== emomGroupIndex
  const isFiveScreenMode = getScreenMode() === 'five'

  if (isGroupChanged && emomGroupIndex > 0 && prevGroup >= 0) {
    if (isFiveScreenMode) {
      log('🎬 [EmomModule] 5-screen: 후반 전용 패널 사용으로 슬롯 advance 생략')
    } else {
      ctx.broadcastToAllWindows('workout-advance-slots', { slots: [1, 2, 3] })
    }
  }

  let totalDuration = 0
  for (let i = currentIndex; i < ctx.activePlaySession.sequences.length; i++) {
    const seq = ctx.activePlaySession.sequences[i]
    if (seq.round !== currentRound) break
    totalDuration += resolveEmomStepDurationSec(seq.duration)
  }

  log(
    `🎬 [EmomModule] Round ${currentRound} 시작 (${displaySequences.length}개 영상, 총 ${totalDuration}초, EMOM 전용 메인 라운드)`,
  )

  if (!isFiveScreenMode) {
    preloadEmomFromTimeline(ctx, currentIndex)
    // 전반: L4–6 블록 선로드. 후반에서 emomGroupIndex=1을 넘기면 (1+1)*3+1=7 로 잡혀 빈 프리로드만 됨
    if (emomGroupIndex === 0) {
      preloadNextEmomGroup(ctx, 0, currentRound)
    }
    preloadEmomCurrentRoundGrid(ctx, currentRound, displaySequences)
  } else {
    log('📹 [EmomModule] 5-screen: main 구간 추가 preload 생략')
  }
  preloadCoolDownForEmom(ctx, ctrl.preloadManager)

  const syncStartAtMs = Date.now() + 2500
  displaySequences.forEach((seq, ordIdx) => {
    ctx.broadcastToAllWindows('workout-play-sequence', {
      sequence: seq,
      round: currentRound,
      totalRounds: ctx.activePlaySession!.totalRounds,
      duration: totalDuration,
      position: seq.position,
      activeSet,
      sequenceIndex: currentIndex,
      totalSequences: ctx.activePlaySession!.sequences.length,
      metadata: ctx.activePlaySession!.metadata,
      syncStartAtMs,
      emomExerciseOrdinal: ordIdx + 1,
      emomExerciseTotal: roundExercises.length,
    })
  })

  const totalSets = halfRounds
  const roundSetNumber = computeEmomPlanRowInHalf(currentRound, halfRounds)
  let sequenceIndex = currentIndex
  let currentExercisePosition: string | null = null

  const executeRoundSequences = (): void => {
    if (ctrl.stopped() || !ctx.activePlaySession) return
    if (sequenceIndex >= ctx.activePlaySession.sequences.length) return

    const seq = ctx.activePlaySession.sequences[sequenceIndex]
    if (seq.round !== currentRound) {
      ctx.activePlaySession.currentSequenceIndex = sequenceIndex
      ctrl.executeNext()
      return
    }

    if (seq.exercise_type === 'rest' || seq.exercise_type === 'water') {
      const nextSeq = ctx.activePlaySession.sequences[sequenceIndex + 1]
      if (
        nextSeq &&
        (nextSeq.exercise_type === 'countdown' ||
          ctx.isStretchingOrCoolDownRound(nextSeq.round))
      ) {
        log(`⏭️ [EmomModule] 전환 직전 ${seq.exercise_type} 스킵`)
        sequenceIndex++
        executeRoundSequences()
        return
      }
    }

    if (seq.exercise_type === 'exercise') {
      if (currentExercisePosition !== seq.position) {
        currentExercisePosition = seq.position || null
        log(`🔄 [EmomModule] 운동 위치: ${seq.position}`)
      }

      const lapIndex = computeEmomLapIndex(seq.position)
      const emomExerciseOrdinal = Math.max(1, roundExercises.indexOf(seq) + 1)

      if (!isFiveScreenMode) {
        preloadEmomFromTimeline(ctx, sequenceIndex)
      }
      const stepSec = resolveEmomStepDurationSec(seq.duration)
      // workout_exercises_logic.md: 랩 순서 L1→…→R1 / L4→…→R4 — 매 스텝 실제 position 필수
      // (KEEP_VIDEO만 쓰면 MainRenderer가 포지션·set 전환 없이 resume만 해 후반 슬롯이 비는 문제)
      ctx.broadcastToAllWindows('workout-play-sequence', {
        sequence: seq,
        round: currentRound,
        totalRounds: ctx.activePlaySession.totalRounds,
        duration: stepSec,
        position: seq.position || 'L1',
        activeSet,
        sequenceIndex,
        totalSequences: ctx.activePlaySession.sequences.length,
        metadata: ctx.activePlaySession.metadata,
        currentSet: roundSetNumber,
        totalSets,
        lapIndex,
        totalLaps: 6,
        emomExerciseOrdinal,
        emomExerciseTotal: roundExercises.length,
      })
    } else {
      const lapIndex = computeEmomLapIndex(currentExercisePosition || seq.position)
      const lastExerciseIndex = findLastExerciseIndexInRound(
        ctx,
        sequenceIndex,
        currentRound,
        roundExercises,
      )
      const emomExerciseOrdinal =
        lastExerciseIndex >= 0 ? Math.min(lastExerciseIndex + 1, roundExercises.length) : 1

      log(
        `[EmomModule] ${seq.exercise_type === 'rest' ? '휴식' : '물보충'} - RND ${roundSetNumber}/${totalSets}, LAP ${lapIndex}/6`,
      )

      const stepSecRest = resolveEmomStepDurationSec(seq.duration)
      ctx.broadcastToAllWindows('workout-play-sequence', {
        sequence: seq,
        round: currentRound,
        totalRounds: ctx.activePlaySession.totalRounds,
        duration: stepSecRest,
        position: 'KEEP_VIDEO',
        activeSet,
        sequenceIndex,
        totalSequences: ctx.activePlaySession.sequences.length,
        metadata: ctx.activePlaySession.metadata,
        currentSet: roundSetNumber,
        totalSets,
        lapIndex,
        totalLaps: 6,
        emomExerciseOrdinal,
        emomExerciseTotal: roundExercises.length,
      })

      if (seq.exercise_type === 'water') {
        if (isFiveScreenMode) {
          log('💧 [EmomModule] 5-screen: 물보충 중 main 그룹 preload 생략')
        } else {
          preloadNextEmomGroupDuringWater(ctx, seq, sequenceIndex, currentRound)
          preloadEmomFromTimeline(ctx, sequenceIndex)
        }
      }
    }

    if (!isFiveScreenMode && (seq.exercise_type === 'rest' || seq.exercise_type === 'water')) {
      preloadEmomFromTimeline(ctx, sequenceIndex)
    }

    ctx.schedulePlayTimer(() => {
      sequenceIndex++
      executeRoundSequences()
    }, resolveEmomStepDurationSec(seq.duration) * 1000)
  }

  executeRoundSequences()
}

const findLastExerciseIndexInRound = (
  ctx: WorkoutModuleContext,
  currentSeqIndex: number,
  currentRound: number,
  roundExercises: any[],
): number => {
  for (let i = currentSeqIndex - 1; i >= 0; i--) {
    const seq = ctx.activePlaySession?.sequences[i]
    if (!seq) continue
    if (seq.round === currentRound && seq.exercise_type === 'exercise') {
      return roundExercises.indexOf(seq)
    }
  }
  return -1
}
