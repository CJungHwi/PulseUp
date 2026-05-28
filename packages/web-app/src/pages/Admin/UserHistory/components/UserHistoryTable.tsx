/**
 * UserHistoryTable — 사용자 로그인 이력 테이블 카드 + 페이지네이션
 *
 * 행: 사용자ID/이름/이메일/지점/로그인 시간(상대+툴팁 절대)/로그인 상태/IP/총 로그인/작업
 *
 * 사용처: `UserHistory.tsx`
 */
import React from 'react'
import { Eye, History, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { UserLoginInfo } from '@/services/admin.service'
import { formatAbsoluteDate, formatSafeDate } from './userHistoryDateUtils'

const HEADER_CELL =
  'h-[45px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]'
const HEADER_CELL_LAST =
  'h-[45px] text-center font-bold px-2 border-b-0 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]'
const BODY_CELL =
  'h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors'
const BODY_CELL_LAST =
  'h-[35px] py-0 px-2 text-xs group-hover:text-inherit group-hover:font-inherit transition-colors'

interface UserHistoryTableProps {
  users: UserLoginInfo[]
  loading: boolean
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
  onShowSessionDetail: (userId: string) => void
  onAskForceLogout: (user: UserLoginInfo) => void
}

export const UserHistoryTable: React.FC<UserHistoryTableProps> = ({
  users,
  loading,
  pagination,
  onPageChange,
  onLimitChange,
  onShowSessionDetail,
  onAskForceLogout,
}) => {
  const totalPages = Math.ceil(pagination.total / pagination.limit) || 1
  const isLastPage = pagination.page * pagination.limit >= pagination.total

  return (
    <Card className="flex-1 flex flex-col min-h-0 shadow-md">
      <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-lg font-medium">사용자 로그인 이력</h3>
          </div>
          <Badge variant="outline">총 {pagination.total}명</Badge>
        </div>
      </CardHeader>

      <div className="flex-1 overflow-hidden p-[3px]">
        <div className="h-full rounded-lg border border-[#343637] dark:border-[#6b7280] overflow-auto relative scrollbar-hide bg-[#f9fafb] dark:bg-[#1d1d1d]">
          <Table className="w-full table-fixed border-separate border-spacing-0">
            <TableHeader className="sticky top-0 z-10 shadow-sm">
              <TableRow className="hover:bg-transparent border-b-0">
                <TableHead className={cn(HEADER_CELL, 'w-[120px]')}>사용자 ID</TableHead>
                <TableHead className={cn(HEADER_CELL, 'w-[120px]')}>이름</TableHead>
                <TableHead className={cn(HEADER_CELL, 'w-[200px]')}>이메일</TableHead>
                <TableHead className={cn(HEADER_CELL, 'w-[150px]')}>지점</TableHead>
                <TableHead className={cn(HEADER_CELL, 'w-[160px]')}>로그인 시간</TableHead>
                <TableHead className={cn(HEADER_CELL, 'w-[140px]')}>로그인 상태</TableHead>
                <TableHead className={cn(HEADER_CELL, 'w-[130px]')}>접속 IP</TableHead>
                <TableHead className={cn(HEADER_CELL, 'w-[120px]')}>총 로그인</TableHead>
                <TableHead className={cn(HEADER_CELL_LAST, 'w-[150px]')}>작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && users.length === 0 ? (
                <TableRow className="border-b-0">
                  <TableCell colSpan={9} className="h-24 text-center border-b-0 text-muted-foreground">
                    데이터를 불러오는 중...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow className="border-b-0">
                  <TableCell colSpan={9} className="h-24 text-center border-b-0 text-muted-foreground">
                    데이터가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow
                    key={user.id}
                    className={cn(
                      'h-[35px] border-b-0 group transition-colors bg-[#f9fafb] dark:bg-[#1d1d1d]',
                      'hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30'
                    )}
                  >
                    <TableCell className={cn(BODY_CELL, 'font-medium')}>{user.userid}</TableCell>
                    <TableCell className={BODY_CELL}>{user.name}</TableCell>
                    <TableCell className={cn(BODY_CELL, 'truncate max-w-[200px]')} title={user.email || ''}>
                      {user.email}
                    </TableCell>
                    <TableCell className={BODY_CELL}>{user.branch_name || '-'}</TableCell>
                    <TableCell className={BODY_CELL}>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>{formatSafeDate(user.last_login_at, '기록 없음')}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{formatAbsoluteDate(user.last_login_at, '기록 없음')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className={cn(BODY_CELL, 'text-center')}>
                      {user.is_currently_logged_in ? (
                        <div className="flex items-center justify-center gap-1">
                          <Badge className="h-5 text-[10px] px-1 bg-green-500 hover:bg-green-600 border-none pointer-events-none">
                            로그인 중
                          </Badge>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <Badge variant="outline" className="h-5 text-[10px] px-1 pointer-events-none">
                            오프라인
                          </Badge>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className={BODY_CELL}>{user.current_session_ip || '-'}</TableCell>
                    <TableCell className={cn(BODY_CELL, 'text-right')}>{user.total_login_count || 0}회</TableCell>
                    <TableCell className={cn(BODY_CELL_LAST, 'text-center')}>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:bg-primary/10"
                          onClick={() => onShowSessionDetail(user.id)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {user.is_currently_logged_in && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => onAskForceLogout(user)}
                          >
                            <LogOut className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
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
            value={String(pagination.limit)}
            onValueChange={(val) => onLimitChange(Number(val))}
            labels={{ '10': '10', '20': '20', '50': '50' }}
          >
            <SelectTrigger className="w-[70px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">행 표시</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            페이지 {pagination.page} / {totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              {'<'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={isLastPage}
            >
              {'>'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
