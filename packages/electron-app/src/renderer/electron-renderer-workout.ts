import type { RendererContext } from './workout-renderers/index.js'
import { log } from './workout-renderers/index.js'
import { removeOverlayElementById, showEndCounterImageOverlay } from './renderer-overlays.js'
import { speakWorkout } from './renderer-speech.js'
import { showCountdownModal as mountCountdownModal } from './renderer-countdown-modal.js'
import { ElectronRendererBase } from './electron-renderer-base.js'
import { displayTypeToFivePanel, isLeftMonitorDisplay } from './renderer-display-types.js'
import { resolveMainPhaseSeekLabel } from './five-screen-seek-label.js'
import { scheduleIntroSequencesForMonitor } from './circuits/intro-workout-grid-schedule.js'
import { schedulePreviewMainSequences } from './circuits/workout-preview-sequence-schedule.js'
import { resolveWorkoutCircuitType } from './components/workout-timer-circuit.js'
import type { WorkoutPlayTimerUI } from './components/WorkoutPlayTimerUI.js'

export abstract class ElectronRendererWorkout extends ElectronRendererBase {
  private usesFiveScreenPanelQueue = false

  protected clearIntroEndNotifyTimer() {
    if (this.introEndNotifyTimer) {
      clearTimeout(this.introEndNotifyTimer)
      this.introEndNotifyTimer = null
    }
  }

  /**
   * 메인 `handlePlayStart` 직전에만 브로드캐스트됨.
   * 인트로를 거친 뒤 `introPlaybackActive`가 이미 false인 경우에도 그리드/플레이어·세트 상태가 남지 않도록
   * **항상** 좌/우 모니터를 직접 운동 시작과 같은 초기 상태로 맞춘다.
   */
  protected handleWorkoutPlayClearPreloadFromMain(data?: { preservePreloadCache?: boolean }): void {
    const wasIntro = this.introPlaybackActive
    const preservePreloadCache = !!(data && data.preservePreloadCache)
    this.introPlaybackActive = false
    this.clearIntroEndNotifyTimer()
    this.hasCountdownPreview = false
    this.currentActiveSet = 'set2'
    this.usesFiveScreenPanelQueue = false

    if (this.isWorkoutGridDisplay(this.currentDisplay)) {
      if (this.workoutGridDisplay) {
        // 인트로 L1~L6 등으로 늘어난 슬롯·맵이 3슬롯 전환 후에도 남지 않도록 전부 destroy
        this.workoutGridDisplay.destroyAllRegisteredPlayers()
        if (!preservePreloadCache) {
          this.workoutGridDisplay.clearPreloadCache()
        }
        this.workoutGridDisplay.clearAllVideoCells()
        this.workoutGridDisplay.render(false)
      }
    }

    if (wasIntro && this.workoutPlayTimerUI) {
      this.workoutPlayTimerUI.hideIntroMode()
    }
  }

  protected scheduleIntroPlaybackEndedNotify(data: any) {
    const seqList = Array.isArray(data?.sequences) ? data.sequences : []
    let maxEndMs = 0
    seqList.forEach((seq: any, index: number) => {
      const delay = index * 50
      const durSec = Number(seq?.duration) || 0
      const end = delay + durSec * 1000 + 800
      if (end > maxEndMs) maxEndMs = end
    })
    const waitMs = maxEndMs > 0 ? Math.min(maxEndMs, 600_000) : 120_000
    this.introEndNotifyTimer = setTimeout(() => {
      this.introEndNotifyTimer = null
      void window.electronAPI.notifyIntroPlaybackEnded?.().catch(() => {})
    }, waitMs)
  }

  private async runTimerIntroStarted(ui: WorkoutPlayTimerUI, data: any) {
    await ui.prepareTimerIntroDom()
    ui.showIntroMode(data?.metadata)
  }

  /**
   * 인트로 중/직후 취소 시 메인에서 보냄 — 그리드·타이머 인트로 정리.
   * `showSplash`: EMOM 등에서 운동 직전 프로그램 초기(스플래시) 화면으로 잠시 복귀.
   */
  protected handleIntroCancelledResetToReady(data?: { showSplash?: boolean; preservePreloadCache?: boolean }) {
    this.clearIntroEndNotifyTimer()
    this.introPlaybackActive = false
    if (this.workoutPlayTimerUI) {
      this.workoutPlayTimerUI.hideIntroMode()
    }
    if (this.workoutGridDisplay) {
      if (!data?.preservePreloadCache) {
        this.workoutGridDisplay.clearPreloadCache()
      }
      this.workoutGridDisplay.clearAllVideoCells()
      this.workoutGridDisplay.render(false)
    }
    if (data?.showSplash) {
      this.showSplashScreen()
    }
  }

  protected handleIntroStarted(data: any) {
    this.clearIntroEndNotifyTimer()
    this.introPlaybackActive = true
    this.scheduleIntroPlaybackEndedNotify(data)
    if (this.currentDisplay === 'timer') {
      if (this.workoutPlayTimerUI) {
        log('🎬 타이머 화면 인트로 모드 노출 시도')
        void this.runTimerIntroStarted(this.workoutPlayTimerUI, data)
      }
      return
    }

    if (!this.isWorkoutGridDisplay(this.currentDisplay)) return
    if (!this.workoutGridDisplay) return

    const isLeftMonitor = isLeftMonitorDisplay(this.currentDisplay)
    const introImageUrl = String(
      isLeftMonitor ? data?.leftImageUrl ?? '' : data?.rightImageUrl ?? ''
    ).trim()

    log(`🎬 인트로 모드 그리드 렌더링 (${this.currentDisplay})`, {
      introImageUrl: introImageUrl || '(없음)'
    })
    // clearCache=false: ready·이전 단계에서 쌓인 오프스크린 preload 를 인트로·운동시작까지 유지
    this.workoutGridDisplay.render(true, introImageUrl || undefined, 0, false)
    scheduleIntroSequencesForMonitor(this.workoutGridDisplay, data, isLeftMonitor)
  }

  protected handleWorkoutPlayPreview(data: any) {
    if (!this.isWorkoutGridDisplay(this.currentDisplay)) return
    if (!this.workoutGridDisplay) return

    if (this.workoutGridDisplay.isQueueMode()) {
      log('🎬 [Preview] 큐 모드 - 프리뷰 스킵')
      return
    }

    const sequences = Array.isArray(data?.sequences) ? data.sequences : []
    if (sequences.length === 0) return
    this.hasCountdownPreview = true

    const isLeftMonitor = isLeftMonitorDisplay(this.currentDisplay)
    const syncStartAtMs = Number(data?.syncStartAtMs) || Date.now()

    // 스트레칭/CD 모드인 경우 별도 처리 (미러링 지원)
    if (data.stretchingMode && data.positionGroups) {
      log('🎬 [Preview] 스트레칭 모드 감지 (미러링 적용)', {
        isLeftMonitor,
        slots: Object.keys(data.positionGroups)
      })
      // Main(3슬롯) -> CD/DS(6슬롯) 전환: 기존 영상 정리
      if (!this.workoutGridDisplay.isStretchingLayout()) {
        this.workoutGridDisplay.clearAllVideoCells()
      }
      this.handleStretchingMode(data.positionGroups, isLeftMonitor, syncStartAtMs, undefined, data.stretchingSlotCount)
      return
    }

    // DS(6슬롯) -> Main(3슬롯) 전환: 기존 영상 정리 후 3슬롯 렌더
    if (this.workoutGridDisplay.isStretchingLayout()) {
      log('🔄 [Preview] 스트레칭->메인 전환: 3슬롯 그리드로 리셋')
      this.workoutGridDisplay.clearAllVideoCells()
      this.workoutGridDisplay.render(false)
    }

    schedulePreviewMainSequences(
      {
        grid: this.workoutGridDisplay,
        isLeftMonitor,
        syncStartAtMs,
        getMainTargetSetFromPosition: (p) => this.getMainTargetSetFromPosition(p),
        getCurrentActiveSet: () => this.currentActiveSet,
        setCurrentActiveSet: (s) => {
          this.currentActiveSet = s
        },
        isPositionForLeftMonitor: (p) => this.isPositionForLeftMonitor(p),
      },
      sequences,
    )
  }

  protected handleWorkoutPlayPreload(data: any) {
    if (!this.isWorkoutGridDisplay(this.currentDisplay)) return
    if (!this.workoutGridDisplay) return
    if (this.introPlaybackActive) {
      log('🚀 [Preload] 인트로 구간 — 스킵')
      return
    }
    if (this.workoutGridDisplay.isQueueMode()) {
      log('🚀 [Preload] 큐 모드 — PreloadStore 스킵')
      return
    }
    const sequences = Array.isArray(data?.sequences) ? data.sequences : []
    if (sequences.length === 0) return

    const isLeftMonitor = isLeftMonitorDisplay(this.currentDisplay)

    sequences.forEach((seq: any, index: number) => {
      const position = typeof seq?.position === 'string' ? seq.position : ''
      const positionsToPreload: string[] = []

      if (data.stretchingMode && data.positionGroups) {
        Object.entries(data.positionGroups).forEach(([pos, group]: [string, any]) => {
          if (Array.isArray(group) && group.some((s: any) => s.exercise_id === seq.exercise_id)) {
            positionsToPreload.push(pos)
          }
        })
      } else {
        positionsToPreload.push(seq.position || 'L1')
      }

      positionsToPreload.forEach(position => {
        if (this.isPositionForLeftMonitor(position) !== isLeftMonitor) {
          return
        }

        if (this.workoutGridDisplay) {
          log(`🚀 [Preload] ${position}: ${seq.exercise_name}`)
          this.workoutGridDisplay.preloadVideo(seq, position)
        }
      })
    })
  }

  protected handleWorkoutPlayStarted(data: any) {
    log(`📺 ${this.currentDisplay} 디스플레이: 운동 플레이 시작 (hasCountdownPreview=${this.hasCountdownPreview}, queueMode=${this.workoutGridDisplay?.isQueueMode()}, stretchingLayout=${this.workoutGridDisplay?.isStretchingLayout()})`)

    if (this.isWorkoutGridDisplay(this.currentDisplay)) {
      if (this.workoutGridDisplay) {
        if (this.workoutGridDisplay.isQueueMode() || this.hasCountdownPreview) {
          log('📺 큐/프리뷰 모드: 영상 유지 (render/clear 스킵)')
          this.workoutGridDisplay.hideArrowOverlay()
          this.workoutGridDisplay.hidePauseOverlay()
        } else {
          this.workoutGridDisplay.render(false)
          this.workoutGridDisplay.clearAllVideoCells()
        }
      }
    } else if (this.currentDisplay === 'timer') {
      if (this.workoutPlayTimerUI) {
        this.workoutPlayTimerUI.hideIntroMode()
      }
    }
  }


  // 스트레칭 모드 처리: 모든 위치 동시 표시
  // 6슬롯 모드: DS1-6을 한번에 로드하고, 그룹 전환 시 보이는 슬롯만 토글
  protected handleStretchingMode(
    positionGroups: { [key: string]: any[] },
    isLeftMonitor: boolean,
    syncStartAtMs?: number,
    skipPlayIfSame?: boolean,
    stretchingSlotCount?: number
  ) {
    const posKeys = Object.keys(positionGroups)
    log('🎬 스트레칭 모드 시작:', { positions: posKeys, isLeftMonitor, stretchingSlotCount })

    if (stretchingSlotCount && stretchingSlotCount > 3 && this.workoutGridDisplay && !skipPlayIfSame) {
      log(`🎬 스트레칭 ${stretchingSlotCount}슬롯 모드로 render`)
      this.workoutGridDisplay.render(false, undefined, stretchingSlotCount)
    }

    const exercisesToPlay: Array<{ legacyPos: string, exercise: any, actualPosition: string }> = []

    posKeys.forEach((legacyPos) => {
      const exercises = positionGroups[legacyPos]
      if (!Array.isArray(exercises) || exercises.length === 0) return

      const firstExercise = exercises[0]

      const isForLeftMonitor = legacyPos.startsWith('L')
      if (isLeftMonitor !== isForLeftMonitor) return

      exercisesToPlay.push({ legacyPos, exercise: firstExercise, actualPosition: legacyPos })
    })

    log(`🎬 ${isLeftMonitor ? '좌측' : '우측'} 모니터: ${exercisesToPlay.length}개 영상 로드 예정`)

    exercisesToPlay.forEach((item) => {
      const displayPosition = item.exercise.position || item.legacyPos
      log(`🎬 ${item.legacyPos} -> ${displayPosition} 영상 표시:`, {
        exercise: item.exercise.exercise_name,
        video_url: item.exercise.video_url,
        duration: item.exercise.duration
      })

      if (this.workoutGridDisplay) this.workoutGridDisplay.playVideo(item.exercise, displayPosition, syncStartAtMs, skipPlayIfSame)
    })
  }

  // ── 슬롯별 영상 큐 핸들러 ──

  protected handleSetupVideoQueue(data: any) {
    if (!this.isWorkoutGridDisplay(this.currentDisplay)) return
    if (!this.workoutGridDisplay) return

    const slotQueues: { [slotNum: number]: Array<{ sequence: any; position: string; label: string }> } = data.slotQueues
    if (!slotQueues) return

    // 5-screen 모드: payload.panel 이 있고, 자기 화면 매핑과 일치하는 panel 만 처리
    const myPanel = displayTypeToFivePanel(this.currentDisplay)
    if (data.panel) {
      if (myPanel !== data.panel) {
        // 자기 panel 이 아니면 무시 (다른 패널에 보낸 메시지)
        return
      }
      // 5-mode: 큐는 이미 panel별로 분리되어 있음 → 그대로 사용
      log(`🎬 [Queue] ${this.currentDisplay} (panel=${data.panel}): 큐 설정`,
        Object.keys(slotQueues).map(k => `slot${k}: ${slotQueues[Number(k)].length}개`))
      this.workoutGridDisplay.setCircuitType(resolveWorkoutCircuitType(data))
      this.workoutGridDisplay.render(false)
      this.workoutGridDisplay.setupVideoQueues(slotQueues)
      this.hasCountdownPreview = true
      this.usesFiveScreenPanelQueue = true
      return
    }

    // 3-screen 모드 (기존): 좌우 합쳐진 mergedQueues 에서 자기 prefix 만 필터링
    const prefix = isLeftMonitorDisplay(this.currentDisplay) ? 'L' : 'R'
    const filteredQueues: { [slotNum: number]: Array<{ sequence: any; position: string; label: string }> } = {}

    for (const [slotNumStr, entries] of Object.entries(slotQueues)) {
      const slotNum = Number(slotNumStr)
      const filtered = entries.filter((e: any) => e.position.startsWith(prefix))
      if (filtered.length > 0) {
        filteredQueues[slotNum] = filtered
      }
    }

    log(`🎬 [Queue] ${this.currentDisplay}: 큐 설정`, Object.keys(filteredQueues).map(k => `slot${k}: ${filteredQueues[Number(k)].length}개`))

    this.workoutGridDisplay.setCircuitType(resolveWorkoutCircuitType(data))
    this.workoutGridDisplay.render(false)
    this.workoutGridDisplay.setupVideoQueues(filteredQueues)
    this.hasCountdownPreview = true
    this.usesFiveScreenPanelQueue = false
  }

  protected handleSeekQueue(data: { round: number; position: string }) {
    if (!this.isWorkoutGridDisplay(this.currentDisplay)) return
    if (!this.workoutGridDisplay) return
    if (!this.workoutGridDisplay.isQueueMode()) return

    const { round, position } = data

    let targetLabel: string | null = null

    if (round === 0) {
      targetLabel = position && /^DS\d+$/.test(position) ? position : 'DS1'
    } else if (round === 99) {
      targetLabel = position && /^CD\d+$/.test(position) ? position : 'CD1'
    } else if (position && /^[LR](\d+)$/i.test(position)) {
      targetLabel = resolveMainPhaseSeekLabel(this.currentDisplay, position)
    }

    if (targetLabel) {
      log(`🔍 [SeekQueue] round=${round}, position=${position} → label="${targetLabel}" (${this.currentDisplay})`)
      this.workoutGridDisplay.seekByPhase(targetLabel)
    }
  }

  protected handleAdvanceSlots(data: any) {
    if (!this.isWorkoutGridDisplay(this.currentDisplay)) return
    if (!this.workoutGridDisplay) return

    const slots: number[] = data.slots
    if (!slots || !Array.isArray(slots)) {
      this.workoutGridDisplay.advanceAllSlots()
    } else {
      slots.forEach((slotNum: number) => this.workoutGridDisplay!.advanceSlot(slotNum))
    }
  }

  // DS/CD: 숫자 1-3, 7-9, 13-15... -> 좌측 / 4-6, 10-12, 16-18... -> 우측
  // Main (L/R prefix): L -> 좌측 / R -> 우측
  protected isPositionForLeftMonitor(position: string): boolean {
    if (!position) return true

    const prefix = position.charAt(0).toUpperCase()

    if (prefix === 'L') return true
    if (prefix === 'R') return false

    const match = position.match(/(\d+)$/)
    if (match) {
      const num = parseInt(match[1], 10)
      const groupIndex = Math.floor((num - 1) / 3)
      return groupIndex % 2 === 0
    }

    return true
  }

  // Main(L/R) position 기반으로 세트(set1/set2) 결정
  // 예: L1~L3=set1, L4~L6=set2, L7~L9=set1, L10~L12=set2 ...
  protected getMainTargetSetFromPosition(position: string): 'set1' | 'set2' | null {
    if (!position) return null
    const prefix = position.charAt(0).toUpperCase()
    if (prefix !== 'L' && prefix !== 'R') return null

    const match = position.match(/(\d+)$/)
    if (!match) return null
    const num = Number.parseInt(match[1], 10)
    if (!Number.isFinite(num) || num <= 0) return null

    const groupIndex = Math.floor((num - 1) / 3)
    return groupIndex % 2 === 0 ? 'set1' : 'set2'
  }

  protected buildRendererContext(): RendererContext {
    return {
      currentDisplay: this.currentDisplay,
      workoutGridDisplay: this.workoutGridDisplay,
      workoutPlayTimerUI: this.workoutPlayTimerUI,
      currentRound: this.currentRound,
      currentActiveSet: this.currentActiveSet,
      hasCountdownPreview: this.hasCountdownPreview,
      setCurrentRound: (round: number) => { this.currentRound = round },
      setCurrentActiveSet: (set: 'set1' | 'set2') => { this.currentActiveSet = set },
      setHasCountdownPreview: (value: boolean) => { this.hasCountdownPreview = value },
      handleStretchingMode: (positionGroups, isLeftMonitor, syncStartAtMs, skipPlayIfSame, stretchingSlotCount) => {
        this.handleStretchingMode(positionGroups, isLeftMonitor, syncStartAtMs, skipPlayIfSame, stretchingSlotCount)
      },
      getMainTargetSetFromPosition: (position: string) => this.getMainTargetSetFromPosition(position)
    }
  }

  protected handleWorkoutPlaySequence(data: any) {
    const { sequence, round } = data
    log('[VideoFlow] workout-play-sequence 수신', {
      display: this.currentDisplay,
      round,
      sequenceIndex: data?.sequenceIndex,
      type: sequence?.exercise_type,
      position: data?.position,
      name: sequence?.exercise_name || sequence?.name_ko || '-',
      isVideoPreload: !!data?.isVideoPreload,
      stretchingMode: !!data?.stretchingMode,
      currentActiveSet: this.currentActiveSet,
    })

    if (data?.isVideoPreload) {
      this.handleWorkoutPlaySequencePreload(data)
      return
    }

    if (round !== undefined && round !== this.currentRound) {
      log(`🔄 Round 변경 감지: ${this.currentRound} -> ${round}`)
      this.currentRound = round
    }

    if (this.isWorkoutGridDisplay(this.currentDisplay) && this.workoutGridDisplay) {
      this.workoutGridDisplay.setCircuitType(resolveWorkoutCircuitType(data))

      // 스트레칭(6슬롯) -> 메인(3슬롯) 전환 시 그리드 리셋
      if (!data.stretchingMode && this.workoutGridDisplay.isStretchingLayout()) {
        log('🔄 스트레칭->메인 전환: 3슬롯 그리드로 리셋')
        this.workoutGridDisplay.render(false)
      }
    }

    const ctx = this.buildRendererContext()

    if (sequence.exercise_type === 'rest' || sequence.exercise_type === 'water') {
      const restRenderer = this.sequenceRenderers.find(r => r.canHandle(data))
      restRenderer?.handle(ctx, data)
      return
    }

    if (this.isWorkoutGridDisplay(this.currentDisplay)) {
      if (!this.workoutGridDisplay) return

      const useSequenceRenderers = !this.workoutGridDisplay.isQueueMode()

      if (useSequenceRenderers) {
        for (const renderer of this.sequenceRenderers) {
          if (renderer.canHandle(data)) {
            renderer.handle(ctx, data)
            break
          }
        }
      }
    }

    if (this.currentDisplay === 'timer' && !data.isVideoPreload) {
      if (this.workoutPlayTimerUI) {
        if (!sequence.video_url && sequence.exercise_type === 'exercise') {
          log('⚠️ 영상 URL 없음 - 타이머는 정상 업데이트')
        }
        this.workoutPlayTimerUI.updateDisplay(data)
      }
    }
  }

  private handleWorkoutPlaySequencePreload(data: any) {
    if (!this.isWorkoutGridDisplay(this.currentDisplay)) {
      log('[VideoFlow] preload 무시: 영상 디스플레이 아님', { display: this.currentDisplay })
      return
    }
    if (!this.workoutGridDisplay) {
      log('[VideoFlow] preload 무시: workoutGridDisplay 없음', { display: this.currentDisplay })
      return
    }
    if (this.usesFiveScreenPanelQueue && this.workoutGridDisplay.isQueueMode()) {
      log('[VideoFlow] preload 무시: 5-screen 큐 모드는 main 영상 선로드 불필요', {
        display: this.currentDisplay,
        round: data?.round,
        position: data?.position,
      })
      return
    }

    const sequence = data?.sequence
    const position = typeof data?.position === 'string' ? data.position : ''
    if (!sequence || !position || position === 'KEEP_VIDEO') {
      log('[VideoFlow] preload 무시: sequence/position 부적합', {
        display: this.currentDisplay,
        hasSequence: !!sequence,
        position,
      })
      return
    }

    const isLeftMonitor = isLeftMonitorDisplay(this.currentDisplay)
    if (this.isPositionForLeftMonitor(position) !== isLeftMonitor) {
      log('[VideoFlow] preload 무시: 반대쪽 모니터 position', {
        display: this.currentDisplay,
        position,
        isLeftMonitor,
      })
      return
    }

    log('[VideoFlow] SequencePreload 캐시 적재', {
      display: this.currentDisplay,
      round: data?.round,
      sequenceIndex: data?.sequenceIndex,
      position,
      name: sequence.exercise_name || sequence.name_ko || '-',
      currentActiveSet: this.currentActiveSet,
    })
    this.workoutGridDisplay.preloadVideo(sequence, position)
  }

  protected handleWorkoutPlayCompleted(data: any) {
    log(`✅ ${this.currentDisplay} 디스플레이: 운동 플레이 완료`)

    this.currentRound = 0
    this.usesFiveScreenPanelQueue = false

    if (this.currentDisplay === 'timer') {
      this.showEndModal()
    }

    if (this.isWorkoutGridDisplay(this.currentDisplay)) {
      if (this.workoutGridDisplay) {
        this.workoutGridDisplay.hideArrowOverlay()
        this.workoutGridDisplay.hidePauseOverlay()
        this.workoutGridDisplay.cleanupQueues()
        this.workoutGridDisplay.clearPreloadCache()
        this.workoutGridDisplay.clearAllVideoCells()
      }
      this.showSplashScreen()
    } else if (this.currentDisplay === 'timer') {
      setTimeout(() => {
        if (this.workoutPlayTimerUI) {
          this.workoutPlayTimerUI.destroy()
        }
      }, 2000)
    }
  }

  protected speak(text: string) {
    speakWorkout(text, this.currentDisplay)
  }

  protected showCountdownModal(data?: { phase?: 'session-start' | 'segment-transition' }) {
    mountCountdownModal({
      getDisplay: () => this.currentDisplay,
      setCountdownInterval: (v) => {
        this.countdownModalInterval = v
      },
      countdownPhase: data?.phase ?? 'segment-transition',
    })
  }

  protected showEndModal() {
    if (this.currentDisplay !== 'timer') {
      return
    }

    removeOverlayElementById('countdown-modal')
    removeOverlayElementById('end-modal')
    removeOverlayElementById('congrats-modal')
    removeOverlayElementById('end-fireworks-canvas')
    removeOverlayElementById('end-modal-style')
    removeOverlayElementById('congrats-modal-style')
    removeOverlayElementById('end-counter-image-modal')

    showEndCounterImageOverlay('assets/end-counter-image.png')
  }

  /** 카운트다운 모달 즉시 중단 (운동 종료 시 호출) */
  protected stopCountdownModal() {
    if (this.countdownModalInterval) {
      clearInterval(this.countdownModalInterval)
      this.countdownModalInterval = null
    }
    removeOverlayElementById('countdown-modal')
    removeOverlayElementById('countdown-modal-style')
  }
}
