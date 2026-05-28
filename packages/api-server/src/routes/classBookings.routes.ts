/**
 * 소스 요약 — 수업예약 API 라우트
 *
 * 기능: 내 수업예약 조회, 수업 예약 생성, 예약 변경, 예약 취소, 지점관리자 출석 상태 변경 HTTP 엔드포인트를 제공한다.
 *
 * 호출/연동: `ClassBookingService`, `classBooking.schema`, `authenticateToken`, `requireBranchAdminOrAbove`.
 *
 * 관련 컴포넌트: 수업예약 화면, 내 수업예약 화면.
 *
 * 흐름: 인증 확인 → 요청 검증 → 소속 지점 확인 → 예약 서비스 호출 → JSON 응답.
 */

import { Router } from 'express'
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.middleware.js'
import { requireBranchAdminOrAbove, type AdminRequest } from '../middleware/admin.middleware.js'
import { validateRequest } from '../middleware/validation.middleware.js'
import {
  classBookingParamsSchema,
  createClassBookingSchema,
  updateAttendanceSchema,
  updateClassBookingSchema,
} from '../schemas/classBooking.schema.js'
import { ClassBookingService } from '../services/classBooking.service.js'

const router = Router()

router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: '인증이 필요합니다' })
    const bookings = await ClassBookingService.listMyBookings(req.user.id)
    res.json({ success: true, data: { bookings } })
  } catch (error) {
    console.error('GET /class-bookings/me error:', error)
    res.status(500).json({ success: false, error: '내 예약 조회에 실패했습니다' })
  }
})

router.post('/', authenticateToken, validateRequest({ body: createClassBookingSchema }), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: '인증이 필요합니다' })
    if (!req.user.branchId) return res.status(400).json({ success: false, error: '소속 지점 정보가 없습니다' })
    const { slotId } = req.body
    if (!slotId) return res.status(400).json({ success: false, error: 'slotId가 필요합니다' })

    await ClassBookingService.createBooking(slotId, req.user.id, req.user.branchId)
    res.status(201).json({ success: true })
  } catch (error) {
    console.error('POST /class-bookings error:', error)
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : '예약에 실패했습니다' })
  }
})

router.patch('/:id', authenticateToken, validateRequest({ params: classBookingParamsSchema, body: updateClassBookingSchema }), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: '인증이 필요합니다' })
    if (!req.user.branchId) return res.status(400).json({ success: false, error: '소속 지점 정보가 없습니다' })

    await ClassBookingService.changeBooking(req.params.id, req.body.slotId, req.user.id, req.user.branchId)
    res.json({ success: true })
  } catch (error) {
    console.error('PATCH /class-bookings/:id error:', error)
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : '예약 변경에 실패했습니다' })
  }
})

router.patch(
  '/:id/attendance',
  authenticateToken,
  requireBranchAdminOrAbove as any,
  validateRequest({ params: classBookingParamsSchema, body: updateAttendanceSchema }),
  async (req: AdminRequest, res) => {
    try {
      const branchId = req.user.role === 'super_admin' ? (req.body.branchId as string | undefined) || req.user.branchId : req.user.branchId
      if (!branchId) return res.status(400).json({ success: false, error: '지점 정보가 필요합니다' })

      await ClassBookingService.updateBookingAttendance(req.params.id, branchId, req.body.status)
      res.json({ success: true })
    } catch (error) {
      console.error('PATCH /class-bookings/:id/attendance error:', error)
      res.status(400).json({ success: false, error: error instanceof Error ? error.message : '출석 상태 변경에 실패했습니다' })
    }
  }
)

router.delete('/:id', authenticateToken, validateRequest({ params: classBookingParamsSchema }), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: '인증이 필요합니다' })
    const cancelled = await ClassBookingService.cancelBooking(req.params.id, req.user.id)
    if (!cancelled) return res.status(404).json({ success: false, error: '취소 가능한 예약을 찾을 수 없습니다' })
    res.json({ success: true })
  } catch (error) {
    console.error('DELETE /class-bookings/:id error:', error)
    res.status(500).json({ success: false, error: '예약 취소에 실패했습니다' })
  }
})

export default router
