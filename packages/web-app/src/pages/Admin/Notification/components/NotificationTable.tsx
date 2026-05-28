/**
 * NotificationTable — 공지사항 목록 테이블 + 페이지네이션
 *
 * 행 클릭: 상세 선택(조회수 증가)
 * 더블클릭: 수정 모달 오픈
 *
 * 사용처: `Notification.tsx`
 */
import React from 'react'
import { Bell } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  NOTIFICATION_TYPE_LABELS,
  type Notification as NotificationItem,
} from '@/types/notification'
import { getTypeBadgeVariant } from './notificationUtils'

const HEADER_CELL =
  'h-[45px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]'
const HEADER_CELL_LAST =
  'h-[45px] text-center font-bold px-2 border-b-0 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]'
const BODY_CELL =
  'h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors'
const BODY_CELL_LAST =
  'h-[35px] py-0 px-2 text-xs group-hover:text-inherit group-hover:font-inherit transition-colors'

interface NotificationTableProps {
  notifications: NotificationItem[]
  loading: boolean
  total: number
  page: number
  limit: number
  onSelect: (notification: NotificationItem) => void
  onDoubleClick: (notification: NotificationItem) => void
  onPageChange: (page: number) => void
  onLimitChange: (limit: string) => void
}

export const NotificationTable: React.FC<NotificationTableProps> = ({
  notifications,
  loading,
  total,
  page,
  limit,
  onSelect,
  onDoubleClick,
  onPageChange,
  onLimitChange,
}) => {
  const totalPages = Math.ceil(total / limit) || 1

  return (
    <Card className="flex-1 overflow-hidden flex flex-col shadow-md">
      <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            <CardTitle className="text-lg">공지사항 목록</CardTitle>
          </div>
          <Badge variant="outline">총 {total}개</Badge>
        </div>
      </CardHeader>

      <div className="flex-1 overflow-hidden p-[3px]">
        <div className="h-full rounded-lg border border-[#343637] dark:border-[#6b7280] overflow-auto relative scrollbar-hide bg-[#f9fafb] dark:bg-[#1d1d1d]">
          <Table className="w-full table-fixed border-separate border-spacing-0">
            <TableHeader className="sticky top-0 z-10 shadow-sm">
              <TableRow className="hover:bg-transparent border-b-0">
                <TableHead className={cn(HEADER_CELL, 'w-[100px]')}>유형</TableHead>
                <TableHead className={cn(HEADER_CELL, 'w-[200px]')}>제목</TableHead>
                <TableHead className={cn(HEADER_CELL, 'w-[300px]')}>내용</TableHead>
                <TableHead className={cn(HEADER_CELL, 'w-[80px]')}>상단고정</TableHead>
                <TableHead className={cn(HEADER_CELL, 'w-[120px]')}>작성일</TableHead>
                <TableHead className={cn(HEADER_CELL, 'w-[100px]')}>작성자</TableHead>
                <TableHead className={cn(HEADER_CELL_LAST, 'w-[80px]')}>조회수</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && notifications.length === 0 ? (
                <TableRow className="border-b-0">
                  <TableCell colSpan={7} className="h-24 text-center border-b-0">
                    데이터를 불러오는 중...
                  </TableCell>
                </TableRow>
              ) : notifications.length === 0 ? (
                <TableRow className="border-b-0">
                  <TableCell colSpan={7} className="h-24 text-center border-b-0">
                    데이터가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                notifications.map((notification) => (
                  <TableRow
                    key={notification.id}
                    className={cn(
                      'cursor-pointer h-[35px] border-b-0 group transition-colors bg-[#f9fafb] dark:bg-[#1d1d1d]',
                      'hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30'
                    )}
                    onClick={() => onSelect(notification)}
                    onDoubleClick={() => onDoubleClick(notification)}
                  >
                    <TableCell className={cn(BODY_CELL, 'text-center')}>
                      <Badge
                        variant={getTypeBadgeVariant(notification.type)}
                        className="h-5 text-[10px] px-1 pointer-events-none"
                      >
                        {NOTIFICATION_TYPE_LABELS[notification.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className={cn(BODY_CELL, 'text-left')}>{notification.title}</TableCell>
                    <TableCell
                      className={cn(BODY_CELL, 'text-left truncate max-w-[300px]')}
                      title={notification.content}
                    >
                      {notification.content}
                    </TableCell>
                    <TableCell className={cn(BODY_CELL, 'text-center')}>
                      <Badge
                        variant={notification.is_pinned ? 'default' : 'outline'}
                        className="h-5 text-[10px] px-1 pointer-events-none"
                      >
                        {notification.is_pinned ? '고정' : '일반'}
                      </Badge>
                    </TableCell>
                    <TableCell className={cn(BODY_CELL, 'text-center text-muted-foreground')}>
                      {new Date(notification.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className={cn(BODY_CELL, 'text-center')}>
                      {notification.author_name || '-'}
                    </TableCell>
                    <TableCell className={cn(BODY_CELL_LAST, 'text-center')}>
                      {notification.view_count || 0}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="border-t p-2 flex items-center justify-between bg-muted/20">
        <div className="flex items-center gap-2">
          <Select
            value={String(limit)}
            onValueChange={onLimitChange}
            labels={{ '10': '10', '25': '25', '50': '50' }}
          >
            <SelectTrigger className="w-[70px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">행 표시</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            페이지 {page} / {totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              {'<'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              {'>'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
