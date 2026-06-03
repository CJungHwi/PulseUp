import type { RendererContext, SequenceRenderer } from './base-renderer.js'
import { log } from './base-renderer.js'
import { isLeftMonitorDisplay, isWorkoutGridDisplayType } from '../renderer-display-types.js'
import { mapMainPositionToDisplayLabel } from '../five-screen-seek-label.js'
import { parseGridPosition } from '../../common/grid-position-codes.js'

export class ReadyRenderer implements SequenceRenderer {
  canHandle(data: any): boolean {
    return data.sequence?.exercise_type === 'countdown'
  }

  handle(ctx: RendererContext, data: any): void {
    const { sequence, syncStartAtMs } = data
    const isLeftMonitor = isLeftMonitorDisplay(ctx.currentDisplay)

    if (!isWorkoutGridDisplayType(ctx.currentDisplay)) return

    const previewSequences = sequence.preview_sequences || []
    const isStretchingPreview = sequence.is_stretching_preview
    const positionGroups = sequence.position_groups

    log('🎬 [ReadyRenderer] 5초 카운트다운 시작', {
      previewCount: previewSequences.length,
      isStretchingPreview,
      previews: previewSequences.map((s: any) => ({ name: s.exercise_name, pos: s.position }))
    })

    if (isStretchingPreview && positionGroups) {
      log('🎬 [ReadyRenderer] 카운트다운 중 스트레칭 미리보기 재생')
      ctx.handleStretchingMode(positionGroups, isLeftMonitor, syncStartAtMs, false)
      ctx.setHasCountdownPreview(true)
    } else if (previewSequences.length > 0) {
      log('🎬 [ReadyRenderer] 카운트다운 중 본운동 미리보기 재생')

      // DS→Main 전환: DS 영상을 먼저 클리어하고 Main 영상 로드
      ctx.workoutGridDisplay.clearAllVideoCells()

      previewSequences.forEach((seq: any) => {
        const pos = seq.position
        if (!pos) return

        const parsed = parseGridPosition(pos)
        if (parsed) {
          if ((isLeftMonitor && parsed.side !== 'left') || (!isLeftMonitor && parsed.side !== 'right')) {
            return
          }
        } else {
          return
        }

        const displayPos = mapMainPositionToDisplayLabel(ctx.currentDisplay, pos, {
          fiveScreen: ctx.usesFiveScreenPanelQueue,
        })
        if (!displayPos) return

        log(`🎬 [ReadyRenderer] Main 프리뷰 로드: ${pos} → ${displayPos} (${seq.exercise_name})`)
        ctx.workoutGridDisplay.playVideo(seq, displayPos, syncStartAtMs, false)
      })
      ctx.setHasCountdownPreview(true)
    }
  }
}
