/**
 * 페이지 요약 — 지점 관리 (`/admin/branch`)
 *
 * 기능: 지점(브랜치) 목록·등록·수정·삭제·페이지네이션.
 *
 * 호출/연동:
 * - Redux `branchSlice`: `fetchBranches`, `createBranch`, `updateBranch`, `deleteBranch`, `setCurrentBranch`,
 *   `clearCurrentBranch`, `clearError`, `setPage`, `setLimit`
 * - DB/SP는 `packages/api-server` 지점 API 참조.
 *
 * 관련 컴포넌트(`./components/`):
 * - `BranchListTable`: 지점 목록 카드(헤더/추가·삭제 버튼/테이블)
 * - `BranchEditForm`: 등록/수정 폼 카드
 * - `BranchDeleteDialog`: 일괄 삭제 확인 다이얼로그
 *
 * 흐름: dispatch로 목록 로드 → 행 선택/편집 → 저장(생성/수정) → 삭제 시 확인.
 */

import React, { useState, useEffect } from 'react'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import {
  fetchBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  setCurrentBranch,
  clearCurrentBranch,
  clearError,
} from '@/store/slices/branchSlice'
import {
  Branch as BranchItem,
  CreateBranchRequest,
} from '@/types/branch'
import { BranchListTable } from './components/BranchListTable'
import { BranchEditForm } from './components/BranchEditForm'
import { BranchDeleteDialog } from './components/BranchDeleteDialog'

const createInitialFormData = (): CreateBranchRequest => ({
  name: '',
  region: '',
  address: '',
  phone: '',
  manager: '',
})

const Branch: React.FC = () => {
  const dispatch = useAppDispatch()

  const branchState = useAppSelector((state) => state.branches)
  const {
    branches = [],
    currentBranch,
    loading = false,
    error = null,
    page = 1,
    limit = 10,
  } = branchState || {}

  const [isEditing, setIsEditing] = useState(false)
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [isNewRow, setIsNewRow] = useState(false)
  const [newRowData, setNewRowData] = useState<BranchItem | null>(null)
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [notification, setNotification] = useState<{
    message: string
    type: 'success' | 'error' | 'info'
  } | null>(null)
  const [formData, setFormData] = useState<CreateBranchRequest>(createInitialFormData)

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  useEffect(() => {
    try {
      dispatch(fetchBranches({ page, limit }))
    } catch (err) {
      console.error('지점 로드 오류:', err)
    }
  }, [dispatch, page, limit])

  useEffect(() => {
    if (error) {
      showNotification(error, 'error')
      dispatch(clearError())
    }
  }, [error, dispatch])

  useEffect(() => {
    if (currentBranch) {
      setFormData({
        name: currentBranch.name,
        region: currentBranch.region,
        address: currentBranch.address || '',
        phone: currentBranch.phone || '',
        manager: currentBranch.manager || '',
      })
      setIsEditing(true)
    }
  }, [currentBranch])

  const handleFormChange = (field: keyof CreateBranchRequest, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleRowSelect = (branch: BranchItem) => {
    if (String(branch.id) === selectedRowId) {
      setSelectedRowId(null)
      setSelectedRows([])
      setIsEditing(false)
      dispatch(clearCurrentBranch())
      setFormData(createInitialFormData())
      return
    }

    const rowId = String(branch.id)
    setSelectedRowId(rowId)
    setSelectedRows([rowId])
    setFormData({
      name: branch.name,
      region: branch.region,
      address: branch.address || '',
      phone: branch.phone || '',
      manager: branch.manager || '',
    })
    setIsEditing(true)
    setIsNewRow(false)
    setNewRowData(null)
    dispatch(setCurrentBranch(branch))
  }

  const handleAddBranch = () => {
    const newId = `new_${Date.now()}`
    const newBranch: BranchItem = {
      id: newId,
      name: '새 지점',
      region: '새 지역',
      address: '',
      phone: '',
      manager: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    setNewRowData(newBranch)
    setFormData(createInitialFormData())
    setSelectedRowId(newId)
    setIsNewRow(true)
    setIsEditing(false)
    dispatch(clearCurrentBranch())
  }

  const handleSaveBranch = async () => {
    const wasNewRow = isNewRow

    try {
      if (wasNewRow) {
        await dispatch(createBranch(formData)).unwrap()
        showNotification('지점이 등록되었습니다.', 'success')
        setFormData(createInitialFormData())
      } else if (currentBranch && isEditing) {
        await dispatch(
          updateBranch({
            id: currentBranch.id,
            data: { ...formData, id: currentBranch.id },
          })
        ).unwrap()
        showNotification('지점 정보가 수정되었습니다.', 'success')
      }
    } catch (err: any) {
      console.error('지점 저장 오류:', err)
      let errorMessage = '저장 중 오류가 발생했습니다.'
      if (err?.response?.data?.message) errorMessage = err.response.data.message
      else if (err?.response?.data?.error) errorMessage = err.response.data.error
      else if (err?.message) errorMessage = err.message
      showNotification(errorMessage, 'error')
    } finally {
      if (wasNewRow) {
        setNewRowData(null)
        setIsNewRow(false)
        setSelectedRowId(null)
        setIsEditing(false)
      }
      await dispatch(fetchBranches({ page, limit }))
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setIsNewRow(false)
    setSelectedRowId(null)
    setNewRowData(null)
    dispatch(clearCurrentBranch())
    setFormData(createInitialFormData())
  }

  const handleDeleteClick = () => {
    if (selectedRows.length === 0) {
      showNotification('삭제할 지점을 선택해주세요.', 'info')
      return
    }
    setDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = async () => {
    try {
      for (const branchId of selectedRows) {
        await dispatch(deleteBranch(branchId)).unwrap()
      }
      showNotification(`${selectedRows.length}개의 지점이 삭제되었습니다.`, 'success')
      setSelectedRows([])
      setDeleteConfirmOpen(false)
      dispatch(fetchBranches({ page, limit }))
    } catch (err) {
      console.error('지점 삭제 오류:', err)
      showNotification('삭제 중 오류가 발생했습니다.', 'error')
      setDeleteConfirmOpen(false)
    }
  }

  const displayData = [...branches, ...(newRowData ? [newRowData] : [])]

  return (
    <div className="relative h-[calc(100vh-140px)] p-0 flex flex-col gap-[3px] overflow-hidden bg-background">
      {notification && (
        <div className="absolute top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <Alert
            variant={notification.type === 'error' ? 'destructive' : 'default'}
            className="w-auto shadow-lg"
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4" />
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

      <div className="flex-[2] min-h-0">
        <BranchListTable
          data={displayData}
          loading={loading}
          selectedRowId={selectedRowId}
          newRowId={newRowData ? String(newRowData.id) : null}
          hasSelection={selectedRows.length > 0}
          onAdd={handleAddBranch}
          onDelete={handleDeleteClick}
          onSelect={handleRowSelect}
        />
      </div>

      <div className="flex-[1.2] min-h-0">
        <BranchEditForm
          formData={formData}
          isEditing={isEditing}
          isNewRow={isNewRow}
          loading={loading}
          onChange={handleFormChange}
          onCancel={handleCancel}
          onSave={handleSaveBranch}
        />
      </div>

      <BranchDeleteDialog
        open={deleteConfirmOpen}
        count={selectedRows.length}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}

export default Branch
