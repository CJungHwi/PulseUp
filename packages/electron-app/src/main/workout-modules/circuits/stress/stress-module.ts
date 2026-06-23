import type { WorkoutModuleContext, WorkoutModule, ActiveSet } from '../shared/base-module'
import { log } from '../shared/base-module'
import { StretchingModule } from '../shared/stretching-module'
import { ReadyModule } from '../shared/ready-module'
import { PreloadManager } from '../shared/preload-manager'
import {
  preloadCoolDownForStress,
  preloadNextStressGroup,
  preloadStressFromTimeline,
} from './stress-preload'
import { getScreenMode } from '../../../screen-mode-store'
import {
  collectStressGroupExercises,
  getStressOrderInfo,
} from './stress-order'

/** Stress 실행 순서: A1→A2→A3→B3→B2→B1 (전반), C1→C2→C3→D3→D2→D1 (후반) */
export class StressModule implements WorkoutModule {
  private stretchingModule = new StretchingModule()
  private readyModule = new ReadyModule()
  private preloadManager = new PreloadManager()
  private stopped = false

  execute(ctx: WorkoutModuleContext, onComplete: () => void): void {
    this.stopped = false
    this.executeNext(ctx, onComplete)
  }

  stop(): void {
    this.stopped = true
    this.stretchingModule.stop()
    this.readyModule.stop()
  }

  private executeNext(ctx: WorkoutModuleContext, onComplete: () => void) {
    if (this.stopped) return
    if (!ctx.activePlaySession) return

    if (ctx.activePlaySession.currentSequenceIndex >= ctx.activePlaySession.sequences.length) {
      log('✅ [StressModule] 운동 완료')
      ctx.activePlaySession.status = 'completed'
      ctx.broadcastToAllWindows('workout-play-completed', { session: ctx.activePlaySession })
      onComplete()
      return
    }

    const currentIndex = ctx.activePlaySession.currentSequenceIndex
    const currentSeq = ctx.activePlaySession.sequences[currentIndex]
    const currentRound = currentSeq.round

    log(`🎬 [StressModule] executeNext:`, {
      currentIndex,
      currentRound,
      exercise_name: currentSeq.exercise_name,
      exercise_type: currentSeq.exercise_type,
      duration: currentSeq.duration
    })

    if (currentSeq.exercise_type === 'countdown') {
      this.readyModule.execute(ctx, () => {
        if (!this.stopped) this.executeNext(ctx, onComplete)
      })
    } else if (ctx.isStretchingOrCoolDownRound(currentRound)) {
      this.stretchingModule.execute(ctx, () => {
        if (!this.stopped) this.executeNext(ctx, onComplete)
      })
    } else if (currentSeq.exercise_type === 'exercise') {
      this.handleMainExercise(ctx, currentSeq, currentIndex, currentRound, onComplete)
    } else {
      this.handleRestOrWater(ctx, currentSeq, currentIndex, currentRound, onComplete)
    }
  }

  private handleMainExercise(ctx: WorkoutModuleContext, currentSeq: any, currentIndex: number, currentRound: number, onComplete: () => void) {
    const isTempExercise = currentSeq.exercise_name === '임시운동' || currentSeq.duration === 0

    if (isTempExercise) {
      log(`⏭️ [StressModule] 임시운동 스킵:`, {
        exercise: currentSeq.exercise_name,
        position: currentSeq.position,
        duration: currentSeq.duration
      })
      ctx.activePlaySession!.currentSequenceIndex++
      this.executeNext(ctx, onComplete)
      return
    }

    const orderInfo = getStressOrderInfo(
      ctx.activePlaySession!.sequences,
      currentSeq,
    )
    const stressGroupIndex = orderInfo.groupIndex
    const currentGroup = collectStressGroupExercises(
      ctx.activePlaySession!.sequences,
      stressGroupIndex,
    )

    const activeSet: ActiveSet = { left: 'set1', right: 'set1' }
    if (stressGroupIndex > 0) {
      activeSet.left = 'set2'
      activeSet.right = 'set2'
    }

    const metadata = ctx.activePlaySession!.metadata || {}
    const totalSets = metadata.totalSets || 3
    const lapIndex = orderInfo.lapIndex
    const totalLaps = orderInfo.totalLaps
    const setIndex = currentRound

    log(`🎬 [StressModule] Main Workout (Round ${currentRound}, Group ${stressGroupIndex + 1}):`, {
      exercise: currentSeq.exercise_name,
      position: currentSeq.position,
      group: currentGroup.map(s => s.position),
      groupSize: currentGroup.length,
      stressGroupIndex,
      activeSet,
      lapIndex,
      totalLaps,
      setIndex,
      totalSets,
      ordinal: orderInfo.ordinal,
    })

    log(
      `[StressModule] ${currentSeq.exercise_name} - SET ${setIndex}/${totalSets}, MOVE ${lapIndex}/${totalLaps} (pos ${currentSeq.position}, round ${currentRound})`,
    )

    const prevGroupIndex = ctx._lastStressGroupIndex
    ctx.setLastStressGroupIndex(stressGroupIndex)
    const isGroupChanged = prevGroupIndex !== stressGroupIndex
    const isFiveScreenMode = getScreenMode() === 'five'

    if (isGroupChanged) {
      log(`📹 [StressModule] 새 그룹 영상 로드 (Group ${stressGroupIndex + 1}, 운동 ${currentGroup.length}개)`)

      // set1→set2 전환 시 큐 advance (첫 그룹은 카운트다운에서 이미 advance됨, 네비게이션 리셋(-1)은 제외)
      if (stressGroupIndex > 0 && prevGroupIndex >= 0) {
        if (isFiveScreenMode) {
          log('🎬 [StressModule] 5-screen: C/D 전용 패널 사용으로 슬롯 advance 생략')
        } else {
          ctx.broadcastToAllWindows('workout-advance-slots', {
            slots: [1, 2, 3]
          })
        }
      }

      const syncStartAtMs = Date.now() + 2500

      currentGroup.forEach(seq => {
        ctx.broadcastToAllWindows('workout-play-sequence', {
          sequence: seq,
          round: currentRound,
          totalRounds: ctx.activePlaySession!.totalRounds,
          duration: currentSeq.duration,
          position: seq.position,
          activeSet: activeSet,
          sequenceIndex: currentIndex,
          totalSequences: ctx.activePlaySession!.sequences.length,
          metadata: ctx.activePlaySession!.metadata,
          syncStartAtMs: syncStartAtMs,
          lapIndex,
          totalLaps,
          setIndex,
          totalSets
        })
      })

      if (!isFiveScreenMode) {
        preloadNextStressGroup(ctx, stressGroupIndex, currentRound)
        preloadStressFromTimeline(ctx, currentIndex)
      } else {
        log('📹 [StressModule] 5-screen: main 구간 추가 preload 생략')
      }
      preloadCoolDownForStress(ctx, this.preloadManager)
    } else {
      log(`⏱️ [StressModule] 타이머만 업데이트`)
      if (!isFiveScreenMode) {
        preloadStressFromTimeline(ctx, currentIndex)
      }
      ctx.broadcastToAllWindows('workout-play-sequence', {
        sequence: currentSeq,
        round: currentRound,
        totalRounds: ctx.activePlaySession!.totalRounds,
        duration: currentSeq.duration,
        position: 'KEEP_VIDEO',
        activeSet: activeSet,
        sequenceIndex: currentIndex,
        totalSequences: ctx.activePlaySession!.sequences.length,
        metadata: ctx.activePlaySession!.metadata,
        lapIndex,
        totalLaps,
        setIndex,
        totalSets
      })
    }

    ctx.schedulePlayTimer(() => {
      if (this.stopped) return
      if (!ctx.activePlaySession) return
      ctx.activePlaySession.currentSequenceIndex++
      this.executeNext(ctx, onComplete)
    }, currentSeq.duration * 1000)
  }

  private handleRestOrWater(ctx: WorkoutModuleContext, currentSeq: any, currentIndex: number, currentRound: number, onComplete: () => void) {
    // CD 직전 마지막 rest/water는 건너뛴다 (다음 시퀀스가 countdown 또는 CD 라운드이면 불필요)
    const nextSeq = ctx.activePlaySession!.sequences[currentIndex + 1]
    if (nextSeq && (nextSeq.exercise_type === 'countdown' || ctx.isStretchingOrCoolDownRound(nextSeq.round))) {
      log(`⏭️ [StressModule] CD 전환 직전 ${currentSeq.exercise_type} 스킵`)
      ctx.activePlaySession!.currentSequenceIndex++
      this.executeNext(ctx, onComplete)
      return
    }

    const isWater = currentSeq.exercise_type === 'water'
    log(`🎬 [StressModule] ${currentSeq.exercise_name} (${currentSeq.duration}초)${isWater ? ' [물보충]' : ''}`)

    const prevExercise = currentIndex > 0 ? ctx.activePlaySession!.sequences[currentIndex - 1] : null
    const restOrderInfo = getStressOrderInfo(
      ctx.activePlaySession!.sequences,
      prevExercise || currentSeq,
    )
    const posForLap = restOrderInfo.position
    const restGroupIndex = restOrderInfo.groupIndex
    const restActiveSet: ActiveSet = {
      left: restGroupIndex > 0 ? 'set2' : 'set1',
      right: restGroupIndex > 0 ? 'set2' : 'set1',
    }

    const stressLapIndex = restOrderInfo.lapIndex
    const stressTotalLaps = restOrderInfo.totalLaps
    const stressSetIndex = currentRound
    const stressTotalSets = ctx.activePlaySession!.metadata?.totalSets || 3

    log(
      `[StressModule] ${isWater ? '물보충' : '휴식'} - SET ${stressSetIndex}/${stressTotalSets}, MOVE ${stressLapIndex}/${stressTotalLaps} (pos ${posForLap}, round ${currentRound})`,
    )

    ctx.broadcastToAllWindows('workout-play-sequence', {
      sequence: currentSeq,
      round: currentRound,
      totalRounds: ctx.activePlaySession!.totalRounds,
      duration: currentSeq.duration,
      position: 'KEEP_VIDEO',
      activeSet: restActiveSet,
      sequenceIndex: currentIndex,
      totalSequences: ctx.activePlaySession!.sequences.length,
      metadata: ctx.activePlaySession!.metadata,
      lapIndex: stressLapIndex,
      totalLaps: stressTotalLaps,
      setIndex: stressSetIndex,
      totalSets: stressTotalSets
    })

    if (isWater && getScreenMode() === 'five') {
      log('💧 [StressModule] 5-screen: 물보충 중 main 그룹 preload 생략')
    } else if (isWater) {
      this.preloadNextGroupDuringWater(ctx, currentSeq, currentIndex, currentRound)
    }
    if (getScreenMode() !== 'five') {
      preloadStressFromTimeline(ctx, currentIndex)
    }

    ctx.schedulePlayTimer(() => {
      if (this.stopped) return
      if (!ctx.activePlaySession) return
      ctx.activePlaySession.currentSequenceIndex++
      this.executeNext(ctx, onComplete)
    }, currentSeq.duration * 1000)
  }

  private preloadNextGroupDuringWater(ctx: WorkoutModuleContext, currentSeq: any, currentIndex: number, currentRound: number) {
    const nextExercise = ctx.activePlaySession!.sequences.slice(currentIndex + 1).find(
      s => s.round > 0 && s.round < 99 && s.exercise_type === 'exercise' &&
        s.exercise_name !== '임시운동' && s.duration > 0
    )

    if (!nextExercise) return

    const nextStressGroupIndex = getStressOrderInfo(
      ctx.activePlaySession!.sequences,
      nextExercise,
    ).groupIndex
    const nextGroup = collectStressGroupExercises(
      ctx.activePlaySession!.sequences,
      nextStressGroupIndex,
    )

    const nextActiveSet: ActiveSet = {
      left: nextStressGroupIndex > 0 ? 'set2' : 'set1',
      right: nextStressGroupIndex > 0 ? 'set2' : 'set1'
    }

    const isFiveScreenMode = getScreenMode() === 'five'
    if (isFiveScreenMode) {
      log('💧 [StressModule] 5-screen: 물보충 중 다음 그룹 seek 생략')
    } else {
      log(`💧 [StressModule] 물보충 중 다음 그룹으로 큐 seek (Group ${nextStressGroupIndex + 1}, position ${nextExercise.position})`)
      ctx.broadcastToAllWindows('workout-seek-queue', {
        round: Number(nextExercise.round),
        position: String(nextExercise.position || ''),
      })
      ctx.setLastStressGroupIndex(nextStressGroupIndex)
    }

    log(`💧 [StressModule] 물보충 중 다음 그룹 영상 로드 (Group ${nextStressGroupIndex + 1})`)
    const syncStartAtMs = Date.now() + 1000
    nextGroup.forEach(seq => {
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
        syncStartAtMs: syncStartAtMs,
        isVideoPreload: true
      })
    })
  }
}
