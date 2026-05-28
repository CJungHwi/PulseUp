/**
 * 페이지 요약 — 수업예약 관리 (`/booking/manage`)
 *
 * 기능: 지점관리자가 월간 캘린더에서 수업 슬롯을 등록, 수정, 삭제하고 정원/예약 인원과 예약자 출석을 관리한다.
 *
 * 호출/연동: `bookingApi.getSlots/createSlot/updateSlot/deleteSlot/getSlotBookings/updateBookingAttendance`,
 *           `workoutCategoryApi.getWorkoutCategories`.
 *
 * 관련 컴포넌트: `BookingMonthCalendar`, `SlotFormDialog`, `AttendanceDialog`, shadcn `Dialog`.
 *
 * 흐름: 월 범위 계산 → 슬롯/운동 대분류 조회 → 날짜 클릭 등록, 슬롯 클릭 수정, 예약자 버튼으로 출석체크 → API 저장 후 재조회.
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
import { bookingApi, type ClassSlot, type ClassSlotPayload } from '../../services/bookingApi'
import { workoutCategoryApi } from '../../services/workoutCategoryApi'
import type { WorkoutCategory } from '../../types/workoutCategory'
import AttendanceDialog from './components/AttendanceDialog'
import BookingMonthCalendar from './components/BookingMonthCalendar'
import SlotFormDialog from './components/SlotFormDialog'
import {
  formatDateTime,
  formatTimeRange,
  getApiErrorMessage,
  getMonthRange,
  getRemainingCapacity,
  getSlotCategoryLabel,
  isPastStart,
  toMonthValue,
} from './components/bookingCalendarUtils'

export const ClassBookingManagement: React.FC = () => {
  const { showSnackbar } = useSnackbar()
  const [month, setMonth] = useState(() => toMonthValue())
  const [slots, setSlots] = useState<ClassSlot[]>([])
  const [categories, setCategories] = useState<WorkoutCategory[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [editingSlot, setEditingSlot] = useState<ClassSlot | null>(null)
  const [deletingSlot, setDeletingSlot] = useState<ClassSlot | null>(null)
  const [attendanceSlot, setAttendanceSlot] = useState<ClassSlot | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const range = useMemo(() => getMonthRange(month), [month])
  const isDialogOpen = Boolean(selectedDate || editingSlot)

  const loadSlots = useCallback(async () => {
    setLoading(true)
    try {
      setSlots(await bookingApi.getSlots(range))
    } catch (error) {
      showSnackbar({ message: getApiErrorMessage(error, '수업 목록을 불러오지 못했습니다.'), severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [range, showSnackbar])

  useEffect(() => {
    loadSlots()
  }, [loadSlots])

  useEffect(() => {
    workoutCategoryApi.getWorkoutCategories({ is_active: true })
      .then(setCategories)
      .catch(() => {
        setCategories([])
        showSnackbar({ message: '운동 대분류 목록을 불러오지 못했습니다.', severity: 'error' })
      })
  }, [showSnackbar])

  const handleOpenCreate = (date: Date) => {
    setEditingSlot(null)
    setSelectedDate(date)
  }

  const handleOpenEdit = (slot: ClassSlot) => {
    setSelectedDate(null)
    setEditingSlot(slot)
  }

  const handleCloseForm = () => {
    if (saving) return
    setSelectedDate(null)
    setEditingSlot(null)
  }

  const handleSubmitSlot = async (payload: ClassSlotPayload) => {
    setSaving(true)
    try {
      if (editingSlot) {
        await bookingApi.updateSlot(editingSlot.id, payload)
        showSnackbar({ message: '수업이 수정되었습니다.', severity: 'success' })
      } else {
        await bookingApi.createSlot(payload)
        showSnackbar({ message: '수업이 등록되었습니다.', severity: 'success' })
      }
      setSelectedDate(null)
      setEditingSlot(null)
      await loadSlots()
    } catch (error) {
      showSnackbar({ message: getApiErrorMessage(error, '수업 저장에 실패했습니다.'), severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingSlot) return

    try {
      await bookingApi.deleteSlot(deletingSlot.id)
      showSnackbar({ message: '수업이 삭제되었습니다.', severity: 'success' })
      setDeletingSlot(null)
      await loadSlots()
    } catch (error) {
      showSnackbar({ message: getApiErrorMessage(error, '수업 삭제에 실패했습니다.'), severity: 'error' })
    }
  }

  return (
    <div className="relative h-[calc(100vh-140px)] p-0 flex flex-col gap-[3px] overflow-hidden bg-background">
      <BookingMonthCalendar
        title="수업예약 관리"
        month={month}
        slots={slots}
        loading={loading}
        onMonthChange={setMonth}
        onDayClick={handleOpenCreate}
        onSlotClick={handleOpenEdit}
        emptyMessage="등록된 수업이 없습니다. 날짜를 선택해 수업을 등록하세요."
        renderToolbarActions={() => (
          <Button size="sm" className="h-9 text-xs" onClick={() => handleOpenCreate(new Date())}>
            수업 등록
          </Button>
        )}
        getSlotBadge={(slot) => {
          if (isPastStart(slot.start_at)) return { label: '종료', color: 'default' }
          return { label: `예약 ${slot.reserved_count}/${slot.capacity}`, color: 'info' }
        }}
        renderSlotActions={(slot) => (
          <div className="flex flex-wrap gap-[3px]">
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleOpenEdit(slot)}>
              수정
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setAttendanceSlot(slot)}>
              예약자
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs border-destructive text-destructive hover:bg-destructive/10"
              onClick={() => setDeletingSlot(slot)}
            >
              삭제
            </Button>
          </div>
        )}
      />

      <SlotFormDialog
        open={isDialogOpen}
        mode={editingSlot ? 'edit' : 'create'}
        categories={categories}
        selectedDate={selectedDate}
        slot={editingSlot}
        saving={saving}
        onClose={handleCloseForm}
        onSubmit={handleSubmitSlot}
      />

      <AttendanceDialog
        open={Boolean(attendanceSlot)}
        slot={attendanceSlot}
        onClose={() => setAttendanceSlot(null)}
        onChanged={loadSlots}
      />

      <Dialog open={Boolean(deletingSlot)} onOpenChange={(open) => !open && setDeletingSlot(null)}>
        <DialogContent className="max-w-xs p-0 border-[#343637] dark:border-[#6b7280] overflow-hidden">
          <DialogHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 leading-none">
              수업 삭제
            </DialogTitle>
          </DialogHeader>
          {deletingSlot ? (
            <div className="p-4 space-y-2 text-sm">
              <p className="font-bold">
                {deletingSlot.title}
              </p>
              <p className="text-muted-foreground">
                {getSlotCategoryLabel(deletingSlot)}
              </p>
              <p>
                {formatDateTime(deletingSlot.start_at)} · {formatTimeRange(deletingSlot.start_at, deletingSlot.end_at)}
              </p>
              <p className={Number(deletingSlot.reserved_count) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}>
                예약 {deletingSlot.reserved_count}명 / 잔여 {getRemainingCapacity(deletingSlot)}명
              </p>
            </div>
          ) : null}
          <DialogFooter className="px-4 py-3 border-t border-[#343637] dark:border-[#6b7280]">
            <Button variant="outline" onClick={() => setDeletingSlot(null)}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ClassBookingManagement
