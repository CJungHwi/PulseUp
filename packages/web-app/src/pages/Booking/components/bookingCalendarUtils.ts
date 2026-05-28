/**
 * 소스 요약 — 수업예약 캘린더 유틸
 *
 * 기능: 월간 캘린더 날짜 계산, 수업/예약 표시 포맷을 제공한다.
 *
 * 호출/연동: `ClassBookingManagement`, `ClassBookingCalendar`, `MyBookings`, `BookingMonthCalendar`, `SlotFormDialog`.
 *
 * 관련 컴포넌트: 수업예약 공통 캘린더와 슬롯 등록/수정 다이얼로그.
 *
 * 흐름: 페이지 상태 → 날짜/슬롯 데이터 정규화 → 캘린더 UI 렌더링.
 */

import type { ClassBooking, ClassSlot } from '../../../services/bookingApi'

export interface CalendarDay {
  date: Date
  key: string
  dayOfMonth: number
  isCurrentMonth: boolean
  isToday: boolean
}

export const getMonthRange = (month: string) => {
  const [year, monthIndex] = month.split('-').map(Number)
  const start = new Date(year, monthIndex - 1, 1, 0, 0, 0)
  const end = new Date(year, monthIndex, 0, 23, 59, 59)
  return { start: start.toISOString(), end: end.toISOString() }
}

export const toMonthValue = (date = new Date()) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  return `${year}-${month}`
}

export const toDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export const toDateTimeLocalValue = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

export const createDefaultSlotTimes = (date: Date) => {
  const start = new Date(date)
  start.setHours(9, 0, 0, 0)
  const end = new Date(start)
  end.setHours(start.getHours() + 1)
  return {
    startAt: toDateTimeLocalValue(start),
    endAt: toDateTimeLocalValue(end),
  }
}

export const buildCalendarDays = (month: string): CalendarDay[] => {
  const [year, monthIndex] = month.split('-').map(Number)
  const firstDay = new Date(year, monthIndex - 1, 1)
  const start = new Date(firstDay)
  start.setDate(firstDay.getDate() - firstDay.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const todayKey = toDateKey(new Date())
    const key = toDateKey(date)

    return {
      date,
      key,
      dayOfMonth: date.getDate(),
      isCurrentMonth: date.getMonth() === monthIndex - 1,
      isToday: key === todayKey,
    }
  })
}

export const getRemainingCapacity = (slot: ClassSlot) => (
  Math.max(0, Number(slot.capacity) - Number(slot.reserved_count || 0))
)

export const isPastStart = (startAt: string) => new Date(startAt).getTime() <= Date.now()

export const formatDateTime = (value: string) => (
  new Date(value).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
)

export const formatTimeRange = (startAt: string, endAt: string) => {
  const start = new Date(startAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  const end = new Date(endAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  return `${start} - ${end}`
}

export const getSlotCategoryLabel = (slot: ClassSlot) => slot.major_category_name || slot.major_category || '-'

export const getBookingCategoryLabel = (booking: ClassBooking) => booking.major_category_name || booking.major_category || '-'

export const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { error?: string; message?: string } } }).response
    return response?.data?.error || response?.data?.message || fallback
  }

  return error instanceof Error ? error.message : fallback
}
