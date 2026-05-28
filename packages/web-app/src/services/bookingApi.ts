/**
 * 소스 요약 — 수업예약 API 서비스
 *
 * 기능: 수업 슬롯 조회/등록/수정/삭제, 사용자 예약/변경/취소, 슬롯 예약자 목록 조회 및 출석 상태 변경 API 호출을 캡슐화한다.
 *
 * 호출/연동: `/api/class-slots`, `/api/class-bookings`.
 *
 * 관련 컴포넌트: `ClassBookingManagement`, `ClassBookingCalendar`, `MyBookings`.
 *
 * 흐름: 화면 요청 → API 파라미터 직렬화 → 응답 데이터 타입 정규화.
 */

import { apiClient } from './api.service'

export type BookingStatus = 'reserved' | 'cancelled' | 'attended' | 'noshow'
export type AttendanceStatus = 'reserved' | 'attended' | 'noshow'

export interface ClassSlot {
  id: string
  branch_id: number
  workout_category_id: string
  title: string
  start_at: string
  end_at: string
  capacity: number
  recurrence_rule?: string | null
  major_category?: string
  major_category_name?: string
  reserved_count: number
  attended_count?: number
  noshow_count?: number
}

export interface ClassSlotBooking {
  id: string
  slot_id: string
  user_id: string
  branch_id: number
  status: BookingStatus
  reserved_at: string
  cancelled_at?: string | null
  userid: string
  name: string
  email: string
}

export interface ClassBooking {
  id: string
  slot_id: string
  status: BookingStatus
  title: string
  start_at: string
  end_at: string
  capacity?: number
  major_category?: string
  major_category_name?: string
}

export interface ClassSlotPayload {
  branchId?: string
  workoutCategoryId: string
  title: string
  startAt: string
  endAt: string
  capacity: number
  recurrenceRule?: string | null
}

export const bookingApi = {
  async getSlots(params?: { start?: string; end?: string; branchId?: string }) {
    const response = await apiClient.get('/class-slots', { params })
    return response.data.data.slots as ClassSlot[]
  },

  async createSlot(data: ClassSlotPayload) {
    const response = await apiClient.post('/class-slots', data)
    return response.data.data.slot as ClassSlot
  },

  async updateSlot(slotId: string, data: Partial<ClassSlotPayload>) {
    const response = await apiClient.patch(`/class-slots/${slotId}`, data)
    return response.data.data.slot as ClassSlot
  },

  async deleteSlot(slotId: string, branchId?: string) {
    await apiClient.delete(`/class-slots/${slotId}`, { params: { branchId } })
  },

  async getMyBookings() {
    const response = await apiClient.get('/class-bookings/me')
    return response.data.data.bookings as ClassBooking[]
  },

  async reserve(slotId: string) {
    await apiClient.post('/class-bookings', { slotId })
  },

  async changeBooking(bookingId: string, slotId: string) {
    await apiClient.patch(`/class-bookings/${bookingId}`, { slotId })
  },

  async cancel(bookingId: string) {
    await apiClient.delete(`/class-bookings/${bookingId}`)
  },

  async getSlotBookings(slotId: string) {
    const response = await apiClient.get(`/class-slots/${slotId}/bookings`)
    return response.data.data.bookings as ClassSlotBooking[]
  },

  async updateBookingAttendance(bookingId: string, status: AttendanceStatus) {
    await apiClient.patch(`/class-bookings/${bookingId}/attendance`, { status })
  },
}
