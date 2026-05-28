/**
 * 페이지 요약 — 사용자 접속 이력 (`/admin/userhistory`)
 *
 * 기능: 로그인 요약·사용자별 로그인 이력·세션 상세·강제 로그아웃.
 *
 * 호출/연동:
 * - `adminService.getUserLoginHistory`, `getUserSessionDetail`, `forceUserLogout`
 * - DB/SP는 `packages/api-server` 관리자 세션/이력 API 참조.
 *
 * 관련 컴포넌트(`./components/`):
 * - `UserHistorySummaryCards`: 요약 통계 카드
 * - `UserHistoryFilterBar`: 검색/활성 토글
 * - `UserHistoryTable`: 이력 테이블 + 페이지네이션
 * - `SessionDetailDialog`: 세션 상세 모달
 * - `ForceLogoutDialog`: 강제 로그아웃 확인 모달
 * - `userHistoryDateUtils.ts`: 상대/절대 시간 포맷터
 *
 * 흐름: 요약·목록 로드 → 사용자 선택 → 세션 상세·강제 로그아웃.
 */

import React, { useEffect, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useSnackbar } from '@/contexts/SnackbarContext'
import {
  adminService,
  type UserLoginHistoryResponse,
  type UserLoginInfo,
  type UserSessionDetailResponse,
} from '@/services/admin.service'
import { UserHistorySummaryCards } from './components/UserHistorySummaryCards'
import { UserHistoryFilterBar } from './components/UserHistoryFilterBar'
import { UserHistoryTable } from './components/UserHistoryTable'
import { SessionDetailDialog } from './components/SessionDetailDialog'
import { ForceLogoutDialog } from './components/ForceLogoutDialog'

const INITIAL_SUMMARY = { totalUsers: 0, currentlyLoggedIn: 0, totalOffline: 0 }
const INITIAL_PAGINATION = { page: 1, limit: 20, total: 0, totalPages: 0 }

export const UserHistory: React.FC = () => {
  const { showSnackbar } = useSnackbar()

  const [users, setUsers] = useState<UserLoginInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState(INITIAL_SUMMARY)
  const [pagination, setPagination] = useState(INITIAL_PAGINATION)

  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [onlyActiveUsers, setOnlyActiveUsers] = useState(false)

  const [showSessionDetail, setShowSessionDetail] = useState(false)
  const [sessionDetail, setSessionDetail] = useState<UserSessionDetailResponse | null>(null)
  const [showForceLogoutDialog, setShowForceLogoutDialog] = useState(false)
  const [userToLogout, setUserToLogout] = useState<UserLoginInfo | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const fetchUserHistory = async (page: number = 1, limit: number = pagination.limit) => {
    try {
      setLoading(true)
      const response: UserLoginHistoryResponse = await adminService.getUserLoginHistory({
        page,
        limit,
        search: debouncedSearchTerm || undefined,
        onlyActive: onlyActiveUsers,
      })
      setUsers(response.users)
      setPagination(response.pagination)
      setSummary(response.summary)
      setError(null)
    } catch (err) {
      setError('사용자 로그인 정보를 불러오는데 실패했습니다.')
      console.error('Fetch user history error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchSessionDetail = async (userId: string) => {
    try {
      setLoading(true)
      const response = await adminService.getUserSessionDetail(userId)
      setSessionDetail(response)
      setShowSessionDetail(true)
    } catch (err) {
      setError('세션 상세 정보를 불러오는데 실패했습니다.')
      console.error('Fetch session detail error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleForceLogout = async () => {
    if (!userToLogout) return
    try {
      await adminService.forceUserLogout(userToLogout.id)
      setShowForceLogoutDialog(false)
      setUserToLogout(null)
      fetchUserHistory(pagination.page)
      setError(null)
      showSnackbar({ message: '성공적으로 로그아웃 처리되었습니다.', severity: 'success' })
    } catch (err) {
      console.error('Force logout error:', err)
      setError('강제 로그아웃에 실패했습니다.')
    }
  }

  useEffect(() => {
    fetchUserHistory(1)
  }, [debouncedSearchTerm, onlyActiveUsers])

  const handleLimitChange = (newLimit: number) => {
    setPagination((prev) => ({ ...prev, limit: newLimit, page: 1 }))
    setTimeout(() => fetchUserHistory(1, newLimit), 0)
  }

  const handleCloseSessionDetail = (open: boolean) => {
    if (open) return
    setShowSessionDetail(false)
    setSessionDetail(null)
  }

  const handleCloseForceLogout = (open: boolean) => {
    if (open) return
    setShowForceLogoutDialog(false)
    setUserToLogout(null)
  }

  return (
    <div className="h-[calc(100vh-140px)] p-0 flex flex-col gap-[3px] overflow-hidden bg-background">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">사용자 로그인 정보</h1>
          <p className="text-muted-foreground text-sm">
            사용자별 로그인 상태 및 이력을 확인하세요
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => fetchUserHistory(pagination.page)}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mx-2 mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <UserHistorySummaryCards summary={summary} />

      <UserHistoryFilterBar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onlyActiveUsers={onlyActiveUsers}
        onOnlyActiveUsersChange={setOnlyActiveUsers}
      />

      <UserHistoryTable
        users={users}
        loading={loading}
        pagination={pagination}
        onPageChange={fetchUserHistory}
        onLimitChange={handleLimitChange}
        onShowSessionDetail={fetchSessionDetail}
        onAskForceLogout={(user) => {
          setUserToLogout(user)
          setShowForceLogoutDialog(true)
        }}
      />

      <SessionDetailDialog
        open={showSessionDetail}
        detail={sessionDetail}
        onOpenChange={handleCloseSessionDetail}
      />

      <ForceLogoutDialog
        open={showForceLogoutDialog}
        user={userToLogout}
        onOpenChange={handleCloseForceLogout}
        onConfirm={handleForceLogout}
      />
    </div>
  )
}
