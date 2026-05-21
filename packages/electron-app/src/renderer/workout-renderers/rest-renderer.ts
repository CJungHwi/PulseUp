import type { RendererContext, SequenceRenderer } from './base-renderer.js'
import { log } from './base-renderer.js'

export class RestRenderer implements SequenceRenderer {
  canHandle(data: any): boolean {
    const type = data.sequence?.exercise_type
    return type === 'rest' || type === 'water'
  }

  handle(ctx: RendererContext, data: any): void {
    const { sequence, position } = data
    const isLoopCircuit = data.metadata?.circuitType === 'loop'
    const keepVideoPositions = ['KEEP_VIDEO', 'PAUSE_VIDEO_BLINK', 'PAUSE_VIDEO_ARROW', 'PAUSE_VIDEO', 'NONE']

    if (keepVideoPositions.includes(position) || isLoopCircuit) {
      if (ctx.workoutGridDisplay) {
        log(`⏱️ [RestRenderer] ${sequence.exercise_type}: 영상 유지 (Position: ${position}, Loop: ${isLoopCircuit})`)
        ctx.workoutGridDisplay.resumeAllVideos()

        if (position === 'PAUSE_VIDEO_BLINK') {
          ctx.workoutGridDisplay.hideArrowOverlay()
          ctx.workoutGridDisplay.showPauseOverlay()
        } else if (position === 'PAUSE_VIDEO_ARROW' || position === 'PAUSE_VIDEO' || position === 'NONE') {
          ctx.workoutGridDisplay.hidePauseOverlay()
          ctx.workoutGridDisplay.showArrowOverlay()
        } else {
          if (isLoopCircuit && !position) {
            ctx.workoutGridDisplay.hidePauseOverlay()
            ctx.workoutGridDisplay.showArrowOverlay()
          } else {
            ctx.workoutGridDisplay.hideArrowOverlay()
            ctx.workoutGridDisplay.hidePauseOverlay()
          }
        }
      }
    } else {
      if (ctx.workoutGridDisplay) {
        log(`🧹 [RestRenderer] ${sequence.exercise_type}: 모든 영상 클리어 (Position: ${position})`)
        ctx.workoutGridDisplay.clearAllVideoCells()
      }
    }

    ctx.workoutPlayTimerUI?.updateDisplay(data)
  }
}
