/**
 * playback-snapshot.ts
 *
 * 기능: 슬롯별 Vimeo Player의 재생 상태를 한 줄 스냅샷 로그로 남김
 *
 * 동작 흐름:
 * 1) 주어진 players 맵을 순회하며 paused / ended / currentTime / duration 을 병렬 조회
 * 2) 각 슬롯을 `playerId=p:<paused>,e:<ended>,t:<curT>/<dur>` 포맷으로 압축
 * 3) `📊 [Snapshot <side>] ...` 한 줄로 logger 출력 (사후 분석용)
 *
 * Export:
 *   - snapshotPlayerStates(side, players)
 *
 * 호출처:
 *   - WorkoutGridDisplay.startHeartbeat → 5초 주기 setInterval 안에서 호출
 *
 * 참고:
 *   - 호출 비용: 4 화면 × 3 슬롯 × 4 API ≈ 5초마다 48 promise. 부담 작음.
 *   - 실패한 항목은 '?' 로 표기, 절대 throw 하지 않음.
 */

import { workoutInfoDevLog } from '../workout-dev-log.js'

export type SnapshotSide = 'left' | 'left-2' | 'right' | 'right-2'

type PlayerLike = {
  getPaused?: () => Promise<boolean>
  getEnded?: () => Promise<boolean>
  getCurrentTime?: () => Promise<number>
  getDuration?: () => Promise<number>
}

const fmtTime = (n: number): string => (Number.isFinite(n) ? n.toFixed(1) : '?')

const fmtBool = (v: boolean | undefined | null): string => {
  if (v === true) return 'T'
  if (v === false) return 'F'
  return '?'
}

const safe = async <T>(fn?: () => Promise<T>): Promise<T | undefined> => {
  if (typeof fn !== 'function') return undefined
  try {
    return await fn()
  } catch {
    return undefined
  }
}

export const snapshotPlayerStates = async (
  side: SnapshotSide,
  players: Map<string, PlayerLike>,
): Promise<void> => {
  if (!players || players.size === 0) return
  const entries = Array.from(players.entries())
  const lines = await Promise.all(
    entries.map(async ([id, player]) => {
      const [paused, ended, cur, dur] = await Promise.all([
        safe(player.getPaused?.bind(player)),
        safe(player.getEnded?.bind(player)),
        safe(player.getCurrentTime?.bind(player)),
        safe(player.getDuration?.bind(player)),
      ])
      const curN = typeof cur === 'number' ? cur : NaN
      const durN = typeof dur === 'number' ? dur : NaN
      return `${id}=p:${fmtBool(paused as boolean)},e:${fmtBool(ended as boolean)},t:${fmtTime(curN)}/${fmtTime(durN)}`
    }),
  )
  workoutInfoDevLog(`📊 [Snapshot ${side}] ${lines.join(' | ')}`)
}
