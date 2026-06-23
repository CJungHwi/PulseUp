/**
 * WorkoutDetailTable — 운동 상세 정보 테이블 (위치/운동명/자극부위/특징/기구/양쪽)
 *
 * - 컬럼 너비 % 단위로 리사이즈 가능 (`useDetailColumnResize` 훅 사용)
 * - AMRAP/EMOM·stress/loop MAIN 카테고리는 "횟수" 컬럼 추가
 * - 운동명(영문/한글) 클릭 시 `ExerciseVideoDialog`로 영상 모달 표시
 */

import React, { useCallback, useState } from 'react'
import { Info } from 'lucide-react'
import {
  Table as ShadcnTable,
  TableBody as ShadcnTableBody,
  TableCell as ShadcnTableCell,
  TableHead as ShadcnTableHead,
  TableHeader as ShadcnTableHeader,
  TableRow as ShadcnTableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useSnackbar } from '@/contexts/SnackbarContext'
import { showWorkoutDetailRepsColumn, isCD, isDS } from './monthProgramUtils'
import { ExerciseVideoDialog } from './ExerciseVideoDialog'
import { buildExerciseVideoEmbedUrl } from './monthProgramVideoUtils'
import type { WorkoutDetail, WorkoutMaster } from './monthProgramTypes'

interface WorkoutDetailTableProps {
  selectedMaster: WorkoutMaster | null
  workoutDetails: WorkoutDetail[]
  selectedDetailId: string | null
  onSelectDetail: (id: string) => void
  detailTableContainerRef: React.RefObject<HTMLDivElement>
  detailTableColumnWidths: number[]
  detailTableColumnWidthsWithReps: number[]
  resizingDetailColIndex: number | null
  onColResizeStart: (colIndex: number) => (e: React.MouseEvent) => void
}

const HEADERS_WITH_REPS = ['위치', '횟수', '운동명(영문)', '운동명(한글)', '자극부위', '특징/효과', '기구', '양쪽'] as const
const HEADERS_BASIC = ['위치', '운동명(영문)', '운동명(한글)', '자극부위', '특징/효과', '기구', '양쪽'] as const

const formatBilateralLabel = (row: WorkoutDetail): string => {
  if (isDS(row.major_category) || isCD(row.major_category)) return ''
  return row.is_bilateral ? 'Y' : 'N'
}

const getExerciseDisplayName = (row: WorkoutDetail): string =>
  row.name_ko || row.exerciseName || row.name_en || '운동'

interface ExerciseNameCellProps {
  label: string
  row: WorkoutDetail
  hasVideo: boolean
  onOpenVideo: (row: WorkoutDetail) => void
  className?: string
}

const ExerciseNameCell: React.FC<ExerciseNameCellProps> = ({
  label,
  row,
  hasVideo,
  onOpenVideo,
  className,
}) => {
  const isClickable = label !== '-'

  const handleClick = (e: React.MouseEvent) => {
    if (!isClickable) return
    e.stopPropagation()
    onOpenVideo(row)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isClickable) return
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    e.stopPropagation()
    onOpenVideo(row)
  }

  const content = (
    <button
      type="button"
      disabled={!isClickable}
      aria-label={isClickable ? `${label} 영상 보기` : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'truncate block w-full text-left bg-transparent border-0 p-0 text-inherit font-inherit',
        isClickable && 'cursor-pointer underline-offset-2 hover:underline',
        hasVideo && 'text-blue-600 dark:text-blue-400',
        !isClickable && 'cursor-default',
        className,
      )}
    >
      {label}
    </button>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {content}
      </TooltipTrigger>
      <TooltipContent>
        <p className="max-w-xs">
          {isClickable ? (hasVideo ? `${label} (클릭하여 영상 보기)` : `${label} (영상 확인)`) : label}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}

export const WorkoutDetailTable: React.FC<WorkoutDetailTableProps> = ({
  selectedMaster,
  workoutDetails,
  selectedDetailId,
  onSelectDetail,
  detailTableContainerRef,
  detailTableColumnWidths,
  detailTableColumnWidthsWithReps,
  resizingDetailColIndex,
  onColResizeStart,
}) => {
  const { showSnackbar } = useSnackbar()
  const [videoDialogOpen, setVideoDialogOpen] = useState(false)
  const [videoTarget, setVideoTarget] = useState<WorkoutDetail | null>(null)

  const handleOpenExerciseVideo = useCallback(
    (row: WorkoutDetail) => {
      const embedUrl = buildExerciseVideoEmbedUrl(row.video_url, row.video_start_time)
      if (!embedUrl) {
        showSnackbar({ message: '등록된 운동 영상이 없습니다.', severity: 'warning' })
        return
      }
      setVideoTarget(row)
      setVideoDialogOpen(true)
    },
    [showSnackbar],
  )

  const showRepsColumn = showWorkoutDetailRepsColumn(
    selectedMaster?.workoutCategoriesId,
    selectedMaster?.workoutCategory,
    selectedMaster?.workoutCategoriesName,
    selectedMaster?.circuitType,
  )
  const headers = showRepsColumn ? HEADERS_WITH_REPS : HEADERS_BASIC
  const colWidths = showRepsColumn ? detailTableColumnWidthsWithReps : detailTableColumnWidths

  return (
    <TooltipProvider>
      <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center gap-2 flex-shrink-0 px-3 py-2 border-b border-[#343637] dark:border-[#6b7280] bg-muted/20">
        <Info className="w-4 h-4 text-primary" />
        <span className="text-xs font-bold">운동 상세 정보 ({workoutDetails.length}개)</span>
      </div>

      <div
        ref={detailTableContainerRef}
        className="flex-1 min-h-0 overflow-auto relative scrollbar-hide bg-[#f9fafb] dark:bg-[#1d1d1d] overscroll-behavior-contain touch-pan-y"
      >
        <ShadcnTable className="w-full table-fixed border-separate border-spacing-0">
          <colgroup>
            {colWidths.map((w, i) => (
              <col key={i} style={{ width: `${w}%`, minWidth: 40 }} />
            ))}
          </colgroup>
          <ShadcnTableHeader className="sticky top-0 z-10 bg-[#b9adb5] dark:bg-gray-800">
            <ShadcnTableRow className="hover:bg-transparent border-b-0 h-[45px]">
              {headers.map((label, i) => (
                <ShadcnTableHead
                  key={label}
                  className={cn(
                    'relative text-center font-bold px-2 border-b-0 border-[#343637] dark:border-[#6b7280] text-[#27272a] dark:text-[#94a3b8]',
                    i < headers.length - 1 && 'border-r',
                  )}
                >
                  {label}
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    tabIndex={0}
                    aria-label={`${label} 컬럼 너비 조절`}
                    onMouseDown={onColResizeStart(i)}
                    className={cn(
                      'absolute top-0 right-0 w-1 h-full cursor-col-resize transition-colors -mr-[2px]',
                      'hover:bg-primary/60 active:bg-primary',
                      resizingDetailColIndex === i && 'bg-primary',
                    )}
                  />
                </ShadcnTableHead>
              ))}
            </ShadcnTableRow>
          </ShadcnTableHeader>
          <ShadcnTableBody>
            {workoutDetails.length > 0 ? (
              workoutDetails.map((row, idx) => {
                const showReps = showRepsColumn && !isDS(row.major_category) && !isCD(row.major_category)
                const hasVideo = !!buildExerciseVideoEmbedUrl(row.video_url, row.video_start_time)
                const nameEn = row.name_en || '-'
                const nameKo = row.name_ko || row.exerciseName || '-'
                return (
                  <ShadcnTableRow
                    key={row.id}
                    className={cn(
                      'h-[35px] border-b-0 group cursor-pointer hover:bg-muted/30 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors',
                      selectedDetailId === row.id ? 'bg-primary/20' : 'bg-[#f9fafb] dark:bg-[#1d1d1d]',
                    )}
                    onClick={() => onSelectDetail(row.id)}
                  >
                    <ShadcnTableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors">
                      {row.position ?? idx + 1}
                    </ShadcnTableCell>
                    {showRepsColumn && (
                      <ShadcnTableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors">
                        {showReps ? row.reps ?? '-' : ''}
                      </ShadcnTableCell>
                    )}
                    <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs border-r border-[#343637] dark:border-[#6b7280] truncate group-hover:text-inherit transition-colors">
                      <ExerciseNameCell
                        label={nameEn}
                        row={row}
                        hasVideo={hasVideo}
                        onOpenVideo={handleOpenExerciseVideo}
                      />
                    </ShadcnTableCell>
                    <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs border-r border-[#343637] dark:border-[#6b7280] truncate font-medium group-hover:text-inherit transition-colors">
                      <ExerciseNameCell
                        label={nameKo}
                        row={row}
                        hasVideo={hasVideo}
                        onOpenVideo={handleOpenExerciseVideo}
                      />
                    </ShadcnTableCell>
                    <ShadcnTableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-[#343637] dark:border-[#6b7280] truncate group-hover:text-inherit transition-colors">
                      {row.targetMuscle || '-'}
                    </ShadcnTableCell>
                    <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs border-r border-[#343637] dark:border-[#6b7280] truncate group-hover:text-inherit transition-colors">
                      {row.characteristics || '-'}
                    </ShadcnTableCell>
                    <ShadcnTableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-[#343637] dark:border-[#6b7280] truncate group-hover:text-inherit transition-colors">
                      {row.equipment || '-'}
                    </ShadcnTableCell>
                    <ShadcnTableCell className="text-center h-[35px] py-0 px-2 text-xs truncate group-hover:text-inherit transition-colors">
                      {formatBilateralLabel(row)}
                    </ShadcnTableCell>
                  </ShadcnTableRow>
                )
              })
            ) : (
              <ShadcnTableRow className="border-b-0">
                <ShadcnTableCell
                  colSpan={headers.length}
                  className="h-24 text-center border-b-0 text-muted-foreground italic"
                >
                  운동 상세 데이터 없음
                </ShadcnTableCell>
              </ShadcnTableRow>
            )}
          </ShadcnTableBody>
        </ShadcnTable>
      </div>

      <ExerciseVideoDialog
        open={videoDialogOpen}
        onOpenChange={setVideoDialogOpen}
        exerciseName={videoTarget ? getExerciseDisplayName(videoTarget) : ''}
        videoUrl={videoTarget?.video_url}
        videoStartTime={videoTarget?.video_start_time}
      />
    </div>
    </TooltipProvider>
  )
}
