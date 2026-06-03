import type { WorkoutGridDisplay } from '../components/WorkoutGridDisplay.js'
import type { DisplayType } from '../renderer-display-types.js'
import { parseGridPosition } from '../../common/grid-position-codes.js'
import { mapMainPositionToDisplayLabel } from '../five-screen-seek-label.js'

export type PreviewSequenceScheduleDeps = {
  grid: WorkoutGridDisplay
  currentDisplay: DisplayType
  isLeftMonitor: boolean
  usesFiveScreenPanelQueue: boolean
  syncStartAtMs: number
  getMainTargetSetFromPosition: (position: string) => 'set1' | 'set2' | null
  getCurrentActiveSet: () => 'set1' | 'set2'
  setCurrentActiveSet: (set: 'set1' | 'set2') => void
  isPositionForLeftMonitor: (position: string) => boolean
}

/** 스트레칭/큐 모드가 아닌 일반 메인 프리뷰: A/B·세트 전환·지연 재생 */
export const schedulePreviewMainSequences = (
  deps: PreviewSequenceScheduleDeps,
  sequences: any[],
) => {
  const {
    grid,
    currentDisplay,
    isLeftMonitor,
    usesFiveScreenPanelQueue,
    syncStartAtMs,
    getMainTargetSetFromPosition,
    getCurrentActiveSet,
    setCurrentActiveSet,
    isPositionForLeftMonitor,
  } = deps

  sequences.forEach((seq: any, index: number) => {
    const position = typeof seq?.position === 'string' ? seq.position : ''
    if (!position) return

    const parsed = parseGridPosition(position)
    if (parsed) {
      if ((isLeftMonitor && parsed.side !== 'left') || (!isLeftMonitor && parsed.side !== 'right')) return
      const derivedSet = getMainTargetSetFromPosition(position)
      if (derivedSet && derivedSet !== getCurrentActiveSet()) {
        grid.switchSet(derivedSet)
        setCurrentActiveSet(derivedSet)
      }
    } else {
      const isForLeft = isPositionForLeftMonitor(position)
      if ((isLeftMonitor && !isForLeft) || (!isLeftMonitor && isForLeft)) return
    }

    const delay = index * 40
    const displayPos =
      mapMainPositionToDisplayLabel(currentDisplay, position, { fiveScreen: usesFiveScreenPanelQueue }) ??
      position
    setTimeout(() => {
      grid.playVideo(seq, displayPos, syncStartAtMs)
    }, delay)
  })
}
