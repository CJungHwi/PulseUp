/**
 * 페이지 요약 — 개인 심박 상세 (`/account/workout-records/:workoutId/heart-rate`)
 *
 * 기능: 선택 운동일의 심박 시계열을 확대 그래프, zone 분포, 측정값 테이블로 상세 조회한다.
 *
 * 호출/연동: `memberWorkoutRecordsApi.getWorkoutHeartRate`.
 *
 * 관련 컴포넌트:
 * - `HeartRateStatsSummary`, `HeartRateAreaChart`: 공통 심박 차트 UI
 * - `HeartRateZoneSummary`: zone 분포
 * - `HeartRateReadingsTable`: 측정값 상세 테이블
 *
 * 흐름: URL workoutId → 심박 API 조회 → 통계·그래프·테이블 렌더링 → 운동기록 목록으로 복귀.
 */

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Activity, ArrowLeft, HeartPulse, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { memberWorkoutRecordsApi } from '@/services/memberWorkoutRecordsApi'
import { useSnackbar } from '@/contexts/SnackbarContext'
import type { WorkoutHeartRateDetail } from '@/types/memberWorkoutRecords'
import { HeartRateReadingsTable } from './components/HeartRateReadingsTable'
import { HeartRateZoneSummary } from './components/HeartRateZoneSummary'
import {
  HeartRateAreaChart,
  HeartRateStatsSummary,
} from './components/heartRateChartShared'
import { formatDate, getApiErrorMessage } from './components/memberWorkoutRecordsUtils'

export const MemberWorkoutHeartRateDetail = () => {
  const { workoutId = '' } = useParams()
  const navigate = useNavigate()
  const { showSnackbar } = useSnackbar()
  const [heartRate, setHeartRate] = useState<WorkoutHeartRateDetail | null>(null)
  const [loading, setLoading] = useState(false)

  const loadHeartRate = useCallback(async () => {
    if (!workoutId) {
      setHeartRate(null)
      return
    }

    setLoading(true)
    try {
      const nextHeartRate = await memberWorkoutRecordsApi.getWorkoutHeartRate(workoutId)
      setHeartRate(nextHeartRate)
    } catch (error) {
      setHeartRate(null)
      showSnackbar({
        message: getApiErrorMessage(error, '심박 기록을 불러오지 못했습니다.'),
        severity: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [showSnackbar, workoutId])

  useEffect(() => {
    loadHeartRate()
  }, [loadHeartRate])

  useEffect(() => {
    if (!workoutId) {
      navigate('/account/workout-records', { replace: true })
    }
  }, [navigate, workoutId])

  const series = heartRate?.series || []
  const stats = heartRate?.stats
  const workout = heartRate?.workout

  return (
    <div className="relative h-[calc(100vh-140px)] p-0 flex flex-col gap-[3px] overflow-hidden bg-background">
      <Card className="border-[#343637] dark:border-[#6b7280] shadow-md">
        <CardContent className="h-14 px-4 py-0 flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 text-xs"
              aria-label="운동기록 목록으로 돌아가기"
              asChild
            >
              <Link to="/account/workout-records">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                목록
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold leading-none truncate flex items-center gap-2">
                <HeartPulse className="h-5 w-5 shrink-0" aria-hidden="true" />
                개인 심박 상세
              </h1>
              <p className="mt-1 text-xs text-muted-foreground truncate">
                {workout
                  ? `${formatDate(workout.workout_date)} · ${workout.method_name || '운동'}`
                  : '운동일 심박 기록 상세'}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 text-xs shrink-0"
            disabled={loading || !workoutId}
            aria-label="심박 기록 새로고침"
            onClick={loadHeartRate}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
            새로고침
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <Card className="flex-1 border-[#343637] dark:border-[#6b7280] shadow-md">
          <CardContent className="h-full flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            심박 기록을 불러오는 중...
          </CardContent>
        </Card>
      ) : series.length > 0 && stats ? (
        <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)] gap-[3px] overflow-hidden">
          <Card className="h-full min-h-0 flex flex-col bg-card shadow-md border-[#343637] dark:border-[#6b7280]">
            <CardContent className="flex-1 min-h-0 flex flex-col gap-[3px] p-4">
              <HeartRateStatsSummary
                avgHeartRate={stats.avg_heart_rate}
                maxHeartRate={stats.max_heart_rate}
                minHeartRate={stats.min_heart_rate}
              />
              <HeartRateAreaChart
                series={series}
                gradientId="heartRateGradientDetail"
                minHeightClassName="min-h-[320px]"
              />
              <HeartRateZoneSummary zoneCounts={stats.zone_counts} />
            </CardContent>
          </Card>
          <HeartRateReadingsTable series={series} />
        </div>
      ) : (
        <Card className="flex-1 border-[#343637] dark:border-[#6b7280] shadow-md">
          <CardContent className="h-full flex flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <Activity className="h-8 w-8" aria-hidden="true" />
            <p>해당 운동일의 심박 기록이 없습니다.</p>
            <Button type="button" variant="outline" size="sm" className="h-9 text-xs" asChild>
              <Link to="/account/workout-records">운동기록으로 돌아가기</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default MemberWorkoutHeartRateDetail
