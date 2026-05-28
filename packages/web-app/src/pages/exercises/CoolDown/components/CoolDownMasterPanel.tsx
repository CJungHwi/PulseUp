/**
 * CoolDownMasterPanel — 좌측 패널: 검색 + 마스터 목록 + 상세 목록 (수직 스플리터 포함)
 *
 * 표시:
 * - 상단: 년월/메모 검색 입력 + 마스터 목록 테이블(클릭=선택, 더블클릭=적용)
 * - 하단: 선택된 마스터의 상세 운동 테이블
 *
 * 사용처: `CoolDown.tsx`
 */
import React from 'react'
import { ClipboardList, Search } from 'lucide-react'
import dayjs, { Dayjs } from 'dayjs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MonthInput } from '@/components/ui/month-input'
import {
  Table as ShadcnTable,
  TableBody as ShadcnTableBody,
  TableCell as ShadcnTableCell,
  TableHead as ShadcnTableHead,
  TableHeader as ShadcnTableHeader,
  TableRow as ShadcnTableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { WorkoutDetail, WorkoutMaster } from './coolDownTypes'

const HEADER_CELL =
  'h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]'
const HEADER_CELL_LAST =
  'h-[45px] px-2 text-xs font-bold text-center border-b-0 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]'

interface CoolDownMasterPanelProps {
  leftWidth: number
  topHeight: number
  selectedDate: Dayjs | null
  memoFilter: string
  workoutMasters: WorkoutMaster[]
  workoutDetails: WorkoutDetail[]
  selectedMasterId: string | null
  onChangeYearMonth: (next: Dayjs | null) => void
  onChangeMemoFilter: (value: string) => void
  onSearch: () => void
  onSelectMaster: (master: WorkoutMaster) => void
  onApplyMaster: (master: WorkoutMaster) => void
  onStartVerticalDrag: () => void
}

export const CoolDownMasterPanel: React.FC<CoolDownMasterPanelProps> = ({
  leftWidth,
  topHeight,
  selectedDate,
  memoFilter,
  workoutMasters,
  workoutDetails,
  selectedMasterId,
  onChangeYearMonth,
  onChangeMemoFilter,
  onSearch,
  onSelectMaster,
  onApplyMaster,
  onStartVerticalDrag,
}) => (
  <div
    className="left-panel flex flex-col bg-card border border-[#343637] dark:border-[#6b7280] rounded-lg overflow-hidden shadow-md"
    style={{ width: `${leftWidth}%` }}
  >
    {/* Top: Master List */}
    <div className="flex flex-col min-h-0 overflow-hidden" style={{ height: `${topHeight}%` }}>
      <Card className="flex-shrink-0 rounded-none border-0 border-b border-[#343637] dark:border-[#6b7280] shadow-none">
        <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
            <ClipboardList className="h-5 w-5 text-primary" />
            Cool Down 기록
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-4 border-b border-[#343637] dark:border-[#6b7280] bg-muted/30">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1 flex-1 min-w-[130px]">
                <Label className="text-[11px] text-muted-foreground leading-none">년월</Label>
                <MonthInput
                  value={selectedDate ? selectedDate.format('YYYY-MM') : ''}
                  onChange={(e) => {
                    const value = e.target.value
                    onChangeYearMonth(value ? dayjs(`${value}-01`) : null)
                  }}
                  className="w-full border-[#343637] dark:border-[#6b7280] bg-card h-9 text-xs"
                />
              </div>

              <div className="flex flex-col gap-1 flex-[2] min-w-[180px]">
                <Label className="text-[11px] text-muted-foreground leading-none">메모</Label>
                <div className="relative w-full min-w-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="메모 검색..."
                    className="w-full pl-8 border-[#343637] dark:border-[#6b7280] bg-card h-9 text-xs"
                    value={memoFilter}
                    onChange={(e) => onChangeMemoFilter(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex-1 min-h-0 p-0 overflow-hidden">
        <div className="h-full border-t-0 border border-[#343637] dark:border-[#6b7280] bg-[#f9fafb] dark:bg-[#1d1d1d] overflow-hidden">
          <div className="h-full overflow-auto scrollbar-hide">
            <ShadcnTable className="w-full table-fixed border-separate border-spacing-0">
              <ShadcnTableHeader className="sticky top-0 z-10">
                <ShadcnTableRow className="hover:bg-transparent border-b-0">
                  <ShadcnTableHead className={cn(HEADER_CELL, 'w-[110px]')}>날짜</ShadcnTableHead>
                  <ShadcnTableHead className={cn(HEADER_CELL, 'w-[90px]')}>시간</ShadcnTableHead>
                  <ShadcnTableHead className={HEADER_CELL_LAST}>메모</ShadcnTableHead>
                </ShadcnTableRow>
              </ShadcnTableHeader>
              <ShadcnTableBody className="bg-[#f9fafb] dark:bg-[#1d1d1d]">
                {workoutMasters.length === 0 ? (
                  <ShadcnTableRow className="border-b-0">
                    <ShadcnTableCell colSpan={3} className="h-24 text-center border-b-0 text-muted-foreground text-xs">
                      조회된 기록이 없습니다.
                    </ShadcnTableCell>
                  </ShadcnTableRow>
                ) : (
                  workoutMasters.map((m) => (
                    <ShadcnTableRow
                      key={m.id}
                      className={cn(
                        'cursor-pointer h-[35px] border-b-0 group transition-colors',
                        'hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30',
                        selectedMasterId === m.id && 'bg-primary/20'
                      )}
                      onClick={() => onSelectMaster(m)}
                      onDoubleClick={() => {
                        onSelectMaster(m)
                        onApplyMaster(m)
                      }}
                    >
                      <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors">
                        {dayjs(m.date).format('YYYY-MM-DD')}
                      </ShadcnTableCell>
                      <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors">
                        {m.workoutTime}
                      </ShadcnTableCell>
                      <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-left truncate group-hover:text-inherit transition-colors">
                        {m.memo}
                      </ShadcnTableCell>
                    </ShadcnTableRow>
                  ))
                )}
              </ShadcnTableBody>
            </ShadcnTable>
          </div>
        </div>
      </div>
    </div>

    {/* Vertical Splitter */}
    <div
      onMouseDown={onStartVerticalDrag}
      className="h-2 cursor-row-resize bg-[#9e9e9e] hover:bg-primary flex items-center justify-center shrink-0"
    >
      <div className="w-8 h-0.5 bg-card rounded-full" />
    </div>

    {/* Bottom: Detail List */}
    <div
      className="flex flex-col min-h-0 overflow-hidden p-0"
      style={{ height: `${100 - topHeight}%` }}
    >
      <div className="h-full border border-[#343637] dark:border-[#6b7280] bg-[#f9fafb] dark:bg-[#1d1d1d] overflow-hidden">
        <div className="h-full overflow-auto scrollbar-hide">
          <ShadcnTable className="w-full table-fixed border-separate border-spacing-0">
            <ShadcnTableHeader className="sticky top-0 z-10 bg-[#b9adb5] dark:bg-gray-800">
              <ShadcnTableRow className="h-[45px] hover:bg-transparent border-b-0 text-[#27272a] dark:text-[#94a3b8]">
                <ShadcnTableHead className={cn(HEADER_CELL, 'w-[44px]')}>#</ShadcnTableHead>
                <ShadcnTableHead className={HEADER_CELL}>운동명</ShadcnTableHead>
                <ShadcnTableHead className={cn(HEADER_CELL, 'w-[80px]')}>부위</ShadcnTableHead>
                <ShadcnTableHead className={cn(HEADER_CELL_LAST, 'w-[64px]')}>시간</ShadcnTableHead>
              </ShadcnTableRow>
            </ShadcnTableHeader>
            <ShadcnTableBody>
              {workoutDetails.length === 0 ? (
                <ShadcnTableRow className="border-b-0">
                  <ShadcnTableCell colSpan={4} className="h-24 text-center border-b-0 text-muted-foreground text-xs">
                    조회된 기록이 없습니다.
                  </ShadcnTableCell>
                </ShadcnTableRow>
              ) : (
                workoutDetails.map((d) => (
                  <ShadcnTableRow
                    key={d.id}
                    className="h-[35px] border-b-0 group transition-colors bg-[#f9fafb] dark:bg-[#1d1d1d] hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30"
                  >
                    <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit group-hover:font-inherit transition-colors">
                      {d.sequence}
                    </ShadcnTableCell>
                    <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-left truncate border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit group-hover:font-inherit transition-colors">
                      {d.exerciseName}
                    </ShadcnTableCell>
                    <ShadcnTableCell className="h-[35px] py-0 px-2 text-[10px] text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit group-hover:font-inherit transition-colors">
                      {d.targetMuscle}
                    </ShadcnTableCell>
                    <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center group-hover:text-inherit group-hover:font-inherit transition-colors">
                      {d.time}
                    </ShadcnTableCell>
                  </ShadcnTableRow>
                ))
              )}
            </ShadcnTableBody>
          </ShadcnTable>
        </div>
      </div>
    </div>
  </div>
)
