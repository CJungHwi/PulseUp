/**
 * 소스 요약 — 심박 그래프 공통 UI
 *
 * 기능: 운동기록 미리보기·상세 화면에서 공유하는 심박 통계, Recharts AreaChart, 툴팁을 제공한다.
 *
 * 호출/연동: API 없음.
 *
 * 관련 컴포넌트: `HeartRateChartCard`, `MemberWorkoutHeartRateDetail`.
 *
 * 흐름: heartRate series/stats props → 통계·차트 렌더링.
 */

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { HeartRatePoint } from '@/types/memberWorkoutRecords'
import { getHeartRateZoneLabel } from './memberWorkoutRecordsUtils'

interface HeartRateStatsSummaryProps {
  avgHeartRate: number
  maxHeartRate: number
  minHeartRate: number
}

interface HeartRateAreaChartProps {
  series: HeartRatePoint[]
  gradientId?: string
  minHeightClassName?: string
}

export const HeartRateTooltip = ({ active, payload, label }: any) => {
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

export const HeartRateStatsSummary = ({
  avgHeartRate,
  maxHeartRate,
  minHeartRate,
}: HeartRateStatsSummaryProps) => (
  <div className="grid grid-cols-3 gap-[3px]">
    <div className="rounded-md border border-[#343637] dark:border-[#6b7280] bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">평균</p>
      <p className="mt-1 text-xl font-bold">{avgHeartRate || 0}</p>
    </div>
    <div className="rounded-md border border-[#343637] dark:border-[#6b7280] bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">최고</p>
      <p className="mt-1 text-xl font-bold text-rose-500">{maxHeartRate || 0}</p>
    </div>
    <div className="rounded-md border border-[#343637] dark:border-[#6b7280] bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">최저</p>
      <p className="mt-1 text-xl font-bold text-blue-500">{minHeartRate || 0}</p>
    </div>
  </div>
)

export const HeartRateAreaChart = ({
  series,
  gradientId = 'heartRateGradient',
  minHeightClassName = 'min-h-[240px]',
}: HeartRateAreaChartProps) => (
  <div
    className={`flex-1 ${minHeightClassName} rounded-md border border-[#343637] dark:border-[#6b7280] bg-background/40 p-2`}
  >
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={series} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
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
          fill={`url(#${gradientId})`}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
)
