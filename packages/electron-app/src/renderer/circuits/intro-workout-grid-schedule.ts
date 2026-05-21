import type { WorkoutGridDisplay } from '../components/WorkoutGridDisplay.js'

/** 인트로 IPC: 현재 모니터(L/R)에 맞는 슬롯만 stagger 재생 */
export const scheduleIntroSequencesForMonitor = (
  grid: WorkoutGridDisplay,
  data: { sequences?: unknown[]; syncStartAtMs?: number },
  isLeftMonitor: boolean,
) => {
  const sequences = Array.isArray(data?.sequences) ? data.sequences : []
  const syncStartAtMs = Number(data?.syncStartAtMs) || Date.now()

  sequences.forEach((seq: any, index: number) => {
    const position = typeof seq?.position === 'string' ? seq.position : ''
    if (!position) return

    const prefix = position.charAt(0).toUpperCase()
    const match = position.match(/^[LR](\d+)$/i)
    const positionIndex = match ? Number(match[1]) : 0

    if (positionIndex < 1 || positionIndex > 6) return
    if ((isLeftMonitor && prefix !== 'L') || (!isLeftMonitor && prefix !== 'R')) return

    const delay = index * 50
    setTimeout(() => {
      grid.playVideo(seq, position, syncStartAtMs)
    }, delay)
  })
}
