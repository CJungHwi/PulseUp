/**
 * 소스 요약 — 회원 운동기록 요약 카드
 *
 * 기능: 운동일수, 운동시간, 출석률, 심박 요약 지표를 카드로 표시한다.
 *
 * 호출/연동: API 없음. `MemberWorkoutRecords`에서 조회한 summary props 사용.
 *
 * 관련 컴포넌트: `MemberWorkoutRecords`.
 *
 * 흐름: summary props → 카드 지표 배열 변환 → 반응형 카드 그리드 렌더링.
 */

import { Activity, CalendarCheck, HeartPulse, Timer } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { MemberWorkoutSummary } from '@/types/memberWorkoutRecords'
import { formatMinute } from './memberWorkoutRecordsUtils'

interface SummaryCardsProps {
  summary: MemberWorkoutSummary
}

export const SummaryCards = ({ summary }: SummaryCardsProps) => {
  const cards = [
    {
      title: '운동일수',
      value: `${summary.workout_days}일`,
      helper: `예약 ${summary.booked_classes}건`,
      icon: CalendarCheck,
      color: 'text-blue-500',
    },
    {
      title: '총 운동시간',
      value: formatMinute(summary.total_workout_minutes),
      helper: '운동 상세 기준',
      icon: Timer,
      color: 'text-emerald-500',
    },
    {
      title: '출석률',
      value: `${summary.attendance_rate}%`,
      helper: `출석 ${summary.attended_classes} · 결석 ${summary.noshow_classes}`,
      icon: Activity,
      color: 'text-amber-500',
    },
    {
      title: '심박 요약',
      value: `${summary.avg_heart_rate || 0} bpm`,
      helper: `최고 ${summary.max_heart_rate || 0} bpm`,
      icon: HeartPulse,
      color: 'text-rose-500',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-[3px]">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card key={card.title} className="border-[#343637] dark:border-[#6b7280] shadow-md">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{card.title}</p>
                <p className="mt-1 text-2xl font-bold leading-none truncate">{card.value}</p>
                <p className="mt-2 text-xs text-muted-foreground truncate">{card.helper}</p>
              </div>
              <div className="h-10 w-10 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                <Icon className={`h-5 w-5 ${card.color}`} aria-hidden="true" />
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
