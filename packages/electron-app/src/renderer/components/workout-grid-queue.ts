/// <reference path="../../types/electron.d.ts" />

import { workoutInfoDevLog } from '../workout-dev-log.js'

declare const Vimeo: any

export interface SlotVideoEntry {
  sequence: any
  position: string
  label: string
  iframe?: HTMLIFrameElement
  player?: any
  layer?: HTMLElement
  loaded: boolean
  playerReady: boolean
  handlersAttached: boolean
  loopInterval?: NodeJS.Timeout
}

export type WorkoutGridQueueSide = 'left' | 'left-2' | 'right' | 'right-2'

function sidePrefixForQueue(side: WorkoutGridQueueSide): 'L' | 'R' {
  return side === 'left' || side === 'left-2' ? 'L' : 'R'
}

interface WorkoutGridQueueManagerDeps {
  side: WorkoutGridQueueSide
  updatePositionLabel: (slot: number, position: string) => void
  updateExerciseNameLabel: (slot: number, exerciseName: string) => void
  updateRepsBadge: (slot: number, sequence: any) => void
  attachVimeoPlayerHandlers: (player: any, startTime: number, endTime: number, tag?: string) => void
  getSequenceVideoUrl: (sequence: any) => string
  extractVimeoId: (url: string) => string
  onDsEntriesReady?: () => void
}

export class WorkoutGridQueueManager {
  private slotQueues: Map<number, SlotVideoEntry[]> = new Map()
  private slotCurrentIndex: Map<number, number> = new Map()
  private queueMode = false
  private readonly deps: WorkoutGridQueueManagerDeps
  private dsTotal = 0
  private dsReady = 0
  private dsReadyFired = false

  constructor(deps: WorkoutGridQueueManagerDeps) {
    this.deps = deps
  }

  setupVideoQueues(slotQueuesData: { [slotNum: number]: Array<{ sequence: any; position: string; label: string }> }) {
    workoutInfoDevLog(
      `🎬 [Queue] 큐 설정 시작 (${this.deps.side})`,
      Object.keys(slotQueuesData).map((k) => `slot${k}: ${slotQueuesData[Number(k)].length}개`),
    )

    this.cleanupQueues()
    this.queueMode = true
    this.dsTotal = 0
    this.dsReady = 0
    this.dsReadyFired = false

    for (const [slotNumStr, entries] of Object.entries(slotQueuesData)) {
      const slotNum = Number(slotNumStr)
      const queue: SlotVideoEntry[] = entries.map((e) => ({
        sequence: e.sequence,
        position: e.position,
        label: e.label,
        loaded: false,
        playerReady: false,
        handlersAttached: false,
      }))
      this.slotQueues.set(slotNum, queue)
      this.slotCurrentIndex.set(slotNum, 0)
    }

    for (const [, queue] of this.slotQueues) {
      if (queue.length > 0 && queue[0].label.startsWith('DS')) this.dsTotal++
    }

    workoutInfoDevLog(`🎬 [Queue] DS 엔트리 ${this.dsTotal}개, DS만 먼저 로드 후 Main 지연 (${this.deps.side})`)

    let delayIdx = 0
    for (const [slotNum, queue] of this.slotQueues) {
      if (queue.length > 0) {
        this.loadQueueEntry(slotNum, 0, false, delayIdx * 150)
        delayIdx++
      }
    }

    if (this.dsTotal === 0) {
      this.dsReadyFired = true
      this.deps.onDsEntriesReady?.()
      this.loadDeferredMainEntries()
    }
  }

  advanceSlot(slotNum: number) {
    const queue = this.slotQueues.get(slotNum)
    if (!queue) return

    const currentIdx = this.slotCurrentIndex.get(slotNum) ?? 0
    const nextIdx = currentIdx + 1

    if (nextIdx >= queue.length) {
      console.warn(`⚠️ [Queue] slot${slotNum}: 큐 끝 (index=${nextIdx}, total=${queue.length})`)
      return
    }

    workoutInfoDevLog(`🎬 [Queue] slot${slotNum} (${this.deps.side}): ${queue[currentIdx]?.label} → ${queue[nextIdx]?.label}`)

    const currentEntry = queue[currentIdx]
    if (currentEntry) {
      this.cleanupQueueEntry(currentEntry)
    }

    const nextEntry = queue[nextIdx]
    if (nextEntry) {
      this.showQueueEntry(slotNum, nextEntry)
    }

    this.slotCurrentIndex.set(slotNum, nextIdx)

    const preloadIdx = nextIdx + 1
    if (preloadIdx < queue.length && !queue[preloadIdx].loaded) {
      this.loadQueueEntry(slotNum, preloadIdx, false, 0)
    }
  }

  advanceAllSlots() {
    for (const slotNum of this.slotQueues.keys()) {
      this.advanceSlot(slotNum)
    }
  }

  revealFirstEntries() {
    for (const [slotNum, queue] of this.slotQueues) {
      const idx = this.slotCurrentIndex.get(slotNum) ?? 0
      const entry = queue[idx]
      if (entry) {
        this.showQueueEntry(slotNum, entry)
      }
    }
    workoutInfoDevLog(`👁️ [Queue] 첫 엔트리 표시 (${this.deps.side})`)
  }

  getCurrentQueueEntry(slotNum: number): SlotVideoEntry | null {
    const queue = this.slotQueues.get(slotNum)
    const idx = this.slotCurrentIndex.get(slotNum) ?? 0
    return queue?.[idx] ?? null
  }

  isQueueMode(): boolean {
    return this.queueMode
  }

  cleanupQueues() {
    for (const [, queue] of this.slotQueues) {
      for (const entry of queue) {
        this.cleanupQueueEntry(entry)
      }
    }
    this.slotQueues.clear()
    this.slotCurrentIndex.clear()
    this.queueMode = false
  }

  seekByPhase(targetLabel: string) {
    if (!this.queueMode) return

    workoutInfoDevLog(`🔍 [Queue] seekByPhase: "${targetLabel}" (${this.deps.side})`)

    let targetQueueIdx: number | null = null
    for (const [, queue] of this.slotQueues) {
      const idx = queue.findIndex((e) => e.label === targetLabel)
      if (idx >= 0) {
        targetQueueIdx = idx
        break
      }
    }

    if (targetQueueIdx === null) {
      workoutInfoDevLog(`⚠️ [Queue] seekByPhase: "${targetLabel}" 를 찾을 수 없음 (${this.deps.side})`)
      return
    }

    for (const [slotNum, queue] of this.slotQueues) {
      if (targetQueueIdx >= queue.length) continue

      const currentIdx = this.slotCurrentIndex.get(slotNum) ?? 0
      if (targetQueueIdx === currentIdx) {
        workoutInfoDevLog(`🔍 [Queue] slot${slotNum}: 이미 index ${targetQueueIdx} 위치 ("${queue[targetQueueIdx].label}")`)
        continue
      }

      const currentEntry = queue[currentIdx]
      if (currentEntry) {
        this.cleanupQueueEntry(currentEntry)
      }

      if (!queue[targetQueueIdx].loaded) {
        this.loadQueueEntry(slotNum, targetQueueIdx, true, 0)
      } else {
        this.showQueueEntry(slotNum, queue[targetQueueIdx])
      }

      this.slotCurrentIndex.set(slotNum, targetQueueIdx)

      const preloadIdx = targetQueueIdx + 1
      if (preloadIdx < queue.length && !queue[preloadIdx].loaded) {
        this.loadQueueEntry(slotNum, preloadIdx, false, 100)
      }

      workoutInfoDevLog(`🔍 [Queue] slot${slotNum}: ${currentIdx} → ${targetQueueIdx} ("${queue[targetQueueIdx].label}")`)
    }
  }

  private loadQueueEntry(slotNum: number, queueIndex: number, visible: boolean, delay: number) {
    const queue = this.slotQueues.get(slotNum)
    if (!queue || queueIndex >= queue.length) return

    const entry = queue[queueIndex]
    if (entry.loaded) return

    const prefix = sidePrefixForQueue(this.deps.side)
    const slotId = `video-slot-${prefix}${slotNum}`
    const videoCell = document.getElementById(slotId)
    if (!videoCell) return

    const videoContainer = videoCell.querySelector('.video-container') as HTMLElement
    if (!videoContainer) return
    videoContainer.style.display = 'block'

    const videoUrl = this.deps.getSequenceVideoUrl(entry.sequence)
    const videoId = this.deps.extractVimeoId(videoUrl)
    if (!videoId) {
      console.warn(`⚠️ [Queue] slot${slotNum}[${queueIndex}] ${entry.label}: videoId 없음`)
      entry.loaded = true
      entry.playerReady = true
      this.checkDsReady(entry)
      return
    }

    const startTime = entry.sequence.video_start_time || 0
    const endTime = entry.sequence.video_end_time || 0

    workoutInfoDevLog(`🚀 [Queue] slot${slotNum}[${queueIndex}] ${entry.label}: 로드 시작 (visible=${visible}, videoId=${videoId})`)

    const autoplayVal = visible ? 1 : 0
    const embedUrl = `https://player.vimeo.com/video/${videoId}?background=1&loop=1&controls=0&title=0&byline=0&portrait=0&badge=0&autoplay=${autoplayVal}&muted=1&autopause=0&quality=auto`

    const layer = document.createElement('div')
    layer.style.cssText = `
      position: absolute;
      inset: 0;
      overflow: hidden;
      background: transparent;
      display: ${visible ? 'block' : 'none'};
      z-index: ${visible ? 10 : 5};
    `
    layer.setAttribute('data-queue-index', String(queueIndex))
    layer.setAttribute('data-queue-label', entry.label)

    const iframe = document.createElement('iframe')
    iframe.src = embedUrl
    iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share')
    iframe.setAttribute('allowfullscreen', 'true')
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
    iframe.style.cssText = `
      border: none;
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      display: block;
    `
    layer.appendChild(iframe)
    videoContainer.appendChild(layer)

    entry.iframe = iframe
    entry.layer = layer
    entry.loaded = true

    const initPlayer = () => {
      try {
        if (typeof Vimeo === 'undefined' || typeof Vimeo.Player === 'undefined') {
          setTimeout(initPlayer, 100)
          return
        }

        const player = new Vimeo.Player(iframe)
        entry.player = player

        player
          .ready()
          .then(async () => {
            try {
              await player.setVolume(0)
            } catch {}
            try {
              if (startTime > 0) await player.setCurrentTime(startTime)
            } catch {}

            if (visible) {
              try {
                await player.play()
              } catch {}
              const placeholder = videoCell.querySelector('.placeholder') as HTMLElement
              if (placeholder) placeholder.style.display = 'none'
              this.deps.updatePositionLabel(slotNum, entry.label)
              this.deps.updateExerciseNameLabel(
                slotNum,
                entry.sequence.exercise_name || entry.sequence.name_ko || '-',
              )
              this.deps.updateRepsBadge(slotNum, entry.sequence)

              this.deps.attachVimeoPlayerHandlers(
                player,
                startTime,
                endTime,
                `queue:${this.deps.side}:slot${slotNum}[${queueIndex}]:${entry.label}`,
              )
              entry.handlersAttached = true
            }

            entry.playerReady = true
            this.checkDsReady(entry)

            workoutInfoDevLog(`✅ [Queue] slot${slotNum}[${queueIndex}] ${entry.label}: 로드 완료 (visible=${visible})`)
          })
          .catch(() => {
            entry.playerReady = true
            this.checkDsReady(entry)
          })
      } catch {
        entry.playerReady = true
        this.checkDsReady(entry)
      }
    }

    if (delay > 0) {
      setTimeout(initPlayer, delay)
    } else {
      initPlayer()
    }
  }

  private checkDsReady(entry: SlotVideoEntry) {
    if (!entry.label.startsWith('DS') || this.dsReadyFired) return
    this.dsReady++
    workoutInfoDevLog(`📊 [Queue] DS ready: ${this.dsReady}/${this.dsTotal} (${this.deps.side})`)
    if (this.dsReady >= this.dsTotal) {
      this.dsReadyFired = true
      workoutInfoDevLog(`✅ [Queue] DS 전체 프리로드 완료 (${this.deps.side})`)
      this.deps.onDsEntriesReady?.()
      this.loadDeferredMainEntries()
    }
  }

  private loadDeferredMainEntries() {
    let delayIdx = 0
    for (const [slotNum, queue] of this.slotQueues) {
      if (queue.length > 1 && !queue[1].loaded) {
        this.loadQueueEntry(slotNum, 1, false, delayIdx * 80)
        delayIdx++
      }
    }
    if (delayIdx > 0) {
      workoutInfoDevLog(`🎬 [Queue] Main 프리로드 지연 로드 시작: ${delayIdx}개 (${this.deps.side})`)
    }
  }

  private showQueueEntry(slotNum: number, entry: SlotVideoEntry) {
    if (!entry.layer) return
    entry.layer.style.display = 'block'
    entry.layer.style.zIndex = '10'

    this.deps.updatePositionLabel(slotNum, entry.label)
    this.deps.updateExerciseNameLabel(slotNum, entry.sequence.exercise_name || entry.sequence.name_ko || '-')
    this.deps.updateRepsBadge(slotNum, entry.sequence)

    const prefix = sidePrefixForQueue(this.deps.side)
    const slotId = `video-slot-${prefix}${slotNum}`
    const videoCell = document.getElementById(slotId)
    if (videoCell) {
      const placeholder = videoCell.querySelector('.placeholder') as HTMLElement
      if (placeholder) placeholder.style.display = 'none'
    }

    if (entry.player) {
      if (!entry.handlersAttached) {
        const startTime = entry.sequence.video_start_time || 0
        const endTime = entry.sequence.video_end_time || 0
        this.deps.attachVimeoPlayerHandlers(
          entry.player,
          startTime,
          endTime,
          `queue:${this.deps.side}:slot${slotNum}:${entry.label}`,
        )
        entry.handlersAttached = true
      }
      try {
        entry.player.play().catch(() => {})
      } catch {}
    }

    workoutInfoDevLog(`👁️ [Queue] slot${slotNum} SHOW: ${entry.label}`)
  }

  private cleanupQueueEntry(entry: SlotVideoEntry) {
    if (entry.loopInterval) {
      clearInterval(entry.loopInterval)
      entry.loopInterval = undefined
    }
    if (entry.player) {
      try {
        entry.player.destroy()
      } catch {}
      entry.player = undefined
    }
    if (entry.layer) {
      try {
        entry.layer.remove()
      } catch {}
      entry.layer = undefined
    }
    entry.iframe = undefined
    entry.loaded = false
    entry.playerReady = false
    entry.handlersAttached = false
  }
}
