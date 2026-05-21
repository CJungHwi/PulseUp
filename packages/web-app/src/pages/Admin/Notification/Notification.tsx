/**
 * 페이지 요약 — 관리자 알림/공지 (`/admin/notification`)
 *
 * 기능: 알림(공지) CRUD, 상태·페이지네이션, 스낵바 피드백.
 *
 * 호출/연동:
 * - Redux `notificationSlice` + `notificationApi` (`services/notificationApi.ts`)
 * - DB/SP는 `packages/api-server` 알림 라우트 참조.
 *
 * 관련 컴포넌트: shadcn `Table`, `Dialog`, `Switch`, `Select`.
 *
 * 흐름: 목록 fetch dispatch → 모달에서 생성/수정/삭제 → API 동기화.
 */

import React, { useState, useEffect } from 'react'
import {
  Plus,
  Save,
  X,
  Edit,
  Trash2,
  Bell,
  Search,
  Filter,
  RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { useAppDispatch, useAppSelector } from '../../../hooks/redux'
import {
  fetchNotifications,
  createNotification,
  updateNotification,
  deleteNotification,
  updateNotificationStatus,
  setCurrentNotification,
  clearCurrentNotification,
  clearError,
  setPage,
  setLimit,
} from '../../../store/slices/notificationSlice'
import { notificationApi } from '../../../services/notificationApi'
import { useSnackbar } from '@/contexts/SnackbarContext'
import {
  Notification as NotificationItem,
  CreateNotificationRequest,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_STATUS_LABELS,
  NotificationType,
  NotificationStatus,
} from '../../../types/notification'

const Notification: React.FC = () => {
  const dispatch = useAppDispatch()
  const { showSnackbar } = useSnackbar()

  // Redux 상태
  const notificationState = useAppSelector(state => state.notifications)
  const {
    notifications = [],
    currentNotification,
    loading = false,
    error = null,
    total = 0,
    page = 1,
    limit = 10
  } = notificationState || {}

  // 로컬 상태
  const [isEditing, setIsEditing] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create')
  const [isPinned, setIsPinned] = useState(false)

  // 폼 상태
  const [formData, setFormData] = useState<CreateNotificationRequest>({
    title: '',
    content: '',
    type: 'general',
    status: 'active',
    priority: 'normal',
    targetAudience: 'all',
  })

  // 필터 상태
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    search: '',
  })

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    try {
      dispatch(fetchNotifications({ page, limit, ...filters }))
    } catch (error) {
      console.error('공지사항 로드 오류:', error)
    }
  }, [dispatch, page, limit, filters])

  // 에러 처리
  useEffect(() => {
    if (error) {
      showSnackbar({ message: String(error), severity: 'error' })
      dispatch(clearError())
    }
  }, [error, dispatch])

  // 현재 선택된 공지사항이 변경될 때 폼 데이터 업데이트
  useEffect(() => {
    if (currentNotification) {
      setFormData({
        title: currentNotification.title,
        content: currentNotification.content,
        type: currentNotification.type,
        status: currentNotification.is_active ? 'active' : 'inactive',
        priority: currentNotification.priority,
        targetAudience: currentNotification.target_audience,
        branchId: currentNotification.branch_id,
      })
      setIsPinned(Boolean(currentNotification.is_pinned))
      setIsEditing(true)
    }
  }, [currentNotification])

  // 폼 데이터 변경 핸들러
  const handleFormChange = (field: keyof CreateNotificationRequest, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // 공지사항 선택 핸들러
  const handleNotificationSelect = async (notification: NotificationItem) => {
    dispatch(setCurrentNotification(notification))

    // 조회수 증가 API 호출
    try {
      await notificationApi.markAsRead(notification.id);
    } catch (error) {
      console.error('조회수 증가 실패:', error);
    }
  }

  // 새 공지사항 추가 핸들러
  const handleAddNotification = () => {
    setFormData({
      title: '',
      content: '',
      type: 'general',
      status: 'active',
      priority: 'normal',
      targetAudience: 'all',
    })
    setIsPinned(false)
    dispatch(clearCurrentNotification())
    setIsEditing(false)
    setModalMode('create')
    setModalOpen(true)
  }

  // 공지사항 더블클릭 핸들러
  const handleRowDoubleClick = async (notification: NotificationItem) => {
    try {
      setFormData({
        title: notification.title,
        content: notification.content,
        type: notification.type,
        status: notification.status || 'active',
        priority: notification.priority || 'normal',
        targetAudience: notification.target_audience || 'all',
      })
      setIsPinned(Boolean(notification.is_pinned))
      dispatch(setCurrentNotification(notification))
      setIsEditing(true)
      setModalMode('edit')
      setModalOpen(true)
    } catch (error) {
      console.error('공지사항 조회 오류:', error)
    }
  }

  // 공지사항 저장 핸들러
  const handleSaveNotification = async () => {
    try {
      const saveData = {
        ...formData,
        isPinned
      }

      if (currentNotification && isEditing) {
        await dispatch(updateNotification({
          id: currentNotification.id,
          data: {
            ...saveData,
            id: currentNotification.id
          }
        })).unwrap()
        showSnackbar({ message: '공지사항이 수정되었습니다.', severity: 'success' })
      } else {
        await dispatch(createNotification(saveData)).unwrap()
        showSnackbar({ message: '공지사항이 등록되었습니다.', severity: 'success' })
      }

      setIsEditing(false)
      setModalOpen(false)
      dispatch(clearCurrentNotification())
      setFormData({
        title: '',
        content: '',
        type: 'general',
        status: 'active',
        priority: 'normal',
        targetAudience: 'all',
      })
      setIsPinned(false)
      dispatch(fetchNotifications({ page, limit, ...filters }))

    } catch (error) {
      console.error('공지사항 저장 오류:', error)
      showSnackbar({ message: '공지사항 저장에 실패했습니다.', severity: 'error' })
    }
  }

  // 공지사항 삭제 핸들러
  const handleDeleteNotification = (id: number) => {
    setDeleteTargetId(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (deleteTargetId) {
      try {
        await dispatch(deleteNotification(deleteTargetId)).unwrap()
        showSnackbar({ message: '공지사항이 삭제되었습니다.', severity: 'success' })
        setDeleteDialogOpen(false)
        setDeleteTargetId(null)
      } catch (error) {
        console.error('공지사항 삭제 오류:', error)
      }
    }
  }

  // 필터 변경 핸들러
  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // 검색 실행
  const handleSearch = () => {
    dispatch(setPage(1))
    dispatch(fetchNotifications({ page: 1, limit, ...filters }))
  }

  // 페이지네이션
  const handlePageChange = (newPage: number) => {
    dispatch(setPage(newPage))
    dispatch(fetchNotifications({ page: newPage, limit, ...filters }))
  }

  const handleLimitChange = (newLimit: string) => {
    const limitNum = Number(newLimit)
    dispatch(setLimit(limitNum))
    dispatch(setPage(1))
    dispatch(fetchNotifications({ page: 1, limit: limitNum, ...filters }))
  }

  // 타입별 Badge variant
  const getTypeBadgeVariant = (type: NotificationType): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (type) {
      case 'urgent': return 'destructive'
      case 'important': return 'default'
      default: return 'secondary'
    }
  }

  const totalPages = Math.ceil(total / limit) || 1

  return (
    <div className="h-[calc(100vh-140px)] p-0 flex flex-col gap-[3px] overflow-hidden bg-background">
      {/* 헤더 */}
      <div className="flex justify-between items-center px-4 py-2 bg-muted/30 border-b border-[#343637] dark:border-[#6b7280]">
        <div>
          <h1 className="text-xl font-bold tracking-tight">공지사항 관리</h1>
        </div>
        <Button size="sm" onClick={handleAddNotification} className="h-8">
          <Plus className="w-4 h-4 mr-2" />
          추가
        </Button>
      </div>

      {/* 필터 및 검색 */}
      <Card className="flex-shrink-0 shadow-md">
        <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            <CardTitle>필터 및 검색</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="py-3 px-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="min-w-[150px]">
              <Select
                value={filters.type}
                onValueChange={(val) => handleFilterChange('type', val)}
                labels={{ '': '전체', ...NOTIFICATION_TYPE_LABELS }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="공지유형" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">전체</SelectItem>
                  {Object.entries(NOTIFICATION_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[120px]">
              <Select
                value={filters.status}
                onValueChange={(val) => handleFilterChange('status', val)}
                labels={{ '': '전체', ...NOTIFICATION_STATUS_LABELS }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="활성" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">전체</SelectItem>
                  {Object.entries(NOTIFICATION_STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="제목/내용 검색..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-8"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 공지사항 목록 */}
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
                  <TableHead className="w-[100px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">유형</TableHead>
                  <TableHead className="w-[200px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">제목</TableHead>
                  <TableHead className="w-[300px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">내용</TableHead>
                  <TableHead className="w-[80px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">상단고정</TableHead>
                  <TableHead className="w-[120px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">작성일</TableHead>
                  <TableHead className="w-[100px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">작성자</TableHead>
                  <TableHead className="w-[80px] h-[45px] text-center font-bold px-2 border-b-0 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">조회수</TableHead>
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
                        "cursor-pointer h-[35px] border-b-0 group transition-colors bg-[#f9fafb] dark:bg-[#1d1d1d]",
                        "hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30"
                      )}
                      onClick={() => handleNotificationSelect(notification)}
                      onDoubleClick={() => handleRowDoubleClick(notification)}
                    >
                      <TableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">
                        <Badge variant={getTypeBadgeVariant(notification.type)} className="h-5 text-[10px] px-1 pointer-events-none">
                          {NOTIFICATION_TYPE_LABELS[notification.type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="h-[35px] py-0 px-2 text-xs text-left border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">{notification.title}</TableCell>
                      <TableCell className="h-[35px] py-0 px-2 text-xs text-left border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors truncate max-w-[300px]" title={notification.content}>
                        {notification.content}
                      </TableCell>
                      <TableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">
                        <Badge variant={notification.is_pinned ? 'default' : 'outline'} className="h-5 text-[10px] px-1 pointer-events-none">
                          {notification.is_pinned ? '고정' : '일반'}
                        </Badge>
                      </TableCell>
                      <TableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors text-muted-foreground">
                        {new Date(notification.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">{notification.author_name || '-'}</TableCell>
                      <TableCell className="h-[35px] py-0 px-2 text-xs text-center group-hover:text-inherit group-hover:font-inherit transition-colors">{notification.view_count || 0}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* 페이지네이션 */}
        <div className="border-t p-2 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <Select
              value={String(limit)}
              onValueChange={handleLimitChange}
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
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
              >
                {'<'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
              >
                {'>'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* 공지사항 등록/수정 모달 */}
      <Dialog open={modalOpen} onOpenChange={(open) => {
        if (!open) {
          setModalOpen(false)
          setIsEditing(false)
          dispatch(clearCurrentNotification())
          setFormData({
            title: '',
            content: '',
            type: 'general',
            status: 'active',
            priority: 'normal',
            targetAudience: 'all',
          })
          setIsPinned(false)
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              공지사항 {modalMode === 'create' ? '등록' : modalMode === 'edit' ? '수정' : '조회'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {/* 첫 번째 행 */}
            <div className="flex gap-4 items-end">
              <div className="flex-[2] space-y-2">
                <Label htmlFor="title">제목 *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleFormChange('title', e.target.value)}
                  placeholder="제목 입력"
                />
              </div>
              <div className="min-w-[120px] space-y-2">
                <Label>공지유형</Label>
                <Select
                  value={formData.type}
                  onValueChange={(val) => handleFormChange('type', val as NotificationType)}
                  labels={NOTIFICATION_TYPE_LABELS}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(NOTIFICATION_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[100px] space-y-2">
                <Label>상태</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) => handleFormChange('status', val as NotificationStatus)}
                  labels={NOTIFICATION_STATUS_LABELS}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(NOTIFICATION_STATUS_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="pinned"
                  checked={isPinned}
                  onCheckedChange={(checked) => setIsPinned(checked as boolean)}
                />
                <Label htmlFor="pinned" className="cursor-pointer">상단고정</Label>
              </div>
            </div>

            {/* 두 번째 행: 내용 */}
            <div className="space-y-2">
              <Label htmlFor="content">내용 *</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => handleFormChange('content', e.target.value)}
                placeholder="내용 입력"
                rows={12}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setModalOpen(false)
                setIsEditing(false)
                dispatch(clearCurrentNotification())
                setFormData({
                  title: '',
                  content: '',
                  type: 'general',
                  status: 'active',
                  priority: 'normal',
                  targetAudience: 'all',
                })
                setIsPinned(false)
              }}
            >
              <X className="w-4 h-4 mr-2" />
              취소
            </Button>
            {modalMode !== 'view' && (
              <Button
                onClick={handleSaveNotification}
                disabled={loading || !formData.title.trim() || !formData.content.trim()}
              >
                <Save className="w-4 h-4 mr-2" />
                {modalMode === 'create' ? '등록' : '수정'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setDeleteDialogOpen(false)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>공지사항 삭제</DialogTitle>
            <DialogDescription>
              정말로 이 공지사항을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Notification
