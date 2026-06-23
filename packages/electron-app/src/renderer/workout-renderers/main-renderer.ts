import type { RendererContext, SequenceRenderer } from './base-renderer.js'
import { log } from './base-renderer.js'
import { displayTypeToFivePanel, isLeftMonitorDisplay } from '../renderer-display-types.js'
import { mapMainPositionToDisplayLabel } from '../five-screen-seek-label.js'

const getFiveScreenGroupPrefix = (panel: ReturnType<typeof displayTypeToFivePanel>): string | null => {
  if (panel === 'L1') return 'A'
  if (panel === 'L2') return 'B'
  if (panel === 'R1') return 'C'
  if (panel === 'R2') return 'D'
  return null
}

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
      // stress/loop: 같은 그룹 내 다음 운동으로 넘어갈 때 횟수 배지 갱신 (AMRAP/EMOM 과 동일)
      if (
        sequence?.exercise_type === 'exercise' &&
        typeof sequence?.position === 'string' &&
        sequence.position &&
        !['KEEP_VIDEO', 'ALL', 'NONE', 'PAUSE_VIDEO', 'PAUSE_VIDEO_BLINK', 'PAUSE_VIDEO_ARROW'].includes(
          sequence.position,
        )
      ) {
        const slot = ctx.workoutGridDisplay.mapPositionToSlot(sequence.position)
        ctx.workoutGridDisplay.updateRepsBadge(slot, sequence)
      }
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
        const groupPrefix = ctx.usesFiveScreenPanelQueue
          ? getFiveScreenGroupPrefix(displayTypeToFivePanel(ctx.currentDisplay))
          : ctx.currentActiveSet === 'set1'
            ? (isLeftMonitor ? 'A' : 'C')
            : (isLeftMonitor ? 'B' : 'D')
        const positions = groupPrefix ? [1, 2, 3].map((n) => `${groupPrefix}${n}`) : []

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

      const displayPosition = mapMainPositionToDisplayLabel(ctx.currentDisplay, position, {
        fiveScreen: ctx.usesFiveScreenPanelQueue,
      })

      if (displayPosition) {
        if (sequence.exercise_type === 'exercise') {
          const skipPlay = ctx.hasCountdownPreview
          if (skipPlay) ctx.setHasCountdownPreview(false)
          ctx.workoutGridDisplay.playVideo(sequence, displayPosition, syncStartAtMs, skipPlay)
        } else {
          ctx.workoutGridDisplay.clearVideoByPosition(displayPosition)
        }
      }
    }
  }
}
