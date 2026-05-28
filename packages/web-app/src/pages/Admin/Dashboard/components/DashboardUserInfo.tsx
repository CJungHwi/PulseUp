/**
 * DashboardUserInfo — 승인 대기 사용자 정보 카드 (DataTable)
 */

import React from 'react'
import { Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import type { ColumnDef } from '@tanstack/react-table'
import type { SimpleUser } from './adminDashboardTypes'

interface DashboardUserInfoProps {
  pendingUsers: SimpleUser[]
  onApprove: (userId: string) => void
  onMore: () => void
}

export const DashboardUserInfo: React.FC<DashboardUserInfoProps> = ({
  pendingUsers,
  onApprove,
  onMore,
}) => {
  const columns: ColumnDef<SimpleUser>[] = [
    {
      accessorKey: 'name',
      header: '사용자',
      cell: ({ row }) => (
        <div
          className="font-medium text-xs truncate max-w-[140px] dark:group-hover:text-yellow-400"
          title={row.original.name}
        >
          {row.original.name}
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: '역할',
      cell: ({ row }) => (
        <div className="text-center text-xs dark:group-hover:text-yellow-400">
          {row.original.role === 'branch_admin' ? '지점관리자' : '일반사용자'}
        </div>
      ),
    },
    {
      accessorKey: 'branch_name',
      header: '지점',
      cell: ({ row }) => (
        <div className="text-center text-xs dark:group-hover:text-yellow-400">
          {row.original.branch_name.replace(' 지점', '')}
        </div>
      ),
    },
    {
      accessorKey: 'is_approved',
      header: '승인',
      cell: ({ row }) => (
        <div className="flex justify-center">
          {row.original.is_approved ? (
            <Badge className="text-[10px] h-6 bg-green-500 hover:bg-green-600 text-white border-none">
              승인됨
            </Badge>
          ) : row.original.role === 'branch_admin' && row.original.branch_name === '미지정' ? (
            <Badge variant="secondary" className="text-[10px] h-6 px-2 border-none">
              사용자관리 승인
            </Badge>
          ) : (
            <Button
              size="sm"
              className="text-[10px] h-7 px-3"
              onClick={() => onApprove(row.original.id)}
            >
              승인
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="flex-1 order-1 lg:order-2">
      <Card className="h-full flex flex-col bg-card shadow-md">
        <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-green-500" />
            사용자 정보
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onMore}>
            더보기
          </Button>
        </CardHeader>

        <CardContent className="flex-1 min-h-0 overflow-auto p-0">
          <DataTable data={pendingUsers} columns={columns} />
        </CardContent>
      </Card>
    </div>
  )
}
