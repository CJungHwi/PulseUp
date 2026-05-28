/**
 * UserStatsCards — 사용자 운동 통계 4종 카드
 */

import React from 'react'
import {
  Activity,
  Clock as AccessTime,
  Dumbbell as FitnessCenter,
  Timer,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { ExtendedUserStats } from './userDashboardTypes'

interface UserStatsCardsProps {
  stats: ExtendedUserStats | null
}

export const UserStatsCards: React.FC<UserStatsCardsProps> = ({ stats }) => {
  if (!stats) return null

  const items = [
    {
      key: 'workout_days',
      icon: <Activity className="w-8 h-8 text-blue-500" />,
      label: '운동 일수',
      value: stats.workout_days,
      unit: '일',
      bgColor: 'bg-blue-500/10',
    },
    {
      key: 'total_minutes',
      icon: <AccessTime className="w-8 h-8 text-emerald-500" />,
      label: '총 운동 시간',
      value: stats.total_minutes,
      unit: '분',
      bgColor: 'bg-emerald-500/10',
    },
    {
      key: 'avg_daily_minutes',
      icon: <Timer className="w-8 h-8 text-amber-500" />,
      label: '일 평균 운동시간',
      value: stats.avg_daily_minutes,
      unit: '분',
      bgColor: 'bg-amber-500/10',
    },
    {
      key: 'exercise_types_used',
      icon: <FitnessCenter className="w-8 h-8 text-rose-500" />,
      label: '실시한 운동 종류',
      value: stats.exercise_types_used,
      unit: '개',
      bgColor: 'bg-rose-500/10',
    },
  ]

  return (
    <div className="flex flex-wrap justify-between gap-[3px] mb-[3px] shrink-0 w-full">
      {items.map((stat) => (
        <Card
          key={stat.key}
          className="flex-1 min-w-[200px] h-20 flex items-center gap-4 p-4 hover:translate-y-[-2px] hover:shadow-lg transition-all duration-200 bg-card shadow-md"
        >
          <div className={`p-3 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
            {stat.icon}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">{stat.value}</span>
              <span className="text-sm text-muted-foreground">{stat.unit}</span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
