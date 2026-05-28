/**
 * PopularWorkoutsCard — 많이 하는 운동 리스트 카드
 *
 * - 보기 모드: 전체 / 지점별 / 날짜별 / 자극부위
 * - DataTable로 순위·횟수·카테고리·운동명·설명·기구 표시
 * - 운동명 호버 시 `VideoTooltip`으로 미리보기
 */

import React from 'react'
import { TrendingUp, Target, Dumbbell, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { DataTable } from '@/components/ui/data-table'
import dayjs, { Dayjs } from 'dayjs'
import type { Branch } from '@/types/branch'
import { VideoTooltip } from './VideoTooltip'
import type { PopularView, SimpleWorkout } from './adminDashboardTypes'

interface PopularWorkoutsCardProps {
  workoutList: SimpleWorkout[]
  branches: Branch[]
  selectedView: PopularView
  onViewChange: (v: PopularView) => void
  selectedBranch: string
  onBranchChange: (b: string) => void
  selectedDate: Dayjs
  onDateChange: (d: Dayjs) => void
  targetMuscleFilter: string
  onTargetMuscleChange: (v: string) => void
  onApplyTargetMuscle: (v: string) => void
}

export const PopularWorkoutsCard: React.FC<PopularWorkoutsCardProps> = ({
  workoutList,
  branches,
  selectedView,
  onViewChange,
  selectedBranch,
  onBranchChange,
  selectedDate,
  onDateChange,
  targetMuscleFilter,
  onTargetMuscleChange,
  onApplyTargetMuscle,
}) => (
  <div className="flex-[1.4] min-h-0 mb-[3px]">
    <Card className="h-full flex flex-col bg-card shadow-md">
      <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-500" />
          많이 하는 운동 리스트
        </CardTitle>
        <div className="flex flex-wrap items-center gap-3">
          <RadioGroup
            defaultValue="전체"
            value={selectedView}
            onValueChange={(value: PopularView) => onViewChange(value)}
            className="flex items-center gap-4 border border-[#343637] dark:border-[#6b7280] rounded-md p-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="전체" id="view-all" />
              <Label htmlFor="view-all">전체</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="지점별" id="view-branch" />
              <Label htmlFor="view-branch">지점별</Label>
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

          {selectedView === '지점별' && (
            <Select
              value={selectedBranch}
              onValueChange={onBranchChange}
              labels={Object.fromEntries(branches.map((b) => [b.name, b.name]))}
            >
              <SelectTrigger className="w-[150px] bg-card">
                <SelectValue placeholder="지점 선택" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.name}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {selectedView === '날짜별' && (
            <DatePicker
              date={selectedDate.toDate()}
              setDate={(date) => date && onDateChange(dayjs(date))}
              className="min-w-[150px] w-[170px] border-[#343637] dark:border-[#6b7280] h-9 text-xs"
            />
          )}

          {selectedView === '자극부위' && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Input
                  placeholder="자극부위 입력"
                  value={targetMuscleFilter}
                  onChange={(e) => onTargetMuscleChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onApplyTargetMuscle(targetMuscleFilter)
                  }}
                  className="w-[150px] bg-card pr-8"
                />
                {targetMuscleFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      onTargetMuscleChange('')
                      onApplyTargetMuscle('')
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button size="sm" onClick={() => onApplyTargetMuscle(targetMuscleFilter)}>
                검색
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 overflow-hidden p-0">
        <DataTable
          data={workoutList.map((workout, index) => ({ ...workout, rank: index + 1 }))}
          columns={[
            {
              accessorKey: 'rank',
              header: '순위',
              size: 90,
              cell: ({ row }) => (
                <div className="flex justify-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ${
                      (row.getValue('rank') as number) <= 3
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-500 text-white'
                    } group-hover:text-blue-600 dark:group-hover:text-yellow-400`}
                  >
                    {row.getValue('rank')}
                  </div>
                </div>
              ),
            },
            {
              accessorKey: 'count',
              header: '횟수',
              size: 100,
              cell: ({ row }) => (
                <div className="flex items-center justify-center gap-1 font-bold text-primary group-hover:text-blue-600 dark:group-hover:text-yellow-400">
                  {row.getValue('count')}회
                </div>
              ),
            },
            {
              accessorKey: 'category',
              header: '카테고리',
              size: 145,
              cell: ({ row }) => (
                <div className="flex items-center justify-center gap-1 font-bold text-primary group-hover:text-blue-600 dark:group-hover:text-yellow-400">
                  {row.getValue('category')}
                </div>
              ),
            },
            {
              accessorKey: 'name',
              header: '운동명(한글)',
              cell: ({ row }) => (
                <VideoTooltip videoUrl={row.original.video_url} exerciseName={row.getValue('name')}>
                  <span className="font-medium cursor-pointer hover:underline">
                    {row.getValue('name')}
                  </span>
                </VideoTooltip>
              ),
            },
            {
              accessorKey: 'name_en',
              header: '운동명(영문)',
              cell: ({ row }) => (
                <span className="text-muted-foreground text-sm group-hover:text-blue-600 dark:group-hover:text-yellow-400">
                  {row.original.name_en || '-'}
                </span>
              ),
            },
            {
              accessorKey: 'target_muscles',
              header: '자극부위',
              cell: ({ row }) => (
                <div className="flex items-center gap-2 text-sm text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-yellow-400">
                  <Target className="w-3 h-3" />
                  {row.original.target_muscles}
                </div>
              ),
            },
            {
              accessorKey: 'description',
              header: '특징 및 효과',
              size: 300,
              cell: ({ row }) => (
                <span
                  className="text-sm truncate max-w-[250px] block group-hover:text-blue-600 dark:group-hover:text-yellow-400"
                  title={row.original.description}
                >
                  {row.original.description}
                </span>
              ),
            },
            {
              accessorKey: 'equipment',
              header: '필요기구',
              size: 120,
              cell: ({ row }) => (
                <div className="flex items-center justify-center gap-2 text-sm group-hover:text-blue-600 dark:group-hover:text-yellow-400">
                  <Dumbbell className="w-3 h-3" />
                  {row.original.equipment}
                </div>
              ),
            },
          ]}
        />
      </CardContent>
    </Card>
  </div>
)
