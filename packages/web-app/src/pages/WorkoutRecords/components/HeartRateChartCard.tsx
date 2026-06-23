/**
 * 소스 요약 — 운동일별 심박 그래프 카드
 *
 * 기능: 선택된 운동일의 심박 시계열 미리보기를 표시하고 상세 페이지로 이동하는 더보기를 제공한다.
 *
 * 호출/연동: API 없음. `MemberWorkoutRecords`에서 조회한 heartRate props 사용.
 *
 * 관련 컴포넌트: `MemberWorkoutRecords`, `WorkoutDayList`, `MemberWorkoutHeartRateDetail`,
 *              `heartRateChartShared`.
 *
 * 흐름: heartRate props → 미리보기 차트 → 더보기 클릭 시 상세 페이지 이동.
 */

import { Activity, ChevronRight, HeartPulse, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { WorkoutHeartRateDetail } from '@/types/memberWorkoutRecords'
import {
  HeartRateAreaChart,
  HeartRateStatsSummary,
} from './heartRateChartShared'

interface HeartRateChartCardProps {
  workoutId: string
  heartRate: WorkoutHeartRateDetail | null
  loading: boolean
}

export const HeartRateChartCard = ({ workoutId, heartRate, loading }: HeartRateChartCardProps) => {
  const series = heartRate?.series || []
  const stats = heartRate?.stats
  const canViewDetail = Boolean(workoutId && series.length > 0)
  const detailPath = `/account/workout-records/${workoutId}/heart-rate`

  return (
    <Card className="h-full min-h-[360px] flex flex-col border-[#343637] dark:border-[#6b7280] shadow-md">
      <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
        <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
          <HeartPulse className="h-5 w-5" aria-hidden="true" />
          수업일별 심박 그래프
        </CardTitle>
        {canViewDetail ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 text-xs gap-1"
            aria-label="심박 상세 보기"
            asChild
          >
            <Link to={detailPath}>
              더보기
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 text-xs gap-1"
            disabled
            aria-label="심박 상세 보기"
          >
            더보기
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col gap-[3px] p-4">
        {loading ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            심박 기록을 불러오는 중...
          </div>
        ) : series.length > 0 && stats ? (
          <>
            <HeartRateStatsSummary
              avgHeartRate={stats.avg_heart_rate}
              maxHeartRate={stats.max_heart_rate}
              minHeartRate={stats.min_heart_rate}
            />
            <HeartRateAreaChart
              series={series}
              gradientId="heartRateGradientPreview"
              minHeightClassName="min-h-[240px]"
            />
          </>
        ) : (
          <div className="flex-1 min-h-[260px] flex flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <Activity className="h-8 w-8" aria-hidden="true" />
            <p>선택된 운동일의 심박 기록이 없습니다.</p>
            <p className="text-xs">ANT+ 심박계 수집 후 그래프가 표시됩니다.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
