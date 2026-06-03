import { Router, Response } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { ElectronRelayService } from '../services/electronRelay.service.js'
import { DeviceService } from '../services/device.service.js'
import {
  DeviceControlLockedError,
  DeviceControlMissingError,
  DeviceControlLockService,
  type LockOwner
} from '../services/deviceControlLock.service.js'
import { authenticateToken, requireLinkageEnabled, type AuthenticatedRequest } from '../middleware/auth.middleware.js'

import { monitorDisplayService } from '../services/monitorDisplay.service.js'

const router = Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ELECTRON_LOG_UPLOAD_ROOT = path.join(__dirname, '../../uploads/electron-logs')

const sanitizePathSegment = (value: unknown, fallback: string): string => {
  const sanitized = String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return sanitized || fallback
}

const formatDateForPath = (value: unknown): string => {
  const date = value ? new Date(String(value)) : new Date()
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10)
  return date.toISOString().slice(0, 10)
}

const formatTimestampForFilename = (value: unknown): string => {
  const date = value ? new Date(String(value)) : new Date()
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date
  const yyyy = safeDate.getFullYear()
  const mm = String(safeDate.getMonth() + 1).padStart(2, '0')
  const dd = String(safeDate.getDate()).padStart(2, '0')
  const hh = String(safeDate.getHours()).padStart(2, '0')
  const mi = String(safeDate.getMinutes()).padStart(2, '0')
  const ss = String(safeDate.getSeconds()).padStart(2, '0')
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`
}

const maskSensitiveLogText = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
      .replace(/("_relayJwt"\s*:\s*")([^"]+)(")/gi, '$1[REDACTED]$3')
      .replace(/("Authorization"\s*:\s*")([^"]+)(")/gi, '$1[REDACTED]$3')
      .replace(/(Authorization:\s*Bearer\s+)[^\s,)]+/gi, '$1[REDACTED]')
  }
  if (Array.isArray(value)) return value.map(maskSensitiveLogText)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        /token|authorization|jwt/i.test(key) ? '[REDACTED]' : maskSensitiveLogText(entry),
      ])
    )
  }
  return value
}

const getControllerId = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const getUserStoreId = (user: NonNullable<AuthenticatedRequest['user']>): number | null => {
  const storeId = user.branchId ? parseInt(String(user.branchId), 10) : null
  return storeId && !Number.isNaN(storeId) ? storeId : null
}

const requireUserStoreId = (req: AuthenticatedRequest, res: Response): number | null => {
  const user = req.user
  if (!user) {
    res.status(401).json({ success: false, error: '인증이 필요합니다' })
    return null
  }

  const storeId = getUserStoreId(user)
  if (!storeId) {
    res.status(400).json({ success: false, error: '매장 정보가 없습니다' })
    return null
  }

  return storeId
}

const requireDeviceStoreAccess = async (
  req: AuthenticatedRequest,
  deviceId: string,
  res: Response
): Promise<boolean> => {
  const storeId = requireUserStoreId(req, res)
  if (!storeId) return false

  const device = await DeviceService.getDeviceByDeviceId(deviceId)
  if (!device || device.status !== 'approved') {
    res.status(404).json({ success: false, error: '등록된 디바이스가 아닙니다' })
    return false
  }

  if (device.store_id !== storeId) {
    res.status(403).json({ success: false, error: '이 디바이스를 제어할 권한이 없습니다' })
    return false
  }

  return true
}

const getLockOwner = (req: AuthenticatedRequest, controllerId: unknown): LockOwner | null => {
  const user = req.user
  const parsedControllerId = getControllerId(controllerId)
  if (!user || !parsedControllerId) return null
  return {
    controllerId: parsedControllerId,
    userId: user.id,
    userid: user.userid
  }
}

const sendLockError = (res: Response, error: DeviceControlLockedError) => {
  res.status(423).json({
    success: false,
    error: error.message,
    code: 'DEVICE_CONTROL_LOCKED',
    lock: {
      userid: error.lock.userid,
      lockedAt: error.lock.lockedAt,
      lastSeenAt: error.lock.lastSeenAt
    }
  })
}

const sendMissingLockError = (res: Response, error: DeviceControlMissingError) => {
  res.status(409).json({
    success: false,
    error: error.message,
    code: 'DEVICE_CONTROL_NOT_LOCKED'
  })
}

const requireDeviceConnection = (deviceId: string, res: Response, command?: string): boolean => {
  if (ElectronRelayService.isDeviceConnected(deviceId)) return true
  console.warn('[electron-relay][command]', {
    deviceIdPrefix: String(deviceId).slice(0, 12),
    command: command ?? '(unknown)',
    httpStatus: 503,
    error: '디바이스가 연결되어 있지 않습니다'
  })
  res.status(503).json({
    success: false,
    error: '디바이스가 연결되어 있지 않습니다'
  })
  return false
}

const getPublicControlLockStatus = (deviceId: string, controllerId?: string) => {
  const status = DeviceControlLockService.getStatus(deviceId, controllerId)
  return {
    locked: status.locked,
    isOwner: status.isOwner,
    lock: status.lock
      ? {
          userid: status.lock.userid,
          lockedAt: status.lock.lockedAt,
          lastSeenAt: status.lock.lastSeenAt
        }
      : null
  }
}

function mergeRelayJwtPayload(req: AuthenticatedRequest, data: unknown): Record<string, unknown> {
  const base: Record<string, unknown> =
    typeof data === 'object' && data !== null && !Array.isArray(data)
      ? { ...(data as Record<string, unknown>) }
      : {}
  const raw = req.headers.authorization
  if (raw && typeof raw === 'string') {
    const m = raw.match(/^Bearer\s+(.+)$/i)
    if (m?.[1]) {
      base._relayJwt = m[1].trim()
    }
  }
  return base
}

/** Electron resolve API 실패를 줄이기 위해 서버에서 모니터 표시 설정을 미리 resolve */
async function enrichPlayDataWithMonitorDisplay(
  userId: string,
  playData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const masterId = playData.masterId ? String(playData.masterId) : ''
  if (!masterId || masterId === 'remote-control') {
    return playData
  }

  try {
    const [initDisplay, introDisplay] = await Promise.all([
      monitorDisplayService.resolveDisplayConfig({ userId, masterId, context: 'default' }),
      monitorDisplayService.resolveDisplayConfig({ userId, masterId, context: 'intro' })
    ])
    return { ...playData, initDisplay, introDisplay }
  } catch (error) {
    console.error('[electron-relay] monitor display pre-resolve failed:', error)
    return playData
  }
}

/** Electron 타이머 MM:SS / 서킷 추적용 — JWT·토큰 필드는 넣지 않음 */
function logRelayStartWorkoutCircuit(source: string, deviceId: string, playData: Record<string, unknown>): void {
  const md = playData.metadata
  const meta = md && typeof md === 'object' && !Array.isArray(md) ? (md as Record<string, unknown>) : null
  const seqs = playData.sequences
  console.log(`[electron-relay][circuit][${source}]`, {
    deviceIdPrefix: String(deviceId).slice(0, 8),
    masterId: playData.masterId,
    metadataCircuitType: meta?.circuitType,
    metadataWorkoutCategory: meta?.workoutCategory,
    sequenceCount: Array.isArray(seqs) ? seqs.length : 0,
  })
}

async function sendOwnedCommand(
  req: AuthenticatedRequest,
  res: Response,
  command: string,
  data: Record<string, unknown> = {}
) {
  const { deviceId, controllerId } = req.body

  if (!deviceId || typeof deviceId !== 'string') {
    return res.status(400).json({ success: false, error: 'deviceId가 필요합니다' })
  }

  if (!(await requireDeviceStoreAccess(req, deviceId, res))) return
  if (!requireDeviceConnection(deviceId, res)) return

  const owner = getLockOwner(req, controllerId)
  if (!owner) {
    return res.status(400).json({ success: false, error: 'controllerId가 필요합니다' })
  }

  try {
    DeviceControlLockService.assertOwner(deviceId, owner)
  } catch (error) {
    if (error instanceof DeviceControlLockedError) {
      return sendLockError(res, error)
    }
    if (error instanceof DeviceControlMissingError) {
      return sendMissingLockError(res, error)
    }
    throw error
  }

  const result = await ElectronRelayService.sendCommand(deviceId, command, mergeRelayJwtPayload(req, data))

  if (command === 'quit-app') {
    DeviceControlLockService.release(deviceId, owner.controllerId)
  }

  res.json({ success: true, data: result })
}

/**
 * POST /api/electron-relay/command
 * 웹앱에서 호출: 특정 디바이스에 명령 전송
 * Body: { deviceId: 'xxx', command: 'start-workout-play', data: {...} }
 */
router.post('/command', authenticateToken, requireLinkageEnabled, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user
    if (!user) {
      return res.status(401).json({ success: false, error: '인증이 필요합니다' })
    }

    const { deviceId, command, controllerId, data } = req.body

    if (!deviceId || typeof deviceId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'deviceId가 필요합니다'
      })
    }

    if (!command || typeof command !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'command가 필요합니다'
      })
    }

    if (!(await requireDeviceStoreAccess(req, deviceId, res))) return
    if (!requireDeviceConnection(deviceId, res, command)) return

    const owner = getLockOwner(req, controllerId)
    if (!owner) {
      console.warn('[electron-relay][command]', {
        deviceIdPrefix: String(deviceId).slice(0, 12),
        command,
        httpStatus: 400,
        error: 'controllerId가 필요합니다'
      })
      return res.status(400).json({
        success: false,
        error: 'controllerId가 필요합니다'
      })
    }

    try {
      if (command === 'start-workout-play') {
        DeviceControlLockService.acquire(deviceId, owner)
      } else {
        DeviceControlLockService.assertOwner(deviceId, owner)
      }
    } catch (error) {
      if (error instanceof DeviceControlLockedError) {
        console.warn('[electron-relay][command]', {
          deviceIdPrefix: String(deviceId).slice(0, 12),
          command,
          httpStatus: 423,
          error: error.message,
          code: 'DEVICE_CONTROL_LOCKED'
        })
        return sendLockError(res, error)
      }
      if (error instanceof DeviceControlMissingError) {
        console.warn('[electron-relay][command]', {
          deviceIdPrefix: String(deviceId).slice(0, 12),
          command,
          httpStatus: 409,
          error: error.message,
          code: 'DEVICE_CONTROL_NOT_LOCKED'
        })
        return sendMissingLockError(res, error)
      }
      throw error
    }

    // set-display-label: DB에 display_label 갱신 (방법 A - 영구 반영)
    if (command === 'set-display-label' && data?.displayLabel && typeof data.displayLabel === 'string') {
      const device = await DeviceService.getDeviceByDeviceId(deviceId)
      if (device) {
        await DeviceService.updateDisplayLabel(device.id, data.displayLabel.trim())
      }
    }

    if (command === 'start-workout-play' && data && typeof data === 'object' && !Array.isArray(data)) {
      const playPayload = req.user?.id
        ? await enrichPlayDataWithMonitorDisplay(String(req.user.id), data as Record<string, unknown>)
        : (data as Record<string, unknown>)
      logRelayStartWorkoutCircuit('command', deviceId, playPayload)
      const result = await ElectronRelayService.sendCommand(
        deviceId,
        command,
        mergeRelayJwtPayload(req, playPayload)
      )
      return res.json({ success: true, data: result })
    }

    // 명령 전송 및 응답 대기
    const result = await ElectronRelayService.sendCommand(deviceId, command, mergeRelayJwtPayload(req, data))

    if (command === 'quit-app') {
      DeviceControlLockService.release(deviceId, owner.controllerId)
    }

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류'
    const bodyCommand = typeof req.body?.command === 'string' ? req.body.command : ''
    const bodyDeviceId = typeof req.body?.deviceId === 'string' ? req.body.deviceId : ''
    console.error('[electron-relay][command]', {
      deviceIdPrefix: bodyDeviceId ? String(bodyDeviceId).slice(0, 12) : '(none)',
      command: bodyCommand || '(unknown)',
      httpStatus: 500,
      error: message
    })
    res.status(500).json({
      success: false,
      error: message
    })
  }
})

/**
 * GET /api/electron-relay/status/:deviceId
 * 특정 디바이스 연결 상태 확인
 */
router.get('/status/:deviceId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { deviceId } = req.params
    const controllerId = getControllerId(req.query.controllerId)

    if (!(await requireDeviceStoreAccess(req, deviceId, res))) return
    const isConnected = ElectronRelayService.isDeviceConnected(deviceId)
    const controlLock = getPublicControlLockStatus(deviceId, controllerId || undefined)

    res.json({
      success: true,
      deviceId,
      isConnected,
      controlLock
    })
  } catch (error) {
    console.error('상태 확인 오류:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    })
  }
})

router.get('/heart-rate-status/:deviceId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { deviceId } = req.params

    if (!(await requireDeviceStoreAccess(req, deviceId, res))) return
    if (!requireDeviceConnection(deviceId, res, 'heart-rate-status')) return

    const diagnostics = await ElectronRelayService.sendCommand(deviceId, 'heart-rate-status', {})
    res.json({
      success: true,
      deviceId,
      diagnostics
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류'
    console.error('[electron-relay][heart-rate-status]', {
      deviceIdPrefix: String(req.params?.deviceId || '').slice(0, 12),
      httpStatus: 500,
      error: message
    })
    res.status(500).json({
      success: false,
      error: message
    })
  }
})

router.get('/control-lock/status/:deviceId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { deviceId } = req.params
    const controllerId = getControllerId(req.query.controllerId)

    if (!(await requireDeviceStoreAccess(req, deviceId, res))) return
    res.json({
      success: true,
      deviceId,
      controlLock: getPublicControlLockStatus(deviceId, controllerId || undefined)
    })
  } catch (error) {
    console.error('제어 잠금 상태 조회 오류:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    })
  }
})

router.post('/control-lock/release', authenticateToken, requireLinkageEnabled, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { deviceId, controllerId } = req.body

    if (!deviceId || typeof deviceId !== 'string') {
      return res.status(400).json({ success: false, error: 'deviceId가 필요합니다' })
    }

    if (!(await requireDeviceStoreAccess(req, deviceId, res))) return
    const owner = getLockOwner(req, controllerId)
    if (!owner) {
      return res.status(400).json({ success: false, error: 'controllerId가 필요합니다' })
    }

    const released = DeviceControlLockService.release(deviceId, owner.controllerId)
    res.json({ success: true, released })
  } catch (error) {
    console.error('제어 잠금 해제 오류:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    })
  }
})

/**
 * GET /api/electron-relay/connected
 * 현재 매장의 연결된 디바이스 목록 (실시간)
 */
router.get('/connected', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user
    if (!user) {
      return res.status(401).json({ success: false, error: '인증이 필요합니다' })
    }

    const storeId = requireUserStoreId(req, res)
    if (!storeId) return

    const devices = ElectronRelayService.getConnectedDevices(storeId)
    
    console.log(`📡 [connected] storeId=${storeId}, 연결된 디바이스 수=${devices.length}`, devices)

    res.json({
      success: true,
      devices
    })
  } catch (error) {
    console.error('연결된 디바이스 조회 오류:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    })
  }
})

/**
 * POST /api/electron-relay/workout-logs
 * Electron 앱이 당일 로그 파일을 서버 파일로 업로드
 */
router.post('/workout-logs', authenticateToken, requireLinkageEnabled, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { deviceId, storeId: rawStoreId, masterId, sentAt, files, displayLabel, logDate } = req.body || {}

    if (!deviceId || typeof deviceId !== 'string') {
      console.warn('[electron-relay][workout-logs]', { httpStatus: 400, error: 'deviceId가 필요합니다' })
      return res.status(400).json({ success: false, error: 'deviceId가 필요합니다' })
    }
    if (!Array.isArray(files)) {
      console.warn('[electron-relay][workout-logs]', { deviceIdPrefix: String(deviceId).slice(0, 12), httpStatus: 400, error: 'files 배열이 필요합니다' })
      return res.status(400).json({ success: false, error: 'files 배열이 필요합니다' })
    }
    if (!(await requireDeviceStoreAccess(req, deviceId, res))) return

    const device = await DeviceService.getDeviceByDeviceId(deviceId)
    const storeId = device?.store_id ?? (Number.isFinite(Number(rawStoreId)) ? Number(rawStoreId) : null)
    const datePart = formatDateForPath(logDate || sentAt)
    const storeSegment = `store-${sanitizePathSegment(storeId ?? 'unknown', 'unknown')}`
    const deviceSegment = `device-${sanitizePathSegment(deviceId, 'unknown')}`
    const targetDir = path.join(ELECTRON_LOG_UPLOAD_ROOT, datePart, storeSegment, deviceSegment)
    fs.mkdirSync(targetDir, { recursive: true })

    const sentPart = formatTimestampForFilename(sentAt)
    const fileName = [
      storeSegment,
      deviceSegment,
      `master-${sanitizePathSegment(masterId ?? 'unknown', 'unknown')}`,
      `sent-${sentPart}`,
    ].join('__') + '.json'
    const filePath = path.join(targetDir, fileName)

    const payload = maskSensitiveLogText({
      deviceId,
      storeId,
      displayLabel,
      masterId: masterId ?? null,
      sentAt: sentAt || new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      logDate: datePart,
      files,
    })

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8')
    console.log('[electron-relay][workout-logs] saved', {
      deviceIdPrefix: deviceId.slice(0, 8),
      storeId,
      masterId,
      files: files.length,
      filePath,
    })

    res.json({
      success: true,
      fileName,
      relativePath: path.relative(ELECTRON_LOG_UPLOAD_ROOT, filePath),
      fileCount: files.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류'
    console.error('[electron-relay][workout-logs]', { httpStatus: 500, error: message })
    res.status(500).json({
      success: false,
      error: message
    })
  }
})

/**
 * POST /api/electron-relay/broadcast
 * 매장의 모든 디바이스에 명령 전송
 */
router.post('/broadcast', authenticateToken, requireLinkageEnabled, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user
    if (!user) {
      return res.status(401).json({ success: false, error: '인증이 필요합니다' })
    }

    const storeId = user.branchId ? parseInt(user.branchId) : null

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: '매장 정보가 없습니다'
      })
    }

    const { command, data } = req.body

    if (!command || typeof command !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'command가 필요합니다'
      })
    }

    const results = await ElectronRelayService.broadcastToStore(storeId, command, mergeRelayJwtPayload(req, data))

    res.json({
      success: true,
      results
    })
  } catch (error) {
    console.error('브로드캐스트 오류:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    })
  }
})

// 운동 제어 단축 API들

/**
 * POST /api/electron-relay/start-workout-play
 * 운동 플레이 시작
 */
router.post('/start-workout-play', authenticateToken, requireLinkageEnabled, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user
    if (!user) {
      return res.status(401).json({ success: false, error: '인증이 필요합니다' })
    }

    const { deviceId, controllerId, ...playData } = req.body

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'deviceId가 필요합니다'
      })
    }

    if (!(await requireDeviceStoreAccess(req, deviceId, res))) return
    if (!requireDeviceConnection(deviceId, res)) return

    const owner = getLockOwner(req, controllerId)
    if (!owner) {
      return res.status(400).json({
        success: false,
        error: 'controllerId가 필요합니다'
      })
    }

    try {
      DeviceControlLockService.acquire(deviceId, owner)
    } catch (error) {
      if (error instanceof DeviceControlLockedError) {
        return sendLockError(res, error)
      }
      throw error
    }

    const enrichedPlayData = user.id
      ? await enrichPlayDataWithMonitorDisplay(String(user.id), playData as Record<string, unknown>)
      : (playData as Record<string, unknown>)

    logRelayStartWorkoutCircuit('start-workout-play', deviceId, enrichedPlayData)

    const result = await ElectronRelayService.sendCommand(
      deviceId,
      'start-workout-play',
      mergeRelayJwtPayload(req, enrichedPlayData)
    )

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('운동 시작 오류:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    })
  }
})

/**
 * POST /api/electron-relay/play-start
 * 대기 → 재생 시작
 */
router.post('/play-start', authenticateToken, requireLinkageEnabled, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await sendOwnedCommand(req, res, 'play-start')
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    })
  }
})

/**
 * POST /api/electron-relay/play-pause
 * 일시정지/재개
 */
router.post('/play-pause', authenticateToken, requireLinkageEnabled, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await sendOwnedCommand(req, res, 'play-pause')
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    })
  }
})

/**
 * POST /api/electron-relay/play-stop
 * 운동 종료
 */
router.post('/play-stop', authenticateToken, requireLinkageEnabled, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await sendOwnedCommand(req, res, 'play-stop')
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    })
  }
})

/**
 * POST /api/electron-relay/play-next
 * 다음 운동으로 이동
 */
router.post('/play-next', authenticateToken, requireLinkageEnabled, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await sendOwnedCommand(req, res, 'play-next')
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    })
  }
})

/**
 * POST /api/electron-relay/play-previous
 * 이전 운동으로 이동
 */
router.post('/play-previous', authenticateToken, requireLinkageEnabled, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await sendOwnedCommand(req, res, 'play-previous')
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    })
  }
})

/**
 * POST /api/electron-relay/toggle-fullscreen
 * 전체화면 토글
 */
router.post('/toggle-fullscreen', authenticateToken, requireLinkageEnabled, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await sendOwnedCommand(req, res, 'toggle-fullscreen')
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    })
  }
})

export default router
