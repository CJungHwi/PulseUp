/**
 * 소스 요약 — EMOM-Stress 운동 모듈
 *
 * 기능: EMOM(method=stress) 운동의 전체 재생 흐름을 담당하는 독립 모듈. Main Stress/Loop, EMOM-Loop와
 *       동일하게 circuit-registry에서 'emom-stress' 타입으로 직접 선택된다.
 * 호출 프로시저: 없음(Electron 재생 모듈, API에서 받은 workout_exercises 세션 사용).
 * 관련 components/modules: `circuit-registry.ts`(선택), `emom-stress-main-round.ts`(메인 재생),
 *       `../shared/stretching-module.ts`, `../shared/ready-module.ts`, `../emom/emom-preload.ts`.
 * 흐름: 스트레칭(Round 0/99) → countdown(Ready) → 메인 라운드는 항상 EMOM-Stress runner로 재생(분기 없음).
 */
import type { WorkoutModuleContext, WorkoutModule } from '../shared/base-module'
import { log } from '../shared/base-module'
import { StretchingModule } from '../shared/stretching-module'
import { ReadyModule } from '../shared/ready-module'
import { PreloadManager } from '../shared/preload-manager'
import { runEmomStressMainRound } from './emom-stress-main-round'

export class EmomStressModule implements WorkoutModule {
  private stretchingModule = new StretchingModule()
  private readyModule = new ReadyModule()
  private preloadManager = new PreloadManager()
  private stopped = false

  execute(ctx: WorkoutModuleContext, onComplete: () => void): void {
    this.stopped = false

    if (ctx.activePlaySession?.metadata) {
      // 화면/큐 빌더는 EMOM과 동일 인프라를 공유하므로 표시 circuitType은 'emom' 유지
      ctx.activePlaySession.metadata.circuitType = 'emom'
    }

    setTimeout(() => {
      this.executeNext(ctx, onComplete)
    }, 100)
  }

  stop(): void {
    this.stopped = true
    this.stretchingModule.stop()
    this.readyModule.stop()
  }

  private proceedToNextRound(
    ctx: WorkoutModuleContext,
    currentRound: number,
    callback: () => void,
  ) {
    if (!ctx.activePlaySession) return
    let nextIndex = ctx.activePlaySession.currentSequenceIndex
    while (
      nextIndex < ctx.activePlaySession.sequences.length &&
      ctx.activePlaySession.sequences[nextIndex].round === currentRound
    ) {
      nextIndex++
    }
    ctx.activePlaySession.currentSequenceIndex = nextIndex
    log(
      `🎬 [EmomStressModule] Round ${currentRound} 완료, 다음 시퀀스 인덱스: ${nextIndex}`,
    )
    callback()
  }

  private executeNext(ctx: WorkoutModuleContext, onComplete: () => void) {
    if (this.stopped) return
    if (!ctx.activePlaySession) return

    if (
      ctx.activePlaySession.currentSequenceIndex >=
      ctx.activePlaySession.sequences.length
    ) {
      log('✅ [EmomStressModule] EMOM-Stress 운동 완료')
      ctx.activePlaySession.status = 'completed'
      ctx.broadcastToAllWindows('workout-play-completed', {
        session: ctx.activePlaySession,
      })
      onComplete()
      return
    }

    const currentIndex = ctx.activePlaySession.currentSequenceIndex
    const currentSeq = ctx.activePlaySession.sequences[currentIndex]
    const currentRound = currentSeq.round

    if (currentSeq.exercise_type === 'countdown') {
      this.readyModule.execute(ctx, () => {
        if (!this.stopped) this.executeNext(ctx, onComplete)
      })
      return
    }

    if (ctx.isStretchingOrCoolDownRound(currentRound)) {
      this.handleStretchingRound(ctx, currentRound, onComplete)
      return
    }

    runEmomStressMainRound(
      ctx,
      {
        stopped: () => this.stopped,
        preloadManager: this.preloadManager,
        executeNext: () => this.executeNext(ctx, onComplete),
      },
      currentIndex,
      currentRound,
    )
  }

  private handleStretchingRound(
    ctx: WorkoutModuleContext,
    currentRound: number,
    onComplete: () => void,
  ) {
    this.stretchingModule.execute(ctx, () => {
      if (this.stopped || !ctx.activePlaySession) return

      // DS/CD 라운드 종료 후 별도 5초 휴식 없음 — 다음은 시퀀스의 countdown(Ready)만 진행
      this.proceedToNextRound(ctx, currentRound, () =>
        this.executeNext(ctx, onComplete),
      )
    })
  }
}
