/**
 * 페이지 요약 — 내 수업예약 (`/account/bookings`)
 *
 * 기능: 지점사용자가 자신의 예약을 월간 캘린더에서 확인하고, 시작 전 예약을 다른 수업으로 변경하거나 취소한다.
 *
 * 호출/연동: `bookingApi.getMyBookings/getSlots/changeBooking/cancel`.
 *
 * 관련 컴포넌트: `BookingMonthCalendar`, `MyBookingDetailDialog`.
 *
 * 흐름: 월 범위 계산 → 내 예약/예약 가능 슬롯 병렬 조회 → 예약 선택 → 상세 다이얼로그에서 변경 또는 취소 → 재조회.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSnackbar } from '../../contexts/SnackbarContext'
import { bookingApi, type ClassBooking, type ClassSlot } from '../../services/bookingApi'
import BookingMonthCalendar from './components/BookingMonthCalendar'
import MyBookingDetailDialog from './components/MyBookingDetailDialog'
import {
  getApiErrorMessage,
  getMonthRange,
  getRemainingCapacity,
  isPastStart,
  toMonthValue,
} from './components/bookingCalendarUtils'

export const MyBookings: React.FC = () => {
  const { showSnackbar } = useSnackbar()
  const [month, setMonth] = useState(() => toMonthValue())
  const [bookings, setBookings] = useState<ClassBooking[]>([])
  const [slots, setSlots] = useState<ClassSlot[]>([])
  const [selectedBooking, setSelectedBooking] = useState<ClassBooking | null>(null)
  const [selectedSlotId, setSelectedSlotId] = useState('')
  const [loading, setLoading] = useState(false)

  const range = useMemo(() => getMonthRange(month), [month])
  const reservedBookings = useMemo(() => (
    bookings.filter((booking) => booking.status === 'reserved')
  ), [bookings])
  const changeableSlots = useMemo(() => {
    if (!selectedBooking) return []

    return slots.filter((slot) => (
      slot.id !== selectedBooking.slot_id &&
      getRemainingCapacity(slot) > 0 &&
      !isPastStart(slot.start_at)
    ))
  }, [selectedBooking, slots])
  const canModify = selectedBooking?.status === 'reserved' && !isPastStart(selectedBooking.start_at)

  const loadBookings = useCallback(async () => {
    setLoading(true)
    try {
      const [nextBookings, nextSlots] = await Promise.all([
        bookingApi.getMyBookings(),
        bookingApi.getSlots(range),
      ])
      setBookings(nextBookings)
      setSlots(nextSlots)
    } catch (error) {
      showSnackbar({ message: getApiErrorMessage(error, '내 수업예약을 불러오지 못했습니다.'), severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [range, showSnackbar])

  useEffect(() => {
    loadBookings()
  }, [loadBookings])

  const handleCloseDetail = () => {
    setSelectedBooking(null)
    setSelectedSlotId('')
  }

  const handleSelectBooking = (booking: ClassBooking) => {
    setSelectedBooking(booking)
    setSelectedSlotId('')
  }

  const handleCancelBooking = async () => {
    if (!selectedBooking) return

    try {
      await bookingApi.cancel(selectedBooking.id)
      showSnackbar({ message: '예약이 취소되었습니다.', severity: 'success' })
      handleCloseDetail()
      await loadBookings()
    } catch (error) {
      showSnackbar({ message: getApiErrorMessage(error, '예약 취소에 실패했습니다.'), severity: 'error' })
    }
  }

  const handleChangeBooking = async () => {
    if (!selectedBooking || !selectedSlotId) return

    try {
      await bookingApi.changeBooking(selectedBooking.id, selectedSlotId)
      showSnackbar({ message: '예약이 변경되었습니다.', severity: 'success' })
      handleCloseDetail()
      await loadBookings()
    } catch (error) {
      showSnackbar({ message: getApiErrorMessage(error, '예약 변경에 실패했습니다.'), severity: 'error' })
    }
  }

  return (
    <div className="relative h-[calc(100vh-140px)] p-0 flex flex-col gap-[3px] overflow-hidden bg-background">
      <BookingMonthCalendar
        title="내 수업예약"
        month={month}
        bookings={reservedBookings}
        loading={loading}
        onMonthChange={setMonth}
        onBookingClick={handleSelectBooking}
        emptyMessage="예약된 수업이 없습니다."
      />

      <MyBookingDetailDialog
        booking={selectedBooking}
        changeableSlots={changeableSlots}
        selectedSlotId={selectedSlotId}
        canModify={Boolean(canModify)}
        onClose={handleCloseDetail}
        onCancelBooking={handleCancelBooking}
        onChangeBooking={handleChangeBooking}
        onSelectedSlotIdChange={setSelectedSlotId}
      />
    </div>
  )
}

export default MyBookings
