/**
 * DashboardStatsCards — 사용자 통계 4종 카드 (전체/승인/대기/사용중지)
 */

import React from 'react'
import { Users, UserPlus, UserMinus, Ban } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { getStatIconColor } from './adminDashboardUtils'
import type { SimpleStats } from './adminDashboardTypes'

interface DashboardStatsCardsProps {
  stats: SimpleStats
}

export const DashboardStatsCards: React.FC<DashboardStatsCardsProps> = ({ stats }) => {
  const items = [
    {
      key: 'total-users',
      icon: <Users className="h-6 w-6" />,
      iconClass: '',
      title: '전체 사용자',
      value: stats.total_users,
    },
    {
      key: 'approved-users',
      icon: <UserPlus className="h-6 w-6" />,
      iconClass: 'approved',
      title: '승인된 사용자',
      value: stats.approved_users,
    },
    {
      key: 'pending-users',
      icon: <UserMinus className="h-6 w-6" />,
      iconClass: 'pending',
      title: '승인 대기',
      value: stats.pending_users,
    },
    {
      key: 'disabled-users',
      icon: <Ban className="h-6 w-6" />,
      iconClass: 'disabled',
      title: '사용중지',
      value: stats.inactive_users,
    },
  ]

  return (
    <div className="flex flex-wrap justify-between gap-[3px] mb-[3px] shrink-0 w-full">
      {items.map((stat) => (
        <Card
          key={stat.key}
          data-testid="stats-card"
          className="flex-1 min-w-[200px] h-20 flex items-center gap-4 p-4 hover:translate-y-[-2px] hover:shadow-lg transition-all duration-200 bg-card shadow-md"
        >
          <div
            className={`p-2 rounded-lg ${getStatIconColor(stat.iconClass)} text-white flex items-center justify-center shrink-0`}
          >
            {stat.icon}
          </div>
          <div className="text-left min-w-0 flex-1">
            <p className="text-sm text-muted-foreground leading-tight mb-1">{stat.title}</p>
            <p className="text-2xl font-bold leading-none">{stat.value.toLocaleString()}</p>
          </div>
        </Card>
      ))}
    </div>
  )
}
