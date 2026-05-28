/**
 * 소스 요약 — 수업 슬롯 API 라우트
 *
 * 기능: 지점별 수업 슬롯 목록 조회, 지점관리자 슬롯 등록/수정/삭제, 슬롯별 예약자 목록 조회 HTTP 엔드포인트를 제공한다.
 *
 * 호출/연동: `ClassBookingService`, `classBooking.schema`, `authenticateToken`, `requireBranchAdminOrAbove`.
 *
 * 관련 컴포넌트: 수업예약 관리 화면, 수업예약 화면, 내 수업예약 변경 화면.
 *
 * 흐름: 인증/권한 확인 → 요청 검증 → 지점 스코프 산정 → 서비스 호출 → JSON 응답.
 */

import { Router } from 'express'
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.middleware.js'
import { requireBranchAdminOrAbove, type AdminRequest } from '../middleware/admin.middleware.js'
import { validateRequest } from '../middleware/validation.middleware.js'
import {
  classSlotParamsSchema,
  classSlotRangeQuerySchema,
  createClassSlotSchema,
  updateClassSlotSchema,
} from '../schemas/classBooking.schema.js'
import { ClassBookingService } from '../services/classBooking.service.js'

const router = Router()

const getScopedBranchId = (req: AuthenticatedRequest | AdminRequest) => {
  if (req.user?.role === 'super_admin') {
    return (req.query.branchId as string | undefined) || req.user?.branchId
  }
  return req.user?.branchId
}

router.get('/', authenticateToken, validateRequest({ query: classSlotRangeQuerySchema }), async (req: AuthenticatedRequest, res) => {
  try {
    const branchId = getScopedBranchId(req)
    if (!branchId) return res.status(400).json({ success: false, error: '지점 정보가 필요합니다' })

    const slots = await ClassBookingService.listSlots({
      branchId,
      start: req.query.start as string | undefined,
      end: req.query.end as string | undefined
    })
    res.json({ success: true, data: { slots } })
  } catch (error) {
    console.error('GET /class-slots error:', error)
    res.status(500).json({ success: false, error: '수업 목록 조회에 실패했습니다' })
  }
})

router.post('/', authenticateToken, requireBranchAdminOrAbove as any, validateRequest({ body: createClassSlotSchema }), async (req: AdminRequest, res) => {
  try {
    const branchId = req.user.role === 'super_admin' ? req.body.branchId : req.user.branchId
    if (!branchId) return res.status(400).json({ success: false, error: '지점 정보가 필요합니다' })

    const { workoutCategoryId, title, startAt, endAt, capacity, recurrenceRule } = req.body
    if (!workoutCategoryId || !title || !startAt || !endAt) {
      return res.status(400).json({ success: false, error: '필수 값이 누락되었습니다' })
    }

    const slot = await ClassBookingService.createSlot({
      branchId,
      workoutCategoryId,
      title,
      startAt,
      endAt,
      capacity: Number(capacity || 1),
      recurrenceRule,
      createdBy: req.user.id
    })

    res.status(201).json({ success: true, data: { slot } })
  } catch (error) {
    console.error('POST /class-slots error:', error)
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : '수업 생성에 실패했습니다' })
  }
})

router.patch('/:id', authenticateToken, requireBranchAdminOrAbove as any, validateRequest({ params: classSlotParamsSchema, body: updateClassSlotSchema }), async (req: AdminRequest, res) => {
  try {
    const branchId = req.user.role === 'super_admin' ? req.body.branchId || req.user.branchId : req.user.branchId
    if (!branchId) return res.status(400).json({ success: false, error: '지점 정보가 필요합니다' })

    const slot = await ClassBookingService.updateSlot(req.params.id, {
      branchId,
      workoutCategoryId: req.body.workoutCategoryId,
      title: req.body.title,
      startAt: req.body.startAt,
      endAt: req.body.endAt,
      capacity: req.body.capacity,
      recurrenceRule: req.body.recurrenceRule,
    })

    res.json({ success: true, data: { slot } })
  } catch (error) {
    console.error('PATCH /class-slots/:id error:', error)
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : '수업 수정에 실패했습니다' })
  }
})

router.get('/:id/bookings', authenticateToken, requireBranchAdminOrAbove as any, validateRequest({ params: classSlotParamsSchema }), async (req: AdminRequest, res) => {
  try {
    const branchId = req.user.role === 'super_admin' ? (req.query.branchId as string | undefined) || req.user.branchId : req.user.branchId
    if (!branchId) return res.status(400).json({ success: false, error: '지점 정보가 필요합니다' })

    const bookings = await ClassBookingService.listSlotBookings(req.params.id, branchId)
    res.json({ success: true, data: { bookings } })
  } catch (error) {
    console.error('GET /class-slots/:id/bookings error:', error)
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : '예약자 목록 조회에 실패했습니다' })
  }
})

router.delete('/:id', authenticateToken, requireBranchAdminOrAbove as any, validateRequest({ params: classSlotParamsSchema }), async (req: AdminRequest, res) => {
  try {
    const branchId = req.user.role === 'super_admin' ? req.query.branchId || req.user.branchId : req.user.branchId
    if (!branchId) return res.status(400).json({ success: false, error: '지점 정보가 필요합니다' })

    const deleted = await ClassBookingService.cancelSlot(req.params.id, String(branchId))
    if (!deleted) return res.status(404).json({ success: false, error: '수업을 찾을 수 없습니다' })
    res.json({ success: true })
  } catch (error) {
    console.error('DELETE /class-slots/:id error:', error)
    res.status(500).json({ success: false, error: '수업 삭제에 실패했습니다' })
  }
})

export default router
