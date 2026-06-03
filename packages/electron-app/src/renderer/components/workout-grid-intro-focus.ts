/// <reference path="../../types/electron.d.ts" />

import type { AttachVimeoHandlersFn } from './workout-grid-vimeo-handlers.js'
import type { WorkoutGridPlayCoreSide } from './workout-grid-play-core.js'
import {
  extractVimeoIdFromUrl,
  getSequenceVideoUrlFromSequence,
} from './workout-grid-video-utils.js'

declare const Vimeo: any

export type IntroFocusGridCtx = {
  side: WorkoutGridPlayCoreSide
  players: Map<string, any>
  loopIntervals: Map<string, NodeJS.Timeout>
  attachVimeoPlayerHandlers: AttachVimeoHandlersFn
}

export type IntroFocusRuntimeState = {
  positionCode: string
  internalPosition: string
  slot: number
  focusPlayerId: string
  sourcePlayerId: string | null
  syncInterval: ReturnType<typeof setInterval> | null
}

const focusPlayerIdForSide = (side: WorkoutGridPlayCoreSide): string =>
  `intro-focus-${side}-player`

const domPrefix = (side: WorkoutGridPlayCoreSide): 'L' | 'R' =>
  side === 'left' || side === 'left-2' ? 'L' : 'R'

const getIntroStaticImage = (side: WorkoutGridPlayCoreSide): HTMLElement | null =>
  document.getElementById(`intro-static-image-${side}`)

const getIntroFocusVideoHost = (side: WorkoutGridPlayCoreSide): HTMLElement | null =>
  document.getElementById(`intro-focus-video-${side}`)

/** data-position 이 정확히 일치하는 셀의 플레이어만 사용 (슬롯 번호만 같고 B1≠A1 인 경우 제외) */
const findIntroSourcePlayerByPosition = (
  ctx: IntroFocusGridCtx,
  internalPosition: string,
): { player: any; videoId: string; playerId: string } | null => {
  const prefix = domPrefix(ctx.side)
  const cells = document.querySelectorAll(`[id^="video-slot-${prefix}"]`)

  for (const candidate of cells) {
    if (candidate.getAttribute('data-position') !== internalPosition) continue

    const playerId = `${candidate.id}-player`
    const player = ctx.players.get(playerId)
    const videoKey = candidate.getAttribute('data-video-key') || ''
    const videoId = videoKey.split(':')[0]
    if (player && videoId) {
      return { player, videoId, playerId }
    }
  }

  return null
}

const resolveVideoIdFromSequence = (sequence: any): string => {
  const url = getSequenceVideoUrlFromSequence(sequence)
  return extractVimeoIdFromUrl(url)
}

const hideIntroStaticImage = (side: WorkoutGridPlayCoreSide): void => {
  const staticImage = getIntroStaticImage(side)
  if (staticImage) {
    staticImage.style.visibility = 'hidden'
    staticImage.style.opacity = '0'
  }
}

const restoreIntroStaticImage = (side: WorkoutGridPlayCoreSide): void => {
  const staticImage = getIntroStaticImage(side)
  if (staticImage) {
    staticImage.style.removeProperty('display')
    staticImage.style.visibility = 'visible'
    staticImage.style.opacity = '1'
  }
}

const teardownFocusHost = (ctx: IntroFocusGridCtx): void => {
  const host = getIntroFocusVideoHost(ctx.side)
  if (host) {
    host.innerHTML = ''
    host.style.display = 'none'
  }
}

const destroyFocusPlayerById = (
  ctx: IntroFocusGridCtx,
  focusPlayerId: string,
  syncInterval: ReturnType<typeof setInterval> | null,
): void => {
  if (syncInterval) {
    clearInterval(syncInterval)
  }

  const loop = ctx.loopIntervals.get(focusPlayerId)
  if (loop) {
    clearInterval(loop)
    ctx.loopIntervals.delete(focusPlayerId)
  }

  const player = ctx.players.get(focusPlayerId)
  if (player) {
    try {
      player.destroy()
    } catch {
      /* ignore */
    }
    ctx.players.delete(focusPlayerId)
  }
}

const destroyFocusPlayer = (
  ctx: IntroFocusGridCtx,
  state: IntroFocusRuntimeState,
): void => {
  destroyFocusPlayerById(ctx, state.focusPlayerId, state.syncInterval)
  teardownFocusHost(ctx)
}

export const cancelIntroFocusInGrid = (
  ctx: IntroFocusGridCtx,
  state: IntroFocusRuntimeState | null,
): void => {
  if (state) {
    destroyFocusPlayer(ctx, state)
  } else {
    destroyFocusPlayerById(ctx, focusPlayerIdForSide(ctx.side), null)
    teardownFocusHost(ctx)
  }

  restoreIntroStaticImage(ctx.side)
}

export const focusIntroSlotInGrid = async (
  ctx: IntroFocusGridCtx,
  params: {
    positionCode: string
    internalPosition: string
    slot: number
    fallbackSequence?: any
  },
  previousState: IntroFocusRuntimeState | null,
): Promise<IntroFocusRuntimeState | null> => {
  if (previousState) {
    destroyFocusPlayer(ctx, previousState)
  }

  const exactSource = findIntroSourcePlayerByPosition(ctx, params.internalPosition)

  let videoId = ''
  let sourcePlayer: any | null = null
  let sourcePlayerId: string | null = null

  if (params.fallbackSequence) {
    videoId = resolveVideoIdFromSequence(params.fallbackSequence)
    sourcePlayer = exactSource?.player ?? null
    sourcePlayerId = exactSource?.playerId ?? null
  } else if (exactSource) {
    videoId = exactSource.videoId
    sourcePlayer = exactSource.player
    sourcePlayerId = exactSource.playerId
  }

  if (!videoId) {
    return null
  }

  const focusHost = getIntroFocusVideoHost(ctx.side)
  if (!focusHost) {
    return null
  }

  hideIntroStaticImage(ctx.side)

  focusHost.style.display = 'block'
  focusHost.innerHTML = ''

  const embedUrl =
    `https://player.vimeo.com/video/${videoId}?background=1&loop=1&controls=0&title=0&byline=0&portrait=0&badge=0&autoplay=1&muted=1&autopause=0&quality=auto`

  const iframe = document.createElement('iframe')
  iframe.src = embedUrl
  iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share')
  iframe.setAttribute('allowfullscreen', 'true')
  iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
  iframe.style.cssText = `
    border: none;
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  `

  focusHost.appendChild(iframe)

  const focusPlayerId = focusPlayerIdForSide(ctx.side)
  const state: IntroFocusRuntimeState = {
    positionCode: params.positionCode,
    internalPosition: params.internalPosition,
    slot: params.slot,
    focusPlayerId,
    sourcePlayerId,
    syncInterval: null,
  }

  await new Promise<void>((resolve) => {
    const initPlayer = () => {
      if (typeof Vimeo === 'undefined' || typeof Vimeo.Player === 'undefined') {
        setTimeout(initPlayer, 100)
        return
      }

      const player = new Vimeo.Player(iframe)
      ctx.players.set(focusPlayerId, player)

      player.ready().then(async () => {
        try {
          if (sourcePlayer) {
            const currentTime = await sourcePlayer.getCurrentTime()
            if (currentTime > 0) {
              await player.setCurrentTime(currentTime)
            }
          } else if (params.fallbackSequence?.video_start_time) {
            const startTime = Number(params.fallbackSequence.video_start_time) || 0
            if (startTime > 0) {
              await player.setCurrentTime(startTime)
            }
          }
          await player.setVolume(0)
          await player.play()
        } catch {
          /* ignore */
        }

        if (sourcePlayer) {
          state.syncInterval = setInterval(() => {
            sourcePlayer
              .getCurrentTime()
              .then((seconds: number) => player.setCurrentTime(seconds).catch(() => {}))
              .catch(() => {})
          }, 800)
        }

        const startTime = Number(params.fallbackSequence?.video_start_time) || 0
        const endTime = Number(params.fallbackSequence?.video_end_time) || 0
        ctx.attachVimeoPlayerHandlers(player, startTime, endTime, `${ctx.side}:intro-focus`)
        resolve()
      }).catch(() => resolve())
    }

    initPlayer()
  })

  return state
}
