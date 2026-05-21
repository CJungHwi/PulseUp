import { Router } from 'express'
import { BluetoothService } from '../services/bluetooth.service.js'
import { authenticateToken as authMiddleware } from '../middleware/auth.middleware.js'

const router = Router()
const bluetoothService = new BluetoothService()

// 블루투스 기기 등록
router.post('/devices', authMiddleware, async (req, res, next) => {
  try {
    const { device_id, device_name, device_type, manufacturer, model, notes } = req.body
    const user = (req as any).user

    if (!user.branchId) {
      return res.status(400).json({ error: '지점 정보가 없습니다' })
    }

    const result = await bluetoothService.registerDevice({
      branch_id: user.branchId,
      device_id,
      device_name,
      device_type,
      manufacturer,
      model,
      notes
    })

    res.json(result)
  } catch (error) {
    next(error)
  }
})

// 블루투스 기기 목록 조회
router.get('/devices', authMiddleware, async (req, res, next) => {
  try {
    const user = (req as any).user
    const { is_active } = req.query

    const devices = await bluetoothService.getDevices(
      user.branchId || null,
      is_active === 'true' ? true : is_active === 'false' ? false : null
    )

    res.json(devices)
  } catch (error) {
    next(error)
  }
})

// 블루투스 기기 삭제
router.delete('/devices', authMiddleware, async (req, res, next) => {
  try {
    const { device_ids } = req.body

    if (!device_ids || !Array.isArray(device_ids) || device_ids.length === 0) {
      return res.status(400).json({ error: '삭제할 기기를 선택해주세요' })
    }

    const result = await bluetoothService.deleteDevices(device_ids)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

// 블루투스 기기 연결 상태 업데이트
router.patch('/devices/:device_id/connection', authMiddleware, async (req, res, next) => {
  try {
    const { device_id } = req.params
    const user = (req as any).user

    const result = await bluetoothService.updateDeviceConnection(device_id, user.id)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

export default router

