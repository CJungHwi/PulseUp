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
import type {
  ExerciseSequence,
  WorkoutPlaySession,
  ActiveSet,
} from './types'
import { workoutInfoDevLog } from './workout-dev-log.js'
import { getScreenMode } from './screen-mode-store.js'
import { HeartRateCleanupTrigger } from './heart-rate-modules/heart-rate-cleanup-trigger.js'

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

  constructor(deps: WorkoutPlayServiceDeps) {
    this.deps = deps
    this.heartRateCleanupTrigger = new HeartRateCleanupTrigger({
      isStretchingCategory: (c) => this.deps.isStretchingCategory(c),
      isCoolDownCategory: (c) => this.deps.isCoolDownCategory(c),
      getRoundMajorCategory: (r) => this.deps.getRoundMajorCategory(r),
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
    const circuitType = normalizeCircuitTypeFromMetadata(this.activePlaySession.metadata)
    this.activePlaySession.metadata.circuitType = circuitType
    return createWorkoutModuleForCircuitType(circuitType)
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

      const normalizedSequences = Array.isArray(data.sequences)
        ? data.sequences.map((seq: any, idx: number) => {
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

          return { ...seq, round: normalizedRound, __srcIndex: idx }
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
              L1: [] as any[], L2: [] as any[], L3: [] as any[],
              R1: [] as any[], R2: [] as any[], R3: [] as any[]
            }
            previewSequences.slice(0, 3).forEach((item, idx) => {
              const slotIndex = idx % 3
              const leftPos = `L${slotIndex + 1}`
              const rightPos = `R${slotIndex + 1}`
              legacyPositionGroups![leftPos].push(item)
              legacyPositionGroups![rightPos].push(item)
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

      this.deps.broadcastToAllWindows('workout-play-ready', {
        session: this.activePlaySession,
        sequences: finalSequences.map((s: any) => {
          if (s && typeof s === 'object' && '__srcIndex' in s) {
            const { __srcIndex, ...rest } = s
            return rest
          }
          return s
        }),
        metadata: data.metadata
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
        throw new Error('인트로에 표시할 메인 포지션(L/R) 운동이 없습니다.')
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

      let introLeftImageUrl = ''
      let introRightImageUrl = ''
      const authHeaders = this.deps.buildAuthHeaders()
      const webAppUrl = this.deps.getWebAppUrl()

      log('[handlePlayIntro] 이미지 조회 시작', {
        webAppUrl,
        authHeaderKeys: Object.keys(authHeaders)
      })

      try {
        const imgUrl = `${webAppUrl}/api/workout-categories/workout-setting-images`
        const imgResponse = await this.deps.fetchWithTimeout(
          imgUrl,
          { method: 'GET', headers: { 'Content-Type': 'application/json', ...authHeaders } },
          4000
        )
        log('[handlePlayIntro] 사용자 이미지 응답:', imgResponse.status)
        if (imgResponse.ok) {
          const imgResult = await imgResponse.json().catch(() => null)
          introLeftImageUrl = imgResult?.data?.leftImageUrl || ''
          introRightImageUrl = imgResult?.data?.rightImageUrl || ''
          log('[handlePlayIntro] 사용자 이미지 URL:', { left: introLeftImageUrl, right: introRightImageUrl })
        }
      } catch (err) {
        console.error('[handlePlayIntro] 사용자 이미지 조회 실패:', err)
      }

      if (!introLeftImageUrl || !introRightImageUrl) {
        log('[handlePlayIntro] 시스템 기본 이미지 fallback 시도')
        try {
          const sysResponse = await this.deps.fetchWithTimeout(
            `${webAppUrl}/api/workout-categories/system-default-images/public`,
            { method: 'GET', headers: { 'Content-Type': 'application/json', ...authHeaders } },
            4000
          )
          log('[handlePlayIntro] 시스템 이미지 응답:', sysResponse.status)
          if (sysResponse.ok) {
            const sysResult = await sysResponse.json().catch(() => null)
            if (!introLeftImageUrl) introLeftImageUrl = sysResult?.data?.leftImageUrl || ''
            if (!introRightImageUrl) introRightImageUrl = sysResult?.data?.rightImageUrl || ''
            log('[handlePlayIntro] 시스템 이미지 URL:', { left: introLeftImageUrl, right: introRightImageUrl })
          }
        } catch (err) {
          console.error('[handlePlayIntro] 시스템 이미지 조회 실패:', err)
        }
      }
      log('[handlePlayIntro] 최종 이미지 URL:', { left: introLeftImageUrl, right: introRightImageUrl })

      this.deps.broadcastToAllWindows('intro-started', {
        sequences: mainSequences,
        syncStartAtMs: Date.now(),
        metadata: this.activePlaySession.metadata,
        leftImageUrl: introLeftImageUrl,
        rightImageUrl: introRightImageUrl
      })
      this.introStartBlocksPlayStart = true
      this.introWasPlayed = true
      return { success: true }
    } catch (error) {
      console.error('인트로 시작 실패:', error)
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' }
    }
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
        const slotIndex = idx + 1
        const leftPos = `L${slotIndex}`
        const rightPos = `R${slotIndex}`
        if (!allPositionGroups[leftPos]) allPositionGroups[leftPos] = []
        if (!allPositionGroups[rightPos]) allPositionGroups[rightPos] = []
        allPositionGroups[leftPos].push(posItem)
        allPositionGroups[rightPos].push(posItem)
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
