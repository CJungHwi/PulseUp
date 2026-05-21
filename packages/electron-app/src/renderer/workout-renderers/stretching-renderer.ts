import type { RendererContext, SequenceRenderer } from './base-renderer.js'
import { log } from './base-renderer.js'
import { isLeftMonitorDisplay } from '../renderer-display-types.js'

export class StretchingRenderer implements SequenceRenderer {
  canHandle(data: any): boolean {
    return !!(data.stretchingMode && data.positionGroups)
  }

  handle(ctx: RendererContext, data: any): void {
    const { sequence, round, position, syncStartAtMs, positionGroups, currentStretchingPosition } = data
    const isLeftMonitor = isLeftMonitorDisplay(ctx.currentDisplay)

    log('🎬 [StretchingRenderer] 스트레칭 모드: L1,L2,L3 동시 표시')

    if (position === 'KEEP_VIDEO') {
      log('⏱️ [StretchingRenderer] 영상 유지, 타이머만 업데이트')
      ctx.workoutGridDisplay.resumeAllVideos()
      ctx.workoutGridDisplay.hideArrowOverlay()
      ctx.workoutGridDisplay.hidePauseOverlay()
    } else {
      const skipPlay = ctx.hasCountdownPreview
      if (skipPlay) ctx.setHasCountdownPreview(false)
      ctx.handleStretchingMode(positionGroups, isLeftMonitor, syncStartAtMs, skipPlay, data.stretchingSlotCount)
    }

    if (ctx.workoutPlayTimerUI && currentStretchingPosition) {
      log(`🎬 [StretchingRenderer] 타이머 업데이트: ${currentStretchingPosition} (${sequence.duration}초)`)
      ctx.workoutPlayTimerUI.updateDisplay({
        sequence: sequence,
        round: round,
        totalRounds: data.totalRounds,
        duration: sequence.duration,
        sequenceIndex: data.sequenceIndex,
        totalSequences: data.totalSequences,
        metadata: data.metadata,
        stretchingMode: true,
        currentStretchingPosition: currentStretchingPosition
      })
    }
  }
}
