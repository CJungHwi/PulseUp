/// <reference path="../../types/electron.d.ts" />

import type { AttachVimeoHandlersFn } from './workout-grid-vimeo-handlers.js'
import type { WorkoutGridPreloadStore } from './workout-grid-preload.js'
import {
  buildWorkoutGridVideoKey,
  extractVimeoIdFromUrl,
  getSequenceVideoUrlFromSequence,
} from './workout-grid-video-utils.js'
import { workoutInfoDevLog } from '../workout-dev-log.js'

declare const Vimeo: any

export type WorkoutGridPlayCoreSide = 'left' | 'left-2' | 'right' | 'right-2'

export type WorkoutGridPlayCoreCtx = {
  side: WorkoutGridPlayCoreSide
  players: Map<string, any>
  loopIntervals: Map<string, NodeJS.Timeout>
  preloadStore: WorkoutGridPreloadStore
  mapPositionToSlot: (position: string) => number
  attachVimeoPlayerHandlers: AttachVimeoHandlersFn
  updatePositionLabel: (slot: number, position: string) => void
  updateExerciseNameLabel: (slot: number, name: string) => void
  updateRepsBadge: (slot: number, sequence: any) => void
}

export const workoutGridPlayVideo = (
  ctx: WorkoutGridPlayCoreCtx,
  sequence: any,
  position: string,
  syncStartAtMs?: number,
  skipPlayIfSame?: boolean,
) => {
  const slot = ctx.mapPositionToSlot(position)
  const prefix: 'L' | 'R' = ctx.side === 'left' || ctx.side === 'left-2' ? 'L' : 'R'
  const slotId = `video-slot-${prefix}${slot}`
  const videoCell = document.getElementById(slotId)

  if (!videoCell) {
    console.warn(`⚠️ Slot not found: ${slotId}`)
    return
  }

  const prevPosition = videoCell.getAttribute('data-position') || ''
  const prevVideoKey = videoCell.getAttribute('data-video-key') || ''

  const pendingExerciseName = sequence.exercise_name || sequence.name_ko || '-'
  const applyPendingLabels = () => {
    ctx.updatePositionLabel(slot, position)
    ctx.updateExerciseNameLabel(slot, pendingExerciseName)
    ctx.updateRepsBadge(slot, sequence)
  }

  const placeholder = videoCell.querySelector('.placeholder') as HTMLElement | null
  const videoContainer = videoCell.querySelector('.video-container') as HTMLElement
  if (!videoContainer) return

  videoContainer.style.display = 'block'

  const videoUrl = getSequenceVideoUrlFromSequence(sequence)
  const videoId = extractVimeoIdFromUrl(videoUrl)
  const playerId = `${slotId}-player`

  if (!videoId) {
    if (ctx.players.has(playerId)) {
      applyPendingLabels()
      return
    }
    videoContainer.style.display = 'none'
    if (placeholder) placeholder.style.display = 'block'
    return
  }

  const startTime = sequence.video_start_time || 0
  const endTime = sequence.video_end_time || 0
  const nextVideoKey = buildWorkoutGridVideoKey(videoId, startTime, endTime)

  const oldPlayer = ctx.players.get(playerId)
  const oldLoop = ctx.loopIntervals.get(playerId)
  const cleanupOld = () => {
    if (oldLoop) {
      try {
        clearInterval(oldLoop)
      } catch { }
      ctx.loopIntervals.delete(playerId)
    }
    if (oldPlayer) {
      try {
        oldPlayer.destroy()
      } catch { }
    }
  }

  if (prevPosition === position && prevVideoKey === nextVideoKey && ctx.players.has(playerId)) {
    const existingPlayer = ctx.players.get(playerId)
    if (!skipPlayIfSame) {
      const ensurePlay = async () => {
        try {
          if (existingPlayer) {
            const isPaused = await existingPlayer.getPaused()
            if (isPaused) {
              await existingPlayer.play().catch(() => { })
            }
          }
        } catch { }
      }
      if (typeof syncStartAtMs === 'number' && Number.isFinite(syncStartAtMs)) {
        const delay = Math.max(0, syncStartAtMs - Date.now())
        setTimeout(ensurePlay, delay)
      } else {
        ensurePlay()
      }
    }
    videoCell.setAttribute('data-position', position)
    videoCell.setAttribute('data-video-key', nextVideoKey)
    applyPendingLabels()
    return
  }

  videoCell.setAttribute('data-position', position)
  videoCell.setAttribute('data-video-key', nextVideoKey)

  const cached = ctx.preloadStore.take(nextVideoKey)
  workoutInfoDevLog(
    `🔍 [PlayVideo] ${position} 프리로드 캐시 ${cached ? 'HIT ✅' : 'MISS ❌'} (key: ${nextVideoKey}, cache size: ${ctx.preloadStore.size}, keys: [${ctx.preloadStore.snapshotCacheKeys().join(', ')}])`,
  )

  if (cached && cached.iframe && cached.player) {
    const fadeLayer = document.createElement('div')
    fadeLayer.style.cssText = `
        position: absolute;
        inset: 0;
        overflow: hidden;
        background: transparent;
        opacity: 0;
        transition: opacity 180ms ease-out;
      `
    videoContainer.appendChild(fadeLayer)

    cached.iframe.style.cssText = `
        border: none;
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: block;
      `
    fadeLayer.appendChild(cached.iframe)
    ctx.players.set(playerId, cached.player)

    let didReveal = false
    const reveal = () => {
      if (didReveal) return
      didReveal = true
      applyPendingLabels()
      if (placeholder) placeholder.style.display = 'none'
      fadeLayer.style.opacity = '1'
      setTimeout(() => {
        try {
          const children = Array.from(videoContainer.children)
          for (let ci = children.length - 1; ci >= 0; ci--) {
            if (children[ci] !== fadeLayer) videoContainer.removeChild(children[ci])
          }
        } catch { }
        cleanupOld()
      }, 250)
    }

    const doPlay = async () => {
      try {
        cached.player.play().catch(() => { })
      } catch { }
      try {
        const onPlaying = () => {
          try {
            cached.player.off?.('playing', onPlaying)
          } catch { }
          reveal()
        }
        cached.player.on?.('playing', onPlaying)
      } catch { }
      try {
        const onTime = (data: { seconds?: number }) => {
          if (typeof data?.seconds === 'number') reveal()
        }
        cached.player.on?.('timeupdate', onTime)
        setTimeout(() => {
          try {
            cached.player.off?.('timeupdate', onTime)
          } catch { }
        }, 1500)
      } catch { }
    }

    if (typeof syncStartAtMs === 'number' && Number.isFinite(syncStartAtMs)) {
      const delay = Math.max(0, syncStartAtMs - Date.now())
      setTimeout(() => {
        doPlay()
      }, delay)
    } else {
      doPlay()
      setTimeout(reveal, 1200)
    }
    return
  }

  const embedUrl = `https://player.vimeo.com/video/${videoId}?background=1&loop=1&controls=0&title=0&byline=0&portrait=0&badge=0&autoplay=1&muted=1&autopause=0&quality=auto`
  const fadeLayer = document.createElement('div')
  fadeLayer.style.cssText = `
      position: absolute;
      inset: 0;
      overflow: hidden;
      background: transparent;
      opacity: 0;
      transition: opacity 180ms ease-out;
    `
  const iframe = document.createElement('iframe')
  iframe.src = embedUrl
  iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share')
  iframe.setAttribute('allowfullscreen', 'true')
  iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
  iframe.style.cssText = `
      border: none;
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: block;
    `

  const iframeLoadStart = Date.now()
  iframe.addEventListener('load', () => {
    console.log(`📄 [${ctx.side}:${slotId}] iframe 로드 완료 (${Date.now() - iframeLoadStart}ms, videoId=${videoId})`)
  })
  iframe.addEventListener('error', (e) => {
    console.error(`📄 [${ctx.side}:${slotId}] iframe 로드 실패 (videoId=${videoId}):`, (e as ErrorEvent).message || 'unknown')
  })

  fadeLayer.appendChild(iframe)
  videoContainer.appendChild(fadeLayer)

  const initPlayer = () => {
    try {
      if (!iframe) return

      if (typeof Vimeo === 'undefined' || typeof Vimeo.Player === 'undefined') {
        setTimeout(initPlayer, 100)
        return
      }

      const player = new Vimeo.Player(iframe)
      ctx.players.set(playerId, player)

      player.ready().then(() => {
        const setTimeAndPlay = async () => {
          try {
            try {
              await player.setVolume(0)
            } catch { }

            if (startTime > 0) {
              await player.setCurrentTime(startTime)
            }

            let didReveal = false
            const reveal = () => {
              if (didReveal) return
              didReveal = true
              applyPendingLabels()
              if (placeholder) placeholder.style.display = 'none'
              fadeLayer.style.opacity = '1'
              setTimeout(() => {
                try {
                  const children = Array.from(videoContainer.children)
                  for (let ci = children.length - 1; ci >= 0; ci--) {
                    if (children[ci] !== fadeLayer) videoContainer.removeChild(children[ci])
                  }
                } catch { }
                cleanupOld()
              }, 250)
            }

            const doPlay = async (attempt = 0) => {
              try {
                await player.play()
              } catch {
                if (attempt < 10) {
                  setTimeout(() => doPlay(attempt + 1), Math.min(400 + attempt * 250, 2500))
                }
              }
            }

            try {
              const onPlaying = () => {
                try {
                  player.off?.('playing', onPlaying)
                } catch { }
                reveal()
              }
              player.on?.('playing', onPlaying)
            } catch { }
            try {
              const onTime = (data: { seconds?: number }) => {
                if (typeof data?.seconds === 'number') reveal()
              }
              player.on?.('timeupdate', onTime)
              setTimeout(() => {
                try {
                  player.off?.('timeupdate', onTime)
                } catch { }
              }, 1500)
            } catch { }

            if (typeof syncStartAtMs === 'number' && Number.isFinite(syncStartAtMs)) {
              const delay = Math.max(0, syncStartAtMs - Date.now())
              setTimeout(() => {
                doPlay()
                setTimeout(reveal, 500)
              }, delay)
            } else {
              doPlay()
              setTimeout(reveal, 500)
            }
          } catch {
            // ignore
          }
        }

        setTimeAndPlay()
        ctx.attachVimeoPlayerHandlers(player, startTime, endTime, `${ctx.side}:${slotId}`)
        player.on('error', () => { })
      }).catch(() => { })
    } catch {
      // ignore
    }
  }

  const slotStaggerMs = 150
  const sideOffsetMs = ctx.side === 'right' ? 80 : 0
  const initDelay = slot > 1 ? (slot - 1) * slotStaggerMs + sideOffsetMs : sideOffsetMs
  if (initDelay > 0) {
    setTimeout(initPlayer, initDelay)
  } else {
    initPlayer()
  }
}
