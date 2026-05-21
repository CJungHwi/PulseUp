/**
 * playback-watchdog.ts
 *
 * 기능: Vimeo Player의 재생 정지(stall) 감지 및 단계적 자동 복구
 *
 * 동작 흐름:
 * 1) `timeupdate` 이벤트로 마지막 진행 시각(`lastTickAt`)과 마지막 currentTime(`lastSeconds`)을 추적
 * 2) `pollIntervalMs`(기본 1s) 주기로 다음을 검사
 *    - paused 또는 ended → 정상(정책적 정지 가능) → 타이머 리셋 후 skip
 *    - 그 외인데 `stallTimeoutMs`(기본 3s) 동안 진행 변동이 없으면 STALL 로 판정
 * 3) 복구 단계
 *    - 1~maxRetries: `setCurrentTime(lastSeconds || 0) → play()`
 *    - maxRetries 초과: `player.element`(iframe) `src` 리셋(=iframe reload)
 * 4) `playing` 이벤트가 들어오면 카운터 리셋
 *
 * Export:
 *   - attachPlaybackWatchdog(player, label, opts?) → { stop() }
 *
 * 호출처:
 *   - workout-grid-vimeo-handlers.ts → createWorkoutGridVimeoHandlerAttacher 의 핸들러 부착 마지막 단계
 */

import { workoutInfoDevLog } from '../workout-dev-log.js'

export type PlaybackWatchdogOptions = {
  stallTimeoutMs?: number
  pollIntervalMs?: number
  recoverDelayMs?: number
  maxRetries?: number
}

export type PlaybackWatchdogHandle = {
  stop: () => void
}

const DEFAULT_OPTIONS: Required<PlaybackWatchdogOptions> = {
  stallTimeoutMs: 3000,
  pollIntervalMs: 1000,
  recoverDelayMs: 800,
  maxRetries: 3,
}

const reloadVimeoIframe = (player: any, label: string): boolean => {
  try {
    const iframe = player?.element as HTMLIFrameElement | undefined
    if (iframe?.tagName !== 'IFRAME') return false
    const src = typeof iframe.src === 'string' ? iframe.src : ''
    if (!src) return false
    iframe.src = src
    workoutInfoDevLog(`♻️ [${label}] iframe reload (src 리셋)`)
    return true
  } catch (error: any) {
    console.warn(`⚠️ [${label}] iframe reload 실패: ${error?.message ?? error}`)
    return false
  }
}

export const attachPlaybackWatchdog = (
  player: any,
  label: string,
  opts: PlaybackWatchdogOptions = {},
): PlaybackWatchdogHandle => {
  const { stallTimeoutMs, pollIntervalMs, recoverDelayMs, maxRetries } = {
    ...DEFAULT_OPTIONS,
    ...opts,
  }

  let lastTickAt = Date.now()
  let lastSeconds = -1
  let retries = 0
  let recovering = false
  let stopped = false

  const handleTimeupdate = (data: { seconds?: number }) => {
    if (typeof data?.seconds !== 'number') return
    if (data.seconds !== lastSeconds) {
      lastTickAt = Date.now()
      lastSeconds = data.seconds
    }
  }

  const handlePlaying = () => {
    lastTickAt = Date.now()
    retries = 0
  }

  try {
    player.on?.('timeupdate', handleTimeupdate)
    player.on?.('playing', handlePlaying)
  } catch {
    /* ignore — non-Vimeo player or destroyed */
  }

  const tryRecover = async (): Promise<void> => {
    if (recovering || stopped) return
    recovering = true
    try {
      retries++
      if (retries > maxRetries) {
        const reloaded = reloadVimeoIframe(player, label)
        if (reloaded) {
          retries = 0
          lastTickAt = Date.now()
        }
        return
      }
      const sinceMs = Date.now() - lastTickAt
      console.warn(
        `🟥 [${label}] STALL → 복구 시도 ${retries}/${maxRetries} (cur=${lastSeconds}, since=${sinceMs}ms)`,
      )
      const target = lastSeconds > 0 ? lastSeconds : 0
      try {
        await player.setCurrentTime?.(target)
      } catch {
        /* ignore */
      }
      try {
        await player.play?.()
      } catch {
        /* ignore */
      }
      lastTickAt = Date.now()
    } finally {
      recovering = false
    }
  }

  const checkStall = async (): Promise<void> => {
    if (stopped) return
    if (Date.now() - lastTickAt < stallTimeoutMs) return
    let paused = false
    let ended = false
    try {
      paused = (await player.getPaused?.()) ?? false
    } catch {
      /* ignore */
    }
    try {
      ended = (await player.getEnded?.()) ?? false
    } catch {
      /* ignore */
    }
    if (paused || ended) {
      lastTickAt = Date.now()
      return
    }
    setTimeout(() => {
      tryRecover().catch(() => {})
    }, recoverDelayMs)
  }

  const interval: ReturnType<typeof setInterval> = setInterval(() => {
    checkStall().catch(() => {})
  }, pollIntervalMs)

  return {
    stop: () => {
      if (stopped) return
      stopped = true
      try {
        clearInterval(interval)
      } catch {
        /* ignore */
      }
      try {
        player.off?.('timeupdate', handleTimeupdate)
        player.off?.('playing', handlePlaying)
      } catch {
        /* ignore */
      }
    },
  }
}
