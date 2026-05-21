import { Router, Request, Response } from 'express'
import { DeviceService } from '../services/device.service.js'
import { authenticateToken, requireLinkageEnabled, type AuthenticatedRequest } from '../middleware/auth.middleware.js'

const router = Router()

/** JWT 사용자가 해당 store_id 디바이스에 대한 삭제 권한이 있는지 */
const canUserModifyDeviceForStore = (
  user: NonNullable<AuthenticatedRequest['user']>,
  deviceStoreId: number | null
): boolean => {
  const scope = user.branchId ? parseInt(String(user.branchId), 10) : null
  if (scope == null || Number.isNaN(scope)) return false
  return deviceStoreId === scope
}

/** display_label '디바이스' 또는 null/빈값 → '링크힛'으로 정규화 */
const normDisplayLabel = (s: string | null | undefined): string =>
  (s && s.trim() !== '' && s !== '디바이스') ? s : '링크힛'

/**
 * GET /api/devices/status
 * Electron에서 호출: 디바이스 상태 조회 및 등록 코드 발급
 * - 등록된 디바이스: { registered: true, device: {...} }
 * - 미등록 디바이스: { registered: false, registerCode: 'ABC123', expiresIn: 600 }
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.query

    if (!deviceId || typeof deviceId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'deviceId가 필요합니다'
      })
    }

    const result = await DeviceService.getDeviceStatus(deviceId)

    const normalized = { ...result }
    if (normalized.device?.display_label !== undefined) {
      normalized.device = { ...normalized.device, display_label: normDisplayLabel(normalized.device.display_label) }
    }
    res.json({ success: true, ...normalized })
  } catch (error) {
    console.error('디바이스 상태 조회 오류:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    })
  }
})

/**
 * POST /api/devices/register
 * 웹앱에서 호출: 등록 코드로 디바이스 등록
 * Body: { code: 'ABC123', displayLabel: '1번 모니터' }
 */
router.post('/register', authenticateToken, requireLinkageEnabled, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user
    console.log('📋 디바이스 등록 요청 - user:', JSON.stringify(user, null, 2))
    
    if (!user) {
      return res.status(401).json({ success: false, error: '인증이 필요합니다' })
    }

    const { code, displayLabel } = req.body

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: '등록 코드가 필요합니다'
      })
    }

    // 사용자의 branchId를 storeId로 사용
    console.log('📋 user.branchId:', user.branchId, 'type:', typeof user.branchId)
    console.log('📋 user.role:', user.role)
    
    const storeId = user.branchId ? parseInt(user.branchId) : null
    console.log('📋 storeId:', storeId)

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: '사용자 지점 정보가 없어 디바이스를 등록할 수 없습니다. 관리자에게 사용자 지점을 먼저 지정해 주세요.'
      })
    }

    const result = await DeviceService.registerDevice(
      code.toUpperCase().trim(),
      storeId,
      displayLabel || '링크힛',
      user.id,
      user.userid
    )

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.json({
      success: true,
      message: '디바이스가 등록되었습니다',
      device: {
        id: result.device!.id,
        deviceId: result.device!.device_id,
        displayLabel: normDisplayLabel(result.device!.display_label),
        status: result.device!.status
      }
    })
  } catch (error) {
    console.error('디바이스 등록 오류:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    })
  }
})

/**
 * GET /api/devices
 * 웹앱에서 호출: 현재 매장의 등록된 디바이스 목록
 */
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
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

    const devices = await DeviceService.getDevicesByStore(storeId)

    res.json({
      success: true,
      devices: devices.map(d => ({
        id: d.id,
        deviceId: d.device_id,
        displayLabel: normDisplayLabel(d.display_label),
        status: d.status,
        isOnline: !!(d as any).is_online,
        lastSeenAt: d.last_seen_at,
        ipAddress: d.ip_address
      }))
    })
  } catch (error) {
    console.error('디바이스 목록 조회 오류:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    })
  }
})

/**
 * GET /api/devices/online
 * 웹앱에서 호출: 현재 온라인 상태인 디바이스 목록
 */
router.get('/online', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
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

    const devices = await DeviceService.getOnlineDevicesByStore(storeId)

    res.json({
      success: true,
      devices: devices.map(d => ({
        id: d.id,
        deviceId: d.device_id,
        displayLabel: normDisplayLabel(d.display_label),
        status: d.status,
        lastSeenAt: d.last_seen_at,
        ipAddress: d.ip_address
      }))
    })
  } catch (error) {
    console.error('온라인 디바이스 조회 오류:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    })
  }
})

/**
 * PUT /api/devices/:id/label
 * 디바이스 표시 이름 변경
 */
router.put('/:id/label', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user
    if (!user) {
      return res.status(401).json({ success: false, error: '인증이 필요합니다' })
    }

    const deviceId = parseInt(req.params.id)
    const { displayLabel } = req.body

    if (!displayLabel || typeof displayLabel !== 'string') {
      return res.status(400).json({
        success: false,
        error: '표시 이름이 필요합니다'
      })
    }

    await DeviceService.updateDisplayLabel(deviceId, displayLabel.trim())

    res.json({
      success: true,
      message: '디바이스 이름이 변경되었습니다'
    })
  } catch (error) {
    console.error('디바이스 이름 변경 오류:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    })
  }
})

/**
 * DELETE /api/devices/:id
 * 디바이스 삭제 (연결 해제)
 */
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user
    if (!user) {
      return res.status(401).json({ success: false, error: '인증이 필요합니다' })
    }

    const numericId = parseInt(req.params.id, 10)
    if (Number.isNaN(numericId)) {
      return res.status(400).json({ success: false, error: '유효하지 않은 디바이스 ID입니다' })
    }

    const existing = await DeviceService.getDeviceByNumericId(numericId)
    if (!existing) {
      return res.status(404).json({ success: false, error: '디바이스를 찾을 수 없습니다' })
    }

    if (!canUserModifyDeviceForStore(user, existing.store_id)) {
      return res.status(403).json({ success: false, error: '이 디바이스를 삭제할 권한이 없습니다' })
    }

    await DeviceService.deleteDevice(numericId)

    res.json({
      success: true,
      message: '디바이스가 삭제되었습니다'
    })
  } catch (error) {
    console.error('디바이스 삭제 오류:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    })
  }
})

/**
 * POST /api/devices/validate-token
 * Electron에서 호출: deviceToken 유효성 검증
 */
router.post('/validate-token', async (req: Request, res: Response) => {
  try {
    const { deviceToken } = req.body

    if (!deviceToken || typeof deviceToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'deviceToken이 필요합니다'
      })
    }

    const device = await DeviceService.getDeviceByToken(deviceToken)

    if (!device) {
      return res.status(401).json({
        success: false,
        error: '유효하지 않은 토큰입니다'
      })
    }

    // 마지막 연결 시간 업데이트
    const clientIp = req.ip || req.socket.remoteAddress
    await DeviceService.updateLastSeen(device.device_id, clientIp)

    res.json({
      success: true,
      device: {
        id: device.id,
        deviceId: device.device_id,
        storeId: device.store_id,
        displayLabel: normDisplayLabel(device.display_label),
        status: device.status
      }
    })
  } catch (error) {
    console.error('토큰 검증 오류:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    })
  }
})

/**
 * POST /api/devices/heartbeat
 * Electron에서 주기적으로 호출: 연결 상태 유지
 */
router.post('/heartbeat', async (req: Request, res: Response) => {
  try {
    const { deviceToken } = req.body

    if (!deviceToken || typeof deviceToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'deviceToken이 필요합니다'
      })
    }

    const device = await DeviceService.getDeviceByToken(deviceToken)

    if (!device) {
      return res.status(401).json({
        success: false,
        error: '유효하지 않은 토큰입니다'
      })
    }

    const clientIp = req.ip || req.socket.remoteAddress
    await DeviceService.updateLastSeen(device.device_id, clientIp)

    res.json({
      success: true,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('하트비트 오류:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    })
  }
})

export default router
