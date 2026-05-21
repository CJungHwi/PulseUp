import type { WorkoutModuleContext, WorkoutModule } from './base-module'
import { log } from './base-module'
import { getHalfRoundsCountFromSession } from './half-rounds-meta'
import {
  orderPreviewMainRoundSequences,
  resolveIntroCircuitKind,
} from '../../circuit-registry'

/**
 * ReadyModule - 구간 전환 카운트다운 모듈
 *
 * DS → Main, Main → CD 등 운동 구간이 바뀔 때 삽입되는 5초 카운트다운을 처리한다.
 * 중앙 타이머 화면에는 "READY"와 함께 초 단위 카운트다운이 표시되며,
 * 좌/우 영상 화면에는 다음 구간의 프리뷰 영상이 즉시 로드된다.
 */
export class ReadyModule implements WorkoutModule {
  private stopped = false

  execute(ctx: WorkoutModuleContext, onComplete: () => void): void {
    this.stopped = false
    if (!ctx.activePlaySession) { onComplete(); return }

    const currentIndex = ctx.activePlaySession.currentSequenceIndex
    const currentSeq = ctx.activePlaySession.sequences[currentIndex]

    if (!currentSeq || currentSeq.exercise_type !== 'countdown') {
      onComplete()
      return
    }

    const currentRound = currentSeq.round

    log(`🎬 [ReadyModule] 카운트다운 (${currentSeq.duration}초) Round ${currentRound}`)

    // 타이머 화면에 5,4,3,2,1 카운트다운 오버레이 표시
    ctx.broadcastToAllWindows('countdown-started', { phase: 'segment-transition' })

    // 큐를 다음 구간의 첫 운동 위치로 절대 이동 (seek).
    // 상대적 advance-slots는 자동재생에선 정확하지만, 네비게이션(다음/이전)으로 진입 시
    // 큐가 예상 위치가 아닐 수 있어 잘못된 영상이 표시된다.
    const seekTarget = this.findNextPhaseFirstExercise(ctx, currentIndex)
    if (seekTarget) {
      log(`🎬 [ReadyModule] 큐 seek → round=${seekTarget.round}, position=${seekTarget.position}`)
      ctx.broadcastToAllWindows('workout-seek-queue', {
        round: Number(seekTarget.round),
        position: String(seekTarget.position || ''),
      })
    } else {
      ctx.broadcastToAllWindows('workout-advance-slots', {
        slots: [1, 2, 3],
      })
    }

    const syncStartAtMs = Date.now() + 2500

    // 타이머 디스플레이 업데이트용
    ctx.broadcastToAllWindows('workout-play-sequence', {
      sequence: currentSeq,
      round: currentRound,
      totalRounds: ctx.activePlaySession.totalRounds,
      duration: currentSeq.duration,
      position: 'ALL',
      activeSet: { left: 'set1', right: 'set1' },
      sequenceIndex: currentIndex,
      totalSequences: ctx.activePlaySession.sequences.length,
      metadata: ctx.activePlaySession.metadata,
      syncStartAtMs: syncStartAtMs
    })

    // 다음 구간의 영상을 5초 카운트다운 중에 즉시 프리뷰
    this.previewNextSection(ctx, currentIndex, syncStartAtMs)

    ctx.schedulePlayTimer(() => {
      if (this.stopped) return
      if (!ctx.activePlaySession) return
      ctx.activePlaySession.currentSequenceIndex++
      onComplete()
    }, currentSeq.duration * 1000)
  }

  stop(): void {
    this.stopped = true
  }

  private findNextPhaseFirstExercise(ctx: WorkoutModuleContext, countdownIndex: number): any | null {
    if (!ctx.activePlaySession) return null
    for (let i = countdownIndex + 1; i < ctx.activePlaySession.sequences.length; i++) {
      const s = ctx.activePlaySession.sequences[i]
      if (s.exercise_type === 'exercise' && s.exercise_name !== '임시운동' && s.duration > 0) {
        return s
      }
    }
    return null
  }

  private previewNextSection(ctx: WorkoutModuleContext, countdownIndex: number, syncStartAtMs: number) {
    if (!ctx.activePlaySession) return

    const nextIndex = countdownIndex + 1
    if (nextIndex >= ctx.activePlaySession.sequences.length) return

    const nextSeq = ctx.activePlaySession.sequences[nextIndex]
    const nextRound = nextSeq.round

    if (ctx.isStretchingOrCoolDownRound(nextRound)) {
      this.previewStretchingSection(ctx, nextRound, syncStartAtMs)
    } else if (nextSeq.exercise_type === 'exercise') {
      this.previewMainSection(ctx, nextRound, syncStartAtMs)
    }
  }

  /** DS/CD 구간 영상 프리뷰 */
  private previewStretchingSection(ctx: WorkoutModuleContext, nextRound: number, syncStartAtMs: number) {
    if (!ctx.activePlaySession) return

    const exercises = ctx.activePlaySession.sequences.filter(
      s => s.round === nextRound &&
        s.exercise_type === 'exercise' &&
        s.exercise_name !== '임시운동' &&
        s.duration > 0
    )

    const seen = new Set<string>()
    const unique: any[] = []
    for (const s of exercises) {
      const id = String(s.exercise_id || s.exercise_name)
      if (seen.has(id)) continue
      seen.add(id)
      unique.push(s)
    }
    if (unique.length === 0) return

    const prefix = nextRound === 99 ? 'CD' : 'DS'
    const allPositionGroups: { [key: string]: any[] } = {}
    unique.forEach((item, idx) => {
      const posItem = { ...item, position: `${prefix}${idx + 1}` }
      const leftPos = `L${idx + 1}`
      const rightPos = `R${idx + 1}`
      allPositionGroups[leftPos] = [posItem]
      allPositionGroups[rightPos] = [posItem]
    })

    log(`🎬 [ReadyModule] 다음 ${prefix} 구간 프리뷰 (${unique.length}개 운동)`)

    ctx.broadcastToAllWindows('workout-play-preview', {
      sequences: unique,
      positionGroups: allPositionGroups,
      stretchingMode: true,
      stretchingSlotCount: unique.length,
      syncStartAtMs,
      metadata: ctx.activePlaySession.metadata
    })
  }

  /** Main 구간 영상 프리뷰 */
  private previewMainSection(ctx: WorkoutModuleContext, nextRound: number, syncStartAtMs: number) {
    if (!ctx.activePlaySession) return

    const mainExercises = ctx.getPlayableMainExercisesByRound(nextRound)
    const circuitType = resolveIntroCircuitKind(ctx.activePlaySession.metadata)
    const halfRounds = getHalfRoundsCountFromSession(ctx.activePlaySession)
    const firstGroup = orderPreviewMainRoundSequences(
      circuitType,
      nextRound,
      mainExercises,
      halfRounds,
    ).slice(0, 6)
    if (firstGroup.length === 0) return

    log(`🎬 [ReadyModule] 다음 Main 구간 프리뷰 브로드캐스트 (${firstGroup.length}개 운동, positions=${firstGroup.map((s: any) => s.position).join(',')})`)

    ctx.broadcastToAllWindows('workout-play-preview', {
      sequences: firstGroup,
      syncStartAtMs,
      metadata: ctx.activePlaySession.metadata
    })
  }
}
