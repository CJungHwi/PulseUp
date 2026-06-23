import { BrowserWindow } from 'electron'
import type { WorkoutModule, WorkoutModuleContext } from './workout-modules'
import {
  AmrapModule,
  EmomModule,
  LoopModule,
  StressModule,
} from './workout-modules'
import {
  applyPreviewLoopPositionHint,
  buildPreviewMainFirstRoundOrdered,
  collectIntroPlaySequences,
  createWorkoutModuleForCircuitType,
  getIntroPreviewMaxMainPositions,
  normalizeCircuitTypeFromMetadata,
  resolveModuleCircuitType,
  primeIntroStartPreloadForCircuit,
  resolveIntroCircuitKind,
} from './workout-modules/circuit-registry'
import { getHalfRoundsCountFromSession } from './workout-modules/circuits/shared/half-rounds-meta'
import { PreloadManager } from './workout-modules/circuits/shared/preload-manager'
import { buildStressQueue } from './workout-modules/circuits/stress/stress-queue-builder'
import { buildEmomQueue } from './workout-modules/circuits/emom/emom-queue-builder'
import { buildLoopQueue } from './workout-modules/circuits/loop/loop-queue-builder'
import { buildAmrapQueue } from './workout-modules/circuits/amrap/amrap-queue-builder'
import type { QueueBuilderFn } from './workout-modules/circuits/shared/queue-builder-types'
import { parseIntroFocusCommandPayload } from '../common/intro-position-codes'
import {
  circuitNeedsHalfSwap,
  isLegacyMainGridFormat,
  migrateOldMainGridPosition,
  normalizeGridPosition,
  swapGridHalfPosition,
} from '../common/grid-position-codes'
import type {
  ExerciseSequence,
  WorkoutPlaySession,
  ActiveSet,
} from './types'
import { workoutInfoDevLog } from './workout-dev-log.js'
import { getScreenMode } from './screen-mode-store.js'
import { HeartRateCleanupTrigger } from './heart-rate-modules/heart-rate-cleanup-trigger.js'
import {
  fetchResolvedMonitorDisplay,
  type ResolvedMonitorDisplay
} from './monitor-display-resolver-client.js'
import { fileLogger } from './file-logger.js'

const log = workoutInfoDevLog

export interface WorkoutPlayServiceDeps {
  broadcastToAllWindows: (channel: string, data: any) => void
  fetchWithTimeout: (input: string, init: RequestInit, timeoutMs: number) => Promise<Response>
  buildAuthHeaders: () => Record<string, string>
  getWebAppUrl: () => string
  hasVideoUrl: (sequence: any) => boolean
  fetchExerciseVideoUrl: (exerciseId: string) => Promise<string | null>
  normalizeMajorCategory: (input: unknown) => string
  isStretchingCategory: (category: string) => boolean
  isCoolDownCategory: (category: string) => boolean
  isStretchingOrCoolDownRound: (round: number) => boolean
  getPlayableMainExercisesByRound: (round: number) => ExerciseSequence[]
  getNextMainRoundAfter: (round: number) => number | null
  getRoundMajorCategory: (round: number) => string
  /** 운동 정지/완료 직전 호출. 심박수 buffer를 서버로 즉시 보낸다(데이터 누락 방지). */
  flushHeartRateBuffer?: () => Promise<void>
}

export class WorkoutPlayService {
  activePlaySession: WorkoutPlaySession | null = null
  playTimer: NodeJS.Timeout | null = null
  _lastStressGroupIndex: number = -1
  _lastAmrapMainRoundNumber: number | null = null
  preloadedGroupKeys: Set<string> = new Set()
  /** 인트로 재생 중이면 true — 이 동안 play-start는 운동 대신 초기 화면 복귀만 수행 */
  introStartBlocksPlayStart = false
  /** 인트로가 실행된 적 있으면 true — 운동 시작 시 그리드 리셋 + 2초 대기 */
  private introWasPlayed = false
  private introStartPreloadManager = new PreloadManager()
  activeWorkoutModule: WorkoutModule | null = null

  _stretchingGroupIndex = 0

  private _timerCallback: (() => void) | null = null
  private _timerStartedAt = 0
  private _timerDurationMs = 0

  lastWorkoutPlay: {
    at: string; masterId?: string; userId?: string;
    sequenceCount?: number; ok?: boolean; error?: string
  } | null = null
  lastPlayStart: { at: string; ok: boolean; error?: string } | null = null

  private deps: WorkoutPlayServiceDeps

  private dsPreloadReadySides = new Set<string>()
  private dsPreloadResolve: (() => void) | null = null
  private dsPreloadPromise: Promise<void> | null = null

  /** 운동 단계 전환·water break 1회 진입 시점에 끊긴 심박 슬롯 정리 IPC를 트리거 */
  private heartRateCleanupTrigger: HeartRateCleanupTrigger

  /** start-workout-play 시 resolve된 모니터 표시 (API 재호출·401 방지) */
  private cachedInitDisplay: ResolvedMonitorDisplay | null = null
  private cachedIntroDisplay: ResolvedMonitorDisplay | null = null

  constructor(deps: WorkoutPlayServiceDeps) {
    this.deps = deps
    this.heartRateCleanupTrigger = new HeartRateCleanupTrigger({
      isStretchingCategory: (c) => this.deps.isStretchingCategory(c),
      isCoolDownCategory: (c) => this.deps.isCoolDownCategory(c),
      getRoundMajorCategory: (r) => this.deps.getRoundMajorCategory(r),
    })
  }

  /** 인트로/운동 시작 버튼 시점 — 세션별 로그 파일 분리 (로그 보내기용) */
  private beginPlaybackLogSession(kind: 'intro' | 'workout-start'): void {
    const session = this.activePlaySession
    if (!session?.masterId) return

    const rotated = fileLogger.beginWorkoutLogSession({
      masterId: session.masterId,
      userId: session.userId,
      kind,
    })
    if (rotated) {
      log(`📝 세션 로그 파일 생성 (${kind}): ${rotated.filename}`)
    }
  }

  private async resolveMonitorDisplay(
    context: 'default' | 'intro',
    exerciseId?: string
  ): Promise<ResolvedMonitorDisplay> {
    const session = this.activePlaySession
    return fetchResolvedMonitorDisplay({
      webAppUrl: this.deps.getWebAppUrl(),
      authHeaders: this.deps.buildAuthHeaders(),
      fetchWithTimeout: this.deps.fetchWithTimeout,
      masterId: session?.masterId,
      exerciseId,
      context
    })
  }

  private maybeBroadcastExerciseMonitorDisplay(_sequence: ExerciseSequence | null | undefined): void {
    const display = this.cachedInitDisplay
    if (display) {
      this.deps.broadcastToAllWindows('monitor-display-updated', { display, context: 'default' })
      return
    }
    void this.resolveMonitorDisplay('default').then((resolved) => {
      this.cachedInitDisplay = resolved
      this.deps.broadcastToAllWindows('monitor-display-updated', { display: resolved, context: 'default' })
    })
  }

  handleQueuePreloadReady(side: string) {
    this.dsPreloadReadySides.add(side)
    log(`📊 [DSPreload] ${side} ready (${this.dsPreloadReadySides.size}개 윈도우)`)
    if (this.dsPreloadReadySides.size >= 2 && this.dsPreloadResolve) {
      this.dsPreloadResolve()
      this.dsPreloadResolve = null
    }
  }

  private resetDsPreloadTracking() {
    this.dsPreloadReadySides.clear()
    this.dsPreloadPromise = new Promise<void>((resolve) => {
      this.dsPreloadResolve = resolve
    })
  }

  private async waitForDsPreload() {
    if (!this.dsPreloadPromise) return
    const MAX_WAIT_MS = 20000
    await Promise.race([
      this.dsPreloadPromise,
      new Promise<void>((resolve) => setTimeout(resolve, MAX_WAIT_MS)),
    ])
    log(`✅ [DSPreload] 대기 완료 (${this.dsPreloadReadySides.size}개 윈도우 ready)`)
  }

  /**
   * 웹 metadata만으로는 circuitType이 비거나 MAIN인 경우가 많음.
   * 렌더러(타이머 MM:SS)는 매 시퀀스마다 확실한 서킷 값이 필요하므로,
   * 실제로 돌고 있는 WorkoutModule 기준으로 주입한다.
   */
  private getCircuitTypeForBroadcast(): string {
    const m = this.activeWorkoutModule
    if (m instanceof EmomModule) return 'emom'
    if (m instanceof AmrapModule) return 'amrap'
    if (m instanceof LoopModule) return 'loop'
    if (m instanceof StressModule) return 'stress'
    const meta = this.activePlaySession?.metadata
    if (!meta) return 'stress'
    const wc = (meta.workoutCategory || '').toString().toUpperCase()
    let circuitType = String(meta.circuitType || 'stress').toLowerCase()
    if (wc === 'EMOM') circuitType = 'emom'
    else if (wc === 'AMRAP') circuitType = 'amrap'
    return circuitType
  }

  /** 타이머 MM:SS 디버깅: IPC에 실리는 circuitType 추적 (메인 프로세스 콘솔) */
  private logCircuitSequenceBroadcast(data: any, circuitType: string, metaBefore: unknown): void {
    const m = this.activeWorkoutModule
    log('[WorkoutPlay][circuit]', {
      injectedCircuitType: circuitType,
      metadataCircuitTypeBefore: metaBefore,
      activeModule: m?.constructor?.name ?? null,
      masterId: this.activePlaySession?.masterId,
      round: data?.round,
      sequenceIndex: data?.sequenceIndex,
      exerciseType: data?.sequence?.exercise_type,
      durationSec: Number(data?.duration ?? data?.sequence?.duration ?? 0) || undefined,
    })
  }

  private preserveEmomMethodMetadata(metadata?: Record<string, unknown> | null): void {
    if (!metadata) return

    const workoutCategory = String(metadata.workoutCategory || '').toUpperCase()
    if (workoutCategory !== 'EMOM') return

    const originalMethod = String(
      metadata.emomCircuitType ||
        metadata.method_type ||
        metadata.methodType ||
        metadata.circuit_type ||
        metadata.circuitType ||
        '',
    ).trim().toLowerCase()

    if (originalMethod !== 'stress' && originalMethod !== 'loop') return

    metadata.emomCircuitType = originalMethod
    if (!metadata.method_type) metadata.method_type = originalMethod
  }

  buildModuleContext(): WorkoutModuleContext {
    const self = this
    return {
      activePlaySession: this.activePlaySession,
      playTimer: this.playTimer,
      get _lastStressGroupIndex() { return self._lastStressGroupIndex },
      get _lastAmrapMainRoundNumber() { return self._lastAmrapMainRoundNumber },
      get stretchingGroupIndex() { return self._stretchingGroupIndex },
      preloadedGroupKeys: this.preloadedGroupKeys,
      broadcastToAllWindows: (channel: string, data: any) => {
        if (channel === 'workout-play-sequence' && data && this.activePlaySession) {
          const metaBefore = data.metadata?.circuitType
          const circuitType = this.getCircuitTypeForBroadcast()
          const mergedMeta = { ...(data.metadata || {}), circuitType }
          data = { ...data, circuitType, metadata: mergedMeta }
          this.logCircuitSequenceBroadcast(data, circuitType, metaBefore)

          // 운동 단계 전환·water break 진입 시 끊긴 심박 슬롯 일괄 정리 신호 발행
          const cleanupReason = this.heartRateCleanupTrigger.evaluate(data?.sequence, data?.round)
          if (cleanupReason) {
            log(`🧹 끊긴 심박 슬롯 정리 신호 발행: ${cleanupReason}`)
            this.deps.broadcastToAllWindows('heart-rate-cleanup-disconnected', { reason: cleanupReason })
          }

          this.maybeBroadcastExerciseMonitorDisplay(data?.sequence)
        }
        this.deps.broadcastToAllWindows(channel, data)

        // 일시정지 상태에서 다음/이전 등으로 새 시퀀스가 broadcast되면
        // 렌더러가 새 카운트다운을 시작하므로 즉시 다시 paused를 보내 정지시킨다.
        if (channel === 'workout-play-sequence' && this.activePlaySession?.status === 'paused') {
          this.deps.broadcastToAllWindows('workout-play-paused', { session: this.activePlaySession })
        }
      },
      setPlayTimer: (timer: NodeJS.Timeout | null) => { this.playTimer = timer },
      schedulePlayTimer: (callback: () => void, durationMs: number) => {
        this.schedulePlayTimer(callback, durationMs)
      },
      setLastStressGroupIndex: (index: number) => { self._lastStressGroupIndex = index },
      setLastAmrapMainRoundNumber: (round: number | null) => {
        self._lastAmrapMainRoundNumber = round
      },
      setStretchingGroupIndex: (index: number) => { self._stretchingGroupIndex = index },
      isStretchingOrCoolDownRound: (round: number) => this.deps.isStretchingOrCoolDownRound(round),
      getPlayableMainExercisesByRound: (round: number) => this.deps.getPlayableMainExercisesByRound(round),
      getNextMainRoundAfter: (round: number) => this.deps.getNextMainRoundAfter(round),
      getRoundMajorCategory: (round: number) => this.deps.getRoundMajorCategory(round),
    }
  }

  createWorkoutModule(): WorkoutModule {
    if (!this.activePlaySession?.metadata) {
      return createWorkoutModuleForCircuitType('stress')
    }
    const metadata = this.activePlaySession.metadata as Record<string, unknown>
    this.preserveEmomMethodMetadata(metadata)
    const workoutCategory = String(metadata.workoutCategory || '').toUpperCase()
    const originalMethod = String(metadata.emomCircuitType || '').trim().toLowerCase()
    const circuitType = normalizeCircuitTypeFromMetadata(this.activePlaySession.metadata)
    if (
      workoutCategory === 'EMOM' &&
      (originalMethod === 'stress' || originalMethod === 'loop')
    ) {
      metadata.emomCircuitType = originalMethod
      if (!metadata.method_type) metadata.method_type = originalMethod
    }
    // 화면 표시/큐 빌더용 circuitType은 'emom'으로 유지하고,
    // 모듈 선택만 EMOM-Stress 여부에 따라 'emom-stress'로 분기한다.
    this.activePlaySession.metadata.circuitType = circuitType
    const moduleCircuitType = resolveModuleCircuitType(
      this.activePlaySession.metadata,
      this.activePlaySession.sequences,
    )
    log(`🧭 [WorkoutPlay] 모듈 선택: ${moduleCircuitType} (표시 circuitType=${circuitType})`)
    return createWorkoutModuleForCircuitType(moduleCircuitType)
  }

  async handleWorkoutPlay(data: any): Promise<{ success: boolean; sessionId?: string; message?: string; error?: string }> {
    try {
      this.lastWorkoutPlay = {
        at: new Date().toISOString(),
        masterId: data?.masterId ? String(data.masterId) : undefined,
        userId: data?.userId !== null && typeof data?.userId !== 'undefined' ? String(data.userId) : undefined,
        sequenceCount: Array.isArray(data?.sequences) ? data.sequences.length : undefined
      }

      log('🏋️ 운동 데이터 로드 (대기 상태):', {
        masterId: data.masterId,
        userId: data.userId,
        sequenceCount: data.sequences.length
      })

      if (this.activePlaySession) {
        this.stopPlaySession()
      }
      this.cachedInitDisplay = null
      this.cachedIntroDisplay = null

      const sourceSequences = Array.isArray(data.sequences) ? data.sequences : []
      const mainPositions = sourceSequences
        .filter((seq: any) => {
          const r = Number(seq?.round)
          return Number.isFinite(r) && r > 0 && r < 99 && seq?.exercise_type === 'exercise'
        })
        .map((seq: any) => (typeof seq?.position === 'string' ? seq.position : undefined))
      const usesLegacyMainGrid = isLegacyMainGridFormat(mainPositions)
      // 모든 서킷은 3분할 전반 A/B·후반 C/D 배치를 사용한다.
      // 과거 AMRAP/EMOM 전용 B↔C 스왑 훅은 공통 함수에서 no-op으로 유지된다.
      const layoutCircuitType = normalizeCircuitTypeFromMetadata(data?.metadata)
      const shouldHalfSwap = circuitNeedsHalfSwap(layoutCircuitType) && getScreenMode() !== 'five'

      const normalizedSequences = sourceSequences.length > 0
        ? sourceSequences.map((seq: any, idx: number) => {
          const rawRound = seq?.round
          const roundNum = Number(rawRound)
          const majorCategoryRaw = String(seq?.major_category || seq?.majorCategory || seq?.workoutCategory || '').trim().toLowerCase()

          let normalizedRound = Number.isFinite(roundNum) ? roundNum : null
          if (normalizedRound === null) {
            const roundStr = String(rawRound || '').trim().toUpperCase()
            if (roundStr === 'DS') normalizedRound = 0
            else if (roundStr === 'CD') normalizedRound = 99
          }
          if (normalizedRound === null) {
            if (this.deps.isStretchingCategory(majorCategoryRaw)) normalizedRound = 0
            else if (this.deps.isCoolDownCategory(majorCategoryRaw)) normalizedRound = 99
          }
          if (normalizedRound === null) normalizedRound = 1

          const isMainExercise =
            normalizedRound > 0 &&
            normalizedRound < 99 &&
            seq?.exercise_type === 'exercise'
          const basePosition = isMainExercise
            ? usesLegacyMainGrid
              ? migrateOldMainGridPosition(seq?.position)
              : normalizeGridPosition(seq?.position)
            : seq?.position
          const normalizedPosition = isMainExercise && shouldHalfSwap
            ? swapGridHalfPosition(basePosition)
            : basePosition
          const reps = Number(
            seq?.reps ??
              seq?.rep_count ??
              seq?.reps_count ??
              seq?.repeat_count ??
              seq?.repetitions ??
              0,
          )

          return {
            ...seq,
            round: normalizedRound,
            position: normalizedPosition,
            reps: Number.isFinite(reps) && reps > 0 ? reps : seq?.reps,
            __srcIndex: idx,
          }
        })
        : []

      const sortedSequences = [...normalizedSequences].sort((a: any, b: any) => {
        const ar = Number(a?.round ?? 0)
        const br = Number(b?.round ?? 0)
        const groupA = ar === 0 ? 0 : ar >= 99 ? 2 : 1
        const groupB = br === 0 ? 0 : br >= 99 ? 2 : 1
        if (groupA !== groupB) return groupA - groupB
        const as = Number(a?.sequence ?? 0)
        const bs = Number(b?.sequence ?? 0)
        if (as !== bs) return as - bs
        return Number(a?.__srcIndex ?? 0) - Number(b?.__srcIndex ?? 0)
      })

      const firstRound = sortedSequences.length > 0 ? Number(sortedSequences[0]?.round ?? 0) : 1

      const finalSequences: any[] = []
      let lastRound = -1
      if (sortedSequences.length > 0) {
        lastRound = Number(sortedSequences[0].round)
        finalSequences.push(sortedSequences[0])
      }

      for (let i = 1; i < sortedSequences.length; i++) {
        const seq = sortedSequences[i]
        const currentRound = Number(seq.round)

        // 첫 메인이 round 1이 아닐 수 있음(레거시/패널 round). DS(0) → 메인(1~98) 전환 전부 카운트다운·슬롯 advance에 포함.
        const isDsToMain = lastRound === 0 && currentRound >= 1 && currentRound < 99
        const isMainToCd = currentRound === 99 && lastRound !== 99

        if (isDsToMain || isMainToCd) {
          log(`🎬 페이즈 전환 감지: Round ${lastRound} -> ${currentRound} (카운트다운 삽입)`)

          const nextPhaseSequences = sortedSequences.slice(i)
          const previewSequences = this.getInitialPreviewSequences(nextPhaseSequences)

          let isNextStretching = this.deps.isStretchingOrCoolDownRound(currentRound)
          if (!isNextStretching && previewSequences.length > 0) {
            const cat = this.deps.normalizeMajorCategory(previewSequences[0].major_category || '')
            if (this.deps.isStretchingCategory(cat) || this.deps.isCoolDownCategory(cat)) {
              isNextStretching = true
            }
          }

          let legacyPositionGroups: { [key: string]: any[] } | null = null
          if (isNextStretching) {
            legacyPositionGroups = {
              A1: [] as any[], A2: [] as any[], A3: [] as any[],
            }
            previewSequences.slice(0, 3).forEach((item, idx) => {
              const pos = `A${idx + 1}`
              legacyPositionGroups![pos].push(item)
            })
          }

          log(`✨ [DEBUG] 카운트다운 시퀀스 생성 및 삽입: Round ${currentRound} 직전`)
          finalSequences.push({
            id: `countdown-${Date.now()}-${i}`,
            workout_history_master_id: seq.workout_history_master_id,
            sequence: 0,
            round: currentRound,
            exercise_type: 'countdown',
            exercise_name: '준비',
            duration: 5,
            preview_sequences: previewSequences,
            is_stretching_preview: isNextStretching,
            position_groups: legacyPositionGroups
          })
        }

        finalSequences.push(seq)
        lastRound = currentRound
      }

      log('🎬 [DEBUG] 운동 시작 순서 확인:', {
        firstRound,
        totalSequences: finalSequences.length,
        roundDistribution: finalSequences.reduce((acc: { [key: number]: number }, seq: any) => {
          const r = Number(seq?.round ?? 0)
          acc[r] = (acc[r] || 0) + 1
          return acc
        }, {}),
        first5Sequences: finalSequences.slice(0, 5).map((s: any) => ({
          round: s.round,
          exercise_name: s.exercise_name,
          position: s.position
        }))
      })

      this._lastStressGroupIndex = -1
      this._lastAmrapMainRoundNumber = null
      this.preloadedGroupKeys.clear()
      this.introStartBlocksPlayStart = false
      this.introWasPlayed = false
      this.activePlaySession = {
        masterId: data.masterId,
        userId: data.userId,
        sequences: finalSequences,
        currentSequenceIndex: 0,
        currentRound: firstRound,
        totalRounds: data.metadata?.totalRounds || 1,
        startTime: new Date(),
        elapsedTime: 0,
        status: 'ready',
        metadata: data.metadata
      }
      this.preserveEmomMethodMetadata(this.activePlaySession.metadata as Record<string, unknown>)

      const pickDisplay = (raw: unknown): ResolvedMonitorDisplay | null => {
        if (!raw || typeof raw !== 'object') return null
        const d = raw as Record<string, unknown>
        return {
          leftImageUrl: String(d.leftImageUrl ?? ''),
          centerImageUrl: String(d.centerImageUrl ?? ''),
          rightImageUrl: String(d.rightImageUrl ?? ''),
          displayText: String(d.displayText ?? '')
        }
      }

      const preInit = pickDisplay(data.initDisplay)
      const preIntro = pickDisplay(data.introDisplay)

      const initDisplay = preInit ?? await this.resolveMonitorDisplay('default')
      const introDisplay = preIntro ?? await this.resolveMonitorDisplay('intro')

      this.cachedInitDisplay = initDisplay
      this.cachedIntroDisplay = introDisplay

      log('[handleWorkoutPlay] monitor display:', {
        masterId: data.masterId,
        initLeft: initDisplay.leftImageUrl || '(empty)',
        introLeft: introDisplay.leftImageUrl || '(empty)',
        displayText: initDisplay.displayText || '(empty)',
        source: preInit ? 'relay-payload' : 'api-resolve'
      })

      this.deps.broadcastToAllWindows('workout-play-ready', {
        session: this.activePlaySession,
        sequences: finalSequences.map((s: any) => {
          if (s && typeof s === 'object' && '__srcIndex' in s) {
            const { __srcIndex, ...rest } = s
            return rest
          }
          return s
        }),
        metadata: data.metadata,
        initDisplay,
        introDisplay
      })

      this.resetDsPreloadTracking()
      this.broadcastVideoQueues()

      return {
        success: true,
        sessionId: this.activePlaySession.masterId,
        message: '운동이 대기 상태로 준비되었습니다. 운동 시작 버튼을 눌러주세요.'
      }
    } catch (error) {
      console.error('❌ 운동 플레이 준비 실패:', error)
      this.lastWorkoutPlay = {
        at: new Date().toISOString(),
        masterId: data?.masterId ? String(data.masterId) : undefined,
        userId: data?.userId !== null && typeof data?.userId !== 'undefined' ? String(data.userId) : undefined,
        sequenceCount: Array.isArray(data?.sequences) ? data.sequences.length : undefined,
        ok: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      }
    }
  }

  async handlePlayStart(): Promise<{
    success: boolean
    error?: string
    introCancelled?: boolean
    message?: string
  }> {
    try {
      if (!this.activePlaySession) {
        throw new Error('활성 운동 플레이 세션을 찾을 수 없습니다')
      }

      if (this.activePlaySession.status !== 'ready') {
        throw new Error('운동이 대기 상태가 아닙니다')
      }

      this.beginPlaybackLogSession('workout-start')

      const introCircuit = resolveIntroCircuitKind(this.activePlaySession.metadata)
      let shouldPrimeIntroStartPreload = false
      const hadIntro = this.introStartBlocksPlayStart || this.introWasPlayed

      /** 인트로 후 그리드/슬롯 정리. 오프스크린 preload(WorkoutGridPreloadStore)는 유지. */
      const notifyGridTransitionKeepPreloadCache = () => {
        this.preloadedGroupKeys.clear()
        this.deps.broadcastToAllWindows('workout-play-clear-preload', { preservePreloadCache: true })
      }

      if (this.introStartBlocksPlayStart) {
        // 인트로 재생 중 운동 시작 — 인트로 취소 → 스플래시 → 2초 대기 → 카운트다운
        this.introStartBlocksPlayStart = false
        shouldPrimeIntroStartPreload = true
        notifyGridTransitionKeepPreloadCache()
        this.deps.broadcastToAllWindows('intro-cancelled-reset-to-ready', { showSplash: true, preservePreloadCache: true })
        this.introWasPlayed = false
        log('🎬 인트로 중 운동 시작 — 스플래시 후 2초 뒤 카운트다운')
        await new Promise((resolve) => setTimeout(resolve, 2000))
      } else if (this.introWasPlayed) {
        // 인트로 종료 후 운동 시작 — 스플래시 → 2초 대기
        this.introWasPlayed = false
        shouldPrimeIntroStartPreload = true
        notifyGridTransitionKeepPreloadCache()
        this.deps.broadcastToAllWindows('intro-cancelled-reset-to-ready', { showSplash: true, preservePreloadCache: true })
        log('🎬 인트로 후 운동 시작 — 스플래시 후 2초 대기')
        await new Promise((resolve) => setTimeout(resolve, 2000))
      } else {
        this.preloadedGroupKeys.clear()
        this.resetDsPreloadTracking()
        this.deps.broadcastToAllWindows('workout-play-clear-preload', {})
        this.broadcastVideoQueues()
        log('🎬 직접 시작 — 큐/프리뷰 재설정 후 DS 프리로드 대기')
      }

      if (hadIntro) {
        this.resetDsPreloadTracking()
        this.broadcastWorkoutPlayPreview()
        this.broadcastVideoQueues()
        this.primeIntroStartMainPreload(introCircuit)
      }

      log('🎬 DS 영상 프리로드 대기 중...')
      await this.waitForDsPreload()

      this.deps.broadcastToAllWindows('countdown-started', { phase: 'session-start' })

      this.playTimer = setTimeout(() => {
        this.playTimer = null
        if (!this.activePlaySession) return

        this.activePlaySession.status = 'playing'
        this.activePlaySession.startTime = new Date()

        this.deps.broadcastToAllWindows('workout-play-started', {
          session: this.activePlaySession
        })

        this.startSequenceExecution()

        log('▶ 운동 시작 (카운트다운 후)')
      }, 6000)

      log('🎬 6초 카운트다운과 동시에 운동영상 즉시 출력')

      this.lastPlayStart = { at: new Date().toISOString(), ok: true }
      return { success: true }
    } catch (error) {
      this.lastPlayStart = { at: new Date().toISOString(), ok: false, error: error instanceof Error ? error.message : '알 수 없는 오류' }
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' }
    }
  }

  /** 렌더러: 인트로 영상 재생이 끝난 뒤 호출 — 이후 운동 시작은 정상 진행 */
  handleIntroPlaybackEnded(): { success: boolean } {
    this.introStartBlocksPlayStart = false
    return { success: true }
  }

  /** 리모컨 「인트로 취소」 — 인트로 UI 종료 후 준비(프리뷰) 화면으로 복귀 */
  handleCancelIntro(): { success: boolean; error?: string } {
    if (!this.isIntroSelectViewAllowed()) {
      return { success: false, error: '취소할 인트로가 없습니다.' }
    }

    this.introStartBlocksPlayStart = false
    this.introWasPlayed = false

    this.preloadedGroupKeys.clear()
    this.deps.broadcastToAllWindows('workout-play-clear-preload', {})
    this.deps.broadcastToAllWindows('intro-cancelled-reset-to-ready', {
      showSplash: false,
      preservePreloadCache: false,
    })
    this.broadcastWorkoutPlayPreview()

    log('🎬 인트로 취소 — 준비 화면으로 복귀')
    return { success: true }
  }

  async handlePlayIntro(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.activePlaySession) {
        throw new Error('활성 운동 세션이 없습니다. 웹에서 운동을 먼저 선택해주세요.')
      }

      const allExercises = this.activePlaySession.sequences.filter(s =>
        s.exercise_type === 'exercise' &&
        s.exercise_name !== '임시운동' &&
        s.duration > 0
      )

      if (allExercises.length === 0) {
        throw new Error('재생 가능한 운동이 없습니다.')
      }

      this.beginPlaybackLogSession('intro')

      const rounds = Array.from(new Set(allExercises.map(s => Number(s.round)))).sort((a, b) => a - b)
      const mainRound = rounds.find(r => !this.deps.isStretchingOrCoolDownRound(r)) ?? rounds[0]

      const introCircuit = resolveIntroCircuitKind(this.activePlaySession.metadata)
      let mainSequences = collectIntroPlaySequences(introCircuit, {
        allExercises,
        rounds,
        mainRound,
        isStretchingOrCoolDownRound: (r) => this.deps.isStretchingOrCoolDownRound(r),
        halfRoundsCount: getHalfRoundsCountFromSession(this.activePlaySession),
      })

      if (mainSequences.length === 0) {
        throw new Error('인트로에 표시할 메인 포지션(A/B) 운동이 없습니다.')
      }

      const idsToFetch = Array.from(
        new Set(
          mainSequences
            .filter((seq) => !this.deps.hasVideoUrl(seq) && seq.exercise_id)
            .map((seq) => String(seq.exercise_id))
        )
      )

      if (idsToFetch.length > 0) {
        const resolved = await Promise.all(
          idsToFetch.map(async (exerciseId) => ({
            exerciseId,
            videoUrl: await this.deps.fetchExerciseVideoUrl(exerciseId)
          }))
        )
        const idToVideo = new Map(
          resolved
            .filter((item) => item.videoUrl)
            .map((item) => [item.exerciseId, item.videoUrl as string])
        )
        mainSequences = mainSequences.map((seq) => {
          if (this.deps.hasVideoUrl(seq)) return seq
          const key = seq.exercise_id ? String(seq.exercise_id) : ''
          const videoUrl = key ? idToVideo.get(key) : null
          if (!videoUrl) return seq
          return { ...seq, video_url: videoUrl }
        })
      }

      let introDisplay = this.cachedIntroDisplay ?? await this.resolveMonitorDisplay('intro')
      if (!this.cachedIntroDisplay) {
        this.cachedIntroDisplay = introDisplay
      }
      log('[handlePlayIntro] intro display:', {
        left: introDisplay.leftImageUrl || '(empty)',
        source: this.cachedIntroDisplay ? 'cache-or-resolve' : 'api-resolve'
      })

      this.deps.broadcastToAllWindows('intro-started', {
        sequences: mainSequences,
        syncStartAtMs: Date.now(),
        metadata: this.activePlaySession.metadata,
        leftImageUrl: introDisplay.leftImageUrl,
        rightImageUrl: introDisplay.rightImageUrl,
        centerImageUrl: introDisplay.centerImageUrl,
        displayText: introDisplay.displayText,
        introDisplay
      })
      this.introStartBlocksPlayStart = true
      this.introWasPlayed = true
      return { success: true }
    } catch (error) {
      console.error('인트로 시작 실패:', error)
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' }
    }
  }

  /** 인트로 UI(선택보기) — 운동 시작 전까지 유지 (영상 1회 재생 종료와 무관) */
  private isIntroSelectViewAllowed(): boolean {
    if (!this.activePlaySession) return false
    if (this.activePlaySession.status !== 'ready') return false
    return this.introStartBlocksPlayStart || this.introWasPlayed
  }

  private findIntroSequenceForPosition(position: string): ExerciseSequence | null {
    if (!this.activePlaySession) return null
    const normalized = normalizeGridPosition(position)
    const candidates = this.activePlaySession.sequences.filter(
      (s) =>
        s.exercise_type === 'exercise' &&
        s.exercise_name !== '임시운동' &&
        s.duration > 0,
    )
    return (
      candidates.find((s) => normalizeGridPosition(String(s.position || '')) === normalized) ?? null
    )
  }

  handleIntroFocus(data: { zone?: string; number?: number; positionCode?: string }): {
    success: boolean
    error?: string
    positionCode?: string
  } {
    if (!this.isIntroSelectViewAllowed()) {
      return { success: false, error: '인트로 재생 중에만 선택보기를 사용할 수 있습니다.' }
    }

    const target = parseIntroFocusCommandPayload(data)
    if (!target) {
      return { success: false, error: '유효하지 않은 선택입니다. A/B/C/D와 1~3을 선택해주세요.' }
    }

    const sequence = this.findIntroSequenceForPosition(target.internalPosition)
    if (!sequence) {
      return { success: false, error: `선택한 ${target.positionCode} 영상을 찾을 수 없습니다.` }
    }

    this.deps.broadcastToAllWindows('intro-focus', { target, sequence })
    return { success: true, positionCode: target.positionCode }
  }

  handleIntroFocusCancel(): { success: boolean; error?: string } {
    if (!this.isIntroSelectViewAllowed()) {
      return { success: false, error: '인트로 재생 중에만 선택보기를 사용할 수 있습니다.' }
    }

    this.deps.broadcastToAllWindows('intro-focus-cancel', {})
    return { success: true }
  }

  broadcastWorkoutPlayPreview() {
    if (!this.activePlaySession) return

    const sequences = this.getInitialPreviewSequences(this.activePlaySession.sequences)
    const syncStartAtMs = Date.now()

    const firstRound = sequences.length > 0 ? Number(sequences[0].round ?? 0) : 0
    let isStretching = this.deps.isStretchingOrCoolDownRound(firstRound)

    if (!isStretching && sequences.length > 0) {
      const cat = this.deps.normalizeMajorCategory(sequences[0].major_category || (sequences[0] as any).majorCategory || (sequences[0] as any).workoutCategory || '')
      if (this.deps.isStretchingCategory(cat) || this.deps.isCoolDownCategory(cat)) {
        isStretching = true
      }
    }

    if (isStretching) {
      log('🎬 프리뷰: 스트레칭 모드 감지 (미러링 적용)')

      // 첫 라운드의 스트레칭 운동 전체를 가져온다 (프리뷰에서 6슬롯 모두 로드)
      const allStretching = (this.activePlaySession.sequences || []).filter(
        s => Number(s.round) === firstRound &&
          s.exercise_type === 'exercise' &&
          s.exercise_name !== '임시운동' &&
          s.duration > 0
      )
      const seen = new Set<string>()
      const uniqueExercises: any[] = []
      for (const s of allStretching) {
        const id = String(s.exercise_id || s.exercise_name)
        if (seen.has(id)) continue
        seen.add(id)
        uniqueExercises.push(s)
      }

      const dsPrefix = firstRound === 0 ? 'DS' : firstRound === 99 ? 'CD' : 'DS'
      const allPositionGroups: { [key: string]: any[] } = {}
      uniqueExercises.forEach((item, idx) => {
        const posItem = { ...item, position: `${dsPrefix}${idx + 1}` }
        const gridPos = `A${idx + 1}`
        if (!allPositionGroups[gridPos]) allPositionGroups[gridPos] = []
        allPositionGroups[gridPos].push(posItem)
      })

      this.deps.broadcastToAllWindows('workout-play-preview', {
        sequences: uniqueExercises,
        positionGroups: allPositionGroups,
        stretchingMode: true,
        stretchingSlotCount: uniqueExercises.length,
        syncStartAtMs,
        metadata: this.activePlaySession.metadata
      })
    } else {
      this.deps.broadcastToAllWindows('workout-play-preview', {
        sequences,
        syncStartAtMs,
        metadata: this.activePlaySession.metadata
      })
    }
  }

  getInitialPreviewSequences(seqs: any[]): any[] {
    const previewCircuit = resolveIntroCircuitKind(this.activePlaySession?.metadata)
    const isLoopCircuit = previewCircuit === 'loop'
    const exercises = (seqs || []).filter((s: any) => {
      const isStretching = this.deps.isStretchingOrCoolDownRound(s.round)
      return (
        s &&
        s.exercise_type === 'exercise' &&
        s.duration > 0 &&
        s.exercise_name !== '임시운동' &&
        (isStretching || isLoopCircuit || (typeof s.position === 'string' && s.position.length > 0))
      )
    })

    if (exercises.length === 0) return []

    const minRound = exercises.reduce((min: number, s: any) => Math.min(min, Number(s.round ?? 0)), Number.POSITIVE_INFINITY)
    const firstRoundExercises = exercises.filter((s: any) => Number(s.round ?? 0) === minRound)

    const isStretchingRound = this.deps.isStretchingOrCoolDownRound(minRound)
    const firstRoundOrdered = buildPreviewMainFirstRoundOrdered(
      previewCircuit,
      exercises,
      minRound,
      isStretchingRound,
      firstRoundExercises,
      (r) => this.deps.isStretchingOrCoolDownRound(r),
      getHalfRoundsCountFromSession(this.activePlaySession),
    )

    const maxMainPreviewPositions = getIntroPreviewMaxMainPositions(previewCircuit, isStretchingRound)
    const selected: any[] = []
    const seen = new Set<string>()

    for (let i = 0; i < firstRoundOrdered.length; i++) {
      const s = firstRoundOrdered[i]
      if (isStretchingRound) {
        const id = String(s.exercise_id || s.exercise_name)
        if (seen.has(id)) continue
        seen.add(id)
        selected.push(s)
        if (selected.length >= 3) break
      } else {
        applyPreviewLoopPositionHint(previewCircuit, s, selected.length)
        let pos = String(s.position || '')

        if (!pos) continue
        if (seen.has(pos)) continue
        seen.add(pos)
        selected.push(s)
        if (selected.length >= maxMainPreviewPositions) break
      }
    }

    return selected
  }

  private primeIntroStartMainPreload(circuit: ReturnType<typeof resolveIntroCircuitKind>) {
    if (!this.activePlaySession) return

    const firstMainRound = this.activePlaySession.sequences.find(
      (seq) =>
        Number(seq.round) > 0 &&
        Number(seq.round) < 99 &&
        seq.exercise_type === 'exercise' &&
        seq.exercise_name !== '임시운동' &&
        seq.duration > 0,
    )?.round

    if (typeof firstMainRound !== 'number') return

    try {
      primeIntroStartPreloadForCircuit(
        circuit,
        this.buildModuleContext(),
        this.introStartPreloadManager,
        firstMainRound,
      )
      log(`🎬 [IntroStart] ${circuit} 첫 메인 그룹 preload 보강 (round=${firstMainRound})`)
    } catch (error) {
      console.warn('[IntroStart] 첫 메인 그룹 preload 보강 실패:', error)
    }
  }

  /**
   * 서킷별 큐 빌더를 통해 슬롯별 영상 큐를 구성하여 renderer에 전송.
   * 각 서킷의 큐 빌더는 circuits/{circuit}/{circuit}-queue-builder.ts 에 정의되어 있다.
   *
   * - 3-screen 모드: 좌·우 큐를 합친 mergedQueues 단일 broadcast (기존 동작 유지)
   * - 5-screen 모드: 좌1·좌2·우1·우2 패널별 4번 broadcast (payload.panel 로 구분)
   *   각 렌더러는 자신의 side(left/left-2/right/right-2)에 매핑된 panel 만 사용한다.
   */
  broadcastVideoQueues() {
    if (!this.activePlaySession) return

    const circuitType = normalizeCircuitTypeFromMetadata(this.activePlaySession.metadata ?? {})
    const screenMode = getScreenMode()
    const builder = this.getQueueBuilder(circuitType)
    const { leftQueues, rightQueues, leftQueues2, rightQueues2 } = builder(
      this.activePlaySession.sequences,
      this.activePlaySession.metadata,
      screenMode,
    )

    if (screenMode === 'five') {
      const panelPayloads: Array<{ panel: 'L1' | 'L2' | 'R1' | 'R2'; queues: any }> = [
        { panel: 'L1', queues: leftQueues },
        { panel: 'L2', queues: leftQueues2 || leftQueues },
        { panel: 'R1', queues: rightQueues },
        { panel: 'R2', queues: rightQueues2 || rightQueues },
      ]

      log('🎬 [VideoQueue] 5-screen 패널별 큐 구성 완료:', {
        circuit: circuitType,
        panels: panelPayloads.map((p) => ({
          panel: p.panel,
          slot1: p.queues[1].map((e: any) => `${e.label}(${e.position})`),
          slot2: p.queues[2].map((e: any) => `${e.label}(${e.position})`),
          slot3: p.queues[3].map((e: any) => `${e.label}(${e.position})`),
        })),
      })

      for (const { panel, queues } of panelPayloads) {
        this.deps.broadcastToAllWindows('workout-setup-queue', {
          panel,
          slotQueues: queues,
          metadata: this.activePlaySession.metadata,
        })
      }
      return
    }

    const mergedQueues: { [slotNum: number]: Array<{ sequence: any; position: string; label: string }> } = {
      1: [...leftQueues[1], ...rightQueues[1]],
      2: [...leftQueues[2], ...rightQueues[2]],
      3: [...leftQueues[3], ...rightQueues[3]],
    }

    log('🎬 [VideoQueue] 슬롯별 큐 구성 완료:', {
      circuit: circuitType,
      slot1: mergedQueues[1].map(e => `${e.label}(${e.position})`),
      slot2: mergedQueues[2].map(e => `${e.label}(${e.position})`),
      slot3: mergedQueues[3].map(e => `${e.label}(${e.position})`),
    })

    this.deps.broadcastToAllWindows('workout-setup-queue', {
      slotQueues: mergedQueues,
      metadata: this.activePlaySession.metadata,
    })
  }

  private getQueueBuilder(circuitType: string): QueueBuilderFn {
    switch (circuitType) {
      case 'stress': return buildStressQueue
      case 'emom': return buildEmomQueue
      case 'loop': return buildLoopQueue
      case 'amrap': return buildAmrapQueue
      default: return buildStressQueue
    }
  }

  schedulePlayTimer(callback: () => void, durationMs: number) {
    if (this.playTimer) clearTimeout(this.playTimer)
    this._timerCallback = callback
    this._timerStartedAt = Date.now()
    this._timerDurationMs = durationMs
    // 일시정지 상태에서 모듈이 다음 시퀀스를 setTimeout 등 비동기로 호출하는 경우,
    // 자동 진행 타이머는 시작하지 않고 콜백/남은시간만 저장 (resume 시 재스케줄)
    if (this.activePlaySession?.status === 'paused') {
      this.playTimer = null
      return
    }
    this.playTimer = setTimeout(callback, durationMs)
  }

  pausePlayTimer() {
    if (this.playTimer) {
      clearTimeout(this.playTimer)
      this.playTimer = null
    }
    const elapsed = Date.now() - this._timerStartedAt
    this._timerDurationMs = Math.max(0, this._timerDurationMs - elapsed)
    log(`⏸ 타이머 일시정지: 남은시간 ${this._timerDurationMs}ms`)
  }

  resumePlayTimer() {
    if (!this._timerCallback) {
      log('⚠️ resumePlayTimer: 저장된 콜백 없음 — continueSequenceExecution fallback')
      this.continueSequenceExecution()
      return
    }
    if (this._timerDurationMs <= 0) {
      log('▶ resumePlayTimer: 남은 시간 0 — 콜백 즉시 실행')
      const cb = this._timerCallback
      this._timerCallback = null
      cb()
      return
    }
    log(`▶ resumePlayTimer: ${this._timerDurationMs}ms 후 콜백 재스케줄`)
    this._timerStartedAt = Date.now()
    this.playTimer = setTimeout(this._timerCallback, this._timerDurationMs)
  }

  startSequenceExecution() {
    if (!this.activePlaySession) return

    const circuitType = this.activePlaySession.metadata?.circuitType || 'stress'
    const workoutCategory = this.activePlaySession.metadata?.workoutCategory || ''

    log(`🎯 영상 재생 방식: ${circuitType}, 카테고리: ${workoutCategory}`)
    log(`🎬 [DEBUG] 시작 시퀀스:`, {
      currentIndex: this.activePlaySession.currentSequenceIndex,
      totalSequences: this.activePlaySession.sequences.length,
      firstSequence: this.activePlaySession.sequences[0],
      firstRound: this.activePlaySession.sequences[0]?.round
    })

    this.activeWorkoutModule = this.createWorkoutModule()
    const ctx = this.buildModuleContext()
    this.activeWorkoutModule.execute(ctx, () => {
      this.stopPlaySession()
    })
  }

  continueSequenceExecution() {
    if (!this.activePlaySession) return

    if (this.activeWorkoutModule) {
      this.activeWorkoutModule.stop()
    }

    const circuitType = this.activePlaySession.metadata?.circuitType || 'stress'
    const workoutCategory = this.activePlaySession.metadata?.workoutCategory || ''

    log('🔄 운동 재개:', { circuitType, workoutCategory, currentIndex: this.activePlaySession.currentSequenceIndex })

    this.activeWorkoutModule = this.createWorkoutModule()
    const ctx = this.buildModuleContext()
    this.activeWorkoutModule.execute(ctx, () => {
      this.stopPlaySession()
    })
  }

  stopPlaySession() {
    if (this.activeWorkoutModule) {
      this.activeWorkoutModule.stop()
      this.activeWorkoutModule = null
    }

    if (this.playTimer) {
      clearTimeout(this.playTimer)
      this.playTimer = null
    }
    this._timerCallback = null
    this._timerDurationMs = 0

    this.preloadedGroupKeys.clear()
    this._lastStressGroupIndex = -1
    this._lastAmrapMainRoundNumber = null
    this._stretchingGroupIndex = 0
    this.introStartBlocksPlayStart = false
    this.introWasPlayed = false
    this.heartRateCleanupTrigger.reset()

    // 운동 종료 직전: 누적된 심박수 buffer를 즉시 서버로 flush (10개 미만 누락 방지)
    // flushBuffer 내부에서 splice로 데이터 소유권을 이전하므로 fire-and-forget로도 안전.
    if (this.deps.flushHeartRateBuffer) {
      void this.deps.flushHeartRateBuffer().catch((err) => {
        console.error('운동 종료 시 심박 buffer flush 실패:', err)
      })
    }

    this.deps.broadcastToAllWindows('workout-play-stopped', {
      message: '운동이 종료되었습니다.'
    })

    if (this.activePlaySession) {
      this.activePlaySession.status = 'ready'
      this.activePlaySession.currentSequenceIndex = 0
      this.activePlaySession.currentRound = 1
      this.activePlaySession.elapsedTime = 0
      this.activePlaySession.startTime = new Date()

      this.deps.broadcastToAllWindows('workout-play-ready', {
        session: this.activePlaySession
      })
    }

    log('🛑 플레이 세션 초기화됨 (다시 시작 가능)')
  }
}
