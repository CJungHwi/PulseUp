/**
 * 페이지 요약 — 사용자 관리 (`/admin/usermanager`)
 *
 * 기능: 사용자 목록·검색·승인·정지·역할·지점 할당·비밀번호 초기화.
 *
 * 호출/연동:
 * - `adminService.getUsers`, `updateUser`, `approveUser`, `suspendUser`, `reactivateUser`
 * - `userManagerApi.resetPassword`, `branchApi.getBranches`
 * - DB/SP는 `packages/api-server` 사용자·관리자 API 참조.
 *
 * 관련 컴포넌트: `AddUserModal`, 내부 `BranchSelect`, shadcn 테이블·다이얼로그.
 *
 * 흐름: 목록 로드 → 행 선택 → 모달/폼에서 수정·승인·초기화.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  Users,
  UserPlus,
  Search,
  Filter,
  RefreshCw,
  CheckCircle,
  XCircle,
  Play,
  Ban,
  Shield,
  ShieldCheck,
  Pencil,
  Trash2,
  Eye,
  MapPin,
  Pause,
  Save,
  X,
  Loader2,
  AlertCircle
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
// import { useToast } from '@/hooks/use-toast'; // Assuming useToast hook exists or I'll implement a simple alert fallback for now
import { Separator } from '@/components/ui/separator';
import { adminService, User, UserListResponse } from '../../../services/admin.service'
import { userManagerApi } from '../../../services/userManagerApi'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { AddUserModal } from '../../../components/Admin/AddUserModal'
import { branchApi } from '../../../services/branchApi'
import { cn } from '@/lib/utils'

// 지점 선택 컴포넌트
interface BranchSelectProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

const BranchSelect: React.FC<BranchSelectProps> = ({ value, onChange, disabled = false }) => {
  const [branches, setBranches] = useState<Array<{ id: string; name: string; region: string }>>([])
  const [loading, setLoading] = useState(false)

  console.log('BranchSelect 렌더링 - 현재 value:', value)

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        setLoading(true)
        console.log('BranchSelect: 지점 목록 조회 시작')
        const response = await branchApi.getBranches()
        console.log('BranchSelect: API 응답:', response)

        if (response.success) {
          const branchItems = response.data.items || []
          console.log('BranchSelect: 지점 데이터:', branchItems)
          setBranches(
            branchItems.map((branch) => ({
              ...branch,
              id: String((branch as any).id),
            }))
          )
        } else {
          console.error('BranchSelect: API 응답 실패:', response)
        }
      } catch (error) {
        console.error('BranchSelect: 지점 목록 조회 실패:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBranches()
  }, [])

  return (
    <div className="w-full">
      <Label className="text-sm font-medium mb-1.5 block">소속 지점</Label>
      <Select
        value={value ? String(value) : 'none'}
        onValueChange={onChange}
        disabled={disabled || loading}
      >
        <SelectTrigger>
          {(() => {
            const currentValue = value ? String(value) : 'none'
            if (loading) return <span className="text-muted-foreground">지점 불러오는 중...</span>
            if (currentValue === 'none') return <span className="text-muted-foreground">지점 선택 안함</span>

            const selectedBranch = branches.find((branch) => branch.id === currentValue)
            if (!selectedBranch) return <span className="text-muted-foreground">지점 선택</span>

            return (
              <span>
                {selectedBranch.name} ({selectedBranch.region})
              </span>
            )
          })()}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">지점 선택 안함</SelectItem>
          {branches.map((branch) => (
            <SelectItem key={branch.id} value={String(branch.id)}>
              {branch.name} ({branch.region})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export const UserManagement: React.FC = () => {
  // const theme = useTheme() // Removed
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const selectedUser = useMemo(() => users.find(u => u.id === selectedUserId), [users, selectedUserId])

  // 스낵바(우측 상단) 알림
  const [notification, setNotification] = useState<{
    message: string
    type: 'success' | 'error' | 'info'
  } | null>(null)

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  // 편집 관련 상태
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    userid: '',
    email: '',
    name: '',
    role: 'user' as 'user' | 'admin' | 'super_admin',
    branchId: '',
    is_approved: false,
    used: true
  })

  // 스낵바 상태 대체 (간단한 알림)
  // const [snackbarOpen, setSnackbarOpen] = useState(false) // Removed
  // const [snackbarMessage, setSnackbarMessage] = useState('') // Removed
  // const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success') // Removed

  // 모달 상태
  const [showAddUserModal, setShowAddUserModal] = useState(false)

  // 안전한 날짜 포맷팅 함수 (년월일 형식, includeTime이 true면 시:분:초 포함)
  const formatSafeDate = (dateValue: string | Date | null | undefined, fallback: string = '-', includeTime: boolean = false) => {
    try {
      if (!dateValue) return fallback
      const date = new Date(dateValue)
      if (isNaN(date.getTime())) return fallback
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const base = `${year}-${month}-${day}`
      if (includeTime) {
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        const seconds = String(date.getSeconds()).padStart(2, '0')
        return `${base} ${hours}:${minutes}:${seconds}`
      }
      return base
    } catch (error) {
      return fallback
    }
  }
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  // 무한 스크롤 관련 상태
  const observerRef = useRef<IntersectionObserver | null>(null);
  const isFetchingRef = useRef(false)
  const lastElementRef = useCallback((node: HTMLTableRowElement) => {
    if (loading) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && pagination.page * pagination.limit < pagination.total) {
        console.log('Last element visible. Loading more...');
        fetchUsers(pagination.page + 1, true);
      }
    });

    if (node) observerRef.current.observe(node);
  }, [loading, pagination.total, pagination.page, pagination.limit]);

  // 필터 및 검색
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')

  // 검색어 디바운싱
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // 사용자 목록 조회
  const fetchUsers = async (page: number = 1, isLoadMore: boolean = false) => {
    // 중복 호출 방지 (초기 로딩 포함)
    if (isFetchingRef.current) return

    try {
      isFetchingRef.current = true
      setLoading(true)
      const params = {
        page,
        limit: pagination.limit,
        search: debouncedSearchTerm || undefined,
        role: roleFilter === 'all' ? undefined : (roleFilter || undefined)
      }

      console.log(`Fetching users page ${page}...`);
      const response: UserListResponse = await adminService.getUsers(params)

      setUsers(prev => isLoadMore ? [...prev, ...response.users] : response.users)
      setPagination(response.pagination) // 페이지 정보 업데이트 (현재 페이지 등)
      setError(null)
    } catch (err) {
      setError('사용자 목록을 불러오는데 실패했습니다.')
      console.error('Fetch users error:', err)
    } finally {
      setLoading(false)
      isFetchingRef.current = false
    }
  }

  // 사용자 선택 핸들러
  const handleUserSelect = (user: User) => {
    setSelectedUserId(user.id)
    const newFormData = {
      userid: user.userid,
      email: user.email || '',
      name: user.name,
      role: user.role,
      branchId: user.branchId ? String(user.branchId) : '',
      is_approved: user.isApproved,
      used: user.isActive
    }
    setFormData(newFormData)
    setIsEditing(true)
  }

  // 폼 데이터 변경 핸들러
  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // 저장 핸들러
  const handleSave = async () => {
    if (!selectedUser) return

    try {
      const updateData = {
        userid: formData.userid,
        email: formData.email,
        name: formData.name,
        role: formData.role,
        branchId: formData.branchId || null
      }

      await adminService.updateUser(selectedUser.id, updateData)
      showNotification('사용자 정보가 저장되었습니다.', 'success')
      await fetchUsers(pagination.page)

    } catch (error: any) {
      console.error('사용자 저장 실패:', error)
      const errorMessage = error.response?.data?.error || error.message || '알 수 없는 오류가 발생했습니다'
      showNotification(`사용자 정보 저장에 실패했습니다: ${errorMessage}`, 'error')
    }
  }

  // 취소 핸들러
  const handleCancel = () => {
    if (selectedUser) {
      setFormData({
        userid: selectedUser.userid,
        email: selectedUser.email || '',
        name: selectedUser.name,
        role: selectedUser.role,
        branchId: selectedUser.branchId || '',
        is_approved: selectedUser.isApproved,
        used: selectedUser.isActive
      })
    }
    setIsEditing(false)
  }

  // 사용자 상태 변경 핸들러 (승인 등)
  const handleApproveUser = async (userId: string) => {
    try {
      await adminService.approveUser(userId)
      showNotification('사용자가 승인되었습니다.', 'success')
      fetchUsers(pagination.page)
    } catch (error) {
      showNotification('사용자 승인에 실패했습니다.', 'error')
    }
  }

  // 사용자 상태 토글 (사용중지/재사용)
  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      if (currentStatus) {
        await adminService.suspendUser(userId)
        showNotification('사용자가 중지되었습니다.', 'success')
      } else {
        await adminService.reactivateUser(userId)
        showNotification('사용자가 재활성화되었습니다.', 'success')
      }
      fetchUsers(pagination.page)
    } catch (error) {
      showNotification('사용자 상태 변경에 실패했습니다.', 'error')
    }
  }

  // 사용자 추가 성공 핸들러
  const handleAddUserSuccess = () => {
    // setShowAddUserModal(false) // Handled by onClose
    showNotification('사용자가 추가되었습니다.', 'success')
    fetchUsers(pagination.page)
  }

  // 암호 초기화 핸들러
  const handleResetPassword = async () => {
    if (!selectedUser) return
    try {
      await userManagerApi.resetPassword(selectedUser.id)
      showNotification('암호가 111111로 초기화되었습니다.', 'success')
    } catch (error) {
      console.error('암호 초기화 실패:', error)
      showNotification('암호 초기화에 실패했습니다.', 'error')
    }
  }

  // 초기 로드 및 필터 변경 시 재조회
  useEffect(() => {
    fetchUsers(1)
  }, [debouncedSearchTerm, roleFilter])


  // 역할 배지 색상 (Updated to return Shadcn Badge variants)
  const getRoleBadgeVariant = (role: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (role) {
      case 'super_admin':
        return 'destructive'
      case 'admin':
        return 'default'
      case 'user':
        return 'secondary'
      default:
        return 'secondary'
    }
  }

  // 역할 라벨
  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin':
        return '슈퍼 관리자'
      case 'admin':
        return '관리자'
      case 'user':
        return '일반 사용자'
      default:
        return role
    }
  }

  return (
    <div className="relative h-[calc(100vh-140px)] p-0 flex flex-col gap-[3px] overflow-hidden bg-background">
      {/* 스낵바(우측 상단) */}
      {notification && (
        <div className="absolute top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <Alert
            variant={notification.type === 'error' ? 'destructive' : 'default'}
            className="w-auto shadow-lg"
          >
            {notification.type === 'success' ? (
              <CheckCircle className="h-4 w-4" />
            ) : notification.type === 'error' ? (
              <XCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertTitle>
              {notification.type === 'success' ? '성공' : notification.type === 'error' ? '오류' : '알림'}
            </AlertTitle>
            <AlertDescription>{notification.message}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <Alert variant="destructive" className="mb-2">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 필터 및 검색 */}
      <Card className="flex flex-col min-h-0 shrink-0 shadow-md">
        <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            <CardTitle className="text-lg font-bold">사용자 관리</CardTitle>
          </div>
          <Button onClick={() => setShowAddUserModal(true)} size="sm">
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
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="min-w-[150px]">
              <Select
                value={roleFilter}
                onValueChange={setRoleFilter}
                labels={{ all: '모든 역할', user: '일반 사용자', admin: '관리자', super_admin: '슈퍼 관리자' }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="역할 필터" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 역할</SelectItem>
                  <SelectItem value="user">일반 사용자</SelectItem>
                  <SelectItem value="admin">관리자</SelectItem>
                  <SelectItem value="super_admin">슈퍼 관리자</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[100px]">
              <Button variant="outline" className="w-full" onClick={() => fetchUsers(pagination.page)} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                새로고침
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 좌우 분할 레이아웃 */}
      <div className="flex flex-1 gap-[3px] min-h-0">
        {/* 좌측: 사용자 목록 (3/4 넓이) */}
        <div className="flex-[3] min-w-0 h-full">
          <Card className="h-full flex flex-col">
            <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  <h3 className="text-lg font-medium">사용자 목록</h3>
                </div>
                <Badge variant="outline">총 {pagination.total}명</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-0">
              <div className="h-full border border-[#343637] dark:border-[#6b7280] overflow-auto relative scrollbar-hide bg-[#f9fafb] dark:bg-[#1d1d1d]">
                <Table className="w-full table-fixed border-separate border-spacing-0">
                  <TableHeader className="sticky top-0 z-10 shadow-sm">
                    <TableRow className="hover:bg-transparent border-b-0">
                      <TableHead className="w-[100px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">아이디</TableHead>
                      <TableHead className="w-[80px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">이름</TableHead>
                      <TableHead className="w-[150px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">이메일</TableHead>
                      <TableHead className="w-[150px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">소속지점</TableHead>
                      <TableHead className="w-[100px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">역할</TableHead>
                      <TableHead className="w-[80px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">승인상태</TableHead>
                      <TableHead className="w-[80px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">사용여부</TableHead>
                      <TableHead className="w-[100px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">가입일</TableHead>
                      <TableHead className="w-[150px] h-[45px] text-center font-bold px-2 border-b-0 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">최근 접속</TableHead>
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
                            "h-[35px] cursor-pointer border-b-0 group transition-colors bg-[#f9fafb] dark:bg-[#1d1d1d]",
                            "hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30",
                            selectedUserId === user.id && "bg-muted/80 ring-1 ring-inset ring-primary/30"
                          )}
                          onClick={() => handleUserSelect(user)}
                        >
                          <TableCell className="h-[35px] py-0 px-2 text-xs font-medium border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">{user.userid}</TableCell>
                          <TableCell className="h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">{user.name}</TableCell>
                          <TableCell className="h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors truncate max-w-[150px]" title={user.email || ''}>{user.email}</TableCell>
                          <TableCell className="h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">
                            {user.branchName || '-'}
                          </TableCell>
                          <TableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">
                            <Badge variant={getRoleBadgeVariant(user.role)} className="h-5 text-[10px] px-1 pointer-events-none">
                              {getRoleLabel(user.role)}
                            </Badge>
                          </TableCell>
                          <TableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">
                            {user.isApproved ? (
                              <Badge className="h-5 text-[10px] px-1 bg-green-500 hover:bg-green-600 border-none pointer-events-none">승인됨</Badge>
                            ) : (
                              <Badge variant="secondary" className="h-5 text-[10px] px-1 pointer-events-none">대기중</Badge>
                            )}
                          </TableCell>
                          <TableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">
                            {user.isActive ? (
                              <Badge variant="outline" className="h-5 text-[10px] px-1 text-blue-600 border-blue-200 pointer-events-none">사용중</Badge>
                            ) : (
                              <Badge variant="destructive" className="h-5 text-[10px] px-1 pointer-events-none">중지됨</Badge>
                            )}
                          </TableCell>
                          <TableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors text-muted-foreground">{formatSafeDate(user.createdAt)}</TableCell>
                          <TableCell className="h-[35px] py-0 px-2 text-xs text-center group-hover:text-inherit group-hover:font-inherit transition-colors text-muted-foreground">
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
        </div>

        {/* 우측: 사용자 편집 폼 (1/4 넓이) */}
        <div className="flex-1 min-w-[350px]">
          <Card className="h-full flex flex-col shadow-md">
            <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5" />
                <h3 className="text-lg font-medium">
                  {selectedUser ? '사용자 편집' : '사용자 선택'}
                </h3>
              </div>
              {selectedUser && (
                <div className="flex gap-2">
                  <Button size="sm" className="h-9" onClick={handleSave}>
                    <Save className="w-4 h-4 mr-2" /> 저장
                  </Button>
                  <Button variant="outline" size="sm" className="h-9" onClick={handleCancel}>
                    <X className="w-4 h-4 mr-2" /> 취소
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="flex-1 p-4 overflow-auto scrollbar-hide">
              {selectedUser ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">사용자 ID</Label>
                    <Input value={formData.userid} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">이름</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => handleFormChange('name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">이메일</Label>
                    <Input
                      value={formData.email}
                      onChange={(e) => handleFormChange('email', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">역할</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(val) => handleFormChange('role', val)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">일반 사용자</SelectItem>
                        <SelectItem value="admin">관리자</SelectItem>
                        <SelectItem value="super_admin">슈퍼 관리자</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <BranchSelect
                      value={formData.branchId}
                      onChange={(val) => handleFormChange('branchId', val === 'none' ? '' : val)}
                    />
                  </div>

                  <Separator className="my-4" />

                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2 mt-2">
                      {/* 상태 변경 버튼 */}
                      {!selectedUser.isApproved ? (
                        <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleApproveUser(selectedUser.id)}>
                          <CheckCircle className="w-4 h-4 mr-2" /> 승인
                        </Button>
                      ) : selectedUser.isActive ? (
                        <Button variant="destructive" className="flex-1" onClick={() => handleToggleUserStatus(selectedUser.id, true)}>
                          <Ban className="w-4 h-4 mr-2" /> 사용중지
                        </Button>
                      ) : (
                        <Button variant="default" className="flex-1" onClick={() => handleToggleUserStatus(selectedUser.id, false)}>
                          <Play className="w-4 h-4 mr-2" /> 재사용
                        </Button>
                      )}
                    </div>
                    <Button variant="outline" className="mt-2 w-full text-muted-foreground hover:text-foreground" onClick={handleResetPassword}>
                      <ShieldCheck className="w-4 h-4 mr-2" /> 비밀번호 초기화
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                  <Users className="w-16 h-16 mb-4" />
                  <p>좌측 목록에서 사용자를 선택해주세요</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AddUserModal
        open={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        onSuccess={handleAddUserSuccess}
      />
    </div>
  )
}