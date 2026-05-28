/**
 * 소스 요약 — 내 수업예약 상세 다이얼로그
 *
 * 기능: 선택된 내 예약의 수업 정보, 변경 가능 수업 선택, 예약 변경/취소 액션을 표시한다.
 *
 * 호출/연동: `MyBookings`에서 전달받은 예약 변경/취소 핸들러.
 *
 * 관련 컴포넌트: shadcn `Dialog`, `Select`, `Button`.
 *
 * 흐름: 예약 선택 → 상세 정보 표시 → 변경 가능 여부 확인 → 변경할 수업 선택 또는 취소/변경 이벤트 전달.
 */

import React from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ClassBooking, ClassSlot } from '../../../services/bookingApi'
import {
  formatDateTime,
  formatTimeRange,
  getBookingCategoryLabel,
  getRemainingCapacity,
  getSlotCategoryLabel,
} from './bookingCalendarUtils'

interface MyBookingDetailDialogProps {
  booking: ClassBooking | null
  changeableSlots: ClassSlot[]
  selectedSlotId: string
  canModify: boolean
  onClose: () => void
  onCancelBooking: () => void
  onChangeBooking: () => void
  onSelectedSlotIdChange: (slotId: string) => void
}

const fieldClassName =
  'h-9 text-xs bg-card border-[#343637] dark:border-[#6b7280]'

export const MyBookingDetailDialog: React.FC<MyBookingDetailDialogProps> = ({
  booking,
  changeableSlots,
  selectedSlotId,
  canModify,
  onClose,
  onCancelBooking,
  onChangeBooking,
  onSelectedSlotIdChange,
}) => {
  const hasChangeableSlots = changeableSlots.length > 0
  const changeSlotSelectId = 'my-booking-change-slot'

  const handleOpenChange = (open: boolean) => {
    if (open) return
    onClose()
  }

  return (
    <Dialog open={Boolean(booking)} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg p-0 border-[#343637] dark:border-[#6b7280] overflow-hidden">
        <DialogHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
          <DialogTitle className="text-lg font-bold flex items-center gap-2 leading-none">
            내 수업예약 상세
          </DialogTitle>
        </DialogHeader>

        {booking ? (
          <div className="p-4 space-y-4 text-sm">
            <div className="space-y-2">
              <p className="text-lg font-bold leading-tight">
                {booking.title}
              </p>
              <p className="text-muted-foreground">
                {getBookingCategoryLabel(booking)}
              </p>
              <p>
                {formatDateTime(booking.start_at)} · {formatTimeRange(booking.start_at, booking.end_at)}
              </p>
            </div>

            {canModify ? (
              <div className="space-y-1">
                <Label htmlFor={changeSlotSelectId} className="text-[11px] text-muted-foreground leading-none">
                  변경할 수업
                </Label>
                <Select
                  value={selectedSlotId}
                  onValueChange={onSelectedSlotIdChange}
                  disabled={!hasChangeableSlots}
                >
                  <SelectTrigger id={changeSlotSelectId} className={fieldClassName}>
                    <SelectValue placeholder="변경할 수업 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {changeableSlots.map((slot) => (
                      <SelectItem key={slot.id} value={slot.id}>
                        {formatDateTime(slot.start_at)} · {slot.title} · {getSlotCategoryLabel(slot)} · 잔여 {getRemainingCapacity(slot)}명
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {hasChangeableSlots
                    ? '정원이 남아있는 시작 전 수업만 선택할 수 있습니다.'
                    : '현재 변경 가능한 수업이 없습니다.'}
                </p>
              </div>
            ) : (
              <p className="rounded-md border border-[#343637] dark:border-[#6b7280] bg-muted/30 p-3 text-xs text-muted-foreground">
                시작된 수업 또는 취소된 예약은 변경/취소할 수 없습니다.
              </p>
            )}
          </div>
        ) : null}

        <DialogFooter className="px-4 py-3 border-t border-[#343637] dark:border-[#6b7280]">
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
          <Button
            variant="outline"
            onClick={onCancelBooking}
            disabled={!canModify}
            className="border-destructive text-destructive hover:bg-destructive/10"
          >
            예약 취소
          </Button>
          <Button onClick={onChangeBooking} disabled={!canModify || !selectedSlotId}>
            예약 변경
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default MyBookingDetailDialog
