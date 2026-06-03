import type { WorkoutGridDisplay } from '../components/WorkoutGridDisplay.js'
import type { DisplayType } from '../renderer-display-types.js'
import { isIntroGridPositionForDisplay } from './intro-position-codes.js'

/**
 * 인트로 IPC: 좌측 모니터 A1~A6, 우측 모니터 B1~B6 stagger 재생
 * - 각 모니터 2열: num 1–3 좌열, 4–6 우열
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
