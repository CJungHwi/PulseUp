/**
 * 소스 요약 — 수업 예약자 출석체크 다이얼로그
 *
 * 기능: 선택한 수업 슬롯의 예약자 목록을 표시하고 예약중/출석/노쇼 상태를 변경한다.
 *       취소된 예약은 읽기 전용으로 표시하며, 운동기록 ID 기준 개인별 심박계 배정을 함께 관리한다.
 *
 * 호출/연동: `bookingApi.getSlotBookings`, `bookingApi.updateBookingAttendance`,
 *           `HeartRateParticipantPanel`.
 *
 * 관련 컴포넌트: `HeartRateParticipantPanel`, shadcn `Dialog`, `Table`, `Select`, `Badge`, `Button`.
 *
 * 흐름: 슬롯 선택 → 예약자 목록 조회 → 출석 상태 변경 또는 심박계 배정 → 재조회 → 닫을 때 상위 슬롯 재조회.
 */

import React, { useCallback, useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useSnackbar } from '../../../contexts/SnackbarContext'
import {
  bookingApi,
  type AttendanceStatus,
  type BookingStatus,
  type ClassSlot,
  type ClassSlotBooking,
} from '../../../services/bookingApi'
import {
  formatDateTime,
  formatTimeRange,
  getApiErrorMessage,
  getSlotCategoryLabel,
} from './bookingCalendarUtils'
import HeartRateParticipantPanel from './HeartRateParticipantPanel'

interface AttendanceDialogProps {
  open: boolean
  slot: ClassSlot | null
  onClose: () => void
  onChanged?: () => void
}

const ATTENDANCE_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'reserved', label: '예약중' },
  { value: 'attended', label: '출석' },
  { value: 'noshow', label: '노쇼' },
]

const STATUS_LABELS: Record<BookingStatus, string> = {
  reserved: '예약중',
  attended: '출석',
  noshow: '노쇼',
  cancelled: '취소',
}

const isAttendanceStatus = (status: BookingStatus): status is AttendanceStatus => (
  status === 'reserved' || status === 'attended' || status === 'noshow'
)

const getStatusClassName = (status: BookingStatus) => {
  switch (status) {
    case 'reserved':
      return 'border-primary text-primary'
    case 'attended':
      return 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
    case 'noshow':
      return 'border-amber-500 text-amber-600 dark:text-amber-400'
    case 'cancelled':
    default:
      return 'border-[#343637] dark:border-[#6b7280] text-muted-foreground'
  }
}

const HEADER_CELL =
  'h-[45px] text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] text-xs'
const HEADER_CELL_LAST =
  'h-[45px] text-center font-bold px-2 border-b-0 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] text-xs'
const BODY_CELL =
  'h-[35px] py-0 px-2 text-xs border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors'
const BODY_CELL_LAST =
  'h-[35px] py-0 px-2 text-xs group-hover:text-inherit transition-colors'

export const AttendanceDialog: React.FC<AttendanceDialogProps> = ({
  open,
  slot,
  onClose,
  onChanged,
}) => {
  const { showSnackbar } = useSnackbar()
  const [bookings, setBookings] = useState<ClassSlotBooking[]>([])
  const [loading, setLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const loadBookings = useCallback(async (slotId: string) => {
    setLoading(true)
    try {
      setBookings(await bookingApi.getSlotBookings(slotId))
    } catch (error) {
      showSnackbar({
        message: getApiErrorMessage(error, '예약자 목록을 불러오지 못했습니다.'),
        severity: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [showSnackbar])

  useEffect(() => {
    if (!open || !slot) {
      setBookings([])
      setDirty(false)
      return
    }
    loadBookings(slot.id)
  }, [open, slot, loadBookings])

  const handleClose = () => {
    if (updatingId) return
    if (dirty) onChanged?.()
    onClose()
  }

  const handleStatusChange = async (booking: ClassSlotBooking, nextStatus: AttendanceStatus) => {
    if (!isAttendanceStatus(booking.status)) return
    if (booking.status === nextStatus) return

    setUpdatingId(booking.id)
    try {
      await bookingApi.updateBookingAttendance(booking.id, nextStatus)
      setBookings((prev) => prev.map((item) => (
        item.id === booking.id ? { ...item, status: nextStatus } : item
      )))
      setDirty(true)
      showSnackbar({ message: '출석 상태가 변경되었습니다.', severity: 'success' })
    } catch (error) {
      showSnackbar({
        message: getApiErrorMessage(error, '출석 상태 변경에 실패했습니다.'),
        severity: 'error',
      })
    } finally {
      setUpdatingId(null)
    }
  }

  const activeCount = bookings.filter((booking) => isAttendanceStatus(booking.status)).length
  const attendedCount = bookings.filter((booking) => booking.status === 'attended').length
  const noshowCount = bookings.filter((booking) => booking.status === 'noshow').length

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent className="max-w-6xl p-0 border-[#343637] dark:border-[#6b7280] overflow-hidden">
        <DialogHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
          <DialogTitle className="text-lg font-bold flex items-center gap-2 leading-none">
            예약자 출석체크
          </DialogTitle>
        </DialogHeader>
        {slot ? (
          <div className="p-4 space-y-3">
            <div className="space-y-1 text-sm">
              <p className="font-bold">{slot.title}</p>
              <p className="text-muted-foreground">{getSlotCategoryLabel(slot)}</p>
              <p>{formatDateTime(slot.start_at)} · {formatTimeRange(slot.start_at, slot.end_at)}</p>
              <div className="flex flex-wrap gap-[3px]">
                <Badge variant="outline" className="border-sky-500 text-sky-600 dark:text-sky-400">
                  예약 {activeCount}/{slot.capacity}
                </Badge>
                <Badge variant="outline" className="border-emerald-500 text-emerald-600 dark:text-emerald-400">
                  출석 {attendedCount}명
                </Badge>
                <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">
                  노쇼 {noshowCount}명
                </Badge>
              </div>
            </div>

            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                데이터를 불러오는 중...
              </div>
            ) : bookings.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                예약자가 없습니다.
              </div>
            ) : (
              <>
                <div className="max-h-[300px] overflow-auto scrollbar-hide bg-[#f9fafb] dark:bg-[#1d1d1d] border border-[#343637] dark:border-[#6b7280]">
                  <Table className="w-full table-fixed border-separate border-spacing-0">
                    <TableHeader className="sticky top-0 z-10 shadow-sm">
                      <TableRow className="hover:bg-transparent border-b-0">
                        <TableHead className={cn(HEADER_CELL, 'w-[120px]')}>이름</TableHead>
                        <TableHead className={cn(HEADER_CELL, 'w-[120px]')}>아이디</TableHead>
                        <TableHead className={cn(HEADER_CELL, 'w-[200px]')}>이메일</TableHead>
                        <TableHead className={cn(HEADER_CELL, 'w-[140px]')}>예약일시</TableHead>
                        <TableHead className={cn(HEADER_CELL, 'w-[100px]')}>현재 상태</TableHead>
                        <TableHead className={cn(HEADER_CELL_LAST, 'w-[150px]')}>출석 처리</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bookings.map((booking) => {
                        const editable = isAttendanceStatus(booking.status)
                        return (
                          <TableRow
                            key={booking.id}
                            className="h-[35px] border-b-0 group transition-colors bg-[#f9fafb] dark:bg-[#1d1d1d] hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30"
                          >
                            <TableCell className={cn(BODY_CELL, 'truncate')}>{booking.name}</TableCell>
                            <TableCell className={cn(BODY_CELL, 'truncate')}>{booking.userid}</TableCell>
                            <TableCell className={cn(BODY_CELL, 'truncate')}>{booking.email}</TableCell>
                            <TableCell className={cn(BODY_CELL, 'text-center')}>{formatDateTime(booking.reserved_at)}</TableCell>
                            <TableCell className={cn(BODY_CELL, 'text-center')}>
                              <Badge variant="outline" className={cn('text-[10px]', getStatusClassName(booking.status))}>
                                {STATUS_LABELS[booking.status]}
                              </Badge>
                            </TableCell>
                            <TableCell className={BODY_CELL_LAST}>
                              {editable ? (
                                <Select
                                  value={booking.status}
                                  disabled={updatingId === booking.id}
                                  onValueChange={(value) => handleStatusChange(booking, value as AttendanceStatus)}
                                >
                                  <SelectTrigger className="h-8 text-xs bg-card border-[#343637] dark:border-[#6b7280]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ATTENDANCE_OPTIONS.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  변경 불가
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
                <HeartRateParticipantPanel bookings={bookings.filter((booking) => booking.status !== 'cancelled')} />
              </>
            )}
          </div>
        ) : null}
        <DialogFooter className="px-4 py-3 border-t border-[#343637] dark:border-[#6b7280]">
          <Button variant="outline" onClick={handleClose} disabled={Boolean(updatingId)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AttendanceDialog
