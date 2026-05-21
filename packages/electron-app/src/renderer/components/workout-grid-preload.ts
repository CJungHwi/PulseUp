/// <reference path="../../types/electron.d.ts" />

import type { AttachVimeoHandlersFn } from './workout-grid-vimeo-handlers.js'
import {
  buildWorkoutGridVideoKey,
  extractVimeoIdFromUrl,
  getSequenceVideoUrlFromSequence,
} from './workout-grid-video-utils.js'
import { workoutInfoDevLog } from '../workout-dev-log.js'

declare const Vimeo: any

export type PreloadCacheEntry = {
  iframe: HTMLIFrameElement
  player: any
  startTime: number
  endTime: number
}

export class WorkoutGridPreloadStore {
  private preloadContainer: HTMLElement | null = null
  private readonly cache = new Map<string, PreloadCacheEntry>()
  private readonly maxPreloadCacheSize = 3

  constructor(
    private readonly side: 'left' | 'left-2' | 'right' | 'right-2',
    private readonly attachVimeoPlayerHandlers: AttachVimeoHandlersFn,
  ) { }

  get size(): number {
    return this.cache.size
  }

  snapshotCacheKeys(): string[] {
    return Array.from(this.cache.keys())
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  get(key: string): PreloadCacheEntry | undefined {
    return this.cache.get(key)
  }

  take(key: string): PreloadCacheEntry | undefined {
    const e = this.cache.get(key)
    if (e) this.cache.delete(key)
    return e
  }

  private getPreloadContainer(): HTMLElement {
    if (this.preloadContainer && document.body.contains(this.preloadContainer)) return this.preloadContainer
    const id = `vimeo-preload-cache-${this.side}`
    const existing = document.getElementById(id)
    if (existing) {
      this.preloadContainer = existing
      return existing
    }
    const el = document.createElement('div')
    el.id = id
    el.style.cssText = `
      position: fixed;
      left: -99999px;
      top: -99999px;
      width: 1px;
      height: 1px;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
    `
    document.body.appendChild(el)
    this.preloadContainer = el
    return el
  }

  private evictPreloadKey(key: string) {
    const cached = this.cache.get(key)
    if (!cached) return
    try {
      cached.player?.destroy?.()
    } catch { }
    try {
      cached.iframe?.remove?.()
    } catch { }
    this.cache.delete(key)
  }

  preloadVideo(sequence: any, position: string) {
    const videoUrl = getSequenceVideoUrlFromSequence(sequence)
    const videoId = extractVimeoIdFromUrl(videoUrl)
    if (!videoId) {
      console.warn(`⚠️ [Preload] ${position}: videoId 없음 (url: ${videoUrl})`)
      return
    }
    const startTime = sequence?.video_start_time || 0
    const endTime = sequence?.video_end_time || 0
    const key = buildWorkoutGridVideoKey(videoId, startTime, endTime)
    if (this.cache.has(key)) {
      workoutInfoDevLog(`🔄 [Preload] ${position}: 이미 캐시에 있음 (key: ${key})`)
      return
    }
    workoutInfoDevLog(`🚀 [Preload] ${position}: 프리로드 시작 (videoId: ${videoId}, key: ${key})`)
    if (this.cache.size >= this.maxPreloadCacheSize) {
      const firstKey = this.cache.keys().next().value as string | undefined
      if (firstKey) this.evictPreloadKey(firstKey)
    }
    const container = this.getPreloadContainer()
    const iframeId = `preload-${this.side}-${key.replace(/[^a-zA-Z0-9:_-]/g, '_')}`
    const embedUrl = `https://player.vimeo.com/video/${videoId}?background=1&loop=1&controls=0&title=0&byline=0&portrait=0&badge=0&autoplay=1&muted=1&autopause=0&quality=auto`
    const iframe = document.createElement('iframe')
    iframe.id = iframeId
    iframe.src = embedUrl
    iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share')
    iframe.setAttribute('allowfullscreen', 'true')
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
    iframe.style.cssText = 'border:none;width:1px;height:1px;display:block;'
    container.appendChild(iframe)

    const init = () => {
      try {
        if (typeof Vimeo === 'undefined' || typeof Vimeo.Player === 'undefined') {
          setTimeout(init, 100)
          return
        }
        const player = new Vimeo.Player(iframe)
        this.cache.set(key, { iframe, player, startTime, endTime })
        player.ready().then(async () => {
          try {
            await player.setVolume(0)
          } catch { }
          try {
            if (startTime > 0) await player.setCurrentTime(startTime)
          } catch { }
          this.attachVimeoPlayerHandlers(player, startTime, endTime, 'preload:' + position)

          const pauseAfterBuffer = () => {
            try { player.pause().catch(() => { }) } catch { }
          }
          const onTimeForPause = (data: { seconds?: number }) => {
            if (typeof data?.seconds === 'number' && data.seconds > 0) {
              try { player.off?.('timeupdate', onTimeForPause) } catch { }
              pauseAfterBuffer()
            }
          }
          try { player.on?.('timeupdate', onTimeForPause) } catch { }
          setTimeout(() => {
            try { player.off?.('timeupdate', onTimeForPause) } catch { }
            pauseAfterBuffer()
          }, 4000)
        })
      } catch {
        // ignore
      }
    }
    init()
  }

  clear() {
    Array.from(this.cache.keys()).forEach((key) => this.evictPreloadKey(key))
    this.cache.clear()
  }
}
