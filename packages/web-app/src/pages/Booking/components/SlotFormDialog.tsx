/**
 * 소스 요약 — 수업 슬롯 등록/수정 다이얼로그
 *
 * 기능: 지점관리자가 수업명, 운동 대분류, 시작/종료 시간, 정원을 입력해 슬롯을 저장한다.
 *       같은 날 여러 수업은 시간만 다르게 등록하며, 같은 시간대 중복 저장은 차단한다.
 *
 * 호출/연동: `ClassBookingManagement`, `bookingApi.createSlot/updateSlot`.
 *
 * 관련 컴포넌트: shadcn `Dialog`, `Input`, `Select`, `Button`.
 *
 * 흐름: 선택 날짜/슬롯 → 기존 수업 기준 다음 시간대 제안 → 입력 검증 → 저장 또는 저장 후 계속.
 */

import React, { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ClassSlotPayload, ClassSlot } from '../../../services/bookingApi'
import type { WorkoutCategory } from '../../../types/workoutCategory'
import {
  createDefaultSlotTimes,
  createNextSlotTimes,
  findOverlappingSlot,
  formatTimeRange,
  toDateKey,
  toDateTimeLocalValue,
} from './bookingCalendarUtils'

export interface SlotFormCarryOver {
  workoutCategoryId: string
  title: string
  capacity: number
}

interface SlotFormDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  categories: WorkoutCategory[]
  selectedDate?: Date | null
  slot?: ClassSlot | null
  existingDaySlots?: ClassSlot[]
  branchSlots?: ClassSlot[]
  carryOver?: SlotFormCarryOver | null
  saving?: boolean
  onClose: () => void
  onSubmit: (payload: ClassSlotPayload, options?: { continueOnSameDay?: boolean }) => Promise<void>
}

const createInitialForm = (
  selectedDate?: Date | null,
  slot?: ClassSlot | null,
  existingDaySlots: ClassSlot[] = [],
  carryOver?: SlotFormCarryOver | null
): ClassSlotPayload => {
  if (slot) {
    return {
      workoutCategoryId: slot.workout_category_id,
      title: slot.title,
      startAt: toDateTimeLocalValue(slot.start_at),
      endAt: toDateTimeLocalValue(slot.end_at),
      capacity: Number(slot.capacity),
      recurrenceRule: slot.recurrence_rule || null,
    }
  }

  const baseDate = selectedDate || new Date()
  const { startAt, endAt } = existingDaySlots.length > 0
    ? createNextSlotTimes(baseDate, existingDaySlots)
    : createDefaultSlotTimes(baseDate)

  return {
    workoutCategoryId: carryOver?.workoutCategoryId || '',
    title: carryOver?.title || '',
    startAt,
    endAt,
    capacity: carryOver?.capacity ?? 10,
    recurrenceRule: null,
  }
}

const fieldClassName =
  'h-9 text-xs bg-card border-[#343637] dark:border-[#6b7280]'

export const SlotFormDialog: React.FC<SlotFormDialogProps> = ({
  open,
  mode,
  categories,
  selectedDate,
  slot,
  existingDaySlots = [],
  branchSlots = [],
  carryOver = null,
  saving = false,
  onClose,
  onSubmit,
}) => {
  const [form, setForm] = useState<ClassSlotPayload>(() => createInitialForm(selectedDate, slot, existingDaySlots, carryOver))

  const selectedDateLabel = useMemo(() => {
    if (!selectedDate) return ''
    return toDateKey(selectedDate)
  }, [selectedDate])

  const existingSlotSummary = useMemo(
    () => existingDaySlots.map((daySlot) => `${daySlot.title} (${formatTimeRange(daySlot.start_at, daySlot.end_at)})`),
    [existingDaySlots]
  )
  const overlappingSlot = useMemo(
    () => findOverlappingSlot(
      { startAt: form.startAt, endAt: form.endAt },
      branchSlots,
      slot?.id
    ),
    [branchSlots, form.endAt, form.startAt, slot?.id]
  )

  useEffect(() => {
    if (!open) return
    setForm(createInitialForm(selectedDate, slot, existingDaySlots, carryOver))
  }, [open, selectedDate, slot, existingDaySlots, carryOver])

  const handleChange = (field: keyof ClassSlotPayload, value: string | number | null) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (continueOnSameDay = false) => {
    await onSubmit({
      ...form,
      title: form.title.trim(),
      recurrenceRule: form.recurrenceRule || null,
    }, mode === 'create' ? { continueOnSameDay } : undefined)
  }

  const isInvalid = (
    !form.title.trim() ||
    !form.workoutCategoryId ||
    !form.startAt ||
    !form.endAt ||
    Number(form.capacity) < 1 ||
    new Date(form.startAt).getTime() >= new Date(form.endAt).getTime() ||
    Boolean(overlappingSlot)
  )

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && !saving && onClose()}>
      <DialogContent className="max-w-lg p-0 border-[#343637] dark:border-[#6b7280] overflow-hidden">
        <DialogHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
          <DialogTitle className="text-lg font-bold flex items-center gap-2 leading-none">
            {mode === 'create' ? '수업 등록' : '수업 수정'}
          </DialogTitle>
        </DialogHeader>
        <div className="p-4 space-y-3">
          {mode === 'create' && selectedDateLabel ? (
            <div className="rounded-md border border-[#343637] dark:border-[#6b7280] bg-muted/20 p-3 text-xs space-y-1">
              <p className="font-bold">{selectedDateLabel} 수업 등록</p>
              <p className="text-muted-foreground">
                같은 날 여러 수업은 시작/종료 시간만 다르게 등록하면 됩니다.
              </p>
              {existingDaySlots.length > 0 ? (
                <p className="text-muted-foreground">
                  기존 {existingDaySlots.length}건 · 다음 시간대가 자동 제안됩니다.
                </p>
              ) : null}
            </div>
          ) : null}

          {mode === 'create' && existingSlotSummary.length > 0 ? (
            <div className="rounded-md border border-[#343637] dark:border-[#6b7280] bg-card p-2 text-xs space-y-1">
              <p className="font-bold">이 날짜 등록된 수업</p>
              {existingSlotSummary.map((summary) => (
                <p key={summary} className="text-muted-foreground truncate">{summary}</p>
              ))}
            </div>
          ) : null}

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground leading-none">수업명</Label>
            <Input
              value={form.title}
              onChange={(event) => handleChange('title', event.target.value)}
              disabled={saving}
              className={fieldClassName}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground leading-none">운동 대분류</Label>
            <Select
              value={form.workoutCategoryId}
              onValueChange={(value) => handleChange('workoutCategoryId', value)}
              disabled={saving || categories.length === 0}
            >
              <SelectTrigger className={fieldClassName}>
                <SelectValue placeholder="운동 대분류 선택" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.major_category_name || category.major_category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categories.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                표시할 운동 대분류가 없습니다. 지점 라이선스 발급 여부를 확인해주세요.
              </p>
            ) : null}
          </div>

          {overlappingSlot ? (
            <p className="rounded-md border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              같은 시간대에 이미 등록된 수업이 있습니다: {overlappingSlot.title} (
              {formatTimeRange(overlappingSlot.start_at, overlappingSlot.end_at)})
            </p>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[3px]">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground leading-none">시작</Label>
              <Input
                type="datetime-local"
                value={form.startAt}
                onChange={(event) => handleChange('startAt', event.target.value)}
                disabled={saving}
                className={fieldClassName}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground leading-none">종료</Label>
              <Input
                type="datetime-local"
                value={form.endAt}
                onChange={(event) => handleChange('endAt', event.target.value)}
                disabled={saving}
                className={fieldClassName}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground leading-none">정원</Label>
            <Input
              type="number"
              value={form.capacity}
              onChange={(event) => handleChange('capacity', Number(event.target.value))}
              min={1}
              max={999}
              disabled={saving}
              className={fieldClassName}
            />
          </div>
        </div>
        <DialogFooter className="px-4 py-3 border-t border-[#343637] dark:border-[#6b7280] gap-[3px] sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            취소
          </Button>
          {mode === 'create' ? (
            <Button
              variant="outline"
              onClick={() => handleSubmit(true)}
              disabled={saving || isInvalid}
            >
              저장 후 계속
            </Button>
          ) : null}
          <Button onClick={() => handleSubmit(false)} disabled={saving || isInvalid}>
            {mode === 'create' ? '저장' : '수정 저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SlotFormDialog
