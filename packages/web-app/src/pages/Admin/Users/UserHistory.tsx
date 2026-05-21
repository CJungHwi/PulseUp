/**
 * 페이지 요약 — 사용자 접속 이력 (`/admin/userhistory`)
 *
 * 기능: 로그인 요약·사용자별 로그인 이력·세션 상세·강제 로그아웃.
 *
 * 호출/연동:
 * - `adminService.getUserLoginHistory`, `getUserSessionDetail`, `forceUserLogout`
 * - DB/SP는 `packages/api-server` 관리자 세션/이력 API 참조.
 *
 * 관련 컴포넌트: shadcn `Table`, `Dialog`, `Switch`, `Tooltip`.
 *
 * 흐름: 요약·목록 로드 → 사용자 선택 → 세션 상세·강제 로그아웃.
 */

import React, { useState, useEffect } from 'react'
import {
  History,
  Search,
  Filter,
  RefreshCw,
  Wifi,
  WifiOff,
  User as UserIcon,
  Clock,
  Monitor,
  LogOut,
  Eye,
  MapPin,
  Ban,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useSnackbar } from '@/contexts/SnackbarContext'
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  adminService,
  UserLoginInfo,
  UserLoginHistoryResponse,
  UserSessionDetailResponse
} from '../../../services/admin.service'
import { formatDistanceToNow, format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { DATE_FORMATS } from '@/lib/constants'

export const UserHistory: React.FC = () => {
  const { showSnackbar } = useSnackbar()
  // const muiTheme = useTheme() // Removed
  const [users, setUsers] = useState<UserLoginInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState({
    totalUsers: 0,
    currentlyLoggedIn: 0,
    totalOffline: 0
  })

  // 페이지네이션
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  // 필터 및 검색
  const [searchTerm, setSearchTerm] = useState('')
  const [onlyActiveUsers, setOnlyActiveUsers] = useState(false)
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')

  // 모달 상태
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [showSessionDetail, setShowSessionDetail] = useState(false)
  const [sessionDetail, setSessionDetail] = useState<UserSessionDetailResponse | null>(null)
  const [showForceLogoutDialog, setShowForceLogoutDialog] = useState(false)
  const [userToLogout, setUserToLogout] = useState<UserLoginInfo | null>(null)

  // 안전한 날짜 포맷팅 함수
  const formatSafeDate = (dateValue: string | Date | null | undefined, fallback: string = '-') => {
    try {
      if (!dateValue) return fallback
      const date = new Date(dateValue)
      if (isNaN(date.getTime())) return fallback
      return formatDistanceToNow(date, { addSuffix: true, locale: ko })
    } catch (error) {
      return fallback
    }
  }

  // 절대 시간 포맷팅
  const formatAbsoluteDate = (dateValue: string | Date | null | undefined, fallback: string = '-') => {
    try {
      if (!dateValue) return fallback
      const date = new Date(dateValue)
      if (isNaN(date.getTime())) return fallback
      return format(date, DATE_FORMATS.FULL, { locale: ko })
    } catch (error) {
      return fallback
    }
  }

  // 검색어 디바운싱
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // 사용자 로그인 이력 조회
  const fetchUserHistory = async (page: number = 1) => {
    try {
      setLoading(true)
      const params = {
        page,
        limit: pagination.limit,
        search: debouncedSearchTerm || undefined,
        onlyActive: onlyActiveUsers
      }

      const response: UserLoginHistoryResponse = await adminService.getUserLoginHistory(params)
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

  // 사용자 세션 상세 조회
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

  // 강제 로그아웃
  const handleForceLogout = async () => {
    if (!userToLogout) return
    try {
      await adminService.forceUserLogout(userToLogout.id)
      setShowForceLogoutDialog(false)
      setUserToLogout(null)
      fetchUserHistory(pagination.page)
      setError(null)
      showSnackbar({ message: '성공적으로 로그아웃 처리되었습니다.', severity: 'success' })
    } catch (error) {
      console.error('Force logout error:', error)
      setError('강제 로그아웃에 실패했습니다.')
    }
  }

  // 초기 로드 및 필터 변경 시 재조회
  useEffect(() => {
    fetchUserHistory(1)
  }, [debouncedSearchTerm, onlyActiveUsers])

  return (
    <div className="h-[calc(100vh-140px)] p-0 flex flex-col gap-[3px] overflow-hidden bg-background">
      {/* 헤더 */}
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

      {/* 에러 메시지 */}
      {error && (
        <Alert variant="destructive" className="mx-2 mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 요약 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[3px] px-0">
        <Card className="shadow-md">
          <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">전체 사용자</CardTitle>
            <UserIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalUsers}</div>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">현재 로그인 중</CardTitle>
            <Wifi className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.currentlyLoggedIn}</div>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">오프라인</CardTitle>
            <WifiOff className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{summary.totalOffline}</div>
          </CardContent>
        </Card>
      </div>

      {/* 필터 및 검색 */}
      <Card className="shadow-md">
        <CardContent className="py-3 px-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex items-center gap-2 mr-4">
              <Filter className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-sm font-semibold whitespace-nowrap">필터 및 검색</h3>
            </div>
            <div className="flex-1 min-w-[200px] relative w-full">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="사용자명으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="active-users-only"
                checked={onlyActiveUsers}
                onCheckedChange={setOnlyActiveUsers}
              />
              <Label htmlFor="active-users-only" className="text-sm">현재 로그인 중만 표시</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 데이터 테이블 */}
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
                  <TableHead className="w-[120px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">사용자 ID</TableHead>
                  <TableHead className="w-[120px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">이름</TableHead>
                  <TableHead className="w-[200px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">이메일</TableHead>
                  <TableHead className="w-[150px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">지점</TableHead>
                  <TableHead className="w-[160px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">로그인 시간</TableHead>
                  <TableHead className="w-[140px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">로그인 상태</TableHead>
                  <TableHead className="w-[130px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">접속 IP</TableHead>
                  <TableHead className="w-[120px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">총 로그인</TableHead>
                  <TableHead className="w-[150px] h-[45px] text-center font-bold px-2 border-b-0 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">작업</TableHead>
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
                        "h-[35px] border-b-0 group transition-colors bg-[#f9fafb] dark:bg-[#1d1d1d]",
                        "hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30"
                      )}
                    >
                      <TableCell className="h-[35px] py-0 px-2 text-xs font-medium border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">{user.userid}</TableCell>
                      <TableCell className="h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">{user.name}</TableCell>
                      <TableCell className="h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors truncate max-w-[200px]" title={user.email || ''}>{user.email}</TableCell>
                      <TableCell className="h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">{user.branch_name || '-'}</TableCell>
                      <TableCell className="h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">
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
                      <TableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">
                        {user.is_currently_logged_in ? (
                          <div className="flex items-center justify-center gap-1">
                            <Badge className="h-5 text-[10px] px-1 bg-green-500 hover:bg-green-600 border-none pointer-events-none">로그인 중</Badge>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <Badge variant="outline" className="h-5 text-[10px] px-1 pointer-events-none">오프라인</Badge>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">{user.current_session_ip || '-'}</TableCell>
                      <TableCell className="h-[35px] py-0 px-2 text-xs text-right border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">{user.total_login_count || 0}회</TableCell>
                      <TableCell className="h-[35px] py-0 px-2 text-xs text-center group-hover:text-inherit group-hover:font-inherit transition-colors">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10" onClick={() => fetchSessionDetail(user.id)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {user.is_currently_logged_in && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setUserToLogout(user)
                                setShowForceLogoutDialog(true)
                              }}
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

        {/* 페이지네이션 (UserHistory Logic has pagination but fetchUserHistory accepts page) */}
        <div className="border-t p-2 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <Select
              value={String(pagination.limit)}
              onValueChange={(val) => {
                setPagination(prev => ({ ...prev, limit: Number(val), page: 1 }));
                setTimeout(() => fetchUserHistory(1), 0);
              }}
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
              페이지 {pagination.page} / {Math.ceil(pagination.total / pagination.limit) || 1}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => fetchUserHistory(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                {'<'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => fetchUserHistory(pagination.page + 1)}
                disabled={pagination.page * pagination.limit >= pagination.total}
              >
                {'>'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* 세션 상세 모달 */}
      <Dialog open={showSessionDetail} onOpenChange={(open) => {
        if (!open) {
          setShowSessionDetail(false)
          setSessionDetail(null)
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              세션 상세 정보
              {sessionDetail && (
                <span className="text-muted-foreground text-sm font-normal ml-2">
                  - {sessionDetail.user.name} ({sessionDetail.user.userid})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {sessionDetail && (
            <div className="space-y-6">
              {/* 현재 활성 세션 */}
              {sessionDetail.activeSessions.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center text-green-600">
                    <Wifi className="h-4 w-4 mr-2" />
                    현재 활성 세션 ({sessionDetail.activeSessions.length}개)
                  </h4>
                  <div className="grid gap-2">
                    {sessionDetail.activeSessions.map((session) => (
                      <Card key={session.id}>
                        <CardContent className="p-3 flex justify-between items-center">
                          <div className="space-y-1">
                            <div className="text-sm flex items-center">
                              <Clock className="h-3 w-3 mr-2 text-muted-foreground" />
                              로그인: {formatAbsoluteDate(session.login_time)}
                            </div>
                            <div className="text-sm flex items-center">
                              <MapPin className="h-3 w-3 mr-2 text-muted-foreground" />
                              IP: {session.ip_address || '알 수 없음'}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              // 특정 세션 로그아웃 로직 (Placeholder)
                              console.log('특정 세션 로그아웃:', session.id)
                            }}
                          >
                            <LogOut className="h-3 w-3 mr-1" /> 종료
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* 로그인 이력 */}
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center">
                  <History className="h-4 w-4 mr-2" />
                  최근 로그인 이력
                </h4>
                <div className="grid gap-2">
                  {sessionDetail.sessionHistory.length > 0 ? (
                    sessionDetail.sessionHistory.slice(0, 10).map((session) => (
                      <Card key={session.id}>
                        <CardContent className="p-3 flex justify-between items-center">
                          <div className="space-y-1">
                            <div className="text-sm flex items-center">
                              <Clock className="h-3 w-3 mr-2 text-muted-foreground" />
                              로그인: {formatAbsoluteDate(session.login_time)}
                            </div>
                            {session.logout_time && (
                              <div className="text-sm flex items-center text-muted-foreground">
                                <LogOut className="h-3 w-3 mr-2" />
                                로그아웃: {formatAbsoluteDate(session.logout_time)}
                              </div>
                            )}
                            <div className="text-sm flex items-center">
                              <MapPin className="h-3 w-3 mr-2 text-muted-foreground" />
                              IP: {session.ip_address || '알 수 없음'}
                            </div>
                          </div>
                          <Badge variant={session.logout_time ? "secondary" : "outline"}>
                            {session.logout_time ? '완료' : '미완료'}
                          </Badge>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">로그인 이력이 없습니다.</p>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowSessionDetail(false)
              setSessionDetail(null)
            }}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 강제 로그아웃 확인 대화상자 */}
      <Dialog open={showForceLogoutDialog} onOpenChange={(open) => {
        if (!open) {
          setShowForceLogoutDialog(false)
          setUserToLogout(null)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>강제 로그아웃</DialogTitle>
            <DialogDescription>
              정말로 "{userToLogout?.name}" 사용자를 강제 로그아웃 시키시겠습니까?
              <br />
              해당 사용자의 모든 활성 세션이 즉시 종료됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowForceLogoutDialog(false)
              setUserToLogout(null)
            }}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleForceLogout}>
              강제 로그아웃
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

