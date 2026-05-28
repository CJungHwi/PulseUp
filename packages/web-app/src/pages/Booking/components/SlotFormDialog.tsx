/**
 * 소스 요약 — 수업 슬롯 등록/수정 다이얼로그
 *
 * 기능: 지점관리자가 수업명, 운동 대분류, 시작/종료 시간, 정원을 입력해 슬롯을 저장한다.
 *
 * 호출/연동: `ClassBookingManagement`, `bookingApi.createSlot/updateSlot`.
 *
 * 관련 컴포넌트: shadcn `Dialog`, `Input`, `Select`, `Button`.
 *
 * 흐름: 선택 날짜/슬롯 → 폼 초기화 → 입력 검증 → 저장 이벤트 전달.
 */

import React, { useEffect, useState } from 'react'
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
  toDateTimeLocalValue,
} from './bookingCalendarUtils'

interface SlotFormDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  categories: WorkoutCategory[]
  selectedDate?: Date | null
  slot?: ClassSlot | null
  saving?: boolean
  onClose: () => void
  onSubmit: (payload: ClassSlotPayload) => Promise<void>
}

const createInitialForm = (selectedDate?: Date | null, slot?: ClassSlot | null): ClassSlotPayload => {
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

  const { startAt, endAt } = createDefaultSlotTimes(selectedDate || new Date())
  return {
    workoutCategoryId: '',
    title: '',
    startAt,
    endAt,
    capacity: 10,
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
  saving = false,
  onClose,
  onSubmit,
}) => {
  const [form, setForm] = useState<ClassSlotPayload>(() => createInitialForm(selectedDate, slot))

  useEffect(() => {
    if (!open) return
    setForm(createInitialForm(selectedDate, slot))
  }, [open, selectedDate, slot])

  const handleChange = (field: keyof ClassSlotPayload, value: string | number | null) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    await onSubmit({
      ...form,
      title: form.title.trim(),
      recurrenceRule: form.recurrenceRule || null,
    })
  }

  const isInvalid = (
    !form.title.trim() ||
    !form.workoutCategoryId ||
    !form.startAt ||
    !form.endAt ||
    Number(form.capacity) < 1 ||
    new Date(form.startAt).getTime() >= new Date(form.endAt).getTime()
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
        <DialogFooter className="px-4 py-3 border-t border-[#343637] dark:border-[#6b7280]">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={saving || isInvalid}>
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SlotFormDialog
