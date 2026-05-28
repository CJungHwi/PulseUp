/**
 * DynamicStretchingEditorPanel — 우측 상단: 일자/시간별 Dynamic Stretching 등록 편집기
 *
 * 표시:
 * - 운동 일자 선택 + 운동선택/삭제/취소/저장 버튼
 * - 운동 테이블: 위치/순차변경/시간/이름(영문/한글)/자극부위/특징/필요기구/삭제
 *
 * 사용처: `DynamicStretching.tsx`
 */
import React from 'react'
import {
  Activity,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import dayjs, { Dayjs } from 'dayjs'
import { DATE_FORMATS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Table as ShadcnTable,
  TableBody as ShadcnTableBody,
  TableCell as ShadcnTableCell,
  TableHead as ShadcnTableHead,
  TableHeader as ShadcnTableHeader,
  TableRow as ShadcnTableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { Exercise } from './dynamicStretchingTypes'

const HEADER_CELL =
  'h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]'
const HEADER_CELL_LAST =
  'h-[45px] px-2 text-xs font-bold text-center border-b-0 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]'

interface DynamicStretchingEditorPanelProps {
  rightSelectedDate: Dayjs | null
  onChangeDate: (next: Dayjs | null) => void
  isDatePickerOpen: boolean
  onChangeDatePickerOpen: (open: boolean) => void
  exercises: Exercise[]
  selectedExerciseId: string | null
  selectedMasterId: string | null
  onSelectExercise: (exercise: Exercise) => void
  onMoveExercise: (index: number, direction: 'up' | 'down') => void
  onDurationChange: (id: string, duration: number) => void
  onDeleteSingle: (id: string) => void
  onOpenExerciseModal: () => void
  onDelete: () => void
  onCancel: () => void
  onSave: () => void
}

export const DynamicStretchingEditorPanel: React.FC<DynamicStretchingEditorPanelProps> = ({
  rightSelectedDate,
  onChangeDate,
  isDatePickerOpen,
  onChangeDatePickerOpen,
  exercises,
  selectedExerciseId,
  selectedMasterId,
  onSelectExercise,
  onMoveExercise,
  onDurationChange,
  onDeleteSingle,
  onOpenExerciseModal,
  onDelete,
  onCancel,
  onSave,
}) => (
  <Card className="h-full flex flex-col bg-card shadow-md">
    <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
      <CardTitle className="text-lg font-bold flex items-center gap-2">
        <Activity className="h-5 w-5 text-primary" />
        일자-시간별 Dynamic Stretching 등록
      </CardTitle>
    </CardHeader>

    <CardContent className="flex-1 min-h-0 overflow-hidden p-0 flex flex-col">
      <div className="p-4 border-b border-[#343637] dark:border-[#6b7280] bg-[#f9fafb]/50 dark:bg-muted/20 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex flex-col gap-1 flex-1 min-w-[130px]">
            <Label className="text-[11px] text-muted-foreground leading-none">운동일자</Label>
            <Popover open={isDatePickerOpen} onOpenChange={onChangeDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="min-w-[150px] justify-between text-left border-[#343637] dark:border-[#6b7280] h-9 text-xs"
                >
                  {rightSelectedDate ? rightSelectedDate.format(DATE_FORMATS.DAYJS_DISPLAY) : '날짜 선택'}
                  <CalendarIcon className="ml-2 h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={rightSelectedDate?.toDate()}
                  onSelect={(d) => {
                    onChangeDate(d ? dayjs(d) : null)
                    if (d) onChangeDatePickerOpen(false)
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={onOpenExerciseModal} className="h-9">
            <Plus className="h-4 w-4 mr-2" /> 운동선택
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="h-9"
            disabled={!selectedMasterId}
          >
            <Trash2 className="h-4 w-4 mr-2" /> 삭제
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel} className="h-9">
            <X className="h-4 w-4 mr-2" /> 취소
          </Button>
          <Button size="sm" onClick={onSave} className="h-9" disabled={exercises.length === 0}>
            <Save className="h-4 w-4 mr-2" /> 저장
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 border border-t-0 border-[#343637] dark:border-[#6b7280] bg-[#f9fafb] dark:bg-[#1d1d1d] overflow-hidden">
        <div className="h-full overflow-auto scrollbar-hide">
          <ShadcnTable className="w-full table-fixed border-separate border-spacing-0">
            <ShadcnTableHeader className="sticky top-0 z-10">
              <ShadcnTableRow className="hover:bg-transparent border-b-0">
                <ShadcnTableHead className={cn(HEADER_CELL, 'w-[70px]')}>위치</ShadcnTableHead>
                <ShadcnTableHead className={cn(HEADER_CELL, 'w-[90px]')}>순차변경</ShadcnTableHead>
                <ShadcnTableHead className={cn(HEADER_CELL, 'w-[90px]')}>시간(초)</ShadcnTableHead>
                <ShadcnTableHead className={cn(HEADER_CELL, 'w-[150px]')}>운동명(영문)</ShadcnTableHead>
                <ShadcnTableHead className={cn(HEADER_CELL, 'w-[150px]')}>운동명(한글)</ShadcnTableHead>
                <ShadcnTableHead className={cn(HEADER_CELL, 'w-[110px]')}>자극부위</ShadcnTableHead>
                <ShadcnTableHead className={cn(HEADER_CELL, 'min-w-[200px]')}>특징 및 효과</ShadcnTableHead>
                <ShadcnTableHead className={cn(HEADER_CELL, 'w-[120px]')}>필요기구</ShadcnTableHead>
                <ShadcnTableHead className={cn(HEADER_CELL_LAST, 'w-[70px]')}>삭제</ShadcnTableHead>
              </ShadcnTableRow>
            </ShadcnTableHeader>
            <ShadcnTableBody className="bg-[#f9fafb] dark:bg-[#1d1d1d]">
              {exercises.length === 0 ? (
                <ShadcnTableRow className="border-b-0">
                  <ShadcnTableCell colSpan={9} className="h-24 text-center border-b-0 text-muted-foreground">
                    조회된 기록이 없습니다.
                  </ShadcnTableCell>
                </ShadcnTableRow>
              ) : (
                exercises.map((ex, idx) => (
                  <ShadcnTableRow
                    key={ex.id}
                    className={cn(
                      'cursor-pointer h-[35px] border-b-0 group transition-colors',
                      'hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30',
                      selectedExerciseId === ex.id && 'bg-primary/20'
                    )}
                    onClick={() => onSelectExercise(ex)}
                  >
                    <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors">
                      {ex.position || `DS${idx + 1}`}
                    </ShadcnTableCell>
                    <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation()
                            onMoveExercise(idx, 'up')
                          }}
                          disabled={idx === 0}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation()
                            onMoveExercise(idx, 'down')
                          }}
                          disabled={idx === exercises.length - 1}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </ShadcnTableCell>
                    <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDurationChange(ex.id, Math.max(10, ex.duration - 5))
                          }}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="number"
                          min={10}
                          value={ex.duration}
                          onChange={(e) => {
                            e.stopPropagation()
                            const raw = e.target.value
                            const val = raw === '' ? 10 : parseInt(raw, 10)
                            if (!Number.isNaN(val) && val >= 10) onDurationChange(ex.id, val)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onFocus={(e) => {
                            e.stopPropagation()
                            e.target.select()
                          }}
                          className="h-7 w-12 text-xs text-center p-1 font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          aria-label="시간(초) 입력"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDurationChange(ex.id, ex.duration + 5)
                          }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </ShadcnTableCell>
                    <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] truncate group-hover:text-inherit transition-colors">
                      {ex.name_en || '-'}
                    </ShadcnTableCell>
                    <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] truncate font-medium group-hover:text-inherit transition-colors">
                      {ex.name_ko || '-'}
                    </ShadcnTableCell>
                    <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] truncate text-muted-foreground group-hover:text-inherit transition-colors">
                      {ex.target_muscles || '-'}
                    </ShadcnTableCell>
                    <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-left border-r border-[#343637] dark:border-[#6b7280] truncate text-muted-foreground group-hover:text-inherit transition-colors">
                      {ex.characteristics || '-'}
                    </ShadcnTableCell>
                    <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] truncate text-muted-foreground group-hover:text-inherit transition-colors">
                      {ex.equipment || '-'}
                    </ShadcnTableCell>
                    <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center group-hover:text-inherit transition-colors">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteSingle(ex.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </ShadcnTableCell>
                  </ShadcnTableRow>
                ))
              )}
            </ShadcnTableBody>
          </ShadcnTable>
        </div>
      </div>
    </CardContent>
  </Card>
)
