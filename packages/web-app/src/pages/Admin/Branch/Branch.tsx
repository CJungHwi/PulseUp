/**
 * 페이지 요약 — 지점 관리 (`/admin/branch`)
 *
 * 기능: 지점(브랜치) 목록·등록·수정·삭제·페이지네이션.
 *
 * 호출/연동:
 * - Redux `branchSlice`: `fetchBranches`, `createBranch`, `updateBranch`, `deleteBranch` 등
 * - DB/SP는 `packages/api-server` 지점 API 참조.
 *
 * 관련 컴포넌트: shadcn `Table`, `Dialog`, 폼 입력.
 *
 * 흐름: dispatch로 목록 로드 → 행 편집·저장 → 삭제 확인.
 */

import React, { useState, useEffect } from 'react'
import {
  Plus,
  Save,
  X,
  Edit,
  Trash2,
  Building2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { cn } from '@/lib/utils'
import { useAppDispatch, useAppSelector } from '../../../hooks/redux'
import {
  fetchBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  setCurrentBranch,
  clearCurrentBranch,
  clearError,
  setPage,
  setLimit,
} from '../../../store/slices/branchSlice'
import {
  Branch as BranchItem,
  CreateBranchRequest,
} from '../../../types/branch'

const Branch: React.FC = () => {
  const dispatch = useAppDispatch()

  // Redux 상태
  const branchState = useAppSelector(state => state.branches)
  const {
    branches = [],
    currentBranch,
    loading = false,
    error = null,
    total = 0,
    page = 1,
    limit = 10
  } = branchState || {}

  // 로컬 상태
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

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  // 폼 상태
  const [formData, setFormData] = useState<CreateBranchRequest>({
    name: '',
    region: '',
    address: '',
    phone: '',
    manager: '',
  })

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    try {
      dispatch(fetchBranches({ page, limit }))
    } catch (error) {
      console.error('지점 로드 오류:', error)
    }
  }, [dispatch, page, limit])

  // 에러 처리
  useEffect(() => {
    if (error) {
      showNotification(error, 'error')
      dispatch(clearError())
    }
  }, [error, dispatch])

  // 현재 선택된 지점이 변경될 때 폼 데이터 업데이트
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

  // 폼 데이터 변경 핸들러
  const handleFormChange = (field: keyof CreateBranchRequest, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }))
  }

  // 테이블 행 선택 핸들러
  const handleRowSelect = (branch: BranchItem) => {
    if (String(branch.id) === selectedRowId) {
      // 이미 선택된 행을 다시 클릭하면 선택 해제
      setSelectedRowId(null)
      setIsEditing(false)
      dispatch(clearCurrentBranch())
      setFormData({
        name: '',
        region: '',
        address: '',
        phone: '',
        manager: '',
      })
    } else {
      // 새로운 행 선택
      setSelectedRowId(String(branch.id))
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
  }

  // 새 지점 추가 핸들러
  const handleAddBranch = () => {
    // 새로운 임시 ID 생성
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

    // 새 행 데이터 설정
    setNewRowData(newBranch)

    setFormData({
      name: '',
      region: '',
      address: '',
      phone: '',
      manager: '',
    })
    setSelectedRowId(newId)
    setIsNewRow(true)
    setIsEditing(false)
    dispatch(clearCurrentBranch())
  }

  // 지점 저장 핸들러
  const handleSaveBranch = async () => {
    const wasNewRow = isNewRow

    try {
      if (wasNewRow) {
        // sp_create_branch 프로시저를 이용한 새 등록
        console.log('지점 생성 요청 데이터:', formData)
        const result = await dispatch(createBranch(formData)).unwrap()
        console.log('지점 생성 성공:', result)
        showNotification('지점이 등록되었습니다.', 'success')
        // 폼 데이터 초기화
        setFormData({
          name: '',
          region: '',
          address: '',
          phone: '',
          manager: '',
        })
      } else if (currentBranch && isEditing) {
        // sp_update_branch 프로시저를 이용한 수정
        await dispatch(updateBranch({
          id: currentBranch.id,
          data: { ...formData, id: currentBranch.id }
        })).unwrap()
        showNotification('지점 정보가 수정되었습니다.', 'success')
        // 수정 후에는 편집 모드 유지
      }
    } catch (error: any) {
      console.error('지점 저장 오류:', error)
      let errorMessage = '저장 중 오류가 발생했습니다.'

      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error
      } else if (error?.message) {
        errorMessage = error.message
      }

      showNotification(errorMessage, 'error')
    } finally {
      // 새 행이었다면 상태 초기화
      if (wasNewRow) {
        setNewRowData(null)
        setIsNewRow(false)
        setSelectedRowId(null)
        setIsEditing(false)
      }

      // 성공/실패 관계없이 데이터 새로고침
      console.log('데이터 새로고침 시작')
      await dispatch(fetchBranches({ page, limit }))
    }
  }

  // 취소 핸들러
  const handleCancel = () => {
    setIsEditing(false)
    setIsNewRow(false)
    setSelectedRowId(null)
    setNewRowData(null)
    dispatch(clearCurrentBranch())
    setFormData({
      name: '',
      region: '',
      address: '',
      phone: '',
      manager: '',
    })
  }

  // 삭제 버튼 클릭 핸들러
  const handleDeleteClick = () => {
    if (selectedRows.length === 0) {
      showNotification('삭제할 지점을 선택해주세요.', 'info')
      return
    }
    setDeleteConfirmOpen(true)
  }

  // 삭제 확인 핸들러
  const handleDeleteConfirm = async () => {
    try {
      for (const branchId of selectedRows) {
        await dispatch(deleteBranch(branchId)).unwrap()
      }
      showNotification(`${selectedRows.length}개의 지점이 삭제되었습니다.`, 'success')
      setSelectedRows([])
      setDeleteConfirmOpen(false)
      // 데이터 새로고침
      dispatch(fetchBranches({ page, limit }))
    } catch (error) {
      console.error('지점 삭제 오류:', error)
      showNotification('삭제 중 오류가 발생했습니다.', 'error')
      setDeleteConfirmOpen(false)
    }
  }

  // 삭제 취소 핸들러
  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false)
  }

  // 페이지네이션 핸들러
  const handlePageChange = (newPage: number) => {
    dispatch(setPage(newPage))
    dispatch(fetchBranches({ page: newPage, limit }))
  }

  const handleLimitChange = (newLimit: string) => {
    const limitNum = Number(newLimit)
    dispatch(setLimit(limitNum))
    dispatch(setPage(1))
    dispatch(fetchBranches({ page: 1, limit: limitNum }))
  }

  // 전체 데이터 (기존 + 새 행)
  const displayData = [...branches, ...(newRowData ? [newRowData] : [])]
  const totalPages = Math.ceil(total / limit) || 1

  return (
    <div className="relative h-[calc(100vh-140px)] p-0 flex flex-col gap-[3px] overflow-hidden bg-background">
      {/* 스낵바(우측 상단) */}
      {notification && (
        <div className="absolute top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <Alert variant={notification.type === 'error' ? 'destructive' : 'default'} className="w-auto shadow-lg">
            {notification.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertTitle>
              {notification.type === 'success' ? '성공' : notification.type === 'error' ? '오류' : '알림'}
            </AlertTitle>
            <AlertDescription>{notification.message}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* 지점 목록 테이블 */}
      <div className="flex-[2] min-h-0">
        <Card className="h-full flex flex-col bg-card shadow-md overflow-hidden">
          <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
              <Building2 className="h-5 w-5 text-blue-500" />
              지점 목록
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" onClick={handleDeleteClick} disabled={selectedRows.length === 0}>
                <Trash2 className="h-4 w-4 mr-2" />
                삭제
              </Button>
              <Button variant="default" size="sm" onClick={handleAddBranch}>
                <Plus className="h-4 w-4 mr-2" />
                추가
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 min-h-0 p-0">
            <div className="h-full overflow-hidden border border-[#343637] dark:border-[#6b7280] bg-[#f9fafb] dark:bg-[#1d1d1d] shadow-md">
              <div className="h-full overflow-auto scrollbar-hide">
                <Table className="w-full table-fixed border-separate border-spacing-0">
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow className="hover:bg-transparent border-b-0">
                      <TableHead className="w-[150px] h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">
                        지점명
                      </TableHead>
                      <TableHead className="w-[120px] h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">
                        지점지역
                      </TableHead>
                      <TableHead className="w-[250px] h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">
                        주소
                      </TableHead>
                      <TableHead className="w-[150px] h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">
                        전화번호
                      </TableHead>
                      <TableHead className="w-[120px] h-[45px] px-2 text-xs font-bold text-center border-b-0 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">
                        담당자
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && displayData.length === 0 ? (
                      <TableRow className="border-b-0">
                        <TableCell colSpan={5} className="h-24 text-center border-b-0 text-muted-foreground">
                          데이터를 불러오는 중...
                        </TableCell>
                      </TableRow>
                    ) : displayData.length === 0 ? (
                      <TableRow className="border-b-0">
                        <TableCell colSpan={5} className="h-24 text-center border-b-0 text-muted-foreground">
                          데이터가 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayData.map((branch) => (
                        <TableRow
                          key={branch.id}
                          className={cn(
                            'cursor-pointer h-[35px] border-b-0 group transition-colors bg-[#f9fafb] dark:bg-[#1d1d1d]',
                            'hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30',
                            selectedRowId === String(branch.id) && 'bg-muted/80 ring-1 ring-inset ring-primary/30',
                            branch.id === newRowData?.id && 'bg-yellow-100 dark:bg-yellow-900/20 italic'
                          )}
                          onClick={() => {
                            if (branch.id !== newRowData?.id) {
                              const rowId = String(branch.id)
                              setSelectedRows([rowId])
                              handleRowSelect(branch)
                            }
                          }}
                        >
                          <TableCell className="h-[35px] py-0 px-2 text-xs text-center font-medium border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">
                            {branch.name}
                          </TableCell>
                          <TableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">
                            {branch.region}
                          </TableCell>
                          <TableCell className="h-[35px] py-0 px-2 text-xs text-left border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">
                            {branch.address || '-'}
                          </TableCell>
                          <TableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">
                            {branch.phone || '-'}
                          </TableCell>
                          <TableCell className="h-[35px] py-0 px-2 text-xs text-center group-hover:text-inherit group-hover:font-inherit transition-colors">
                            {branch.manager || '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 지점 등록/수정 폼 */}
      <div className="flex-[1.2] min-h-0">
        <Card className="h-full flex flex-col bg-card shadow-md overflow-hidden">
          <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
              <Edit className="h-5 w-5 text-blue-500" />
              지점 {isNewRow ? '등록' : isEditing ? '수정' : '정보'}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={!isEditing && !isNewRow}
                className="h-9"
              >
                <X className="h-4 w-4 mr-2" />
                취소
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleSaveBranch}
                disabled={loading || !formData.name.trim() || !formData.region.trim() || (!isNewRow && !isEditing)}
                className="h-9"
              >
                <Save className="h-4 w-4 mr-2" />
                {isNewRow ? '등록' : '저장'}
              </Button>
          </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-auto scrollbar-hide p-4">
            <div className="space-y-4">
              {/* 1행: 지점명, 지점지역, 전화번호 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">지점명 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    disabled={!isEditing && !isNewRow}
                    placeholder="지점명 입력"
                    className="h-10 bg-card"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">지점지역 *</Label>
                  <Input
                    id="region"
                    value={formData.region}
                    onChange={(e) => handleFormChange('region', e.target.value)}
                    disabled={!isEditing && !isNewRow}
                    placeholder="지역 입력"
                    className="h-10 bg-card"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">전화번호</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleFormChange('phone', e.target.value)}
                    disabled={!isEditing && !isNewRow}
                    placeholder="전화번호 입력"
                    className="h-10 bg-card"
                  />
                </div>
              </div>

              {/* 2행: 주소, 담당자 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="address">주소</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleFormChange('address', e.target.value)}
                    disabled={!isEditing && !isNewRow}
                    placeholder="주소 입력"
                    className="h-10 bg-card"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manager">담당자</Label>
                  <Input
                    id="manager"
                    value={formData.manager}
                    onChange={(e) => handleFormChange('manager', e.target.value)}
                    disabled={!isEditing && !isNewRow}
                    placeholder="담당자 입력"
                    className="h-10 bg-card"
                  />
                </div>
              </div>

            </div>
          </CardContent>
        </Card>
      </div>

      {/* 삭제 확인 대화상자 */}
      <Dialog open={deleteConfirmOpen} onOpenChange={(open) => {
        if (!open) {
          setDeleteConfirmOpen(false)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>지점 삭제 확인</DialogTitle>
            <DialogDescription>
              선택된 {selectedRows.length}개의 지점을 삭제하시겠습니까?
              <br />
              삭제된 데이터는 복구할 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleDeleteCancel}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  )
}

export default Branch