/**
 * LicenseGrantForm — 라이선스 발급 폼
 *
 * 기능: 지점/운동 대분류 선택, 시작일 입력, 1/2/3/5년 기간 선택으로 자동 종료일 산정 후 발급
 *
 * Props:
 * - form: { branchId, workoutCategoryId, validFrom, termYears, notes }
 * - branches, categories, saving
 * - onChange(form), onBranchChange(branchId), onGrant()
 *
 * 사용처: `LicenseManagement.tsx`
 * 관련 유틸: `licenseDateUtils.ts`
 */
import React from 'react'
import { ShieldPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Branch } from '@/types/branch'
import type { WorkoutCategory } from '@/types/workoutCategory'
import {
  LICENSE_TERM_OPTIONS,
  calculateValidTo,
  formatDateDisplay,
  type LicenseTermYears,
} from './licenseDateUtils'

export interface LicenseGrantFormState {
  branchId: string
  workoutCategoryId: string
  validFrom: string
  termYears: LicenseTermYears
  notes: string
}

interface LicenseGrantFormProps {
  form: LicenseGrantFormState
  branches: Branch[]
  categories: WorkoutCategory[]
  saving?: boolean
  onChange: (next: LicenseGrantFormState) => void
  onBranchChange: (branchId: string) => void
  onGrant: () => void | Promise<void>
}

const fieldClassName =
  'h-9 text-xs bg-card border-[#343637] dark:border-[#6b7280]'

export const LicenseGrantForm: React.FC<LicenseGrantFormProps> = ({
  form,
  branches,
  categories,
  saving = false,
  onChange,
  onBranchChange,
  onGrant,
}) => {
  const handleField = <K extends keyof LicenseGrantFormState>(
    key: K,
    value: LicenseGrantFormState[K]
  ) => onChange({ ...form, [key]: value })

  const previewValidTo = calculateValidTo(form.validFrom, form.termYears)
  const canGrant = Boolean(form.branchId && form.workoutCategoryId && form.validFrom && previewValidTo)

  return (
    <Card className="flex flex-col shrink-0 shadow-md border border-[#343637] dark:border-[#6b7280]">
      <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
        <div className="flex items-center gap-2">
          <ShieldPlus className="size-5" />
          <CardTitle className="text-lg font-bold leading-none">라이선스 발급</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-[3px] items-end">
          <div className="md:col-span-3 space-y-1">
            <Label className="text-[11px] text-muted-foreground leading-none">지점</Label>
            <Select
              value={form.branchId}
              onValueChange={(value) => {
                handleField('branchId', value)
                onBranchChange(value)
              }}
              disabled={saving}
            >
              <SelectTrigger className={fieldClassName}>
                <SelectValue placeholder="지점 선택" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={String(branch.id)}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-3 space-y-1">
            <Label className="text-[11px] text-muted-foreground leading-none">운동 대분류</Label>
            <Select
              value={form.workoutCategoryId}
              onValueChange={(value) => handleField('workoutCategoryId', value)}
              disabled={saving || categories.length === 0}
            >
              <SelectTrigger className={fieldClassName}>
                <SelectValue placeholder="대분류 선택" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.major_category_name || category.major_category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2 space-y-1">
            <Label className="text-[11px] text-muted-foreground leading-none">시작일</Label>
            <Input
              type="date"
              value={form.validFrom}
              onChange={(event) => handleField('validFrom', event.target.value)}
              disabled={saving}
              className={fieldClassName}
            />
          </div>

          <div className="md:col-span-2 space-y-1">
            <Label className="text-[11px] text-muted-foreground leading-none">기간</Label>
            <Select
              value={String(form.termYears)}
              onValueChange={(value) => handleField('termYears', Number(value) as LicenseTermYears)}
              disabled={saving}
            >
              <SelectTrigger className={fieldClassName}>
                <SelectValue placeholder="기간 선택" />
              </SelectTrigger>
              <SelectContent>
                {LICENSE_TERM_OPTIONS.map((years) => (
                  <SelectItem key={years} value={String(years)}>
                    {years}년
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Button
              className="w-full h-9 text-xs"
              disabled={!canGrant || saving}
              onClick={onGrant}
            >
              {saving ? '발급 중...' : '발급'}
            </Button>
          </div>
        </div>

        <p className="mt-2 text-[11px] text-muted-foreground">
          종료일(자동 계산): <span className="font-bold text-foreground">{formatDateDisplay(previewValidTo)}</span>
        </p>
      </CardContent>
    </Card>
  )
}
