/**
 * 소스 요약 — 운동일 목록
 *
 * 기능: 월간 운동기록을 날짜별로 표시하고 선택된 운동일의 심박 그래프 조회를 유도한다.
 *
 * 호출/연동: API 없음. `MemberWorkoutRecords`에서 조회한 workoutDays props 및 선택 핸들러 사용.
 *
 * 관련 컴포넌트: `MemberWorkoutRecords`, `HeartRateChartCard`.
 *
 * 흐름: workoutDays props → 선택 가능한 버튼 목록 → 선택 ID 변경 이벤트 전달.
 */

import { Dumbbell, HeartPulse } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { MemberWorkoutDay } from '@/types/memberWorkoutRecords'
import { formatDate, formatMinute } from './memberWorkoutRecordsUtils'

interface WorkoutDayListProps {
  workoutDays: MemberWorkoutDay[]
  selectedWorkoutId: string
  onSelectWorkout: (workoutId: string) => void
}

export const WorkoutDayList = ({
  workoutDays,
  selectedWorkoutId,
  onSelectWorkout,
}: WorkoutDayListProps) => {
  return (
    <Card className="h-full min-h-0 flex flex-col border-[#343637] dark:border-[#6b7280] shadow-md">
      <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
        <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
          <Dumbbell className="h-5 w-5" aria-hidden="true" />
          운동일 기록
        </CardTitle>
        <span className="text-xs text-muted-foreground">{workoutDays.length}일</span>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0 overflow-y-auto scrollbar-hide">
        {workoutDays.length > 0 ? (
          <div className="divide-y divide-[#343637] dark:divide-[#6b7280]">
            {workoutDays.map((workout) => {
              const isSelected = workout.id === selectedWorkoutId
              return (
                <button
                  key={workout.id}
                  type="button"
                  className={cn(
                    'w-full text-left p-3 transition-colors focus:outline-none focus:ring-2 focus:ring-ring',
                    'hover:bg-muted/30',
                    isSelected && 'bg-primary/20'
                  )}
                  aria-label={`${formatDate(workout.workout_date)} 운동기록 보기`}
                  aria-pressed={isSelected}
                  onClick={() => onSelectWorkout(workout.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">
                        {formatDate(workout.workout_date)} · {workout.method_name || workout.category_name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground truncate">
                        {workout.exercise_names || '운동 상세 없음'}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatMinute(workout.total_minutes)} · 운동 {workout.exercise_count}개
                      </p>
                    </div>
                    <Badge variant="outline" size="sm" className="gap-1 shrink-0">
                      <HeartPulse className="h-3 w-3" aria-hidden="true" />
                      {workout.avg_heart_rate || 0}
                    </Badge>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="h-full min-h-[180px] flex items-center justify-center p-4 text-sm text-muted-foreground">
            해당 월의 운동기록이 없습니다.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
