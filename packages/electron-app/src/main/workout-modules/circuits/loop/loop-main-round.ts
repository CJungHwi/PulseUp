import type { WorkoutModuleContext } from '../shared/base-module'
import { log } from '../shared/base-module'
import type { PreloadManager } from '../shared/preload-manager'
import {
  computeLoopLapIndex,
  getActiveSetForLoopRound,
  sortLoopDisplaySequences,
  getLoopHalfGroupIndex,
} from './loop-constants'
import { computePlanRowWithinHalf, getHalfRoundsCountFromSession } from '../shared/half-rounds-meta'
import {
  preloadCoolDownForLoop,
  preloadLoopFromTimeline,
  preloadNextLoopGroup,
  preloadNextLoopGroupDuringWater,
} from './loop-preload'
import { getScreenMode } from '../../../screen-mode-store'

export interface LoopMainRoundController {
  stopped: () => boolean
  preloadManager: PreloadManager
  executeNext: () => void
}

export const runLoopMainRound = (
  ctx: WorkoutModuleContext,
  ctrl: LoopMainRoundController,
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
  const displaySequences = sortLoopDisplaySequences(
    currentRound,
    roundExercises,
    halfRounds,
  )
  const activeSet = getActiveSetForLoopRound(currentRound, halfRounds)
  const loopGroupIndex = getLoopHalfGroupIndex(currentRound, halfRounds)

  const prevGroup = ctx._lastStressGroupIndex
  ctx.setLastStressGroupIndex(loopGroupIndex)
  const isGroupChanged = prevGroup !== loopGroupIndex
  const isFiveScreenMode = getScreenMode() === 'five'

  if (isGroupChanged && loopGroupIndex > 0 && prevGroup >= 0) {
    if (isFiveScreenMode) {
      log('🎬 [LoopModule] 5-screen: 후반 전용 패널 사용으로 슬롯 advance 생략')
    } else {
      ctx.broadcastToAllWindows('workout-advance-slots', { slots: [1, 2, 3] })
    }
  }

  let totalDuration = 0
  for (let i = currentIndex; i < ctx.activePlaySession.sequences.length; i++) {
    const seq = ctx.activePlaySession.sequences[i]
    if (seq.round !== currentRound) break
    totalDuration += seq.duration
  }

  log(`🎬 [LoopModule] Round ${currentRound} 시작 (${displaySequences.length}개 영상, 총 ${totalDuration}초, LAP 순서: Stress 동일)`)

  if (!isFiveScreenMode) {
    preloadLoopFromTimeline(ctx, currentIndex)
    preloadNextLoopGroup(ctx, loopGroupIndex, currentRound)
  } else {
    log('📹 [LoopModule] 5-screen: main 구간 추가 preload 생략')
  }
  preloadCoolDownForLoop(ctx, ctrl.preloadManager)

  const syncStartAtMs = Date.now() + 2500
  displaySequences.forEach((seq) => {
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
    })
  })

  const totalSets = halfRounds
  const roundSetNumber = computePlanRowWithinHalf(currentRound, halfRounds)
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
        (nextSeq.exercise_type === 'countdown' || ctx.isStretchingOrCoolDownRound(nextSeq.round))
      ) {
        log(`⏭️ [LoopModule] 전환 직전 ${seq.exercise_type} 스킵`)
        sequenceIndex++
        executeRoundSequences()
        return
      }
    }

    if (seq.exercise_type === 'exercise') {
      if (currentExercisePosition !== seq.position) {
        currentExercisePosition = seq.position || null
        log(`🔄 [LoopModule] 운동 위치: ${seq.position}`)
      }

      const lapIndex = computeLoopLapIndex(roundExercises, seq)
      if (!isFiveScreenMode) {
        preloadLoopFromTimeline(ctx, sequenceIndex)
      }
      ctx.broadcastToAllWindows('workout-play-sequence', {
        sequence: seq,
        round: currentRound,
        totalRounds: ctx.activePlaySession.totalRounds,
        duration: seq.duration,
        position: 'KEEP_VIDEO',
        activeSet,
        sequenceIndex,
        totalSequences: ctx.activePlaySession.sequences.length,
        metadata: ctx.activePlaySession.metadata,
        currentSet: roundSetNumber,
        totalSets,
        lapIndex,
        totalLaps: 6,
      })
    } else {
      const currentExercise = roundExercises.find((exercise) => exercise.position === currentExercisePosition)
      const lapIndex = computeLoopLapIndex(roundExercises, currentExercise || seq)
      log(
        `[LoopModule] ${seq.exercise_type === 'rest' ? '휴식' : '물보충'} - SET ${roundSetNumber}/${totalSets}, LAP ${lapIndex}/6`,
      )

      ctx.broadcastToAllWindows('workout-play-sequence', {
        sequence: seq,
        round: currentRound,
        totalRounds: ctx.activePlaySession.totalRounds,
        duration: seq.duration,
        position: 'KEEP_VIDEO',
        activeSet,
        sequenceIndex,
        totalSequences: ctx.activePlaySession.sequences.length,
        metadata: ctx.activePlaySession.metadata,
        currentSet: roundSetNumber,
        totalSets,
        lapIndex,
        totalLaps: 6,
      })

      if (seq.exercise_type === 'water') {
        if (isFiveScreenMode) {
          log('💧 [LoopModule] 5-screen: 물보충 중 main 그룹 preload 생략')
        } else {
          preloadNextLoopGroupDuringWater(ctx, seq, sequenceIndex, currentRound)
          preloadLoopFromTimeline(ctx, sequenceIndex)
        }
      }
    }

    if (!isFiveScreenMode && (seq.exercise_type === 'rest' || seq.exercise_type === 'water')) {
      preloadLoopFromTimeline(ctx, sequenceIndex)
    }

    ctx.schedulePlayTimer(() => {
      sequenceIndex++
      executeRoundSequences()
    }, seq.duration * 1000)
  }

  executeRoundSequences()
}
