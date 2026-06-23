/**
 * WorkoutScopeFormDialog — 운동저장구분 등록/수정 다이얼로그
 */

import React from 'react'
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
import { Switch } from '@/components/ui/switch'
import type { WorkoutScopeFormValues } from './workoutScopeTypes'

export type WorkoutScopeFormMode = 'create' | 'edit'

interface WorkoutScopeFormDialogProps {
  open: boolean
  mode: WorkoutScopeFormMode
  formData: WorkoutScopeFormValues
  saving: boolean
  onOpenChange: (open: boolean) => void
  onChange: (field: keyof WorkoutScopeFormValues, value: string | number | boolean) => void
  onSubmit: () => void
}

export const WorkoutScopeFormDialog: React.FC<WorkoutScopeFormDialogProps> = ({
  open,
  mode,
  formData,
  saving,
  onOpenChange,
  onChange,
  onSubmit,
}) => {
  const isCreate = mode === 'create'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isCreate ? '운동저장구분 등록' : '운동저장구분 수정'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="scopeCode">운동저장구분 코드</Label>
            <Input
              id="scopeCode"
              value={formData.scopeCode}
              disabled={!isCreate}
              placeholder="예: TOTAL"
              onChange={(e) => onChange('scopeCode', e.target.value.toUpperCase())}
              aria-label="운동저장구분 코드"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="scopeName">표시명</Label>
            <Input
              id="scopeName"
              value={formData.scopeName}
              placeholder="예: 통합 운동"
              onChange={(e) => onChange('scopeName', e.target.value)}
              aria-label="표시명"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sortOrder">정렬 순서</Label>
            <Input
              id="sortOrder"
              type="number"
              min={0}
              value={formData.sortOrder}
              onChange={(e) => onChange('sortOrder', Number(e.target.value) || 0)}
              aria-label="정렬 순서"
            />
          </div>

          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label htmlFor="isActive">사용 여부</Label>
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => onChange('isActive', checked)}
              aria-label="사용 여부"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            aria-label="취소"
          >
            취소
          </Button>
          <Button type="button" onClick={onSubmit} disabled={saving} aria-label={isCreate ? '등록' : '저장'}>
            {saving ? '저장 중...' : isCreate ? '등록' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
