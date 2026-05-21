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

/** Stress 실행 순서: L1→L2→L3→R3→R2→R1 (전반전), L4→L5→L6→R6→R5→R4 (후반전) */
const LAP_ORDER = ['L1', 'L2', 'L3', 'R3', 'R2', 'R1', 'L4', 'L5', 'L6', 'R6', 'R5', 'R4']

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

    const posMatch = (currentSeq.position || '').match(/^[LR](\d+)$/)
    const posNum = posMatch ? parseInt(posMatch[1]) : 1
    const stressGroupIndex = Math.floor((posNum - 1) / 3)

    const groupBaseNum = stressGroupIndex * 3 + 1
    const groupPositions = new Set<string>()
    for (let i = 0; i < 3; i++) {
      groupPositions.add(`L${groupBaseNum + i}`)
      groupPositions.add(`R${groupBaseNum + i}`)
    }

    const positionMap = new Map<string, any>()
    for (const seq of ctx.activePlaySession!.sequences) {
      if (seq.round > 0 && seq.round < 99 &&
        seq.exercise_type === 'exercise' &&
        seq.exercise_name !== '임시운동' &&
        seq.duration > 0 &&
        groupPositions.has(seq.position || '') &&
        !positionMap.has(seq.position || '')) {
        positionMap.set(seq.position || '', seq)
      }
    }

    const sortedPositionKeys = Array.from(positionMap.keys()).sort((a, b) => {
      const aPrefix = a.charAt(0)
      const bPrefix = b.charAt(0)
      const aNum = parseInt(a.substring(1))
      const bNum = parseInt(b.substring(1))
      if (aPrefix === 'L' && bPrefix === 'R') return -1
      if (aPrefix === 'R' && bPrefix === 'L') return 1
      if (aPrefix === 'L') return aNum - bNum
      return bNum - aNum
    })
    const currentGroup = sortedPositionKeys.map(k => positionMap.get(k)!)

    const activeSet: ActiveSet = { left: 'set1', right: 'set1' }
    if (stressGroupIndex > 0) {
      activeSet.left = 'set2'
      activeSet.right = 'set2'
    }

    const metadata = ctx.activePlaySession!.metadata || {}
    const totalSets = metadata.totalSets || 3
    const lapIndexRaw = (() => {
      const idx = LAP_ORDER.indexOf(currentSeq.position || '')
      return idx >= 0 ? idx + 1 : 1
    })()
    const isSecondHalf = posNum >= 4
    const lapIndex = isSecondHalf ? ((lapIndexRaw - 1) % 6) + 1 : lapIndexRaw
    const totalLaps = 6
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
      totalSets
    })

    const prevGroupIndex = ctx._lastStressGroupIndex
    ctx.setLastStressGroupIndex(stressGroupIndex)
    const isGroupChanged = prevGroupIndex !== stressGroupIndex
    const isFiveScreenMode = getScreenMode() === 'five'

    if (isGroupChanged) {
      log(`📹 [StressModule] 새 그룹 영상 로드 (Group ${stressGroupIndex + 1}, 운동 ${currentGroup.length}개)`)

      // set1→set2 전환 시 큐 advance (첫 그룹은 카운트다운에서 이미 advance됨, 네비게이션 리셋(-1)은 제외)
      if (stressGroupIndex > 0 && prevGroupIndex >= 0) {
        if (isFiveScreenMode) {
          log('🎬 [StressModule] 5-screen: L4/R4 전용 패널 사용으로 슬롯 advance 생략')
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
    const posForLap = (prevExercise?.position || currentSeq.position || '') as string
    const posMatch = posForLap.match(/^[LR](\d+)$/)
    const posNum = posMatch ? parseInt(posMatch[1]) : 1
    const restGroupIndex = Math.floor((posNum - 1) / 3)
    const restActiveSet: ActiveSet = {
      left: restGroupIndex > 0 ? 'set2' : 'set1',
      right: restGroupIndex > 0 ? 'set2' : 'set1',
    }

    const stressLapRaw = (() => {
      const idx = LAP_ORDER.indexOf(posForLap)
      return idx >= 0 ? idx + 1 : 1
    })()
    const stressLapIndex = stressLapRaw <= 6 ? stressLapRaw : ((stressLapRaw - 1) % 6) + 1
    const stressTotalLaps = 6
    const stressSetIndex = currentRound
    const stressTotalSets = ctx.activePlaySession!.metadata?.totalSets || 3

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

    const nextPosMatch = (nextExercise.position || '').match(/^[LR](\d+)$/)
    const nextPosNum = nextPosMatch ? parseInt(nextPosMatch[1]) : 1
    const nextStressGroupIndex = Math.floor((nextPosNum - 1) / 3)
    const nextGroupBase = nextStressGroupIndex * 3 + 1
    const nextGroupPositions = new Set<string>()
    for (let i = 0; i < 3; i++) {
      nextGroupPositions.add(`L${nextGroupBase + i}`)
      nextGroupPositions.add(`R${nextGroupBase + i}`)
    }

    const nextPosMap = new Map<string, any>()
    for (const seq of ctx.activePlaySession!.sequences) {
      if (seq.round > 0 && seq.round < 99 &&
        seq.exercise_type === 'exercise' &&
        nextGroupPositions.has(seq.position || '') &&
        !nextPosMap.has(seq.position || '')) {
        nextPosMap.set(seq.position || '', seq)
      }
    }

    const nextActiveSet: ActiveSet = {
      left: nextStressGroupIndex > 0 ? 'set2' : 'set1',
      right: nextStressGroupIndex > 0 ? 'set2' : 'set1'
    }

    log(`💧 [StressModule] 물보충 중 다음 그룹 영상 로드 (Group ${nextStressGroupIndex + 1})`)
    const syncStartAtMs = Date.now() + 1000
    const sortedNextKeys = Array.from(nextPosMap.keys()).sort((a, b) => {
      const aP = a.charAt(0), bP = b.charAt(0)
      const aN = parseInt(a.substring(1)), bN = parseInt(b.substring(1))
      if (aP === 'L' && bP === 'R') return -1
      if (aP === 'R' && bP === 'L') return 1
      if (aP === 'L') return aN - bN
      return bN - aN
    })
    sortedNextKeys.forEach(k => {
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
        syncStartAtMs: syncStartAtMs,
        isVideoPreload: true
      })
    })
  }
}
