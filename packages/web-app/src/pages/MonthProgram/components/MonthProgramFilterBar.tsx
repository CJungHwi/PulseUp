/**
 * MonthProgramFilterBar — 운동 scope / 운동구분 / 서킷구분 / 년월 필터 바
 */

import React from 'react'
import dayjs, { Dayjs } from 'dayjs'
import { Label } from '@/components/ui/label'
import { MonthInput } from '@/components/ui/month-input'
import {
  Select as ShadcnSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { WorkoutScopeRecord } from '@/pages/exercises/shared/workoutScope'
import type { WorkoutCategoryItem } from './monthProgramTypes'

interface MonthProgramFilterBarProps {
  workoutScopeFilter: string
  onWorkoutScopeFilterChange: (v: string) => void
  workoutScopes: WorkoutScopeRecord[]
  exerciseType: string
  onExerciseTypeChange: (v: string) => void
  circuitType: string
  onCircuitTypeChange: (v: string) => void
  selectedDate: Dayjs | null
  onSelectedDateChange: (d: Dayjs | null) => void
  workoutCategories: WorkoutCategoryItem[]
}

export const MonthProgramFilterBar: React.FC<MonthProgramFilterBarProps> = ({
  workoutScopeFilter,
  onWorkoutScopeFilterChange,
  workoutScopes,
  exerciseType,
  onExerciseTypeChange,
  circuitType,
  onCircuitTypeChange,
  selectedDate,
  onSelectedDateChange,
  workoutCategories,
}) => {
  const scopeLabels: Record<string, string> = {
    전체: '전체',
    ...Object.fromEntries(workoutScopes.map((s) => [s.scopeCode, s.scopeName])),
  }

  return (
  <div className="p-4 border-b border-[#343637] dark:border-[#6b7280] bg-muted/30">
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
        <Label className="text-[11px] text-muted-foreground leading-none">운동 Scope</Label>
        <ShadcnSelect
          value={workoutScopeFilter}
          onValueChange={onWorkoutScopeFilterChange}
          labels={scopeLabels}
        >
          <SelectTrigger className="w-full h-9 text-xs border-[#343637] dark:border-[#6b7280] bg-card">
            <SelectValue placeholder="운동 Scope" />
          </SelectTrigger>
          <SelectContent className="min-w-[180px]">
            <SelectItem value="전체" className="whitespace-nowrap">
              전체
            </SelectItem>
            {workoutScopes.map((scope) => (
              <SelectItem
                key={scope.id}
                value={scope.scopeCode}
                className="whitespace-nowrap"
              >
                {scope.scopeName} ({scope.scopeCode})
              </SelectItem>
            ))}
          </SelectContent>
        </ShadcnSelect>
      </div>

      <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
        <Label className="text-[11px] text-muted-foreground leading-none">운동구분</Label>
        <ShadcnSelect
          value={exerciseType}
          onValueChange={onExerciseTypeChange}
          labels={{
            전체: '전체',
            ...Object.fromEntries(
              workoutCategories.map((c) => [c.major_category, c.major_category_name]),
            ),
          }}
        >
          <SelectTrigger className="w-full h-9 text-xs border-[#343637] dark:border-[#6b7280] bg-card">
            <SelectValue placeholder="운동구분" />
          </SelectTrigger>
          <SelectContent className="min-w-[200px]">
            <SelectItem value="전체" className="whitespace-nowrap">
              전체
            </SelectItem>
            {workoutCategories.map((category) => (
              <SelectItem
                key={category.major_category}
                value={category.major_category}
                className="whitespace-nowrap"
              >
                {category.major_category_name}
              </SelectItem>
            ))}
          </SelectContent>
        </ShadcnSelect>
      </div>

      <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
        <Label className="text-[11px] text-muted-foreground leading-none">서킷구분</Label>
        <ShadcnSelect
          value={circuitType}
          onValueChange={onCircuitTypeChange}
          labels={{ 전체: '전체', stress: '스트레스', loop: '루프' }}
        >
          <SelectTrigger className="w-full h-9 text-xs border-[#343637] dark:border-[#6b7280] bg-card">
            <SelectValue placeholder="서킷구분" />
          </SelectTrigger>
          <SelectContent className="min-w-[150px]">
            <SelectItem value="전체" className="whitespace-nowrap">
              전체
            </SelectItem>
            <SelectItem value="stress" className="whitespace-nowrap">
              스트레스
            </SelectItem>
            <SelectItem value="loop" className="whitespace-nowrap">
              루프
            </SelectItem>
          </SelectContent>
        </ShadcnSelect>
      </div>

      <div className="flex flex-col gap-1 flex-1 min-w-[130px]">
        <Label className="text-[11px] text-muted-foreground leading-none">년월</Label>
        <MonthInput
          value={selectedDate ? selectedDate.format('YYYY-MM') : ''}
          onChange={(e) => {
            const value = e.target.value
            onSelectedDateChange(value ? dayjs(`${value}-01`) : null)
          }}
          className="w-full h-9 text-xs border-[#343637] dark:border-[#6b7280] bg-card"
        />
      </div>
    </div>
  </div>
  )
}
