import type { WorkoutModuleContext, WorkoutModule } from '../shared/base-module'
import { log } from '../shared/base-module'
import { StretchingModule } from '../shared/stretching-module'
import { ReadyModule } from '../shared/ready-module'
import { PreloadManager } from '../shared/preload-manager'
import { runAmrapStretchingRound } from './amrap-stretching-round'
import {
  runAmrapMainRound,
  runAmrapRestOrWater,
  shouldSkipAmrapRestWaterBeforeCD,
} from './amrap-main-round'

export class AmrapModule implements WorkoutModule {
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

  private proceedToNextRound(ctx: WorkoutModuleContext, currentRound: number, callback: () => void) {
    if (!ctx.activePlaySession) return
    let nextIndex = ctx.activePlaySession.currentSequenceIndex
    while (
      nextIndex < ctx.activePlaySession.sequences.length &&
      Number(ctx.activePlaySession.sequences[nextIndex].round) === Number(currentRound)
    ) {
      nextIndex++
    }
    ctx.activePlaySession.currentSequenceIndex = nextIndex
    log(`🎬 [AmrapModule] Round ${currentRound} 완료, 다음 시퀀스 인덱스: ${nextIndex}`)
    callback()
  }

  private executeNext(ctx: WorkoutModuleContext, onComplete: () => void) {
    if (this.stopped) return
    if (!ctx.activePlaySession) return

    if (ctx.activePlaySession.currentSequenceIndex >= ctx.activePlaySession.sequences.length) {
      log('✅ [AmrapModule] AMRAP 운동 완료')
      ctx.activePlaySession.status = 'completed'
      ctx.broadcastToAllWindows('workout-play-completed', { session: ctx.activePlaySession })
      onComplete()
      return
    }

    const currentIndex = ctx.activePlaySession.currentSequenceIndex
    const currentSeq = ctx.activePlaySession.sequences[currentIndex]
    const currentRound = currentSeq.round

    log(`🎬 [AmrapModule] executeNext:`, {
      currentIndex,
      currentRound,
      exercise_name: currentSeq.exercise_name,
      exercise_type: currentSeq.exercise_type,
    })

    if (currentSeq.exercise_type === 'countdown') {
      this.readyModule.execute(ctx, () => {
        if (!this.stopped) this.executeNext(ctx, onComplete)
      })
      return
    }

    if (ctx.isStretchingOrCoolDownRound(currentRound)) {
      runAmrapStretchingRound(ctx, this.stretchingModule, {
        stopped: () => this.stopped,
        proceedToNextRound: (r, cb) => this.proceedToNextRound(ctx, r, cb),
        executeNext: () => this.executeNext(ctx, onComplete),
      }, currentRound)
    } else if (currentSeq.exercise_type === 'rest' || currentSeq.exercise_type === 'water') {
      if (shouldSkipAmrapRestWaterBeforeCD(ctx.activePlaySession.sequences, currentIndex)) {
        log(
          `⏭️ [AmrapModule] Main→CD(또는 Ready) 전환 직전 ${currentSeq.exercise_type} 스킵 (AMRAP 전용, 연속 휴식/물보충 포함)`,
        )
        ctx.activePlaySession.currentSequenceIndex++
        this.executeNext(ctx, onComplete)
        return
      }
      runAmrapRestOrWater(ctx, {
        stopped: () => this.stopped,
        preloadManager: this.preloadManager,
        executeNext: () => this.executeNext(ctx, onComplete),
      }, currentSeq, currentIndex, currentRound)
    } else {
      runAmrapMainRound(ctx, {
        stopped: () => this.stopped,
        preloadManager: this.preloadManager,
        executeNext: () => this.executeNext(ctx, onComplete),
      }, currentIndex, currentRound)
    }
  }
}
