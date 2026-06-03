import { ipcMain, BrowserWindow, app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { Agent } from 'undici'
import { HeartRateManager } from './heart-rate-modules'
import { WorkoutPlayService } from './workout-play-service'
import { PlaybackController } from './playback-controller'
import type { HeartRateAntDiagnostics, HeartRateDiagnosticsSnapshot, HeartRateReading } from './heart-rate-modules'
import type {
  PersistedElectronConfig,
  WorkoutSessionData,
  PlaylistSyncData,
  ExerciseSequence,
  WorkoutPlaySession,
  ActiveSet,
} from './types'

export type {
  WorkoutSessionData,
  PlaylistSyncData,
  ExerciseSequence,
  WorkoutPlaySession,
  ActiveSet,
  HeartRateReading,
} from './types'
export type { HeartRateReading as HeartRateReadingType } from './heart-rate-modules'

const DEBUG = false
const log = (...args: any[]) => {
  if (DEBUG) console.log(...args)
}

type HeartRateAntDiagnosticsProvider = () => HeartRateAntDiagnostics

export class IPCHandlers {
  private activeSession: WorkoutSessionData | null = null
  private heartRateManager!: HeartRateManager
  private webAppUrl: string
  private readonly webAppUrlLockedByEnv: boolean
  private authToken: string | null = null
  private displayLabel: string | null = null
  private insecureLocalHttpsDispatcher: Agent | null = null
  private exerciseVideoCache: Map<string, string> = new Map()
  private readonly configFilePath: string
  private heartRateAntDiagnosticsProvider: HeartRateAntDiagnosticsProvider | null = null

  private playService: WorkoutPlayService
  private playbackController: PlaybackController

  constructor(webAppUrl?: string) {
    const userDataDir = this.getWritableDataDir()
    this.configFilePath = path.join(userDataDir, 'linkhiit-electron-config.json')
    const heartRateQueueFilePath = path.join(userDataDir, 'linkhiit-heart-rate-queue.jsonl')

    const persisted = this.loadPersistedConfig()

    const envServerUrl = process.env.API_SERVER_URL
    this.webAppUrlLockedByEnv = !!(envServerUrl && String(envServerUrl).trim())
    const persistedUrl = persisted.webAppUrl || ''
    const isPersistedLoopback = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(persistedUrl)
    const prodFallback = app.isPackaged && !envServerUrl && (!persistedUrl || isPersistedLoopback)
      ? 'https://linkhiit.co.kr'
      : undefined
    const initialUrl = webAppUrl || envServerUrl || (prodFallback || persisted.webAppUrl) || 'http://localhost:3001'
    this.webAppUrl = this.normalizeBaseUrl(initialUrl)

    const envAuthToken = process.env.API_AUTH_TOKEN
    this.authToken = envAuthToken || persisted.authToken || null
    this.displayLabel = persisted.displayLabel || null

    this.heartRateManager = new HeartRateManager(heartRateQueueFilePath, {
      broadcastToAllWindows: (channel, data) => this.broadcastToAllWindows(channel, data),
      fetchWithTimeout: (input, init, timeoutMs) => this.fetchWithTimeout(input, init, timeoutMs),
      buildAuthHeaders: () => this.buildAuthHeaders(),
      getWebAppUrl: () => this.webAppUrl,
      getActivePlaySession: () => this.playService.activePlaySession,
      getActiveSession: () => this.activeSession
    })

    this.playService = new WorkoutPlayService({
      broadcastToAllWindows: (channel, data) => this.broadcastToAllWindows(channel, data),
      fetchWithTimeout: (input, init, timeoutMs) => this.fetchWithTimeout(input, init, timeoutMs),
      buildAuthHeaders: () => this.buildAuthHeaders(),
      getWebAppUrl: () => this.webAppUrl,
      hasVideoUrl: (seq) => this.hasVideoUrl(seq),
      fetchExerciseVideoUrl: (id) => this.fetchExerciseVideoUrl(id),
      normalizeMajorCategory: (input) => this.normalizeMajorCategory(input),
      isStretchingCategory: (cat) => this.isStretchingCategory(cat),
      isCoolDownCategory: (cat) => this.isCoolDownCategory(cat),
      isStretchingOrCoolDownRound: (round) => this.isStretchingOrCoolDownRound(round),
      getPlayableMainExercisesByRound: (round) => this.getPlayableMainExercisesByRound(round),
      getNextMainRoundAfter: (round) => this.getNextMainRoundAfter(round),
      getRoundMajorCategory: (round) => this.getRoundMajorCategory(round),
      flushHeartRateBuffer: () => this.heartRateManager.flushBuffer(),
    })

    this.playbackController = new PlaybackController(this.playService, {
      broadcastToAllWindows: (channel, data) => this.broadcastToAllWindows(channel, data),
    })

    this.persistConfig()
    this.setupHandlers()
  }

  // ── 카테고리/라운드 판별 유틸 ──

  private normalizeMajorCategory(input: unknown): string {
    const v = String(input || '').trim()
    if (!v) return ''
    return v.toLowerCase().replace(/\s+/g, '_')
  }

  private getRoundMajorCategory(round: number): string {
    const session = this.playService.activePlaySession
    if (!session) return ''
    const seq = session.sequences.find(s => Number(s.round) === round && s.exercise_type === 'exercise')
    if (!seq) return ''
    return this.normalizeMajorCategory(seq.major_category || '')
  }

  private isStretchingCategory(category: string): boolean {
    const cat = this.normalizeMajorCategory(category)
    return [
      'dynamic_stretching', 'ds', 'stretching',
      'dynamic stretching', '동적_스트레칭', '동적스트레칭'
    ].includes(cat)
  }

  private isCoolDownCategory(category: string): boolean {
    const cat = this.normalizeMajorCategory(category)
    return [
      'cool_down', 'cd', 'cooldown', 'cool down',
      '쿨다운', '정리_운동', '정리운동'
    ].includes(cat)
  }

  private isStretchingOrCoolDownRound(round: number): boolean {
    if (round === 0 || round === 99) return true
    const cat = this.getRoundMajorCategory(round)
    if (!cat) return false
    return this.isStretchingCategory(cat) || this.isCoolDownCategory(cat)
  }

  private getPlayableMainExercisesByRound(round: number): ExerciseSequence[] {
    const session = this.playService.activePlaySession
    if (!session) return []
    return session.sequences.filter(s =>
      Number(s.round) === round &&
      !this.isStretchingOrCoolDownRound(round) &&
      s.exercise_type === 'exercise' &&
      s.exercise_name !== '임시운동' &&
      s.duration > 0
    )
  }

  private getNextMainRoundAfter(round: number): number | null {
    const session = this.playService.activePlaySession
    if (!session) return null
    const rounds = Array.from(
      new Set(
        session.sequences
          .map(s => Number(s.round))
          .filter((r) => Number.isFinite(r) && !this.isStretchingOrCoolDownRound(r))
      )
    ).sort((a, b) => a - b)
    return rounds.find(r => r > round) ?? null
  }

  // ── 설정/HTTP 유틸 ──

  private getWritableDataDir(): string {
    try {
      const dir = app.getPath('userData')
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      return dir
    } catch {
      const fallback = path.join(os.homedir(), '.linkhiit')
      if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true })
      return fallback
    }
  }

  private normalizeBaseUrl(input: string): string {
    const url = String(input || '').trim()
    if (!url) return 'http://localhost:3001'
    return url.replace(/\/+$/, '')
  }

  private loadPersistedConfig(): PersistedElectronConfig {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const raw = fs.readFileSync(this.configFilePath, 'utf-8')
        const parsed = JSON.parse(raw)
        return {
          webAppUrl: parsed.webAppUrl || undefined,
          authToken: parsed.authToken || undefined,
          displayLabel: parsed.displayLabel || undefined
        }
      }
    } catch { }
    return {}
  }

  private persistConfig() {
    try {
      const cfg: PersistedElectronConfig = {
        webAppUrl: this.webAppUrl,
        authToken: this.authToken || undefined,
        displayLabel: this.displayLabel || undefined
      }
      fs.writeFileSync(this.configFilePath, JSON.stringify(cfg, null, 2), 'utf-8')
    } catch (err) {
      console.error('설정 저장 실패:', err)
    }
  }

  private buildAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}
    if (this.authToken) {
      // 웹은 Authorization: Bearer <jwt> 로 보내고, 그대로 authToken에 들어가면 Bearer 이중 접두사 → 401
      let token = this.authToken.trim()
      while (/^Bearer\s+/i.test(token)) {
        token = token.replace(/^Bearer\s+/i, '').trim()
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }
    return headers
  }

  private async fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const isLocalHttps = /^https:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(input)
      const fetchInit: any = { ...init, signal: controller.signal }
      if (isLocalHttps) {
        if (!this.insecureLocalHttpsDispatcher) {
          this.insecureLocalHttpsDispatcher = new Agent({
            connect: { rejectUnauthorized: false }
          })
        }
        fetchInit.dispatcher = this.insecureLocalHttpsDispatcher
      }
      const response = await fetch(input, fetchInit)
      return response
    } finally {
      clearTimeout(timer)
    }
  }

  private hasVideoUrl(sequence: any): boolean {
    if (!sequence) return false
    const url = sequence.video_url
    if (!url || typeof url !== 'string') return false
    const trimmed = url.trim()
    if (!trimmed) return false
    if (/^https?:\/\//i.test(trimmed)) return true
    if (/^\d+$/.test(trimmed) && trimmed.length >= 5) return true
    return false
  }

  private async fetchExerciseVideoUrl(exerciseId: string): Promise<string | null> {
    if (this.exerciseVideoCache.has(exerciseId)) {
      return this.exerciseVideoCache.get(exerciseId) || null
    }
    try {
      const response = await this.fetchWithTimeout(
        `${this.webAppUrl}/api/exercises/${exerciseId}/video-url`,
        { method: 'GET', headers: { 'Content-Type': 'application/json', ...this.buildAuthHeaders() } },
        5000
      )
      if (response.ok) {
        const data = await response.json() as any
        const videoUrl = data?.data?.video_url || data?.video_url || null
        if (videoUrl) {
          this.exerciseVideoCache.set(exerciseId, videoUrl)
        }
        return videoUrl
      }
    } catch (err) {
      console.error(`[fetchExerciseVideoUrl] 실패 (${exerciseId}):`, err)
    }
    return null
  }

  // ── 런타임 설정/상태 ──

  public applyRuntimeConfig(config: { webAppUrl?: string; authToken?: string | null; displayLabel?: string }) {
    if (config.webAppUrl && !this.webAppUrlLockedByEnv) {
      this.webAppUrl = this.normalizeBaseUrl(config.webAppUrl)
    }
    if (config.authToken !== undefined) {
      this.authToken = config.authToken || null
    }
    if (config.displayLabel !== undefined) {
      this.displayLabel = config.displayLabel || null
    }
    this.persistConfig()
  }

  public getRuntimeInfo() {
    return {
      webAppUrl: this.webAppUrl,
      webAppUrlLockedByEnv: this.webAppUrlLockedByEnv,
      authToken: this.authToken,
      displayLabel: this.displayLabel,
      hasActiveSession: !!this.activeSession,
      sessionId: this.activeSession?.id,
      heartRateCount: this.activeSession?.heartRateData.length || 0,
      hasActivePlaySession: !!this.playService.activePlaySession,
      playSession: this.playService.activePlaySession
        ? {
          masterId: this.playService.activePlaySession.masterId,
          status: this.playService.activePlaySession.status,
          currentSequenceIndex: this.playService.activePlaySession.currentSequenceIndex,
          totalSequences: this.playService.activePlaySession.sequences.length,
        }
        : null,
      lastWorkoutPlay: this.playService.lastWorkoutPlay,
      lastPlayStart: this.playService.lastPlayStart,
    }
  }

  public setHeartRateAntDiagnosticsProvider(provider: HeartRateAntDiagnosticsProvider | null): void {
    this.heartRateAntDiagnosticsProvider = provider
  }

  public getHeartRateDiagnostics(): HeartRateDiagnosticsSnapshot {
    const ant = this.heartRateAntDiagnosticsProvider
      ? this.heartRateAntDiagnosticsProvider()
      : {
          state: 'disabled' as const,
          ready: false,
          staleTimeoutMs: 30000,
          gracePeriodMs: 60000,
          lastError: 'ANT+ 기능이 비활성화되었거나 초기화되지 않았습니다.',
          slots: [],
        }
    const upload = this.heartRateManager.getUploadDiagnostics()
    const connectedSlots = ant.slots.filter((slot) => slot.state === 'connected').length
    const reconnectingSlots = ant.slots.filter((slot) => slot.reconnecting).length
    const hasUploadBacklog = upload.bufferCount > 0 || upload.queue.exists
    const hints: string[] = []

    if (ant.state === 'failed') {
      hints.push('ANT+ USB 동글 연결, USB 포트, WinUSB/Zadig 드라이버, Garmin Express 등 다른 ANT 프로그램 실행 여부를 확인하세요.')
    }
    if (connectedSlots === 0 && ant.ready) {
      hints.push('HW9 전원, 배터리, 착용 위치와 센서 밀착 상태를 확인하세요. Bluetooth 연결 여부와 ANT+ 수신 여부는 별개입니다.')
    }
    if (reconnectingSlots > 0) {
      hints.push('일부 슬롯은 최근 끊긴 심박계를 같은 슬롯으로 자동 재연결 대기 중입니다.')
    }
    if (hasUploadBacklog) {
      hints.push('심박 업로드 대기 데이터가 있습니다. 네트워크와 로그인 세션 상태를 확인하세요.')
    }

    return {
      generatedAt: new Date().toISOString(),
      ant,
      upload,
      summary: {
        connectedSlots,
        reconnectingSlots,
        hasUploadBacklog,
        primaryIssue: ant.lastError || (hints.length > 0 ? hints[0] : null),
        hints,
      },
    }
  }

  public async collectHeartRateFromANT(
    slotNumber: number,
    deviceId: number,
    deviceName: string,
    heartRate: number,
  ) {
    return this.heartRateManager.collectFromANT(slotNumber, deviceId, deviceName, heartRate)
  }

  // ── IPC 핸들러 등록 ──

  private setupHandlers() {
    ipcMain.handle('web-start-workout', async (_event, data: { playlistId: string, userId: string }) => {
      return this.handleWebStartWorkout(data)
    })

    ipcMain.handle('web-stop-workout', async (_event, data: { sessionId: string, caloriesBurned?: number }) => {
      return this.handleWebStopWorkout(data)
    })

    ipcMain.handle('sync-playlist', async (_event, playlistData: PlaylistSyncData) => {
      return this.handleSyncPlaylist(playlistData)
    })

    this.heartRateManager.registerIPCHandlers()

    ipcMain.handle('get-session-status', async () => {
      return {
        hasActiveSession: !!this.activeSession,
        session: this.activeSession,
        heartRateCount: this.activeSession?.heartRateData.length || 0
      }
    })

    ipcMain.handle('check-web-connection', async () => {
      try {
        const response = await this.fetchWithTimeout(
          `${this.webAppUrl}/api/health`,
          { method: 'GET', headers: { ...this.buildAuthHeaders() } },
          5000
        )
        return { connected: response.ok }
      } catch {
        return { connected: false }
      }
    })
  }

  // ── 브로드캐스트 ──

  private broadcastToAllWindows(channel: string, data: any) {
    const windows = BrowserWindow.getAllWindows()
    windows.forEach(window => {
      try {
        if (window && !window.isDestroyed() && window.webContents) {
          window.webContents.send(channel, data)
        }
      } catch (err) {
        console.error(`broadcastToAllWindows 오류 (${channel}):`, err)
      }
    })
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // ── 세션 API (웹 연동) ──

  setWebAppUrl(url: string) {
    this.webAppUrl = this.normalizeBaseUrl(url)
    this.persistConfig()
  }

  getActiveSession(): WorkoutSessionData | null {
    return this.activeSession
  }

  async handleWebStartWorkout(data: { playlistId: string, userId: string }) {
    try {
      log('웹에서 운동 시작 요청:', data)
      const playlistData = await this.fetchPlaylistFromWeb(data.playlistId)

      this.activeSession = {
        id: this.generateSessionId(),
        playlistId: data.playlistId,
        playlistName: playlistData.name,
        startTime: new Date(),
        duration: 0,
        heartRateData: [],
        status: 'active'
      }

      this.broadcastToAllWindows('workout-started', {
        session: this.activeSession,
        playlist: playlistData
      })

      return { success: true, sessionId: this.activeSession.id }
    } catch (error) {
      console.error('운동 시작 실패:', error)
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' }
    }
  }

  async handleWebStopWorkout(data: { sessionId: string, caloriesBurned?: number }) {
    try {
      if (!this.activeSession || this.activeSession.id !== data.sessionId) {
        throw new Error('활성 운동 세션을 찾을 수 없습니다')
      }

      this.activeSession.endTime = new Date()
      this.activeSession.duration = Math.floor(
        (this.activeSession.endTime.getTime() - this.activeSession.startTime.getTime()) / 1000
      )
      this.activeSession.caloriesBurned = data.caloriesBurned
      this.activeSession.status = 'completed'

      if (this.activeSession.heartRateData.length > 0) {
        const heartRates = this.activeSession.heartRateData.map(reading => reading.heartRate)
        this.activeSession.averageHeartRate = Math.round(
          heartRates.reduce((sum, hr) => sum + hr, 0) / heartRates.length
        )
        this.activeSession.maxHeartRate = Math.max(...heartRates)
      }

      const completedSession = { ...this.activeSession }

      this.broadcastToAllWindows('workout-stopped', { session: completedSession })
      await this.sendSessionDataToWeb(completedSession)

      this.activeSession = null
      // 종료 시 buffer에 남은 마지막 심박 데이터(10개 미만)를 먼저 서버로 보낸 뒤 비운다
      try {
        await this.heartRateManager.flushBuffer()
      } catch (flushErr) {
        console.error('운동 종료 시 심박 buffer flush 실패:', flushErr)
      }
      this.heartRateManager.clearBuffer()

      return { success: true, session: completedSession }
    } catch (error) {
      console.error('운동 종료 실패:', error)
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' }
    }
  }

  async handleSyncPlaylist(playlistData: PlaylistSyncData) {
    try {
      log('플레이리스트 동기화:', playlistData.name)
      this.broadcastToAllWindows('playlist-loaded', playlistData)
      return { success: true }
    } catch (error) {
      console.error('플레이리스트 동기화 실패:', error)
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' }
    }
  }

  async handlePauseWorkout(sessionId: string) {
    try {
      if (!this.activeSession || this.activeSession.id !== sessionId) {
        throw new Error('활성 운동 세션을 찾을 수 없습니다')
      }
      this.broadcastToAllWindows('workout-paused', { sessionId })
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' }
    }
  }

  async handleResumeWorkout(sessionId: string) {
    try {
      if (!this.activeSession || this.activeSession.id !== sessionId) {
        throw new Error('활성 운동 세션을 찾을 수 없습니다')
      }
      this.broadcastToAllWindows('workout-resumed', { sessionId })
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' }
    }
  }

  // ── 위임 (Delegation) — PlayService / PlaybackController ──

  async handleWorkoutPlay(data: any) {
    return this.playService.handleWorkoutPlay(data)
  }

  async handlePlayStart() {
    return this.playService.handlePlayStart()
  }

  handleQueuePreloadReady(side: string) {
    this.playService.handleQueuePreloadReady(side)
  }

  async handlePlayIntro() {
    return this.playService.handlePlayIntro()
  }

  handleIntroFocus(data: { zone?: string; number?: number; positionCode?: string }) {
    return this.playService.handleIntroFocus(data)
  }

  handleIntroFocusCancel() {
    return this.playService.handleIntroFocusCancel()
  }

  handleIntroPlaybackEnded() {
    return this.playService.handleIntroPlaybackEnded()
  }

  handleCancelIntro() {
    return this.playService.handleCancelIntro()
  }

  async handlePlayPauseToggle() {
    return this.playbackController.handlePlayPauseToggle()
  }

  async handlePlayStop() {
    return this.playbackController.handlePlayStop()
  }

  async handlePlayNext() {
    return this.playbackController.handlePlayNext()
  }

  async handlePlayPrevious() {
    return this.playbackController.handlePlayPrevious()
  }

  async handlePausePlay() {
    return this.playbackController.handlePausePlay()
  }

  async handleGetSessionStatus() {
    const playStatus = await this.playbackController.handleGetSessionStatus()
    return {
      ...playStatus,
      hasActiveSession: !!this.activeSession,
      session: this.activeSession,
      heartRateCount: this.activeSession?.heartRateData.length || 0,
    }
  }

  async handleCreateMonitors() {
    return this.playbackController.handleCreateMonitors()
  }

  async handleToggleFullscreen() {
    return this.playbackController.handleToggleFullscreen()
  }

  handleQuitApp() {
    return this.playbackController.handleQuitApp()
  }

  // ── 웹 API 연동 ──

  private async fetchPlaylistFromWeb(playlistId: string): Promise<PlaylistSyncData> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.webAppUrl}/api/playlists/${playlistId}`,
        { method: 'GET', headers: { ...this.buildAuthHeaders() } },
        10000
      )
      if (!response.ok) {
        throw new Error(`플레이리스트 조회 실패: ${response.status}`)
      }

      const data = await response.json()
      return data as PlaylistSyncData
    } catch (error) {
      console.error('플레이리스트 조회 실패:', error)
      return {
        id: playlistId,
        name: '로컬 플레이리스트',
        videos: []
      }
    }
  }

  private async sendSessionDataToWeb(sessionData: WorkoutSessionData) {
    try {
      const response = await this.fetchWithTimeout(
        `${this.webAppUrl}/api/sessions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.buildAuthHeaders()
          },
          body: JSON.stringify(sessionData)
        },
        10000
      )

      if (!response.ok) {
        console.error('세션 데이터 전송 실패:', response.status)
        this.saveSessionDataLocally(sessionData)
      } else {
        log('세션 데이터 전송 성공')
      }
    } catch (error) {
      console.error('세션 데이터 전송 오류:', error)
      this.saveSessionDataLocally(sessionData)
    }
  }

  private saveSessionDataLocally(sessionData: WorkoutSessionData) {
    try {
      const dataDir = this.getWritableDataDir()
      const sessionsDir = path.join(dataDir, 'sessions')
      if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true })
      }

      const fileName = `session-${sessionData.id}.json`
      fs.writeFileSync(
        path.join(sessionsDir, fileName),
        JSON.stringify(sessionData, null, 2)
      )
      log('세션 데이터 로컬 저장 완료:', fileName)
    } catch (error) {
      console.error('세션 데이터 로컬 저장 실패:', error)
    }
  }
}
