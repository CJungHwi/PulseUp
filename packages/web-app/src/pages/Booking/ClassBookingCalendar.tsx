/**
 * 페이지 요약 — 수업예약 (`/booking/calendar`)
 *
 * 기능: 지점사용자가 소속 지점의 수업 슬롯을 월간 캘린더에서 확인하고 날짜/시간을 선택해 예약한다.
 *       같은 날짜에 시간이 겹치지 않는 여러 수업을 각각 예약할 수 있다.
 *
 * 호출/연동: `bookingApi.getSlots/reserve/getMyBookings`.
 *
 * 관련 컴포넌트: `BookingMonthCalendar`, shadcn `Dialog`, `Button`.
 *
 * 흐름: 월 범위 계산 → 수업/내 예약 병렬 조회 → 슬롯 선택 → 정원/중복/시간 겹침 확인 → 예약 저장.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSnackbar } from '../../contexts/SnackbarContext'
import { bookingApi, type ClassBooking, type ClassSlot } from '../../services/bookingApi'
import BookingMonthCalendar from './components/BookingMonthCalendar'
import {
  countItemsByDate,
  formatDateTime,
  formatTimeRange,
  getApiErrorMessage,
  getRemainingCapacity,
  getSlotCategoryLabel,
  getMonthRange,
  hasBookingTimeOverlap,
  isPastStart,
  toDateKey,
  toMonthValue,
} from './components/bookingCalendarUtils'

const getReserveBlockReason = (
  slot: ClassSlot,
  reservedSlotIds: Set<string>,
  reservedBookings: ClassBooking[]
) => {
  if (reservedSlotIds.has(slot.id)) return 'already_reserved'
  if (isPastStart(slot.start_at)) return 'past'
  if (getRemainingCapacity(slot) <= 0) return 'full'
  if (hasBookingTimeOverlap(slot, reservedBookings)) return 'overlap'
  return null
}

export const ClassBookingCalendar: React.FC = () => {
  const { showSnackbar } = useSnackbar()
  const [month, setMonth] = useState(() => toMonthValue())
  const [slots, setSlots] = useState<ClassSlot[]>([])
  const [myBookings, setMyBookings] = useState<ClassBooking[]>([])
  const [selectedSlot, setSelectedSlot] = useState<ClassSlot | null>(null)
  const [loading, setLoading] = useState(false)

  const range = useMemo(() => getMonthRange(month), [month])
  const reservedBookings = useMemo(
    () => myBookings.filter((booking) => booking.status === 'reserved'),
    [myBookings]
  )
  const reservedSlotIds = useMemo(
    () => new Set(reservedBookings.map((booking) => booking.slot_id)),
    [reservedBookings]
  )
  const reservedCountByDate = useMemo(
    () => countItemsByDate(reservedBookings),
    [reservedBookings]
  )
  const monthReservedCount = useMemo(
    () => reservedBookings.filter((booking) => booking.start_at >= range.start && booking.start_at <= range.end).length,
    [range.end, range.start, reservedBookings]
  )

  const loadCalendar = useCallback(async () => {
    setLoading(true)
    try {
      const [nextSlots, nextBookings] = await Promise.all([
        bookingApi.getSlots(range),
        bookingApi.getMyBookings(),
      ])
      setSlots(nextSlots)
      setMyBookings(nextBookings)
    } catch (error) {
      showSnackbar({ message: getApiErrorMessage(error, '수업예약 정보를 불러오지 못했습니다.'), severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [range, showSnackbar])

  useEffect(() => {
    loadCalendar()
  }, [loadCalendar])

  const canReserve = (slot: ClassSlot) => getReserveBlockReason(slot, reservedSlotIds, reservedBookings) === null

  const handleSelectSlot = (slot: ClassSlot) => {
    const blockReason = getReserveBlockReason(slot, reservedSlotIds, reservedBookings)

    if (blockReason === 'already_reserved') {
      showSnackbar({ message: '이미 예약한 수업입니다.', severity: 'info' })
      return
    }
    if (blockReason === 'overlap') {
      showSnackbar({
        message: '같은 시간대에 예약된 수업이 있습니다. 다른 시간대 수업을 선택해주세요.',
        severity: 'warning',
      })
      return
    }
    if (blockReason) {
      showSnackbar({ message: '예약할 수 없는 수업입니다. 마감, 예약완료, 종료 여부를 확인해주세요.', severity: 'warning' })
      return
    }

    setSelectedSlot(slot)
  }

  const handleReserve = async () => {
    if (!selectedSlot) return

    try {
      await bookingApi.reserve(selectedSlot.id)
      showSnackbar({
        message: '수업예약이 완료되었습니다. 같은 날 다른 시간대 수업도 추가 예약할 수 있습니다.',
        severity: 'success',
      })
      setSelectedSlot(null)
      await loadCalendar()
    } catch (error) {
      showSnackbar({ message: getApiErrorMessage(error, '예약에 실패했습니다.'), severity: 'error' })
    }
  }

  return (
    <div className="relative h-[calc(100vh-140px)] p-0 flex flex-col gap-[3px] overflow-hidden bg-background">
      <BookingMonthCalendar
        title="수업예약"
        month={month}
        slots={slots}
        bookings={reservedBookings}
        loading={loading}
        onMonthChange={setMonth}
        onSlotClick={handleSelectSlot}
        emptyMessage="예약 가능한 수업이 없습니다."
        renderToolbarActions={() => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            이번 달 예약 {monthReservedCount}건
          </span>
        )}
        getSlotBadge={(slot) => {
          const blockReason = getReserveBlockReason(slot, reservedSlotIds, reservedBookings)
          if (blockReason === 'already_reserved') return { label: '예약완료', color: 'primary' }
          if (blockReason === 'overlap') return { label: '시간중복', color: 'warning' }
          if (blockReason === 'past') return { label: '종료', color: 'default' }
          if (blockReason === 'full') return { label: '마감', color: 'default' }
          return { label: '예약가능', color: 'success' }
        }}
        renderSlotActions={(slot) => (
          <Button
            size="sm"
            disabled={!canReserve(slot)}
            onClick={() => handleSelectSlot(slot)}
            className="h-7 text-xs"
          >
            예약
          </Button>
        )}
      />

      <Dialog open={Boolean(selectedSlot)} onOpenChange={(open) => !open && setSelectedSlot(null)}>
        <DialogContent className="max-w-xs p-0 border-[#343637] dark:border-[#6b7280] overflow-hidden">
          <DialogHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 leading-none">
              수업예약 확인
            </DialogTitle>
          </DialogHeader>
          {selectedSlot ? (
            <div className="p-4 space-y-2 text-sm">
              <p className="font-bold">
                {selectedSlot.title}
              </p>
              <p className="text-muted-foreground">
                {getSlotCategoryLabel(selectedSlot)}
              </p>
              <p>
                {formatDateTime(selectedSlot.start_at)} · {formatTimeRange(selectedSlot.start_at, selectedSlot.end_at)}
              </p>
              <p className="text-muted-foreground">
                잔여 {getRemainingCapacity(selectedSlot)}명 / 정원 {selectedSlot.capacity}명
              </p>
              {reservedCountByDate[toDateKey(selectedSlot.start_at)] ? (
                <p className="text-xs text-muted-foreground">
                  이 날짜 기존 예약 {reservedCountByDate[toDateKey(selectedSlot.start_at)]}건 · 시간이 겹치지 않으면 추가 예약 가능
                </p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="px-4 py-3 border-t border-[#343637] dark:border-[#6b7280]">
            <Button variant="outline" onClick={() => setSelectedSlot(null)}>
              닫기
            </Button>
            <Button onClick={handleReserve}>
              예약하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ClassBookingCalendar
