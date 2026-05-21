/**
 * 페이지 요약 — 공지사항 (`/announcements`)
 *
 * 기능: 공지 목록·작성·수정·삭제·상태·조회수·첨부파일(역할에 따라 관리 기능 노출).
 *
 * 호출/연동:
 * - Redux `notificationSlice`(fetch/create/update/delete/status/page 등)
 * - `notificationApi` (`services/notificationApi.ts`) — REST 목록·상세·첨부 multipart 업로드·읽음 등
 * - DB/SP는 `packages/api-server` 관리자 공지 라우트·`sp_CreateAnnouncement` / `sp_UpdateAnnouncement` 등
 *
 * 관련 컴포넌트: `DataTable`(첨부 컬럼·`announcements-page-columns`), Dialog, `AnnouncementAttachmentsField`, `useAuth`.
 *
 * 흐름: dispatch로 목록 로드 → 모달 CRUD → 저장 시 선택 파일 업로드 후 본문 JSON에 attachments 포함.
 */

import React, { useState, useEffect } from 'react'
import {
  Plus,
  Edit,
  Search,
  Filter,
  Megaphone,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { DataTable } from '@/components/ui/data-table'
import { useAppDispatch, useAppSelector } from '../../hooks/redux'
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
  incrementViewCount,
} from '../../store/slices/notificationSlice'
import {
  Notification as NotificationItem,
  CreateNotificationRequest,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_STATUS_LABELS,
  NotificationStatus,
  parseNotificationAttachments,
  AnnouncementAttachment,
} from '../../types/notification'
import { useAuth } from '../../hooks/useAuth'
import { notificationApi } from '../../services/notificationApi'
import { AnnouncementAttachmentsField } from './AnnouncementAttachmentsField'
import { buildAnnouncementsPageColumns } from './announcements-page-columns'

const AnnouncementsPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { user, isAdmin } = useAuth()

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
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertVariant, setAlertVariant] = useState<'default' | 'destructive'>('default')

  // 팝업 모달 상태
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create')

  // 폼 상태
  const [formData, setFormData] = useState<CreateNotificationRequest>({
    title: '',
    content: '',
    type: 'general',
    status: 'active',
    priority: 'normal',
    targetAudience: 'all',
  })

  // 상단고정 상태
  const [isPinned, setIsPinned] = useState(false)

  /** 서버에 반영된 첨부 URL + 저장 시 multipart로 올릴 로컬 파일 */
  const [uploadedAttachments, setUploadedAttachments] = useState<AnnouncementAttachment[]>([])
  const [pendingAttachmentFiles, setPendingAttachmentFiles] = useState<File[]>([])

  // 필터 상태
  const [filters, setFilters] = useState({
    type: 'all', // 'all' for UI, empty string for API
    status: 'all', // 'all' for UI, empty string for API
    search: '',
  })

  // 초기 로드 및 필터 변경 시 로드
  useEffect(() => {
    dispatch(setPage(1))
    dispatch(fetchNotifications({
      page: 1,
      limit,
      type: filters.type === 'all' ? '' : filters.type,
      status: filters.status === 'all' ? '' : filters.status,
      search: filters.search,
      isAdmin,
      append: false
    }))
  }, [filters.type, filters.status, isAdmin, dispatch]) // search는 별도 처리 (엔터/버튼)

  // 에러 처리
  useEffect(() => {
    if (error) {
      setAlertMessage(error)
      setAlertVariant('destructive')
      setAlertOpen(true)
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
      setUploadedAttachments(parseNotificationAttachments(currentNotification.attachments))
      setPendingAttachmentFiles([])
      setIsEditing(true)
    } else {
      setUploadedAttachments([])
      setPendingAttachmentFiles([])
    }
  }, [currentNotification])

  // 폼 데이터 변경 핸들러
  const handleFormChange = (field: keyof CreateNotificationRequest, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // 새 공지사항 추가 핸들러 - 관리자만 가능
  const handleAddNotification = () => {
    if (!isAdmin) return

    setFormData({
      title: '',
      content: '',
      type: 'general',
      status: 'active',
      priority: 'normal',
      targetAudience: 'all',
    })
    setIsPinned(false)
    setUploadedAttachments([])
    setPendingAttachmentFiles([])
    dispatch(clearCurrentNotification())
    setIsEditing(true)
    setModalMode('create')
    setModalOpen(true)
  }

  // 공지사항 클릭 핸들러 (상세보기/편집)
  const handleCardClick = async (notification: NotificationItem) => {
    setFormData({
      title: notification.title,
      content: notification.content,
      type: notification.type,
      status: notification.status || 'active',
      priority: notification.priority || 'normal',
      targetAudience: notification.target_audience || 'all',
    })
    setIsPinned(Boolean(notification.is_pinned))
    setUploadedAttachments(parseNotificationAttachments(notification.attachments))
    setPendingAttachmentFiles([])
    dispatch(setCurrentNotification(notification))

    if (isAdmin) {
      setIsEditing(true)
      setModalMode('edit')
    } else {
      setIsEditing(false)
      setModalMode('view')
    }
    setModalOpen(true)

    // 조회수 증가 API 호출
    try {
      await notificationApi.markAsRead(notification.id);
      // Redux 상태 즉시 업데이트 (조회수 +1)
      dispatch(incrementViewCount(notification.id));
    } catch (error) {
      console.error('조회수 증가 실패:', error);
    }
  }

  // 공지사항 저장 핸들러
  const handleAddAttachmentFiles = (files: File[]) => {
    if (files.length === 0) return
    setPendingAttachmentFiles((prev) => [...prev, ...files])
  }

  const handleRemoveUploadedAttachment = (url: string) => {
    setUploadedAttachments((prev) => prev.filter((a) => a.url !== url))
  }

  const handleRemovePendingAttachment = (index: number) => {
    setPendingAttachmentFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSaveNotification = async () => {
    if (!isAdmin) return

    try {
      let mergedAttachments = [...uploadedAttachments]
      if (pendingAttachmentFiles.length > 0) {
        const uploadedNew = await notificationApi.uploadAnnouncementAttachments(pendingAttachmentFiles)
        mergedAttachments = [...mergedAttachments, ...uploadedNew]
      }

      const saveData = {
        ...formData,
        isPinned,
        attachments: mergedAttachments,
      }

      if (currentNotification && modalMode === 'edit') {
        // 수정
        await dispatch(updateNotification({
          id: currentNotification.id,
          data: {
            ...saveData,
            id: currentNotification.id
          }
        })).unwrap()
        setAlertMessage('공지사항이 수정되었습니다.')
      } else {
        // 새 등록
        await dispatch(createNotification(saveData)).unwrap()
        setAlertMessage('공지사항이 등록되었습니다.')
      }

      setPendingAttachmentFiles([])

      setAlertVariant('default')
      setAlertOpen(true)
      setIsEditing(false)
      setModalOpen(false)
      dispatch(clearCurrentNotification())

      // 목록 새로고침 (첫 페이지부터)
      dispatch(setPage(1))
      dispatch(fetchNotifications({
        page: 1,
        limit,
        type: filters.type === 'all' ? '' : filters.type,
        status: filters.status === 'all' ? '' : filters.status,
        search: filters.search,
        isAdmin,
        append: false
      }))

    } catch (error) {
      console.error('공지사항 저장 오류:', error)
      setAlertMessage(
        error instanceof Error ? error.message : '공지사항 저장에 실패했습니다.'
      )
      setAlertVariant('destructive')
      setAlertOpen(true)
    }
  }

  // 공지사항 삭제 핸들러
  const handleDeleteNotification = (e: React.MouseEvent, id: number) => {
    e.stopPropagation() // 카드 클릭 이벤트 전파 방지
    if (!isAdmin) return
    setDeleteTargetId(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!isAdmin || !deleteTargetId) return

    try {
      await dispatch(deleteNotification(deleteTargetId)).unwrap()
      setAlertMessage('공지사항이 삭제되었습니다.')
      setAlertVariant('default')
      setAlertOpen(true)
      setDeleteDialogOpen(false)
      setDeleteTargetId(null)
    } catch (error) {
      console.error('공지사항 삭제 오류:', error)
    }
  }

  // 검색 실행 핸들러
  const handleSearch = () => {
    dispatch(setPage(1))
    dispatch(fetchNotifications({
      page: 1,
      limit,
      type: filters.type === 'all' ? '' : filters.type,
      status: filters.status === 'all' ? '' : filters.status,
      search: filters.search,
      isAdmin,
      append: false
    }))
  }

  const columns = buildAnnouncementsPageColumns({
    isAdmin,
    onRowOpen: handleCardClick,
    onDeleteRow: handleDeleteNotification,
  })

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col p-0 gap-[3px] bg-background">
      {/* 알림 메시지 */}
      {alertOpen && (
        <Alert variant={alertVariant} className="mb-0 rounded-none border-x-0 border-t-0">
          <AlertTitle>{alertVariant === 'default' ? '성공' : '오류'}</AlertTitle>
          <AlertDescription>{alertMessage}</AlertDescription>
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 h-6 w-6 p-0"
            onClick={() => setAlertOpen(false)}
          >
            <span className="sr-only">Close</span>
            <span aria-hidden="true">&times;</span>
          </Button>
        </Alert>
      )}

      {/* 필터 및 검색 영역 */}
      <Card className="shrink-0 shadow-md">
        <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg font-bold">필터 및 검색</CardTitle>
          </div>
          {isAdmin && (
            <Button onClick={handleAddNotification} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              공지사항 추가
            </Button>
          )}
        </CardHeader>
        <CardContent className="py-3">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="w-full sm:w-[180px]">
              <Label htmlFor="type-filter" className="mb-2 block text-sm font-medium">공지유형</Label>
              <Select
                value={filters.type}
                onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))}
                labels={{ all: '전체', ...NOTIFICATION_TYPE_LABELS }}
              >
                <SelectTrigger id="type-filter">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {Object.entries(NOTIFICATION_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-[150px]">
              <Label htmlFor="status-filter" className="mb-2 block text-sm font-medium">상태</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                labels={{ all: '전체', ...NOTIFICATION_STATUS_LABELS }}
              >
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {Object.entries(NOTIFICATION_STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <Label htmlFor="search-input" className="mb-2 block text-sm font-medium">검색</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="search-input"
                    placeholder="제목 또는 내용 검색..."
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="bg-card pr-8"
                  />
                  {filters.search && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilters(prev => ({ ...prev, search: '' }));
                        // 검색어 초기화 시 즉시 검색 결과 반영을 원할 경우 handleSearch() 호출 가능
                        // 현재는 입력값만 비우는 것으로 처리
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button variant="secondary" onClick={handleSearch}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 공지사항 목록 (DataTable) */}
      <Card className="flex-1 min-h-0 overflow-hidden shadow-md">
        <CardContent className="p-0 h-full">
          <DataTable
            columns={columns}
            data={notifications}
          />
        </CardContent>
      </Card>

      {/* 공지사항 상세/등록/수정 다이얼로그 */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-full max-w-7xl h-[60vh] overflow-y-auto">
          <DialogHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 leading-none">
              {modalMode === 'create' ? <Plus className="h-5 w-5 text-primary" /> :
                modalMode === 'edit' ? <Edit className="h-5 w-5 text-primary" /> :
                  <Megaphone className="h-5 w-5 text-orange-500" />}
              {modalMode === 'create' ? '공지사항 등록' :
                modalMode === 'edit' ? '공지사항 수정' :
                  '공지사항 상세'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 py-4">
            {/* Left Column: Meta Info */}
            <div className="md:col-span-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">제목</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleFormChange('title', e.target.value)}
                  readOnly={modalMode === 'view'}
                  className={modalMode === 'view' ? 'bg-muted' : ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">공지유형</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => handleFormChange('type', value)}
                  disabled={modalMode === 'view'}
                  labels={NOTIFICATION_TYPE_LABELS}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(NOTIFICATION_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isAdmin && modalMode !== 'view' && (
                <div className="space-y-4 border p-4 rounded-md bg-muted/20">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="pinned"
                      checked={isPinned}
                      onCheckedChange={(checked) => setIsPinned(checked as boolean)}
                    />
                    <Label htmlFor="pinned" className="cursor-pointer font-medium">상단고정</Label>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status" className="text-sm font-medium">상태</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => handleFormChange('status', value)}
                      labels={NOTIFICATION_STATUS_LABELS}
                    >
                      <SelectTrigger id="status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(NOTIFICATION_STATUS_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Content */}
            <div className="md:col-span-7 flex flex-col h-full">
              <Label htmlFor="content" className="mb-2">내용</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => handleFormChange('content', e.target.value)}
                readOnly={modalMode === 'view'}
                className={`flex-1 min-h-[320px] resize-none ${modalMode === 'view' ? 'bg-muted' : ''}`}
              />
              <AnnouncementAttachmentsField
                readOnly={modalMode === 'view'}
                uploaded={uploadedAttachments}
                pendingFiles={pendingAttachmentFiles}
                onAddFiles={handleAddAttachmentFiles}
                onRemoveUploaded={handleRemoveUploadedAttachment}
                onRemovePending={handleRemovePendingAttachment}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              {modalMode === 'view' ? '닫기' : '취소'}
            </Button>
            {modalMode !== 'view' && isAdmin && (
              <Button onClick={handleSaveNotification}>
                {modalMode === 'create' ? '등록' : '저장'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>공지사항 삭제</DialogTitle>
            <DialogDescription>
              정말로 이 공지사항을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>취소</Button>
            <Button variant="destructive" onClick={confirmDelete}>삭제</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AnnouncementsPage