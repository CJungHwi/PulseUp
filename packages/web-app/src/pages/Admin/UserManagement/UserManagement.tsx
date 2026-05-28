/**
 * 페이지 요약 — 사용자 관리 (`/admin/usermanager`)
 *
 * 기능: 사용자 목록·검색·승인·정지·역할/지점 할당·비밀번호 초기화.
 *
 * 호출/연동:
 * - `adminService.getUsers`, `updateUser`, `approveUser`, `suspendUser`, `reactivateUser`
 * - `userManagerApi.resetPassword`
 * - `branchApi.getBranches` (BranchSelect 내부)
 *
 * 관련 컴포넌트(`./components/`):
 * - `UserManagementFilterBar`: 검색/역할 필터/새로고침/사용자 추가
 * - `UserManagementTable`: 사용자 목록 테이블 + 무한 스크롤
 * - `UserManagementEditForm`: 우측 편집 폼 + 액션
 * - `BranchSelect`: 지점 선택 셀렉트
 * - `userManagementUtils.ts`: 날짜 포맷/역할 라벨·배지
 *
 * 외부 컴포넌트: `@/components/Admin/AddUserModal`
 *
 * 흐름: 목록 로드 → 행 선택 → 모달/폼에서 수정·승인·초기화.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { adminService, type User, type UserListResponse } from '@/services/admin.service'
import { userManagerApi } from '@/services/userManagerApi'
import { useAuth } from '@/hooks/useAuth'
import { AddUserModal } from '@/components/Admin/AddUserModal'
import { UserManagementFilterBar } from './components/UserManagementFilterBar'
import { UserManagementTable } from './components/UserManagementTable'
import {
  UserManagementEditForm,
  type UserManagementFormState,
} from './components/UserManagementEditForm'

const INITIAL_PAGINATION = { page: 1, limit: 20, total: 0, totalPages: 0 }
const INITIAL_FORM: UserManagementFormState = {
  userid: '',
  email: '',
  name: '',
  role: 'user',
  branchId: '',
  is_approved: false,
  used: true,
}

export const UserManagement: React.FC = () => {
  const { user: currentUser, isBranchAdmin, isSuperAdmin } = useAuth()
  const currentBranchId = currentUser?.branchId ? String(currentUser.branchId) : ''

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId),
    [users, selectedUserId]
  )

  const [notification, setNotification] = useState<{
    message: string
    type: 'success' | 'error' | 'info'
  } | null>(null)
  const [formData, setFormData] = useState<UserManagementFormState>(INITIAL_FORM)
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [pagination, setPagination] = useState(INITIAL_PAGINATION)

  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')

  const isFetchingRef = useRef(false)

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const fetchUsers = async (page: number = 1, isLoadMore: boolean = false) => {
    if (isFetchingRef.current) return
    try {
      isFetchingRef.current = true
      setLoading(true)
      const response: UserListResponse = await adminService.getUsers({
        page,
        limit: pagination.limit,
        search: debouncedSearchTerm || undefined,
        role: isBranchAdmin
          ? 'user'
          : roleFilter === 'all'
            ? undefined
            : roleFilter || undefined,
      })
      setUsers((prev) => (isLoadMore ? [...prev, ...response.users] : response.users))
      setPagination(response.pagination)
      setError(null)
    } catch (err) {
      setError('사용자 목록을 불러오는데 실패했습니다.')
      console.error('Fetch users error:', err)
    } finally {
      setLoading(false)
      isFetchingRef.current = false
    }
  }

  useEffect(() => {
    fetchUsers(1)
  }, [debouncedSearchTerm, roleFilter])

  const handleUserSelect = (user: User) => {
    setSelectedUserId(user.id)
    setFormData({
      userid: user.userid,
      email: user.email || '',
      name: user.name,
      role: user.role,
      branchId: user.branchId ? String(user.branchId) : '',
      is_approved: user.isApproved,
      used: user.isActive,
    })
  }

  const handleFormChange = (field: keyof UserManagementFormState, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!selectedUser) return
    try {
      await adminService.updateUser(selectedUser.id, {
        userid: formData.userid,
        email: formData.email,
        name: formData.name,
        role: isBranchAdmin ? 'user' : formData.role,
        branchId: isBranchAdmin ? currentBranchId : formData.branchId || null,
      })
      showNotification('사용자 정보가 저장되었습니다.', 'success')
      await fetchUsers(pagination.page)
    } catch (err: any) {
      console.error('사용자 저장 실패:', err)
      const errorMessage =
        err.response?.data?.error || err.message || '알 수 없는 오류가 발생했습니다'
      showNotification(`사용자 정보 저장에 실패했습니다: ${errorMessage}`, 'error')
    }
  }

  const handleCancel = () => {
    if (selectedUser) {
      setFormData({
        userid: selectedUser.userid,
        email: selectedUser.email || '',
        name: selectedUser.name,
        role: selectedUser.role,
        branchId: selectedUser.branchId || '',
        is_approved: selectedUser.isApproved,
        used: selectedUser.isActive,
      })
    }
  }

  const handleApproveUser = async (userId: string) => {
    const targetUser = users.find((u) => u.id === userId)
    if (!targetUser) return

    const approvalRole = isSuperAdmin ? formData.role : targetUser.role
    const approvalBranchId = isSuperAdmin
      ? formData.branchId || null
      : targetUser.branchId || null

    if (isSuperAdmin && approvalRole !== 'super_admin' && !approvalBranchId) {
      showNotification(
        '일반 사용자 또는 지점관리자로 승인하려면 소속 지점을 선택해주세요.',
        'error'
      )
      return
    }

    try {
      await adminService.approveUser(
        userId,
        isSuperAdmin
          ? {
              role: approvalRole,
              branchId: approvalBranchId,
            }
          : undefined
      )
      showNotification('사용자가 승인되었습니다.', 'success')
      fetchUsers(pagination.page)
    } catch (err: any) {
      const message =
        err.response?.data?.error || err.response?.data?.message || '사용자 승인에 실패했습니다.'
      showNotification(message, 'error')
    }
  }

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
    } catch {
      showNotification('사용자 상태 변경에 실패했습니다.', 'error')
    }
  }

  const handleAddUserSuccess = () => {
    showNotification('사용자가 추가되었습니다.', 'success')
    fetchUsers(pagination.page)
  }

  const handleResetPassword = async () => {
    if (!selectedUser) return
    try {
      await userManagerApi.resetPassword(selectedUser.id)
      showNotification('암호가 111111로 초기화되었습니다.', 'success')
    } catch (err) {
      console.error('암호 초기화 실패:', err)
      showNotification('암호 초기화에 실패했습니다.', 'error')
    }
  }

  const canLoadMore = pagination.page * pagination.limit < pagination.total

  return (
    <div className="relative h-[calc(100vh-140px)] p-0 flex flex-col gap-[3px] overflow-hidden bg-background">
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
              {notification.type === 'success'
                ? '성공'
                : notification.type === 'error'
                  ? '오류'
                  : '알림'}
            </AlertTitle>
            <AlertDescription>{notification.message}</AlertDescription>
          </Alert>
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mb-2">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <UserManagementFilterBar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
        loading={loading}
        isBranchAdmin={isBranchAdmin}
        onRefresh={() => fetchUsers(pagination.page)}
        onAddUser={() => setShowAddUserModal(true)}
      />

      <div className="flex flex-1 gap-[3px] min-h-0">
        <div className="flex-[3] min-w-0 h-full">
          <UserManagementTable
            users={users}
            loading={loading}
            total={pagination.total}
            selectedUserId={selectedUserId}
            onSelectUser={handleUserSelect}
            onLoadMore={() => fetchUsers(pagination.page + 1, true)}
            canLoadMore={canLoadMore}
          />
        </div>

        <div className="flex-1 min-w-[350px]">
          <UserManagementEditForm
            selectedUser={selectedUser}
            formData={formData}
            isBranchAdmin={isBranchAdmin}
            onChange={handleFormChange}
            onSave={handleSave}
            onCancel={handleCancel}
            onApprove={handleApproveUser}
            onToggleStatus={handleToggleUserStatus}
            onResetPassword={handleResetPassword}
          />
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
