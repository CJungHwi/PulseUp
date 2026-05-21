import type { WorkoutGridDisplay } from '../components/WorkoutGridDisplay.js'

export type PreviewSequenceScheduleDeps = {
  grid: WorkoutGridDisplay
  isLeftMonitor: boolean
  syncStartAtMs: number
  getMainTargetSetFromPosition: (position: string) => 'set1' | 'set2' | null
  getCurrentActiveSet: () => 'set1' | 'set2'
  setCurrentActiveSet: (set: 'set1' | 'set2') => void
  isPositionForLeftMonitor: (position: string) => boolean
}

/** 스트레칭/큐 모드가 아닌 일반 메인 프리뷰: L/R·세트 전환·지연 재생 */
export const schedulePreviewMainSequences = (
  deps: PreviewSequenceScheduleDeps,
  sequences: any[],
) => {
  const {
    grid,
    isLeftMonitor,
    syncStartAtMs,
    getMainTargetSetFromPosition,
    getCurrentActiveSet,
    setCurrentActiveSet,
    isPositionForLeftMonitor,
  } = deps

  sequences.forEach((seq: any, index: number) => {
    const position = typeof seq?.position === 'string' ? seq.position : ''
    if (!position) return

    const prefix = position.charAt(0).toUpperCase()
    if (prefix === 'L' || prefix === 'R') {
      if ((isLeftMonitor && prefix !== 'L') || (!isLeftMonitor && prefix !== 'R')) return
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
    setTimeout(() => {
      grid.playVideo(seq, position, syncStartAtMs)
    }, delay)
  })
}
