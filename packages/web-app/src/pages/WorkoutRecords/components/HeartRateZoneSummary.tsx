/**
 * 소스 요약 — 심박 zone 분포 요약
 *
 * 기능: 운동일별 심박 zone 카운트를 비율 막대와 라벨로 표시한다.
 *
 * 호출/연동: API 없음. `WorkoutHeartRateDetail.stats.zone_counts` props 사용.
 *
 * 관련 컴포넌트: `MemberWorkoutHeartRateDetail`.
 *
 * 흐름: zone_counts → 총합 대비 비율 계산 → zone별 막대 렌더링.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getHeartRateZoneLabel } from './memberWorkoutRecordsUtils'

const ZONE_ORDER = ['rest', 'fat-burn', 'cardio', 'peak'] as const

const ZONE_COLORS: Record<string, string> = {
  rest: 'bg-slate-400',
  'fat-burn': 'bg-emerald-500',
  cardio: 'bg-amber-500',
  peak: 'bg-rose-500',
}

interface HeartRateZoneSummaryProps {
  zoneCounts: Record<string, number>
}

export const HeartRateZoneSummary = ({ zoneCounts }: HeartRateZoneSummaryProps) => {
  const entries = ZONE_ORDER.map((zone) => ({
    zone,
    count: zoneCounts[zone] || 0,
  }))
  const total = entries.reduce((sum, entry) => sum + entry.count, 0)

  return (
    <Card className="flex flex-col overflow-hidden border border-[#343637] dark:border-[#6b7280] shadow-md">
      <CardHeader className="h-8 px-3 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
        <CardTitle className="text-xs font-bold">심박 zone 분포</CardTitle>
        <span className="text-xs text-muted-foreground">{total}회 측정</span>
      </CardHeader>
      <CardContent className="p-2 flex flex-col gap-2">
        {total > 0 ? (
          <>
            <div className="flex h-3 overflow-hidden rounded-md border border-[#343637] dark:border-[#6b7280]">
              {entries.map((entry) => {
                const width = (entry.count / total) * 100
                if (width <= 0) return null
                return (
                  <div
                    key={entry.zone}
                    className={cn(ZONE_COLORS[entry.zone], 'h-full')}
                    style={{ width: `${width}%` }}
                    aria-label={`${getHeartRateZoneLabel(entry.zone)} ${entry.count}회`}
                  />
                )
              })}
            </div>
            <div className="grid grid-cols-2 gap-[3px]">
              {entries.map((entry) => (
                <div
                  key={entry.zone}
                  className="flex items-center justify-between rounded-md border border-[#343637] dark:border-[#6b7280] bg-muted/20 px-2 py-1.5 text-xs"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', ZONE_COLORS[entry.zone])} />
                    <span className="truncate">{getHeartRateZoneLabel(entry.zone)}</span>
                  </div>
                  <span className="font-bold shrink-0">
                    {entry.count}
                    <span className="ml-1 font-normal text-muted-foreground">
                      ({total > 0 ? Math.round((entry.count / total) * 100) : 0}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="py-4 text-center text-xs text-muted-foreground">zone 데이터가 없습니다.</p>
        )}
      </CardContent>
    </Card>
  )
}
