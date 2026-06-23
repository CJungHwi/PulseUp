import type { WorkoutGridDisplay } from '../components/WorkoutGridDisplay.js'
import type { DisplayType } from '../renderer-display-types.js'
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
    usesFiveScreenPanelQueue,
    syncStartAtMs,
    getMainTargetSetFromPosition,
    getCurrentActiveSet,
    setCurrentActiveSet,
  } = deps

  sequences.forEach((seq: any, index: number) => {
    const position = typeof seq?.position === 'string' ? seq.position : ''
    if (!position) return

    const displayPos = mapMainPositionToDisplayLabel(currentDisplay, position, {
      fiveScreen: usesFiveScreenPanelQueue,
    })
    if (!displayPos) return

    const derivedSet = getMainTargetSetFromPosition(position)
    if (derivedSet && derivedSet !== getCurrentActiveSet()) {
      grid.switchSet(derivedSet)
      setCurrentActiveSet(derivedSet)
    }

    const delay = index * 40
    setTimeout(() => {
      grid.playVideo(seq, displayPos, syncStartAtMs)
    }, delay)
  })
}
