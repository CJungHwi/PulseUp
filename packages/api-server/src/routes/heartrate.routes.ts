/**
 * 소스 요약 — 운동 심박수 API 라우트
 *
 * 기능: 실시간/배치 심박수 저장, 운동 세션별 회원-심박계 매핑 등록/조회/해제,
 *       참가자별 심박 요약 조회 엔드포인트를 제공한다.
 *
 * 호출/연동: `HeartRateService`, `heartRate.schema`, `authenticateToken`,
 *           `requireBranchAdminOrAbove`, `sp_insert_heart_rate_data`.
 *
 * 흐름: 인증/권한 확인 → 요청 검증 → 매핑 기반 저장 또는 참가자 조회 → JSON 응답.
 */

import { Router } from 'express'
import { HeartRateService } from '../services/heartrate.service.js'
import { authenticateToken as authMiddleware } from '../middleware/auth.middleware.js'
import { requireBranchAdminOrAbove, type AdminRequest } from '../middleware/admin.middleware.js'
import { validateRequest } from '../middleware/validation.middleware.js'
import {
  heartRateParticipantParamsSchema,
  heartRateWorkoutParamsSchema,
  saveBatchHeartRateSchema,
  saveSingleHeartRateSchema,
  upsertHeartRateParticipantsSchema,
} from '../schemas/heartRate.schema.js'
import { ResponseUtil } from '../utils/response.util.js'

const router = Router()
const heartRateService = new HeartRateService()

// 배치 심박수 저장 (ANT+ Electron에서 호출)
router.post('/save-batch', authMiddleware, validateRequest({ body: saveBatchHeartRateSchema }), async (req, res, next) => {
  try {
    const user = (req as any).user
    const { workoutHistoryMasterId, heartRateData } = req.body
    const userId = user?.id

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: '로그인이 필요합니다'
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
router.post('/data', authMiddleware, validateRequest({ body: saveSingleHeartRateSchema }), async (req, res, next) => {
  try {
    const { workout_history_master_id, device_id, device_name, heart_rate, timestamp, zone, slot_number } = req.body
    const user = (req as any).user

    if (!user?.id) {
      return res.status(400).json({ error: '로그인이 필요합니다' })
    }

    const result = await heartRateService.saveHeartRateData({
      user_id: user.id,
      workout_history_master_id,
      device_id,
      device_name,
      heart_rate,
      timestamp: new Date(timestamp),
      zone,
      slot_number
    })

    res.json(result)
  } catch (error) {
    next(error)
  }
})

router.get(
  '/workouts/:workoutHistoryMasterId/participants',
  authMiddleware,
  requireBranchAdminOrAbove as any,
  validateRequest({ params: heartRateWorkoutParamsSchema }),
  async (req: AdminRequest, res) => {
    try {
      const participants = await heartRateService.listParticipants(req.params.workoutHistoryMasterId)
      return ResponseUtil.success(res, { participants }, '심박 참가자 매핑을 조회했습니다.')
    } catch (error) {
      console.error('GET /heart-rate/workouts/:id/participants error:', error)
      return ResponseUtil.internalError(res, '심박 참가자 매핑 조회에 실패했습니다.')
    }
  }
)

router.post(
  '/workouts/:workoutHistoryMasterId/participants',
  authMiddleware,
  requireBranchAdminOrAbove as any,
  validateRequest({ params: heartRateWorkoutParamsSchema, body: upsertHeartRateParticipantsSchema }),
  async (req: AdminRequest, res) => {
    try {
      const participants = await heartRateService.upsertParticipants(
        req.params.workoutHistoryMasterId,
        req.body.participants
      )
      return ResponseUtil.success(res, { participants }, '심박 참가자 매핑을 저장했습니다.')
    } catch (error) {
      console.error('POST /heart-rate/workouts/:id/participants error:', error)
      return ResponseUtil.badRequest(
        res,
        error instanceof Error ? error.message : '심박 참가자 매핑 저장에 실패했습니다.'
      )
    }
  }
)

router.delete(
  '/workouts/:workoutHistoryMasterId/participants/:participantId',
  authMiddleware,
  requireBranchAdminOrAbove as any,
  validateRequest({ params: heartRateParticipantParamsSchema }),
  async (req: AdminRequest, res) => {
    try {
      const removed = await heartRateService.deactivateParticipant(
        req.params.workoutHistoryMasterId,
        req.params.participantId
      )
      if (!removed) return ResponseUtil.notFound(res, '해제할 심박 참가자 매핑을 찾을 수 없습니다.')
      return ResponseUtil.success(res, null, '심박 참가자 매핑을 해제했습니다.')
    } catch (error) {
      console.error('DELETE /heart-rate/workouts/:id/participants/:participantId error:', error)
      return ResponseUtil.internalError(res, '심박 참가자 매핑 해제에 실패했습니다.')
    }
  }
)

router.get(
  '/workouts/:workoutHistoryMasterId/participants/summary',
  authMiddleware,
  requireBranchAdminOrAbove as any,
  validateRequest({ params: heartRateWorkoutParamsSchema }),
  async (req: AdminRequest, res) => {
    try {
      const participants = await heartRateService.getParticipantsSummary(req.params.workoutHistoryMasterId)
      return ResponseUtil.success(res, { participants }, '참가자별 심박 요약을 조회했습니다.')
    } catch (error) {
      console.error('GET /heart-rate/workouts/:id/participants/summary error:', error)
      return ResponseUtil.internalError(res, '참가자별 심박 요약 조회에 실패했습니다.')
    }
  }
)

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
