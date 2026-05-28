/**
 * 소스 요약 — 운동일별 심박 그래프 카드
 *
 * 기능: 선택된 운동일의 심박 시계열을 Recharts AreaChart로 표시하고 평균/최고/최저 심박을 함께 보여준다.
 *
 * 호출/연동: API 없음. `MemberWorkoutRecords`에서 조회한 heartRate props 사용.
 *
 * 관련 컴포넌트: `MemberWorkoutRecords`, `WorkoutDayList`.
 *
 * 흐름: heartRate props → 통계 배지/차트 데이터 → 반응형 그래프 렌더링.
 */

import {
  Activity,
  HeartPulse,
  Loader2,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { HeartRatePoint, WorkoutHeartRateDetail } from '@/types/memberWorkoutRecords'
import { getHeartRateZoneLabel } from './memberWorkoutRecordsUtils'

interface HeartRateChartCardProps {
  heartRate: WorkoutHeartRateDetail | null
  loading: boolean
}

const HeartRateTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const point = payload[0].payload as HeartRatePoint

  return (
    <div className="rounded-md border border-[#343637] dark:border-[#6b7280] bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-bold">{label}</p>
      <p className="mt-1 text-rose-500">{point.heart_rate} bpm</p>
      <p className="text-muted-foreground">{getHeartRateZoneLabel(point.zone)}</p>
    </div>
  )
}

export const HeartRateChartCard = ({ heartRate, loading }: HeartRateChartCardProps) => {
  const series = heartRate?.series || []
  const stats = heartRate?.stats

  return (
    <Card className="h-full min-h-[360px] flex flex-col border-[#343637] dark:border-[#6b7280] shadow-md">
      <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
        <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
          <HeartPulse className="h-5 w-5" aria-hidden="true" />
          수업일별 심박 그래프
        </CardTitle>
        <Badge variant="outline" size="sm">
          {stats?.readings || 0} points
        </Badge>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col gap-[3px] p-4">
        {loading ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            심박 기록을 불러오는 중...
          </div>
        ) : series.length > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-[3px]">
              <div className="rounded-md border border-[#343637] dark:border-[#6b7280] bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">평균</p>
                <p className="mt-1 text-xl font-bold">{stats?.avg_heart_rate || 0}</p>
              </div>
              <div className="rounded-md border border-[#343637] dark:border-[#6b7280] bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">최고</p>
                <p className="mt-1 text-xl font-bold text-rose-500">{stats?.max_heart_rate || 0}</p>
              </div>
              <div className="rounded-md border border-[#343637] dark:border-[#6b7280] bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">최저</p>
                <p className="mt-1 text-xl font-bold text-blue-500">{stats?.min_heart_rate || 0}</p>
              </div>
            </div>

            <div className="flex-1 min-h-[240px] rounded-md border border-[#343637] dark:border-[#6b7280] bg-background/40 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="heartRateGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.55} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(107,114,128,0.35)" />
                  <XAxis dataKey="elapsed_label" tick={{ fontSize: 11 }} minTickGap={24} />
                  <YAxis tick={{ fontSize: 11 }} width={36} domain={['dataMin - 10', 'dataMax + 10']} />
                  <Tooltip content={<HeartRateTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="heart_rate"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="url(#heartRateGradient)"
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
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
