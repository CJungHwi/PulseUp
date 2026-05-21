import type { WorkoutModuleContext, WorkoutModule } from '../shared/base-module'
import { log } from '../shared/base-module'
import { StretchingModule } from '../shared/stretching-module'
import { ReadyModule } from '../shared/ready-module'
import { PreloadManager } from '../shared/preload-manager'
import { runEmomMainRound } from './emom-main-round'

export class EmomModule implements WorkoutModule {
  private stretchingModule = new StretchingModule()
  private readyModule = new ReadyModule()
  private preloadManager = new PreloadManager()
  private stopped = false

  execute(ctx: WorkoutModuleContext, onComplete: () => void): void {
    this.stopped = false

    if (ctx.activePlaySession?.metadata) {
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
      `🎬 [EmomModule] Round ${currentRound} 완료, 다음 시퀀스 인덱스: ${nextIndex}`,
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
      log('✅ [EmomModule] EMOM 운동 완료')
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

    runEmomMainRound(ctx, {
      stopped: () => this.stopped,
      preloadManager: this.preloadManager,
      executeNext: () => this.executeNext(ctx, onComplete),
    }, currentIndex, currentRound)
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
