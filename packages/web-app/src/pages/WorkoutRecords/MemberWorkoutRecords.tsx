/**
 * 페이지 요약 — 회원 운동기록 (`/account/workout-records`)
 *
 * 기능: 지점 회원 본인의 수업 예약/출석 결과, 운동일별 심박 그래프, 인바디 최신 현황을 종합 대시보드로 표시한다.
 *
 * 호출/연동: `memberWorkoutRecordsApi.getOverview/getWorkoutHeartRate`.
 *
 * 관련 컴포넌트:
 * - `SummaryCards`: 월간 운동/출석/심박 KPI 카드
 * - `BookingAttendanceList`: 수업 예약 목록 및 출석 결과
 * - `WorkoutDayList`: 운동일 목록 및 심박 그래프 선택
 * - `HeartRateChartCard`: Recharts 기반 수업일별 심박 그래프
 * - `InbodyOverviewCard`: 최근 인바디 현황 및 등록 예정 안내
 *
 * 흐름: 월 선택 → 요약 API 조회 → 첫 운동일 선택 → 선택 운동일 심박 상세 조회 → 그래프/목록 동시 표시.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { memberWorkoutRecordsApi } from '@/services/memberWorkoutRecordsApi'
import { useSnackbar } from '@/contexts/SnackbarContext'
import type {
  MemberWorkoutRecordsOverview,
  WorkoutHeartRateDetail,
} from '@/types/memberWorkoutRecords'
import { BookingAttendanceList } from './components/BookingAttendanceList'
import { HeartRateChartCard } from './components/HeartRateChartCard'
import { InbodyOverviewCard } from './components/InbodyOverviewCard'
import { SummaryCards } from './components/SummaryCards'
import { WorkoutDayList } from './components/WorkoutDayList'
import {
  getApiErrorMessage,
  getCurrentMonthValue,
} from './components/memberWorkoutRecordsUtils'

const emptyOverview: MemberWorkoutRecordsOverview = {
  month: getCurrentMonthValue(),
  summary: {
    workout_days: 0,
    total_workout_minutes: 0,
    booked_classes: 0,
    attended_classes: 0,
    noshow_classes: 0,
    cancelled_classes: 0,
    reserved_classes: 0,
    attendance_rate: 0,
    avg_heart_rate: 0,
    max_heart_rate: 0,
  },
  bookings: [],
  workoutDays: [],
  inbody: { status: 'empty', latest: null },
}

export const MemberWorkoutRecords = () => {
  const { showSnackbar } = useSnackbar()
  const [month, setMonth] = useState(() => getCurrentMonthValue())
  const [overview, setOverview] = useState<MemberWorkoutRecordsOverview>(emptyOverview)
  const [selectedWorkoutId, setSelectedWorkoutId] = useState('')
  const [heartRate, setHeartRate] = useState<WorkoutHeartRateDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [heartRateLoading, setHeartRateLoading] = useState(false)

  const selectedWorkout = useMemo(
    () => overview.workoutDays.find((workout) => workout.id === selectedWorkoutId) || null,
    [overview.workoutDays, selectedWorkoutId]
  )

  const loadOverview = useCallback(async () => {
    setLoading(true)
    try {
      const nextOverview = await memberWorkoutRecordsApi.getOverview(month)
      setOverview(nextOverview)
      setSelectedWorkoutId((currentId) => {
        const hasCurrentWorkout = nextOverview.workoutDays.some((workout) => workout.id === currentId)
        return hasCurrentWorkout ? currentId : nextOverview.workoutDays[0]?.id || ''
      })
    } catch (error) {
      showSnackbar({
        message: getApiErrorMessage(error, '운동기록을 불러오지 못했습니다.'),
        severity: 'error',
      })
      setOverview(emptyOverview)
      setSelectedWorkoutId('')
    } finally {
      setLoading(false)
    }
  }, [month, showSnackbar])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  useEffect(() => {
    let isCancelled = false

    const loadHeartRate = async () => {
      if (!selectedWorkoutId) {
        setHeartRate(null)
        return
      }

      setHeartRateLoading(true)
      try {
        const nextHeartRate = await memberWorkoutRecordsApi.getWorkoutHeartRate(selectedWorkoutId)
        if (!isCancelled) setHeartRate(nextHeartRate)
      } catch (error) {
        if (!isCancelled) {
          setHeartRate(null)
          showSnackbar({
            message: getApiErrorMessage(error, '심박 기록을 불러오지 못했습니다.'),
            severity: 'error',
          })
        }
      } finally {
        if (!isCancelled) setHeartRateLoading(false)
      }
    }

    loadHeartRate()

    return () => {
      isCancelled = true
    }
  }, [selectedWorkoutId, showSnackbar])

  const handleRefresh = () => {
    loadOverview()
  }

  return (
    <div className="relative h-[calc(100vh-140px)] p-0 flex flex-col gap-[3px] overflow-hidden bg-background">
      <Card className="border-[#343637] dark:border-[#6b7280] shadow-md">
        <CardContent className="h-14 px-4 py-0 flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold leading-none truncate">내 운동기록</h1>
              <p className="mt-1 text-xs text-muted-foreground truncate">
                {selectedWorkout ? `${selectedWorkout.workout_date} 심박 기록 선택됨` : '예약, 출석, 심박, 인바디 현황'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-[3px] shrink-0">
            <Input
              type="month"
              value={month}
              className="w-[150px] h-9 text-xs bg-card border-[#343637] dark:border-[#6b7280]"
              aria-label="조회 월 선택"
              onChange={(event) => setMonth(event.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              disabled={loading}
              aria-label="운동기록 새로고침"
              onClick={handleRefresh}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              )}
              새로고침
            </Button>
          </div>
        </CardContent>
      </Card>

      <SummaryCards summary={overview.summary} />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(260px,0.85fr)_minmax(430px,1.45fr)_minmax(280px,0.9fr)] gap-[3px] flex-1 min-h-0 overflow-hidden">
        <BookingAttendanceList bookings={overview.bookings} />
        <HeartRateChartCard heartRate={heartRate} loading={heartRateLoading} />
        <div className="min-h-0 flex flex-col gap-[3px] overflow-hidden">
          <WorkoutDayList
            workoutDays={overview.workoutDays}
            selectedWorkoutId={selectedWorkoutId}
            onSelectWorkout={setSelectedWorkoutId}
          />
          <InbodyOverviewCard inbody={overview.inbody} />
        </div>
      </div>
    </div>
  )
}

export default MemberWorkoutRecords
