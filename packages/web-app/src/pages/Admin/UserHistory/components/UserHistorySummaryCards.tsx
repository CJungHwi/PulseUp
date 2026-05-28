/**
 * UserHistorySummaryCards — 전체/현재 로그인/오프라인 요약 카드
 *
 * 사용처: `UserHistory.tsx`
 */
import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { User as UserIcon, Wifi, WifiOff } from 'lucide-react'

interface UserHistorySummaryCardsProps {
  summary: {
    totalUsers: number
    currentlyLoggedIn: number
    totalOffline: number
  }
}

export const UserHistorySummaryCards: React.FC<UserHistorySummaryCardsProps> = ({ summary }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-[3px] px-0">
    <Card className="shadow-md">
      <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium">전체 사용자</CardTitle>
        <UserIcon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{summary.totalUsers}</div>
      </CardContent>
    </Card>
    <Card className="shadow-md">
      <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium">현재 로그인 중</CardTitle>
        <Wifi className="h-4 w-4 text-green-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-green-600">{summary.currentlyLoggedIn}</div>
      </CardContent>
    </Card>
    <Card className="shadow-md">
      <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium">오프라인</CardTitle>
        <WifiOff className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-muted-foreground">{summary.totalOffline}</div>
      </CardContent>
    </Card>
  </div>
)
