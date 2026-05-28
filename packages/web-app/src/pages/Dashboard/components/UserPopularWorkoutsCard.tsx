/**
 * UserPopularWorkoutsCard — 사용자 자주 하는 운동 카드 (필터 + 테이블)
 */

import React from 'react'
import { Dumbbell as FitnessCenter } from 'lucide-react'
import dayjs, { Dayjs } from 'dayjs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { VideoTooltip } from './VideoTooltip'
import type { UserPopularGridRow, UserPopularView } from './userDashboardTypes'

interface UserPopularWorkoutsCardProps {
  rows: UserPopularGridRow[]
  selectedView: UserPopularView
  onViewChange: (v: UserPopularView) => void
  selectedDate: Dayjs
  onDateChange: (d: Dayjs) => void
  targetMuscleFilter: string
  onTargetMuscleChange: (v: string) => void
  onApplyTargetMuscle: (v: string) => void
}

export const UserPopularWorkoutsCard: React.FC<UserPopularWorkoutsCardProps> = ({
  rows,
  selectedView,
  onViewChange,
  selectedDate,
  onDateChange,
  targetMuscleFilter,
  onTargetMuscleChange,
  onApplyTargetMuscle,
}) => (
  <div className="flex-[1.4] min-h-0 mb-[3px] w-full">
    <Card className="h-full flex flex-col bg-card shadow-md">
      <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
          <FitnessCenter className="w-5 h-5 text-primary" />
          자주 하는 운동 리스트
        </CardTitle>
        <div className="flex flex-wrap items-center gap-3">
          <RadioGroup
            defaultValue="전체"
            value={selectedView}
            onValueChange={(value: UserPopularView) => onViewChange(value)}
            className="flex items-center gap-4 border border-[#343637] dark:border-[#6b7280] rounded-md p-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="전체" id="view-all" />
              <Label htmlFor="view-all">전체</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="날짜별" id="view-date" />
              <Label htmlFor="view-date">날짜별</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="자극부위" id="view-muscle" />
              <Label htmlFor="view-muscle">자극부위</Label>
            </div>
          </RadioGroup>

          {selectedView === '날짜별' && (
            <DatePicker
              date={selectedDate.toDate()}
              setDate={(date) => date && onDateChange(dayjs(date))}
              className="w-[170px]"
            />
          )}

          {selectedView === '자극부위' && (
            <div className="flex items-center gap-2">
              <Input
                placeholder="자극부위 입력"
                value={targetMuscleFilter}
                onChange={(e) => onTargetMuscleChange(e.target.value)}
                className="w-[150px] bg-card"
              />
              <Button size="sm" onClick={() => onApplyTargetMuscle(targetMuscleFilter)}>
                검색
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 p-0 overflow-hidden flex flex-col">
        <div className="flex-1 min-h-0 border border-[#343637] dark:border-[#6b7280] overflow-auto relative scrollbar-hide bg-[#f9fafb] dark:bg-[#1d1d1d]">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <FitnessCenter className="w-12 h-12 opacity-20" />
              <div className="text-center">
                <p className="text-lg font-semibold">운동 기록이 없습니다</p>
                <p className="text-sm">운동을 등록하면 통계가 표시됩니다</p>
              </div>
            </div>
          ) : (
            <Table className="w-full table-fixed border-separate border-spacing-0">
              <TableHeader className="sticky top-0 z-10 shadow-sm bg-[#b9adb5] dark:bg-gray-800">
                <TableRow className="hover:bg-transparent border-b-0 h-[45px]">
                  <TableHead className="w-[60px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">순위</TableHead>
                  <TableHead className="w-[60px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">횟수</TableHead>
                  <TableHead className="w-[110px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">카테고리</TableHead>
                  <TableHead className="w-[120px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">운동명(영문)</TableHead>
                  <TableHead className="w-[120px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">운동명(한글)</TableHead>
                  <TableHead className="w-[70px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">자극부위</TableHead>
                  <TableHead className="w-[150px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">특징/효과</TableHead>
                  <TableHead className="w-[70px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">기구</TableHead>
                  <TableHead className="w-[100px] text-center font-bold px-2 border-b-0 text-[#27272a] dark:text-[#94a3b8]">최근운동</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="h-[35px] border-b-0 group transition-colors bg-[#f9fafb] dark:bg-[#1d1d1d] hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30"
                  >
                    <TableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500">
                      <div
                        className={cn(
                          'w-6 h-6 rounded-full mx-auto flex items-center justify-center font-bold',
                          row.rank <= 3
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {row.rank}
                      </div>
                    </TableCell>
                    <TableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 font-bold text-primary group-hover:text-inherit group-hover:font-inherit transition-colors">
                      {row.exercise_count}회
                    </TableCell>
                    <TableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 truncate group-hover:text-inherit group-hover:font-inherit transition-colors">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="truncate w-full">{row.category_name || '-'}</div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{row.category_name}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 truncate group-hover:text-inherit group-hover:font-inherit transition-colors">
                      <VideoTooltip videoUrl={row.video_url} exerciseName={row.exercise_name_en}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-pointer hover:text-blue-600 dark:hover:text-yellow-400 transition-colors truncate block">
                              {row.exercise_name_en}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{row.exercise_name_en}</p>
                          </TooltipContent>
                        </Tooltip>
                      </VideoTooltip>
                    </TableCell>
                    <TableCell className="h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 truncate group-hover:text-inherit group-hover:font-inherit transition-colors">
                      <VideoTooltip videoUrl={row.video_url} exerciseName={row.exercise_name}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-pointer hover:text-blue-600 dark:hover:text-yellow-400 transition-colors truncate block">
                              {row.exercise_name}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{row.exercise_name}</p>
                          </TooltipContent>
                        </Tooltip>
                      </VideoTooltip>
                    </TableCell>
                    <TableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 truncate group-hover:text-inherit group-hover:font-inherit transition-colors">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="truncate w-full">{row.target_muscles}</div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{row.target_muscles}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 truncate group-hover:text-inherit group-hover:font-inherit transition-colors">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="truncate w-full">{row.characteristics || '-'}</div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{row.characteristics || '-'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 truncate group-hover:text-inherit group-hover:font-inherit transition-colors">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="truncate w-full">{row.equipment || '맨몸'}</div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{row.equipment || '맨몸'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-center h-[35px] py-0 px-2 text-xs truncate group-hover:text-inherit group-hover:font-inherit transition-colors">
                      {row.last_workout_date ? dayjs(row.last_workout_date).format('YYYY-MM-DD') : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  </div>
)
