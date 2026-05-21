import { workoutInfoDevLog } from '../workout-dev-log.js'
import { attachPlaybackWatchdog } from './playback-watchdog.js'

export type AttachVimeoHandlersFn = (
  player: any,
  startTime: number,
  endTime: number,
  tag?: string,
) => void

export const createWorkoutGridVimeoHandlerAttacher = (ctx: {
  side: 'left' | 'left-2' | 'right' | 'right-2'
  getRecoveryLockUntil: () => number
  setRecoveryLockUntil: (epochMs: number) => void
}): AttachVimeoHandlersFn => {
  return (player: any, startTime: number, endTime: number, tag = ''): void => {
    const label = tag || `${ctx.side}:?`

    let lastSeekAt = 0
    let isSeeking = false
    let seekSafetyTimer: ReturnType<typeof setTimeout> | null = null
    const seekAndPlay = (reason: string) => {
      const now = Date.now()
      if (now - lastSeekAt < 300 || isSeeking) return
      lastSeekAt = now
      isSeeking = true
      if (seekSafetyTimer) clearTimeout(seekSafetyTimer)
      seekSafetyTimer = setTimeout(() => { isSeeking = false }, 3000)
      player
        .setCurrentTime(startTime)
        .then(() => player.play().catch(() => { }))
        .catch(() => { })
        .finally(() => {
          isSeeking = false
          if (seekSafetyTimer) { clearTimeout(seekSafetyTimer); seekSafetyTimer = null }
        })
    }

    if (endTime > 0 && endTime > startTime) {
      let lastTimeupdateAt = 0
      player.on('timeupdate', (data: { seconds: number }) => {
        if (typeof data?.seconds !== 'number') return
        const now = Date.now()
        if (data.seconds < endTime - 1.0 && now - lastTimeupdateAt < 500) return
        lastTimeupdateAt = now
        if (data.seconds >= endTime - 0.5) seekAndPlay('timeupdate')
      })
      player.on('ended', () => {
        workoutInfoDevLog(`🔚 [${label}] ended (segment loop)`)
        seekAndPlay('ended')
      })
    } else {
      player.on('ended', () => {
        workoutInfoDevLog(`🔚 [${label}] ended (simple loop, startTime=${startTime})`)
        seekAndPlay('ended-simple')
      })
    }

    let pauseTimer: ReturnType<typeof setTimeout> | null = null
    let pauseRecoveryDelay = 500
    const MAX_PAUSE_RECOVERY_DELAY = 4000
    player.on('pause', () => {
      const ts = new Date().toISOString().slice(11, 23)
      const now = Date.now()
      if (now < ctx.getRecoveryLockUntil()) {
        workoutInfoDevLog(`⏸ [${label}] PAUSE at ${ts} — 잠금 중 스킵 (lock expires in ${ctx.getRecoveryLockUntil() - now}ms)`)
        return
      }
      console.warn(`⏸ [${label}] PAUSE at ${ts} — recovery 예약 (delay=${pauseRecoveryDelay}ms)`)
      if (pauseTimer) clearTimeout(pauseTimer)
      pauseTimer = setTimeout(() => {
        pauseTimer = null
        if (Date.now() < ctx.getRecoveryLockUntil()) return
        player
          .getPaused?.()
          .then((paused: boolean) => {
            if (!paused) {
              workoutInfoDevLog(`✅ [${label}] pause-recovery: 이미 재생 중`)
              pauseRecoveryDelay = 500
              return
            }
            ctx.setRecoveryLockUntil(Date.now() + 1000)
            workoutInfoDevLog(`▶️ [${label}] pause-recovery: play() 호출`)
            player.play().catch((e: any) => {
              console.warn(`⚠️ [${label}] pause-recovery play() failed: ${e?.message ?? e}`)
            })
            pauseRecoveryDelay = Math.min(pauseRecoveryDelay * 2, MAX_PAUSE_RECOVERY_DELAY)
          })
          .catch(() => { })
      }, pauseRecoveryDelay)
    })

    player.on('playing', () => {
      pauseRecoveryDelay = 500
    })

    player.on('error', (e: any) => {
      console.error(`❌ [${label}] Vimeo error:`, e?.message ?? e)
    })

    let bufferStartAt = 0
    player.on('bufferstart', () => {
      bufferStartAt = Date.now()
      console.warn(`⏳ [${label}] 버퍼링 시작`)
    })
    player.on('bufferend', () => {
      const duration = bufferStartAt > 0 ? Date.now() - bufferStartAt : 0
      console.warn(`✅ [${label}] 버퍼링 종료 (${duration}ms)`)
      bufferStartAt = 0
    })

    const loadStartAt = Date.now()
    player.on('loaded', (data: any) => {
      const loadTime = Date.now() - loadStartAt
      console.log(`📦 [${label}] 영상 로드 완료 (${loadTime}ms, id=${data?.id ?? '?'})`)
    })

    player.on('qualitychange', (data: any) => {
      console.log(`🎞 [${label}] 화질 변경: ${data?.quality ?? '?'}`)
    })

    attachPlaybackWatchdog(player, label)
  }
}
