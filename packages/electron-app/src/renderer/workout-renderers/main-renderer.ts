import type { RendererContext, SequenceRenderer } from './base-renderer.js'
import { log } from './base-renderer.js'
import { isLeftMonitorDisplay } from '../renderer-display-types.js'

export class MainRenderer implements SequenceRenderer {
  canHandle(_data: any): boolean {
    return true
  }

  handle(ctx: RendererContext, data: any): void {
    const { sequence, position, syncStartAtMs } = data
    const isLeftMonitor = isLeftMonitorDisplay(ctx.currentDisplay)

    if (typeof position === 'string') {
      const derivedSet = ctx.getMainTargetSetFromPosition(position)
      if (derivedSet && derivedSet !== ctx.currentActiveSet) {
        ctx.workoutGridDisplay.switchSet(derivedSet)
        ctx.setCurrentActiveSet(derivedSet)
      }
    }

    if (position === 'KEEP_VIDEO') {
      log('⏱️ [MainRenderer] 영상 계속 재생, 타이머만 업데이트')
      ctx.workoutGridDisplay.resumeAllVideos()
      ctx.workoutGridDisplay.hideArrowOverlay()
      ctx.workoutGridDisplay.hidePauseOverlay()
    } else if (position === 'PAUSE_VIDEO_BLINK') {
      log('▶️ [MainRenderer] Set 내 휴식 - || 오버레이')
      ctx.workoutGridDisplay.resumeAllVideos()
      ctx.workoutGridDisplay.hideArrowOverlay()
      ctx.workoutGridDisplay.showPauseOverlay()
    } else if (position === 'PAUSE_VIDEO_ARROW') {
      log('▶️ [MainRenderer] 마지막 Set 휴식 - 화살표 오버레이')
      ctx.workoutGridDisplay.resumeAllVideos()
      ctx.workoutGridDisplay.hidePauseOverlay()
      ctx.workoutGridDisplay.showArrowOverlay()
    } else if (position === 'PAUSE_VIDEO') {
      log('▶️ [MainRenderer] 같은 그룹 내 휴식 - 화살표 오버레이')
      ctx.workoutGridDisplay.resumeAllVideos()
      ctx.workoutGridDisplay.showArrowOverlay()
      ctx.workoutGridDisplay.hidePauseOverlay()
    } else if (position === 'NONE') {
      log('▶️ [MainRenderer] 그룹 전환/휴식 - 영상 유지')
      ctx.workoutGridDisplay.resumeAllVideos()
      ctx.workoutGridDisplay.showArrowOverlay()
      ctx.workoutGridDisplay.hidePauseOverlay()
    } else if (position === 'ALL') {
      ctx.workoutGridDisplay.hideArrowOverlay()
      ctx.workoutGridDisplay.resumeAllVideos()

      if (sequence.exercise_type === 'exercise') {
        const positions = isLeftMonitor
          ? (ctx.currentActiveSet === 'set1' ? ['L1', 'L2', 'L3'] : ['L4', 'L5', 'L6'])
          : (ctx.currentActiveSet === 'set1' ? ['R1', 'R2', 'R3'] : ['R4', 'R5', 'R6'])

        const skipPlay = ctx.hasCountdownPreview
        if (skipPlay) ctx.setHasCountdownPreview(false)
        positions.forEach(pos => {
          ctx.workoutGridDisplay.playVideo(sequence, pos, syncStartAtMs, skipPlay)
        })
      } else {
        ctx.workoutGridDisplay.clearAllVideoCells()
      }
    } else {
      ctx.workoutGridDisplay.hideArrowOverlay()
      ctx.workoutGridDisplay.resumeAllVideos()

      const positionPrefix = position?.charAt(0)

      if ((isLeftMonitor && positionPrefix === 'L') || (!isLeftMonitor && positionPrefix === 'R')) {
        if (sequence.exercise_type === 'exercise') {
          const skipPlay = ctx.hasCountdownPreview
          if (skipPlay) ctx.setHasCountdownPreview(false)
          ctx.workoutGridDisplay.playVideo(sequence, position, syncStartAtMs, skipPlay)
        } else {
          ctx.workoutGridDisplay.clearVideoByPosition(position)
        }
      }
    }
  }
}
