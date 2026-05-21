import { ipcMain } from 'electron'
import * as fs from 'fs'

import type { HeartRateReading, HeartRateManagerDeps } from './types'
import type { HeartRateUploadStatus } from './diagnostics-types'
import { calculateHeartRateZoneForApi } from './heart-rate-zones'

/**
 * HeartRateManager - 심박수 데이터 수집·전송·큐 관리 모듈
 *
 * ANT+ 동글 또는 웹 앱에서 수신된 심박수 데이터를 처리한다:
 *   1. UI 브로드캐스트 — 모든 Electron 윈도우에 실시간 심박수 전달
 *   2. 버퍼링 — 10개씩 모아서 웹 API로 일괄 전송 (네트워크 부하 감소)
 *   3. Zone 계산 — rest / fat-burn / cardio / peak
 *   4. 실패 큐 — 전송 실패 시 로컬 JSONL 파일에 적재, 다음 전송 시 우선 드레인
 *   5. 임계값 조회 — 웹 API에서 심박수 임계값 설정을 가져옴
 */

export class HeartRateManager {
  private buffer: HeartRateReading[] = []
  private lastNoSessionWarnAtMs = 0
  /** 401 등으로 서버 업로드를 잠시 중지할 때까지 (epoch ms) */
  private uploadPausedUntilMs = 0
  private lastAuthFailureLogAtMs = 0
  private lastUpload: {
    at: string
    ok: boolean
    status?: number
    count?: number
    masterId?: string
    error?: string
    queued?: boolean
  } | null = null
  private readonly queueFilePath: string
  private readonly deps: HeartRateManagerDeps

  constructor(queueFilePath: string, deps: HeartRateManagerDeps) {
    this.queueFilePath = queueFilePath
    this.deps = deps
  }

  /** 마지막 업로드 상태 (디버그 진단용) */
  getLastUploadStatus() {
    return this.lastUpload
  }

  /** 원격/로컬 심박 진단용 업로드 상태 */
  getUploadDiagnostics(): HeartRateUploadStatus {
    return {
      bufferCount: this.buffer.length,
      queue: this.getQueueStatus(),
      lastUpload: this.lastUpload,
    }
  }

  /** 심박수 Zone 계산 (웹 API 규칙과 동일) */
  calculateZone(heartRate: number): string {
    return calculateHeartRateZoneForApi(heartRate)
  }

  /**
   * ANT+ 심박수 데이터 수집
   *
   * ANT+ 동글에서 수신된 심박 데이터를 처리한다.
   * UI 브로드캐스트는 세션 유무와 관계없이 항상 수행하며,
   * 세션이 있을 때만 버퍼에 쌓아 웹 API로 전송한다.
   */
  async collectFromANT(
    slotNumber: number,
    deviceId: number,
    deviceName: string,
    heartRate: number
  ): Promise<void> {
    this.deps.broadcastToAllWindows('heart-rate-updated', {
      slotNumber,
      deviceName,
      heartRate,
      deviceId
    })

    // 유효하지 않은 HR(0 등)은 UI만 갱신하고 서버 배치에는 넣지 않음 (로그/API 부하 감소)
    if (heartRate <= 0) return

    const session = this.deps.getActivePlaySession()
    if (!session) {
      const now = Date.now()
      if (now - this.lastNoSessionWarnAtMs > 15000) {
        this.lastNoSessionWarnAtMs = now
        console.warn('⚠️ 심박수 수신 중이지만 activePlaySession이 없어 업로드를 건너뜁니다')
      }
      return
    }

    const reading: HeartRateReading = {
      deviceId: `ant-${deviceId}`,
      deviceName: deviceName,
      heartRate,
      timestamp: new Date(),
      zone: calculateHeartRateZoneForApi(heartRate)
    }

    this.buffer.push(reading)

    if (this.buffer.length >= 10) {
      const batch = this.buffer.splice(0, this.buffer.length)
      await this.sendToWeb(batch)
    }
  }

  /**
   * IPC 심박수 데이터 수집 (renderer → main)
   *
   * renderer에서 `collect-heart-rate` 채널로 보낸 데이터를 버퍼에 쌓고
   * UI 브로드캐스트 후 10개마다 웹 API로 전송한다.
   */
  async collectFromIPC(heartRateData: HeartRateReading): Promise<void> {
    const activeSession = this.deps.getActiveSession()
    if (!activeSession) return

    this.buffer.push(heartRateData)
    this.deps.broadcastToAllWindows('heart-rate-updated', heartRateData)

    if (this.buffer.length >= 10) {
      const batch = this.buffer.splice(0, this.buffer.length)
      await this.sendToWeb(batch)
    }
  }

  /**
   * 웹 앱에서 수신된 심박수 데이터를 모든 Electron 윈도우에 브로드캐스트 (UI 표시용)
   * 웹 앱이 이미 API로 저장하므로 버퍼/전송은 하지 않는다.
   */
  broadcastFromWeb(heartRateData: HeartRateReading): void {
    this.deps.broadcastToAllWindows('heart-rate-updated', heartRateData)
  }

  /** 심박수 임계값을 웹 API에서 조회한다 (기본값: 120) */
  async getThreshold(): Promise<{ success: boolean; threshold: number }> {
    try {
      const response = await this.deps.fetchWithTimeout(
        `${this.deps.getWebAppUrl()}/api/heart-rate/threshold`,
        { method: 'GET', headers: { ...this.deps.buildAuthHeaders() } },
        5000
      )
      if (response.ok) {
        const data = await response.json()
        return { success: true, threshold: data.threshold || 120 }
      }
      return { success: false, threshold: 120 }
    } catch (error) {
      console.error('심박수 임계값 조회 실패:', error)
      return { success: false, threshold: 120 }
    }
  }

  /** 버퍼를 비운다 (세션 종료 시) */
  clearBuffer(): void {
    this.buffer = []
  }

  /**
   * 버퍼에 남은 심박수 데이터를 즉시 웹 API로 전송한다 (세션 종료 직전 호출).
   * 전송 실패 시 로컬 큐에 적재하며, 호출 후 버퍼는 비워진다.
   */
  async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0) return
    const batch = this.buffer.splice(0, this.buffer.length)
    await this.sendToWeb(batch)
  }

  /** 심박수 큐 파일 상태를 반환한다 (디버그 진단용) */
  getQueueStatus(): { exists: boolean; bytes: number; mtimeMs: number | null } {
    try {
      const st = fs.statSync(this.queueFilePath)
      return { exists: true, bytes: st.size, mtimeMs: st.mtimeMs }
    } catch {
      return { exists: false, bytes: 0, mtimeMs: null }
    }
  }

  /**
   * IPC 핸들러를 등록한다.
   * ipc-handlers.ts의 registerIPCHandlers()에서 호출.
   */
  registerIPCHandlers(): void {
    ipcMain.handle('collect-heart-rate', async (_event, heartRateData: HeartRateReading) => {
      try {
        await this.collectFromIPC(heartRateData)
        return { success: true }
      } catch (error) {
        console.error('심박수 데이터 수집 실패:', error)
        return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' }
      }
    })

    ipcMain.handle('web-send-heart-rate', async (_event, heartRateData: HeartRateReading) => {
      try {
        this.broadcastFromWeb(heartRateData)
        return { success: true }
      } catch (error) {
        console.error('웹 심박수 데이터 처리 실패:', error)
        return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' }
      }
    })

    ipcMain.handle('get-heart-rate-threshold', async () => {
      return this.getThreshold()
    })
  }

  // ── 내부 메서드 ──

  private noteAuthFailureFromApi(status: number): void {
    if (status !== 401) return
    this.uploadPausedUntilMs = Date.now() + 120_000
    const now = Date.now()
    if (now - this.lastAuthFailureLogAtMs < 30_000) return
    this.lastAuthFailureLogAtMs = now
    console.error(
      '❌ 심박 API 401: 세션이 만료되었습니다. 약 2분간 서버 업로드를 건너뜁니다. 웹에 재로그인 후 다시 시도해 주세요.'
    )
  }

  /** 심박수 데이터를 웹 API로 전송한다 */
  private async sendToWeb(heartRateData: HeartRateReading[]): Promise<boolean> {
    try {
      if (Date.now() < this.uploadPausedUntilMs) {
        this.appendQueue(heartRateData, { quiet: true })
        return false
      }

      const session = this.deps.getActivePlaySession()
      if (!session) {
        console.warn('활성 운동 세션이 없어 심박수 데이터 전송을 건너뜁니다')
        return false
      }

      await this.flushQueue()

      const response = await this.deps.fetchWithTimeout(
        `${this.deps.getWebAppUrl()}/api/heart-rate/save-batch`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.deps.buildAuthHeaders()
          },
          body: JSON.stringify({
            userId: session.userId,
            workoutHistoryMasterId: session.masterId,
            heartRateData: heartRateData.map(hr => ({
              deviceId: hr.deviceId,
              deviceName: hr.deviceName,
              heartRate: hr.heartRate,
              timestamp: hr.timestamp,
              zone: hr.zone
            }))
          })
        },
        10000
      )

      if (!response.ok) {
        const errorText = await response.text()
        this.lastUpload = {
          at: new Date().toISOString(),
          ok: false,
          status: response.status,
          count: heartRateData.length,
          masterId: session.masterId,
          error: String(errorText || '').slice(0, 300)
        }
        if (response.status === 401) {
          this.noteAuthFailureFromApi(401)
          this.appendQueue(heartRateData, { quiet: true })
          return false
        }
        console.error(`❌ API 응답 에러 (${response.status}):`, errorText)
        throw new Error(`심박수 데이터 전송 실패: ${response.status}`)
      }

      this.uploadPausedUntilMs = 0
      this.lastUpload = {
        at: new Date().toISOString(),
        ok: true,
        status: response.status,
        count: heartRateData.length,
        masterId: session.masterId
      }
      return true
    } catch (error) {
      console.error('❌ 심박수 데이터 전송 실패:', error)
      this.appendQueue(heartRateData)
      this.lastUpload = {
        at: new Date().toISOString(),
        ok: false,
        count: heartRateData.length,
        masterId: this.deps.getActivePlaySession()?.masterId,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        queued: true
      }
      return false
    }
  }

  /** 전송 실패 데이터를 로컬 JSONL 파일에 적재한다 */
  private appendQueue(heartRateData: HeartRateReading[], opts?: { quiet?: boolean }): void {
    try {
      const lines = heartRateData.map(hr => JSON.stringify({
        deviceId: hr.deviceId,
        deviceName: hr.deviceName,
        heartRate: hr.heartRate,
        timestamp: hr.timestamp instanceof Date ? hr.timestamp.toISOString() : hr.timestamp,
        zone: hr.zone
      }))
      fs.appendFileSync(this.queueFilePath, `${lines.join('\n')}\n`)
      if (!opts?.quiet) {
        console.warn(`⚠️ 심박수 업로드 실패로 로컬 큐에 적재: ${heartRateData.length}개`)
      }
    } catch (e) {
      console.error('❌ 심박수 로컬 큐 적재 실패:', e)
    }
  }

  /** 이전에 실패해 큐에 쌓인 데이터를 우선 드레인한다 (최대 200개씩) */
  private async flushQueue(): Promise<void> {
    try {
      if (Date.now() < this.uploadPausedUntilMs) return
      if (!fs.existsSync(this.queueFilePath)) return
      const raw = fs.readFileSync(this.queueFilePath, 'utf-8').trim()
      if (!raw) return

      const lines = raw.split('\n').filter(Boolean)
      const batchLines = lines.slice(0, 200)
      if (batchLines.length === 0) return

      const session = this.deps.getActivePlaySession()
      if (!session) return

      const payload = batchLines.map(line => {
        const parsed = JSON.parse(line)
        return {
          deviceId: parsed.deviceId,
          deviceName: parsed.deviceName,
          heartRate: parsed.heartRate,
          timestamp: parsed.timestamp,
          zone: parsed.zone
        }
      })

      const response = await this.deps.fetchWithTimeout(
        `${this.deps.getWebAppUrl()}/api/heart-rate/save-batch`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.deps.buildAuthHeaders()
          },
          body: JSON.stringify({
            userId: session.userId,
            workoutHistoryMasterId: session.masterId,
            heartRateData: payload
          })
        },
        10000
      )

      if (!response.ok) {
        this.noteAuthFailureFromApi(response.status)
        return
      }

      this.uploadPausedUntilMs = 0

      const remaining = lines.slice(batchLines.length)
      if (remaining.length === 0) {
        fs.unlinkSync(this.queueFilePath)
      } else {
        fs.writeFileSync(this.queueFilePath, `${remaining.join('\n')}\n`)
      }
    } catch {
      // 드레인 실패는 조용히 유지 (다음 기회에 재시도)
    }
  }
}
