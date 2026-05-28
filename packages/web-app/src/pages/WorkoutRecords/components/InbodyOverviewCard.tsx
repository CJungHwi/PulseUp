/**
 * 소스 요약 — 인바디 현황 카드
 *
 * 기능: 최근 인바디 측정값 또는 측정 등록 예정 상태를 표시한다.
 *
 * 호출/연동: API 없음. `MemberWorkoutRecords`에서 조회한 inbody props 사용.
 *
 * 관련 컴포넌트: `MemberWorkoutRecords`.
 *
 * 흐름: inbody props → 최신 측정값/빈 상태/스키마 미적용 상태 분기 렌더링.
 */

import { Scale } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { InbodyOverview } from '@/types/memberWorkoutRecords'
import { formatDateTime } from './memberWorkoutRecordsUtils'

interface InbodyOverviewCardProps {
  inbody: InbodyOverview | null
}

export const InbodyOverviewCard = ({ inbody }: InbodyOverviewCardProps) => {
  const latest = inbody?.latest
  const isReady = inbody?.status === 'ready' && latest

  return (
    <Card className="border-[#343637] dark:border-[#6b7280] shadow-md">
      <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
        <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
          <Scale className="h-5 w-5" aria-hidden="true" />
          인바디 현황
        </CardTitle>
        <Badge variant="outline" size="sm">
          {isReady ? '최근 측정' : '등록 예정'}
        </Badge>
      </CardHeader>
      <CardContent className="p-4">
        {isReady ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{formatDateTime(latest.measured_at)} 측정</p>
            <div className="grid grid-cols-2 gap-[3px]">
              <Metric label="체중" value={latest.weight_kg} suffix="kg" />
              <Metric label="골격근량" value={latest.skeletal_muscle_mass} suffix="kg" />
              <Metric label="체지방률" value={latest.body_fat_percentage} suffix="%" />
              <Metric label="BMI" value={latest.bmi} suffix="" />
            </div>
            {latest.memo ? <p className="text-xs text-muted-foreground">{latest.memo}</p> : null}
          </div>
        ) : (
          <div className="min-h-[130px] flex flex-col justify-center gap-2 text-sm text-muted-foreground">
            <p className="font-bold text-foreground">아직 등록된 인바디 측정값이 없습니다.</p>
            <p>
              추후 측정 등록 기능이 연결되면 체중, 골격근량, 체지방률, BMI 변화가 이 영역에 표시됩니다.
            </p>
            {inbody?.status === 'pending_schema' ? (
              <p className="text-xs text-amber-600 dark:text-amber-300">
                `inbody_measurements` 마이그레이션 적용 후 최신 측정값 조회가 활성화됩니다.
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const Metric = ({ label, value, suffix }: { label: string; value: number | null; suffix: string }) => (
  <div className="rounded-md border border-[#343637] dark:border-[#6b7280] bg-muted/20 p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 text-lg font-bold">
      {value == null ? '-' : value}
      {value == null ? '' : suffix}
    </p>
  </div>
)
