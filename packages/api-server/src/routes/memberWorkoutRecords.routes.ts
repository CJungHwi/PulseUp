/**
 * 소스 요약 — 회원 운동기록 API 라우트
 *
 * 기능: 지점 회원 본인의 수업 예약/출석, 운동일, 심박 그래프, 인바디 최신 현황 조회 엔드포인트를 제공한다.
 *
 * 호출/연동: `MemberWorkoutRecordsService`, `memberWorkoutRecords.schema`, `authenticateToken`.
 *
 * 관련 화면: `MemberWorkoutRecords` 사용자 운동기록 종합 화면.
 *
 * 흐름: 인증 확인 → 쿼리/파라미터 검증 → 본인 사용자 ID 기준 서비스 조회 → JSON 응답.
 */

import { Router } from 'express'
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.middleware.js'
import { validateRequest } from '../middleware/validation.middleware.js'
import {
  memberWorkoutHistoryParamsSchema,
  memberWorkoutRecordsOverviewQuerySchema,
} from '../schemas/memberWorkoutRecords.schema.js'
import { MemberWorkoutRecordsService } from '../services/memberWorkoutRecords.service.js'
import { ResponseUtil } from '../utils/response.util.js'

const router = Router()

router.get(
  '/overview',
  authenticateToken,
  validateRequest({ query: memberWorkoutRecordsOverviewQuerySchema }),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) return ResponseUtil.unauthorized(res, '로그인이 필요합니다.')

      const overview = await MemberWorkoutRecordsService.getOverview(
        req.user.id,
        req.query.month as string | undefined
      )

      return ResponseUtil.success(res, overview, '회원 운동기록을 조회했습니다.')
    } catch (error) {
      console.error('GET /member-workout-records/overview error:', error)
      return ResponseUtil.internalError(res, '회원 운동기록 조회에 실패했습니다.')
    }
  }
)

router.get(
  '/workouts/:workoutHistoryMasterId/heart-rate',
  authenticateToken,
  validateRequest({ params: memberWorkoutHistoryParamsSchema }),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) return ResponseUtil.unauthorized(res, '로그인이 필요합니다.')

      const detail = await MemberWorkoutRecordsService.getWorkoutHeartRate(
        req.user.id,
        req.params.workoutHistoryMasterId
      )

      if (!detail) return ResponseUtil.notFound(res, '운동기록을 찾을 수 없습니다.')
      return ResponseUtil.success(res, detail, '심박 기록을 조회했습니다.')
    } catch (error) {
      console.error('GET /member-workout-records/workouts/:id/heart-rate error:', error)
      return ResponseUtil.internalError(res, '심박 기록 조회에 실패했습니다.')
    }
  }
)

export default router
