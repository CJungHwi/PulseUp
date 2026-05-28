/**
 * UserManagementFilterBar — 검색/역할 필터/새로고침/사용자 추가
 *
 * 사용처: `UserManagement.tsx`
 */
import React from 'react'
import { Filter, RefreshCw, Search, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface UserManagementFilterBarProps {
  searchTerm: string
  onSearchTermChange: (value: string) => void
  roleFilter: string
  onRoleFilterChange: (value: string) => void
  loading: boolean
  isBranchAdmin: boolean
  onRefresh: () => void
  onAddUser: () => void
}

export const UserManagementFilterBar: React.FC<UserManagementFilterBarProps> = ({
  searchTerm,
  onSearchTermChange,
  roleFilter,
  onRoleFilterChange,
  loading,
  isBranchAdmin,
  onRefresh,
  onAddUser,
}) => (
  <Card className="flex flex-col min-h-0 shrink-0 shadow-md">
    <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
      <div className="flex items-center gap-2">
        <Filter className="w-5 h-5" />
        <CardTitle className="text-lg font-bold">사용자 관리</CardTitle>
      </div>
      <Button onClick={onAddUser} size="sm">
        <UserPlus className="w-4 h-4 mr-2" />
        사용자 추가
      </Button>
    </CardHeader>
    <CardContent className="py-2">
      <div className="flex flex-col sm:flex-row gap-4 items-center w-full">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="사용자명 또는 아이디로 검색..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="min-w-[150px]">
          <Select
            value={roleFilter}
            onValueChange={onRoleFilterChange}
            labels={{
              all: '모든 역할',
              user: '일반 사용자',
              branch_admin: '지점관리자',
              super_admin: '슈퍼 관리자',
            }}
            disabled={isBranchAdmin}
          >
            <SelectTrigger>
              <SelectValue placeholder="역할 필터" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">모든 역할</SelectItem>
              <SelectItem value="user">일반 사용자</SelectItem>
              <SelectItem value="branch_admin">지점관리자</SelectItem>
              <SelectItem value="super_admin">슈퍼 관리자</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[100px]">
          <Button variant="outline" className="w-full" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
)
