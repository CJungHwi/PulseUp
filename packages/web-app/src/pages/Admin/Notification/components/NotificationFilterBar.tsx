/**
 * NotificationFilterBar — 공지 유형/상태 필터 + 제목·내용 검색
 *
 * 사용처: `Notification.tsx`
 */
import React from 'react'
import { Filter, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  NOTIFICATION_STATUS_LABELS,
  NOTIFICATION_TYPE_LABELS,
} from '@/types/notification'

export interface NotificationFilterState {
  type: string
  status: string
  search: string
}

interface NotificationFilterBarProps {
  filters: NotificationFilterState
  onChange: (field: keyof NotificationFilterState, value: string) => void
  onSearch: () => void
}

export const NotificationFilterBar: React.FC<NotificationFilterBarProps> = ({
  filters,
  onChange,
  onSearch,
}) => (
  <Card className="flex-shrink-0 shadow-md">
    <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
      <div className="flex items-center gap-2">
        <Filter className="w-5 h-5" />
        <CardTitle>필터 및 검색</CardTitle>
      </div>
    </CardHeader>
    <CardContent className="py-3 px-4">
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="min-w-[150px]">
          <Select
            value={filters.type}
            onValueChange={(val) => onChange('type', val)}
            labels={{ '': '전체', ...NOTIFICATION_TYPE_LABELS }}
          >
            <SelectTrigger>
              <SelectValue placeholder="공지유형" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">전체</SelectItem>
              {Object.entries(NOTIFICATION_TYPE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[120px]">
          <Select
            value={filters.status}
            onValueChange={(val) => onChange('status', val)}
            labels={{ '': '전체', ...NOTIFICATION_STATUS_LABELS }}
          >
            <SelectTrigger>
              <SelectValue placeholder="활성" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">전체</SelectItem>
              {Object.entries(NOTIFICATION_STATUS_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="제목/내용 검색..."
            value={filters.search}
            onChange={(e) => onChange('search', e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && onSearch()}
            className="pl-8"
          />
        </div>
      </div>
    </CardContent>
  </Card>
)
