/**
 * MonthProgramPlayButtons — 월간프로그램 상세 헤더 Play 버튼
 *
 * - workout_scope=SINGLE: 가로play(3분할) / 세로play(5분할)
 * - 그 외(TOTAL 등): Play 단일 버튼
 */

import React from 'react'
import { Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WORKOUT_SCOPE_SINGLE } from '@/pages/exercises/shared/workoutScope'
import type { WorkoutMaster } from './monthProgramTypes'
import type { SinglePlayLayout } from './useWorkoutPlay'

export type MonthProgramPlayButtonsProps = {
  selectedMaster: WorkoutMaster | null
  exerciseCount: number
  onPlay: (layout?: SinglePlayLayout) => void
}

export const MonthProgramPlayButtons: React.FC<MonthProgramPlayButtonsProps> = ({
  selectedMaster,
  exerciseCount,
  onPlay,
}) => {
  const disabled = !selectedMaster || exerciseCount === 0
  const isSingleScope =
    (selectedMaster?.workoutScope || 'TOTAL').toUpperCase() === WORKOUT_SCOPE_SINGLE

  if (isSingleScope) {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          className="h-8 bg-green-600 hover:bg-green-700 text-white"
          onClick={() => onPlay('horizontal')}
          disabled={disabled}
          aria-label="가로 재생"
        >
          <Play className="mr-1 h-4 w-4" />
          가로play
        </Button>
        <Button
          size="sm"
          className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => onPlay('vertical')}
          disabled={disabled}
          aria-label="세로 재생"
        >
          <Play className="mr-1 h-4 w-4" />
          세로play
        </Button>
      </div>
    )
  }

  return (
    <Button
      size="sm"
      className="h-8 bg-green-600 hover:bg-green-700 text-white shrink-0"
      onClick={() => onPlay()}
      disabled={disabled}
      aria-label="운동 재생"
    >
      <Play className="mr-1 h-4 w-4" />
      Play
    </Button>
  )
}
