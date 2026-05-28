/**
 * 페이지 요약 — 관리자 알림/공지 (`/admin/notification`)
 *
 * 기능: 알림(공지) CRUD, 상태·페이지네이션, 스낵바 피드백.
 *
 * 호출/연동:
 * - Redux `notificationSlice`: `fetchNotifications`, `createNotification`, `updateNotification`,
 *   `deleteNotification`, `setCurrentNotification`, `clearCurrentNotification`, `clearError`,
 *   `setPage`, `setLimit`
 * - `notificationApi.markAsRead`
 *
 * 관련 컴포넌트(`./components/`):
 * - `NotificationFilterBar`: 유형/상태/검색 필터
 * - `NotificationTable`: 목록 테이블 + 페이지네이션
 * - `NotificationFormDialog`: 등록/수정 모달
 * - `NotificationDeleteDialog`: 삭제 확인
 * - `notificationUtils.ts`: 유형 Badge variant
 *
 * 흐름: 목록 fetch → 행 더블클릭으로 모달 → 등록/수정/삭제 → API 동기화.
 */

import React, { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import {
  fetchNotifications,
  createNotification,
  updateNotification,
  deleteNotification,
  setCurrentNotification,
  clearCurrentNotification,
  clearError,
  setPage,
  setLimit,
} from '@/store/slices/notificationSlice'
import { notificationApi } from '@/services/notificationApi'
import { useSnackbar } from '@/contexts/SnackbarContext'
import {
  CreateNotificationRequest,
  Notification as NotificationItem,
} from '@/types/notification'
import {
  NotificationFilterBar,
  type NotificationFilterState,
} from './components/NotificationFilterBar'
import { NotificationTable } from './components/NotificationTable'
import {
  NotificationFormDialog,
  type NotificationFormMode,
} from './components/NotificationFormDialog'
import { NotificationDeleteDialog } from './components/NotificationDeleteDialog'

const INITIAL_FORM: CreateNotificationRequest = {
  title: '',
  content: '',
  type: 'general',
  status: 'active',
  priority: 'normal',
  targetAudience: 'all',
}

const INITIAL_FILTERS: NotificationFilterState = {
  type: '',
  status: '',
  search: '',
}

const Notification: React.FC = () => {
  const dispatch = useAppDispatch()
  const { showSnackbar } = useSnackbar()

  const notificationState = useAppSelector((state) => state.notifications)
  const {
    notifications = [],
    currentNotification,
    loading = false,
    error = null,
    total = 0,
    page = 1,
    limit = 10,
  } = notificationState || {}

  const [isEditing, setIsEditing] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<NotificationFormMode>('create')
  const [isPinned, setIsPinned] = useState(false)
  const [formData, setFormData] = useState<CreateNotificationRequest>(INITIAL_FORM)
  const [filters, setFilters] = useState<NotificationFilterState>(INITIAL_FILTERS)

  useEffect(() => {
    try {
      dispatch(fetchNotifications({ page, limit, ...filters }))
    } catch (err) {
      console.error('공지사항 로드 오류:', err)
    }
  }, [dispatch, page, limit, filters])

  useEffect(() => {
    if (error) {
      showSnackbar({ message: String(error), severity: 'error' })
      dispatch(clearError())
    }
  }, [error, dispatch])

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

  const resetForm = () => {
    setFormData(INITIAL_FORM)
    setIsPinned(false)
  }

  const handleFormChange = (field: keyof CreateNotificationRequest, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleNotificationSelect = async (notification: NotificationItem) => {
    dispatch(setCurrentNotification(notification))
    try {
      await notificationApi.markAsRead(notification.id)
    } catch (err) {
      console.error('조회수 증가 실패:', err)
    }
  }

  const handleAddNotification = () => {
    resetForm()
    dispatch(clearCurrentNotification())
    setIsEditing(false)
    setModalMode('create')
    setModalOpen(true)
  }

  const handleRowDoubleClick = (notification: NotificationItem) => {
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
  }

  const handleSaveNotification = async () => {
    try {
      const saveData = { ...formData, isPinned }
      if (currentNotification && isEditing) {
        await dispatch(
          updateNotification({
            id: currentNotification.id,
            data: { ...saveData, id: currentNotification.id },
          })
        ).unwrap()
        showSnackbar({ message: '공지사항이 수정되었습니다.', severity: 'success' })
      } else {
        await dispatch(createNotification(saveData)).unwrap()
        showSnackbar({ message: '공지사항이 등록되었습니다.', severity: 'success' })
      }

      setIsEditing(false)
      setModalOpen(false)
      dispatch(clearCurrentNotification())
      resetForm()
      dispatch(fetchNotifications({ page, limit, ...filters }))
    } catch (err) {
      console.error('공지사항 저장 오류:', err)
      showSnackbar({ message: '공지사항 저장에 실패했습니다.', severity: 'error' })
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return
    try {
      await dispatch(deleteNotification(deleteTargetId)).unwrap()
      showSnackbar({ message: '공지사항이 삭제되었습니다.', severity: 'success' })
      setDeleteDialogOpen(false)
      setDeleteTargetId(null)
    } catch (err) {
      console.error('공지사항 삭제 오류:', err)
    }
  }

  const handleFilterChange = (field: keyof NotificationFilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  const handleSearch = () => {
    dispatch(setPage(1))
    dispatch(fetchNotifications({ page: 1, limit, ...filters }))
  }

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

  const handleModalOpenChange = (open: boolean) => {
    if (open) return
    setModalOpen(false)
    setIsEditing(false)
    dispatch(clearCurrentNotification())
    resetForm()
  }

  return (
    <div className="h-[calc(100vh-140px)] p-0 flex flex-col gap-[3px] overflow-hidden bg-background">
      <div className="flex justify-between items-center px-4 py-2 bg-muted/30 border-b border-[#343637] dark:border-[#6b7280]">
        <h1 className="text-xl font-bold tracking-tight">공지사항 관리</h1>
        <Button size="sm" onClick={handleAddNotification} className="h-8">
          <Plus className="w-4 h-4 mr-2" />
          추가
        </Button>
      </div>

      <NotificationFilterBar
        filters={filters}
        onChange={handleFilterChange}
        onSearch={handleSearch}
      />

      <NotificationTable
        notifications={notifications}
        loading={loading}
        total={total}
        page={page}
        limit={limit}
        onSelect={handleNotificationSelect}
        onDoubleClick={handleRowDoubleClick}
        onPageChange={handlePageChange}
        onLimitChange={handleLimitChange}
      />

      <NotificationFormDialog
        open={modalOpen}
        mode={modalMode}
        loading={loading}
        formData={formData}
        isPinned={isPinned}
        onOpenChange={handleModalOpenChange}
        onChange={handleFormChange}
        onPinnedChange={setIsPinned}
        onSave={handleSaveNotification}
        onCancel={() => handleModalOpenChange(false)}
      />

      <NotificationDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) setDeleteDialogOpen(false)
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}

export default Notification
