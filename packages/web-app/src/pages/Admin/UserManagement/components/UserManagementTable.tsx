/**
 * UserManagementTable — 사용자 목록 테이블 + 무한 스크롤
 *
 * 행 컬럼: 아이디/이름/이메일/소속지점/역할/승인상태/사용여부/가입일/최근접속
 *
 * 사용처: `UserManagement.tsx`
 */
import React, { useCallback, useEffect, useRef } from 'react'
import { Loader2, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { User } from '@/services/admin.service'
import { formatSafeDate, getRoleBadgeVariant, getRoleLabel } from './userManagementUtils'

const HEADER_CELL =
  'h-[45px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]'
const HEADER_CELL_LAST =
  'h-[45px] text-center font-bold px-2 border-b-0 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]'
const BODY_CELL =
  'h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors'
const BODY_CELL_LAST =
  'h-[35px] py-0 px-2 text-xs group-hover:text-inherit group-hover:font-inherit transition-colors'

interface UserManagementTableProps {
  users: User[]
  loading: boolean
  total: number
  selectedUserId: string | null
  onSelectUser: (user: User) => void
  onLoadMore: () => void
  canLoadMore: boolean
}

export const UserManagementTable: React.FC<UserManagementTableProps> = ({
  users,
  loading,
  total,
  selectedUserId,
  onSelectUser,
  onLoadMore,
  canLoadMore,
}) => {
  const observerRef = useRef<IntersectionObserver | null>(null)

  const lastElementRef = useCallback(
    (node: HTMLTableRowElement | null) => {
      if (loading) return
      observerRef.current?.disconnect()
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && canLoadMore) {
          onLoadMore()
        }
      })
      if (node) observerRef.current.observe(node)
    },
    [loading, canLoadMore, onLoadMore]
  )

  useEffect(() => () => observerRef.current?.disconnect(), [])

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            <h3 className="text-lg font-medium">사용자 목록</h3>
          </div>
          <Badge variant="outline">총 {total}명</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0">
        <div className="h-full border border-[#343637] dark:border-[#6b7280] overflow-auto relative scrollbar-hide bg-[#f9fafb] dark:bg-[#1d1d1d]">
          <Table className="w-full table-fixed border-separate border-spacing-0">
            <TableHeader className="sticky top-0 z-10 shadow-sm">
              <TableRow className="hover:bg-transparent border-b-0">
                <TableHead className={cn(HEADER_CELL, 'w-[100px]')}>아이디</TableHead>
                <TableHead className={cn(HEADER_CELL, 'w-[80px]')}>이름</TableHead>
                <TableHead className={cn(HEADER_CELL, 'w-[150px]')}>이메일</TableHead>
                <TableHead className={cn(HEADER_CELL, 'w-[150px]')}>소속지점</TableHead>
                <TableHead className={cn(HEADER_CELL, 'w-[100px]')}>역할</TableHead>
                <TableHead className={cn(HEADER_CELL, 'w-[80px]')}>승인상태</TableHead>
                <TableHead className={cn(HEADER_CELL, 'w-[80px]')}>사용여부</TableHead>
                <TableHead className={cn(HEADER_CELL, 'w-[100px]')}>가입일</TableHead>
                <TableHead className={cn(HEADER_CELL_LAST, 'w-[150px]')}>최근 접속</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && users.length === 0 ? (
                <TableRow className="border-b-0">
                  <TableCell colSpan={9} className="h-24 text-center border-b-0">
                    데이터를 불러오는 중...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow className="border-b-0">
                  <TableCell colSpan={9} className="h-24 text-center border-b-0">
                    데이터가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user, index) => (
                  <TableRow
                    key={user.id}
                    ref={index === users.length - 1 ? lastElementRef : null}
                    className={cn(
                      'h-[35px] cursor-pointer border-b-0 group transition-colors bg-[#f9fafb] dark:bg-[#1d1d1d]',
                      'hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30',
                      selectedUserId === user.id && 'bg-muted/80 ring-1 ring-inset ring-primary/30'
                    )}
                    onClick={() => onSelectUser(user)}
                  >
                    <TableCell className={cn(BODY_CELL, 'font-medium')}>{user.userid}</TableCell>
                    <TableCell className={BODY_CELL}>{user.name}</TableCell>
                    <TableCell
                      className={cn(BODY_CELL, 'truncate max-w-[150px]')}
                      title={user.email || ''}
                    >
                      {user.email}
                    </TableCell>
                    <TableCell className={BODY_CELL}>{user.branchName || '-'}</TableCell>
                    <TableCell className={cn(BODY_CELL, 'text-center')}>
                      <Badge
                        variant={getRoleBadgeVariant(user.role)}
                        className="h-5 text-[10px] px-1 pointer-events-none"
                      >
                        {getRoleLabel(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className={cn(BODY_CELL, 'text-center')}>
                      {user.isApproved ? (
                        <Badge className="h-5 text-[10px] px-1 bg-green-500 hover:bg-green-600 border-none pointer-events-none">
                          승인됨
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="h-5 text-[10px] px-1 pointer-events-none">
                          대기중
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className={cn(BODY_CELL, 'text-center')}>
                      {user.isActive ? (
                        <Badge
                          variant="outline"
                          className="h-5 text-[10px] px-1 text-blue-600 border-blue-200 pointer-events-none"
                        >
                          사용중
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="h-5 text-[10px] px-1 pointer-events-none">
                          중지됨
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className={cn(BODY_CELL, 'text-center text-muted-foreground')}>
                      {formatSafeDate(user.createdAt)}
                    </TableCell>
                    <TableCell className={cn(BODY_CELL_LAST, 'text-center text-muted-foreground')}>
                      {user.lastLoginAt ? formatSafeDate(user.lastLoginAt, '-', true) : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}

              {loading && users.length > 0 && (
                <TableRow className="border-b-0">
                  <TableCell colSpan={9} className="h-10 text-center border-b-0">
                    <div className="flex justify-center items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-xs text-muted-foreground">더 불러오는 중...</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
