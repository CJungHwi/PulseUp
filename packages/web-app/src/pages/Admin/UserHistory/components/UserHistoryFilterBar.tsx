/**
 * UserHistoryFilterBar — 사용자명 검색 + 활성 사용자만 토글
 *
 * 사용처: `UserHistory.tsx`
 */
import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Filter, Search } from 'lucide-react'

interface UserHistoryFilterBarProps {
  searchTerm: string
  onSearchTermChange: (value: string) => void
  onlyActiveUsers: boolean
  onOnlyActiveUsersChange: (value: boolean) => void
}

export const UserHistoryFilterBar: React.FC<UserHistoryFilterBarProps> = ({
  searchTerm,
  onSearchTermChange,
  onlyActiveUsers,
  onOnlyActiveUsersChange,
}) => (
  <Card className="shadow-md">
    <CardContent className="py-3 px-4">
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="flex items-center gap-2 mr-4">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-sm font-semibold whitespace-nowrap">필터 및 검색</h3>
        </div>
        <div className="flex-1 min-w-[200px] relative w-full">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="사용자명으로 검색..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            id="active-users-only"
            checked={onlyActiveUsers}
            onCheckedChange={onOnlyActiveUsersChange}
          />
          <Label htmlFor="active-users-only" className="text-sm">
            현재 로그인 중만 표시
          </Label>
        </div>
      </div>
    </CardContent>
  </Card>
)
