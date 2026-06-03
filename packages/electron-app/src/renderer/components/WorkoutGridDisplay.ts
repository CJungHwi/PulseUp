/// <reference path="../../types/electron.d.ts" />

import { getGridCategoryDisplayName, normalizePanelCircuitType } from '../circuits/grid-display-registry.js'
import {
  getIntroSlotDefaultLabel,
  internalPositionToDisplayCode,
  mapGridPositionToDomSlot,
  resolveIntroFocusForMonitor,
  type IntroFocusTarget,
} from '../circuits/intro-position-codes.js'
import { normalizeGridPosition } from '../../common/grid-position-codes.js'
import { clearAllWorkoutGridVideoCells, clearWorkoutGridVideoByPosition } from './workout-grid-cell-cleanup.js'
import { buildWorkoutGridShellHtml } from './workout-grid-display-shell.js'
import {
  cancelIntroFocusInGrid,
  focusIntroSlotInGrid,
  type IntroFocusRuntimeState,
} from './workout-grid-intro-focus.js'
import { WorkoutGridPreloadStore } from './workout-grid-preload.js'
import { workoutGridPlayVideo } from './workout-grid-play-core.js'
import type { SlotVideoEntry } from './workout-grid-queue.js'
import { WorkoutGridQueueManager } from './workout-grid-queue.js'
import type { WorkoutCircuitType } from './workout-timer-circuit.js'
import type { AttachVimeoHandlersFn } from './workout-grid-vimeo-handlers.js'
import { createWorkoutGridVimeoHandlerAttacher } from './workout-grid-vimeo-handlers.js'
import { extractVimeoIdFromUrl, getSequenceVideoUrlFromSequence } from './workout-grid-video-utils.js'
import { snapshotPlayerStates } from './playback-snapshot.js'
import { workoutInfoDevLog } from '../workout-dev-log.js'

export type WorkoutGridSide = 'left' | 'left-2' | 'right' | 'right-2'

/** side → DOM slot ID prefix ('L' 또는 'R'). 5-screen 모드에서도 같은 좌/우 prefix 사용. */
function sidePrefix(side: WorkoutGridSide): 'L' | 'R' {
  return side === 'left' || side === 'left-2' ? 'L' : 'R'
}

export class WorkoutGridDisplay {
  private container: HTMLElement
  private side: WorkoutGridSide
  private currentActiveSet: 'set1' | 'set2' = 'set2'
  private players: Map<string, any> = new Map()
  private loopIntervals: Map<string, NodeJS.Timeout> = new Map()
  private heartbeatInterval: NodeJS.Timeout | null = null
  private recoveryLockUntil = 0
  private queueManager: WorkoutGridQueueManager
  private readonly preloadStore: WorkoutGridPreloadStore
  private readonly attachVimeoPlayerHandlers: AttachVimeoHandlersFn
  private circuitType: WorkoutCircuitType = 'stress'
  private lastCategoryLabelSource = ''
  private isIntroLayout = false
  private introFocusState: IntroFocusRuntimeState | null = null

  constructor(container: HTMLElement, side: WorkoutGridSide) {
    this.container = container
    this.side = side
    this.attachVimeoPlayerHandlers = createWorkoutGridVimeoHandlerAttacher({
      side: this.side,
      getRecoveryLockUntil: () => this.recoveryLockUntil,
      setRecoveryLockUntil: (epochMs) => {
        this.recoveryLockUntil = epochMs
      },
    })
    this.preloadStore = new WorkoutGridPreloadStore(this.side, this.attachVimeoPlayerHandlers)
    this.queueManager = new WorkoutGridQueueManager({
      side: this.side,
      updatePositionLabel: (slot, position) => this.updatePositionLabel(slot, position),
      updateExerciseNameLabel: (slot, name) => this.updateExerciseNameLabel(slot, name),
      updateRepsBadge: (slot, sequence) => this.updateRepsBadge(slot, sequence),
      attachVimeoPlayerHandlers: (player, startTime, endTime, tag) =>
        this.attachVimeoPlayerHandlers(player, startTime, endTime, tag),
      getSequenceVideoUrl: getSequenceVideoUrlFromSequence,
      extractVimeoId: extractVimeoIdFromUrl,
      onDsEntriesReady: () => {
        try {
          window.electronAPI.notifyQueuePreloadReady(this.side)
        } catch {}
      },
    })
    this.render()
  }

  preloadVideo(sequence: any, position: string) {
    this.preloadStore.preloadVideo(sequence, position)
  }

  clearPreloadCache() {
    this.preloadStore.clear()
  }

  private stretchingSlotCount = 0

  /**
   * 그리드를 재구성한다.
   * @param clearCache preloadCache를 함께 비울지 여부 (기본 false).
   */
  render(
    isIntro: boolean = false,
    introImageUrl?: string,
    stretchingSlotCount: number = 0,
    clearCache: boolean = false,
    introFiveScreen: boolean = false,
  ) {
    workoutInfoDevLog(
      `🔄 [WorkoutGridDisplay] render(isIntro=${isIntro}, stretchingSlotCount=${stretchingSlotCount}, clearCache=${clearCache}, cacheSize=${this.preloadStore.size})`,
    )
    this.stopHeartbeat()
    try {
      this.cleanupQueues()
    } catch {
      /* ignore */
    }
    if (clearCache) {
      try {
        this.clearPreloadCache()
      } catch {
        /* ignore */
      }
    }
    try {
      this.clearAllVideoCells(false)
    } catch {
      /* ignore */
    }

    this.stretchingSlotCount = stretchingSlotCount
    this.isIntroLayout = isIntro
    if (!isIntro) {
      this.introFocusState = null
    }
    this.container.innerHTML = buildWorkoutGridShellHtml({
      side: this.side,
      isIntro,
      introImageUrl,
      stretchingSlotCount,
      introFiveScreen,
    })
    this.startHeartbeat()
  }

  isStretchingLayout(): boolean {
    return this.stretchingSlotCount > 3
  }

  switchStretchingGroup(groupIndex: number) {
    const prefix = sidePrefix(this.side)
    const targetGroup = groupIndex + 1
    for (let i = 1; i <= this.stretchingSlotCount; i++) {
      const slotId = `video-slot-${prefix}${i}`
      const el = document.getElementById(slotId)
      if (!el) continue
      const group = parseInt(el.getAttribute('data-stretching-group') || '0', 10)
      if (group === 0) continue
      el.style.display = group === targetGroup ? 'flex' : 'none'
    }
  }

  mapPositionToSlot(position: string): number {
    if (!position) return 1
    const domPrefix = sidePrefix(this.side)
    const maxSlots = document.querySelectorAll(`[id^="video-slot-${domPrefix}"]`).length || 3
    return mapGridPositionToDomSlot(position, {
      introLayout: this.isIntroLayout,
      maxSlots,
    })
  }

  switchSet(newSet: 'set1' | 'set2') {
    if (newSet !== this.currentActiveSet) this.currentActiveSet = newSet
  }

  clearAllVideoCells(keepLabels: boolean = false) {
    clearAllWorkoutGridVideoCells(
      {
        side: this.side,
        players: this.players,
        loopIntervals: this.loopIntervals,
        resetPositionLabel: (slot, defaultLabel) => this.resetPositionLabel(slot, defaultLabel),
        resetExerciseNameLabel: (slot) => this.resetExerciseNameLabel(slot),
        updateCategoryLabel: (s) => this.updateCategoryLabel(s),
      },
      keepLabels,
    )
  }

  private updatePositionLabel(slot: number, position: string) {
    const prefix = sidePrefix(this.side)
    const displayPosition = this.isIntroLayout
      ? internalPositionToDisplayCode(position, this.side)
      : position
    const overlayId = `position-overlay-${prefix}${slot}`
    const overlayElement = document.getElementById(overlayId)
    if (overlayElement) {
      overlayElement.textContent = displayPosition
      overlayElement.style.display = 'block'
    }
    this.updateReadyScreenLabel(slot, displayPosition)
    this.updateCategoryLabel(position)
  }

  setCircuitType(ct: string | undefined) {
    const val = normalizePanelCircuitType(ct)
    if (!val) return
    if (this.circuitType === val) return
    this.circuitType = val
    if (this.lastCategoryLabelSource) {
      this.updateCategoryLabel(this.lastCategoryLabelSource)
    }
  }

  private updateCategoryLabel(positionOrLabel: string) {
    this.lastCategoryLabelSource = positionOrLabel || ''
    const categoryEl = document.getElementById(`category-label-${this.side}`)
    if (!categoryEl) return
    categoryEl.textContent = getGridCategoryDisplayName(this.circuitType, positionOrLabel)
    this.fitLabelToContainer(categoryEl)
  }

  /** 텍스트가 컨테이너를 넘으면 font-size를 줄여 전체 텍스트가 한 줄로 보이게 자동 조절 */
  private fitLabelToContainer(el: HTMLElement) {
    const parent = el.parentElement
    if (!parent) return

    const maxFontSize = 48
    const minFontSize = 14
    el.style.fontSize = `${maxFontSize}px`

    requestAnimationFrame(() => {
      const containerWidth = parent.clientWidth
      let fontSize = maxFontSize
      while (el.scrollWidth > containerWidth && fontSize > minFontSize) {
        fontSize -= 2
        el.style.fontSize = `${fontSize}px`
      }
    })
  }

  private updateReadyScreenLabel(slot: number, position: string) {
    const prefix = sidePrefix(this.side)
    const slotId = `video-slot-${prefix}${slot}`
    const videoCell = document.getElementById(slotId)
    if (!videoCell) return
    const placeholder = videoCell.querySelector('.placeholder') as HTMLElement
    if (placeholder) {
      const positionLabel = placeholder.querySelector('div:first-child')
      if (positionLabel) positionLabel.textContent = position
    }
  }

  private resetPositionLabel(slot: number, defaultLabel: string) {
    const prefix = sidePrefix(this.side)
    const label = this.isIntroLayout ? getIntroSlotDefaultLabel(this.side, slot) : defaultLabel
    const overlayId = `position-overlay-${prefix}${slot}`
    const overlayElement = document.getElementById(overlayId)
    if (overlayElement) {
      overlayElement.textContent = label
      overlayElement.style.display = 'none'
    }
    this.updateReadyScreenLabel(slot, label)
  }

  private updateExerciseNameLabel(_slot: number, _exerciseName: string) { }

  private resetExerciseNameLabel(_slot: number) { }

  showArrowOverlay() { }

  hideArrowOverlay() { }

  updateRepsBadge(slot: number, sequence: any) {
    const prefix = sidePrefix(this.side)
    const badgeId = `reps-badge-${prefix}${slot}`
    const badge = document.getElementById(badgeId)
    if (!badge) return
    const reps = sequence.reps || 0
    if (reps > 0) {
      badge.innerHTML =
        `<div style="font-size: 30px; letter-spacing: 2px;">REPS</div>` +
        `<div style="font-size: 60px;">${reps}</div>`
      badge.style.display = 'block'
    } else {
      badge.style.display = 'none'
    }
  }

  /**
   * 슬롯 수·DOM이 바뀌기 전에 맵에 남은 모든 Vimeo 플레이어를 destroy (인트로 6슬롯 → 메인 3슬롯 등).
   */
  destroyAllRegisteredPlayers(): void {
    this.stopHeartbeat()
    for (const id of [...this.loopIntervals.keys()]) {
      const iv = this.loopIntervals.get(id)
      if (iv) clearInterval(iv)
      this.loopIntervals.delete(id)
    }
    for (const [, player] of [...this.players.entries()]) {
      try {
        player?.pause?.()
        player?.destroy?.()
      } catch {
        /* ignore */
      }
    }
    this.players.clear()
  }

  pauseAllVideos() {
    this.players.forEach((player, position) => {
      try {
        if (player) {
          player.pause().catch((error: any) => {
            console.error(`일시정지 실패 (${position}):`, error)
          })
        }
      } catch (error) {
        console.error(`일시정지 실패 (${position}):`, error)
      }
    })
  }

  resumeAllVideos() {
    this.triggerSequentialPlay()
  }

  private triggerSequentialPlay() {
    const players = Array.from(this.players.values())
    let i = 0
    const checkNext = () => {
      if (i >= players.length) return
      const player = players[i++]
      if (!player) { checkNext(); return }
      player.getPaused?.()
        .then((paused: boolean) => {
          if (!paused) return
          player.getEnded?.()
            .then((ended: boolean) => {
              if (ended) {
                player.setCurrentTime(0).then(() => player.play().catch(() => {})).catch(() => {})
              } else {
                player.play().catch(() => {})
              }
            })
            .catch(() => { player.play().catch(() => {}) })
        })
        .catch(() => { })
        .finally(() => setTimeout(checkNext, 300))
    }
    checkNext()
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatInterval = setInterval(() => {
      if (this.players.size === 0) return
      this.triggerSequentialPlay()
      snapshotPlayerStates(this.side, this.players).catch(() => {
        /* snapshot 실패는 운동 진행에 영향 없음 */
      })
    }, 5_000)
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  destroy() {
    this.stopHeartbeat()
    this.clearAllVideoCells()
  }

  playVideo(sequence: any, position: string, syncStartAtMs?: number, skipPlayIfSame?: boolean) {
    workoutGridPlayVideo(
      {
        side: this.side,
        players: this.players,
        loopIntervals: this.loopIntervals,
        preloadStore: this.preloadStore,
        mapPositionToSlot: (p) => this.mapPositionToSlot(p),
        attachVimeoPlayerHandlers: this.attachVimeoPlayerHandlers,
        updatePositionLabel: (slot, pos) => this.updatePositionLabel(slot, pos),
        updateExerciseNameLabel: (slot, name) => this.updateExerciseNameLabel(slot, name),
        updateRepsBadge: (slot, seq) => this.updateRepsBadge(slot, seq),
      },
      sequence,
      position,
      syncStartAtMs,
      skipPlayIfSame,
    )
  }

  clearVideoByPosition(position: string) {
    clearWorkoutGridVideoByPosition(
      {
        side: this.side,
        players: this.players,
        loopIntervals: this.loopIntervals,
        mapPositionToSlot: (p) => this.mapPositionToSlot(p),
        resetPositionLabel: (slot, def) => this.resetPositionLabel(slot, def),
        resetExerciseNameLabel: (slot) => this.resetExerciseNameLabel(slot),
      },
      position,
    )
  }

  showPauseOverlay() {
    const pauseOverlay = document.getElementById(`pause-overlay-${this.side}`)
    if (pauseOverlay) pauseOverlay.style.display = 'flex'
  }

  hidePauseOverlay() {
    const pauseOverlay = document.getElementById(`pause-overlay-${this.side}`)
    if (pauseOverlay) pauseOverlay.style.display = 'none'
  }

  setupVideoQueues(slotQueuesData: { [slotNum: number]: Array<{ sequence: any; position: string; label: string }> }) {
    this.stopHeartbeat()
    this.queueManager.setupVideoQueues(slotQueuesData)
  }

  advanceSlot(slotNum: number) {
    this.queueManager.advanceSlot(slotNum)
  }

  advanceAllSlots() {
    this.queueManager.advanceAllSlots()
  }

  getCurrentQueueEntry(slotNum: number): SlotVideoEntry | null {
    return this.queueManager.getCurrentQueueEntry(slotNum)
  }

  isQueueMode(): boolean {
    return this.queueManager.isQueueMode()
  }

  cleanupQueues() {
    const wasQueueMode = this.queueManager.isQueueMode()
    this.queueManager.cleanupQueues()
    if (wasQueueMode && !this.heartbeatInterval) {
      this.startHeartbeat()
    }
  }

  revealFirstEntries() {
    this.queueManager.revealFirstEntries()
  }

  seekByPhase(targetLabel: string) {
    this.queueManager.seekByPhase(targetLabel)
  }

  async focusIntroPosition(
    target: IntroFocusTarget,
    fallbackSequence?: any,
  ): Promise<boolean> {
    if (!this.isIntroLayout) return false

    const domPrefix = sidePrefix(this.side)
    const maxSlots =
      document.querySelectorAll(`[id^="video-slot-${domPrefix}"]`).length || 6

    const resolved = resolveIntroFocusForMonitor(target, this.side, {
      introLayout: true,
      maxSlots,
    })
    if (!resolved) return false

    const nextState = await focusIntroSlotInGrid(
      {
        side: this.side,
        players: this.players,
        loopIntervals: this.loopIntervals,
        attachVimeoPlayerHandlers: this.attachVimeoPlayerHandlers,
      },
      {
        positionCode: resolved.displayCode,
        internalPosition: resolved.internalPosition,
        slot: resolved.slot,
        fallbackSequence,
      },
      this.introFocusState,
    )

    if (!nextState) return false
    this.introFocusState = nextState
    return true
  }

  cancelIntroFocus(): void {
    cancelIntroFocusInGrid(
      {
        side: this.side,
        players: this.players,
        loopIntervals: this.loopIntervals,
        attachVimeoPlayerHandlers: this.attachVimeoPlayerHandlers,
      },
      this.introFocusState,
    )
    this.introFocusState = null
  }
}
