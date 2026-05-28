import { z } from 'zod'

/**
 * 소스 요약 — 수업예약 요청 검증 스키마
 *
 * 기능: 수업 슬롯 생성/수정, 사용자 예약 생성/변경 요청의 입력값을 검증한다.
 *
 * 호출/연동: `classSlots.routes`, `classBookings.routes`.
 *
 * 관련 컴포넌트: Express validation middleware, `ClassBookingService`.
 *
 * 흐름: HTTP 요청 → zod 스키마 검증 → 서비스 레이어 비즈니스 검증.
 */

const isoDateTimeSchema = z.string().min(1, '일시 값은 필수입니다').refine((value) => {
  const time = new Date(value).getTime()
  return Number.isFinite(time)
}, '유효한 일시 형식이 아닙니다')

const branchIdSchema = z.union([z.string().min(1), z.number().int().positive()]).optional()

export const classSlotRangeQuerySchema = z.object({
  start: isoDateTimeSchema.optional(),
  end: isoDateTimeSchema.optional(),
  branchId: branchIdSchema,
})

export const classSlotParamsSchema = z.object({
  id: z.string().uuid('유효한 수업 ID가 필요합니다'),
})

const classSlotBaseSchema = z.object({
  branchId: branchIdSchema,
  workoutCategoryId: z.string().uuid('운동 대분류를 선택해주세요'),
  title: z.string().trim().min(1, '수업명을 입력해주세요').max(255, '수업명은 255자를 초과할 수 없습니다'),
  startAt: isoDateTimeSchema,
  endAt: isoDateTimeSchema,
  capacity: z.coerce.number().int().min(1, '정원은 1명 이상이어야 합니다').max(999, '정원은 999명을 초과할 수 없습니다'),
  recurrenceRule: z.string().trim().max(255).nullable().optional(),
})

export const createClassSlotSchema = classSlotBaseSchema.refine((data) => new Date(data.startAt).getTime() < new Date(data.endAt).getTime(), {
  path: ['endAt'],
  message: '종료 시간은 시작 시간보다 늦어야 합니다',
})

export const updateClassSlotSchema = classSlotBaseSchema.partial().refine(
  (data) => Object.keys(data).some((key) => key !== 'branchId'),
  '수정할 값이 필요합니다'
).refine((data) => {
  if (!data.startAt || !data.endAt) return true
  return new Date(data.startAt).getTime() < new Date(data.endAt).getTime()
}, {
  path: ['endAt'],
  message: '종료 시간은 시작 시간보다 늦어야 합니다',
})

export const createClassBookingSchema = z.object({
  slotId: z.string().uuid('예약할 수업을 선택해주세요'),
})

export const updateClassBookingSchema = z.object({
  slotId: z.string().uuid('변경할 수업을 선택해주세요'),
})

export const classBookingParamsSchema = z.object({
  id: z.string().uuid('유효한 예약 ID가 필요합니다'),
})

export const attendanceStatusSchema = z.enum(['reserved', 'attended', 'noshow'], {
  errorMap: () => ({ message: '출석 상태는 reserved, attended, noshow 중 하나여야 합니다' }),
})

export const updateAttendanceSchema = z.object({
  status: attendanceStatusSchema,
})

export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>
export type CreateClassSlotRequest = z.infer<typeof createClassSlotSchema>
export type UpdateClassSlotRequest = z.infer<typeof updateClassSlotSchema>
export type CreateClassBookingRequest = z.infer<typeof createClassBookingSchema>
export type UpdateClassBookingRequest = z.infer<typeof updateClassBookingSchema>
export type UpdateAttendanceRequest = z.infer<typeof updateAttendanceSchema>
