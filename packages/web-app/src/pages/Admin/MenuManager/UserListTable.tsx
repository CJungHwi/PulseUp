import React from 'react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, RefreshCw, Loader2 } from 'lucide-react'
import { UserInfo } from '../../../types/userManager'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface UserListTableProps {
    users: UserInfo[]
    total: number
    loading: boolean
    search: string
    onSearchChange: (value: string) => void
    onRefresh: () => void
    pagination: {
        page: number
        pageSize: number
    }
    onPageChange: (page: number) => void
    selectedUserId: string | null
    onSelectUser: (user: UserInfo) => void
    title: string
    isAdminTable?: boolean
}

export const UserListTable: React.FC<UserListTableProps> = ({
    users,
    total,
    loading,
    search,
    onSearchChange,
    onRefresh,
    pagination,
    onPageChange,
    selectedUserId,
    onSelectUser,
    title,
    isAdminTable = false
}) => {
    const totalPages = Math.ceil(total / pagination.pageSize)

    return (
        <Card className="flex flex-col h-full border border-[#343637] dark:border-[#6b7280] rounded-lg overflow-hidden bg-card shadow-md">
            <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
                    {title}
                </CardTitle>
                <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                    <div className="relative w-full max-w-[280px] min-w-[160px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={isAdminTable ? "관리자 검색..." : "사용자 검색..."}
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="pl-8 h-9 text-xs border-[#343637] dark:border-[#6b7280] bg-card"
                        />
                    </div>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 border-[#343637] dark:border-[#6b7280] shrink-0"
                        onClick={onRefresh}
                        disabled={loading}
                    >
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="flex-1 min-h-0 p-0 bg-[#f9fafb] dark:bg-[#1d1d1d] scrollbar-hide overflow-auto">
                <Table className="w-full table-fixed border-separate border-spacing-0">
                    <TableHeader className="sticky top-0 z-10 shadow-sm">
                        <TableRow className="hover:bg-transparent border-b-0">
                            <TableHead className="h-[45px] px-2 text-xs font-bold bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] border-r border-[#343637] dark:border-[#6b7280] border-b-0 text-center">ID</TableHead>
                            <TableHead className="h-[45px] px-2 text-xs font-bold bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] border-r border-[#343637] dark:border-[#6b7280] border-b-0 text-center">이름</TableHead>
                            <TableHead className="h-[45px] px-2 text-xs font-bold bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] border-r border-[#343637] dark:border-[#6b7280] border-b-0 text-center">이메일</TableHead>
                            <TableHead className="h-[45px] px-2 text-xs font-bold bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] border-r border-[#343637] dark:border-[#6b7280] border-b-0 text-center">역할</TableHead>
                            <TableHead className="h-[45px] px-2 text-xs font-bold bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] border-r border-[#343637] dark:border-[#6b7280] border-b-0 text-center">승인</TableHead>
                            <TableHead className="h-[45px] px-2 text-xs font-bold bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] border-b-0 text-center">지점</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody className="bg-[#f9fafb] dark:bg-[#1d1d1d]">
                        {loading && users.length === 0 ? (
                            <TableRow className="border-b-0">
                                <TableCell colSpan={6} className="h-24 text-center border-b-0">
                                    <div className="flex items-center justify-center text-muted-foreground">
                                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                        로딩 중...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : users.length === 0 ? (
                            <TableRow className="border-b-0">
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground border-b-0">
                                    데이터가 없습니다.
                                </TableCell>
                            </TableRow>
                        ) : (
                            users.map((user) => (
                                <TableRow
                                    key={user.id}
                                    className={cn(
                                        "h-[35px] cursor-pointer transition-colors border-b-0 group",
                                        "hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30",
                                        selectedUserId === user.id ? "bg-muted/80 ring-1 ring-inset ring-primary/30" : "bg-[#f9fafb] dark:bg-[#1d1d1d]"
                                    )}
                                    onClick={() => onSelectUser(user)}
                                >
                                    <TableCell className="h-[35px] py-0 px-2 text-xs font-medium border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit group-hover:font-inherit transition-colors">{(user as any).userid || user.id}</TableCell>
                                    <TableCell className="h-[35px] py-0 px-2 text-xs border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit group-hover:font-inherit transition-colors">{user.name}</TableCell>
                                    <TableCell className="h-[35px] py-0 px-2 text-xs text-muted-foreground border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit group-hover:font-inherit transition-colors">{user.email || '-'}</TableCell>
                                    <TableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit group-hover:font-inherit transition-colors">
                                        <Badge variant={user.role === 'user' ? 'outline' : 'default'} className="text-[10px] px-1.5 h-5 pointer-events-none">
                                            {user.role === 'super_admin' ? '슈퍼' : user.role === 'admin' ? '관리자' : '일반'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit group-hover:font-inherit transition-colors">
                                        <Badge variant={user.isApproved ? 'secondary' : 'destructive'} className="text-[10px] px-1.5 h-5 pointer-events-none">
                                            {user.isApproved ? '승인' : '대기'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="h-[35px] py-0 px-2 text-xs group-hover:text-inherit group-hover:font-inherit transition-colors">{(user as any).branchName || (user as any).branch_name || '-'}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>

            {/* 페이지네이션 완전 제거 */}
        </Card>
    )
}
