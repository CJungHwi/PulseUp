import { Router } from 'express'
import { HeartRateService } from '../services/heartrate.service.js'
import { authenticateToken as authMiddleware } from '../middleware/auth.middleware.js'

const router = Router()
const heartRateService = new HeartRateService()

// 배치 심박수 저장 (ANT+ Electron에서 호출)
router.post('/save-batch', authMiddleware, async (req, res, next) => {
  try {
    const user = (req as any).user
    const { workoutHistoryMasterId, heartRateData } = req.body
    const userId = user?.id

    if (!userId || !workoutHistoryMasterId || !heartRateData || !Array.isArray(heartRateData)) {
      return res.status(400).json({
        success: false,
        error: '필수 파라미터가 누락되었습니다'
      })
    }

    console.log(`📊 심박수 배치 저장 요청: ${heartRateData.length}개 (User: ${userId}, Master: ${workoutHistoryMasterId})`)

    const result = await heartRateService.saveBatchHeartRateData(
      userId,
      workoutHistoryMasterId,
      heartRateData
    )

    res.json(result)
  } catch (error) {
    console.error('❌ 심박수 배치 저장 실패:', error)
    next(error)
  }
})

// 실시간 심박수 저장 (단일)
router.post('/data', authMiddleware, async (req, res, next) => {
  try {
    const { workout_history_master_id, device_id, device_name, heart_rate, timestamp, zone } = req.body
    const user = (req as any).user

    if (!workout_history_master_id || !device_id || !device_name || !heart_rate || !timestamp) {
      return res.status(400).json({ error: '필수 파라미터가 누락되었습니다' })
    }

    const result = await heartRateService.saveHeartRateData({
      user_id: user.id,
      workout_history_master_id,
      device_id,
      device_name,
      heart_rate,
      timestamp: new Date(timestamp),
      zone
    })

    res.json(result)
  } catch (error) {
    next(error)
  }
})

// 운동 세션별 심박수 데이터 조회
router.get('/workout/:workout_history_master_id', authMiddleware, async (req, res, next) => {
  try {
    const { workout_history_master_id } = req.params
    const user = (req as any).user

    const data = await heartRateService.getWorkoutHeartRateData(
      user.id,
      workout_history_master_id
    )

    res.json(data)
  } catch (error) {
    next(error)
  }
})

// 심박수 통계 조회
router.get('/workout/:workout_history_master_id/stats', authMiddleware, async (req, res, next) => {
  try {
    const { workout_history_master_id } = req.params
    const user = (req as any).user

    const stats = await heartRateService.getHeartRateStats(
      user.id,
      workout_history_master_id
    )

    res.json(stats)
  } catch (error) {
    next(error)
  }
})

// 심박수 임계값 설정 조회
router.get('/threshold', async (req, res, next) => {
  try {
    const threshold = await heartRateService.getHeartRateThreshold()
    res.json({ threshold })
  } catch (error) {
    next(error)
  }
})

export default router
