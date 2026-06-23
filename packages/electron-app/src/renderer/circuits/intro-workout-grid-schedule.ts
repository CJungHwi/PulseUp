import type { WorkoutGridDisplay } from '../components/WorkoutGridDisplay.js'
import type { DisplayType } from '../renderer-display-types.js'
import { isIntroGridPositionForDisplay } from './intro-position-codes.js'

/**
 * 인트로 IPC: 3모니터 좌 A/B·우 C/D, 5모니터 좌부터 A/B/C/D stagger 재생
 */
export const scheduleIntroSequencesForMonitor = (
  grid: WorkoutGridDisplay,
  data: { sequences?: unknown[]; syncStartAtMs?: number },
  display: DisplayType,
  options: { fiveScreen?: boolean } = {},
) => {
  const sequences = Array.isArray(data?.sequences) ? data.sequences : []
  const syncStartAtMs = Number(data?.syncStartAtMs) || Date.now()

  sequences.forEach((seq: any, index: number) => {
    const position = typeof seq?.position === 'string' ? seq.position : ''
    if (!position) return
    if (!isIntroGridPositionForDisplay(position, display, options)) return

    const delay = index * 50
    setTimeout(() => {
      grid.playVideo(seq, position, syncStartAtMs)
    }, delay)
  })
}
