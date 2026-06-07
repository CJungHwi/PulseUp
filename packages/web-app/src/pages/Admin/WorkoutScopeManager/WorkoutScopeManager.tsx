/**
 * 페이지 요약 — 운동 Scope 관리 (`/admin/workout-scope`)
 *
 * 기능: workout_scope 마스터 등록·수정·사용안함(비활성) 처리.
 *
 * 호출/연동:
 * - `GET /workout-scopes?includeInactive=true`
 * - `POST /workout-scopes`, `PUT /workout-scopes/:id`
 * - DB: `workout_scope` 테이블 (`create_workout_scope_table.sql`)
 *
 * 관련 컴포넌트(`./components/`):
 * - `WorkoutScopeTable`: 목록
 * - `WorkoutScopeFormDialog`: 등록/수정 모달
 * - `workoutScopeAdminApi`, `workoutScopeTypes`
 *
 * 흐름: 목록 로드 → 행 선택 또는 추가 → 모달에서 저장 → 목록 갱신.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { Layers, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSnackbar } from '@/contexts/SnackbarContext'
import { WorkoutScopeTable } from './components/WorkoutScopeTable'
import {
  WorkoutScopeFormDialog,
  type WorkoutScopeFormMode,
} from './components/WorkoutScopeFormDialog'
import {
  createWorkoutScope,
  fetchAdminWorkoutScopes,
  updateWorkoutScope,
} from './components/workoutScopeAdminApi'
import {
  createEmptyWorkoutScopeForm,
  type WorkoutScopeFormValues,
  type WorkoutScopeItem,
} from './components/workoutScopeTypes'

const mapItemToForm = (item: WorkoutScopeItem): WorkoutScopeFormValues => ({
  scopeCode: item.scopeCode,
  scopeName: item.scopeName,
  sortOrder: item.sortOrder,
  isActive: item.isActive,
})

const WorkoutScopeManager: React.FC = () => {
  const { showSnackbar } = useSnackbar()
  const [items, setItems] = useState<WorkoutScopeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<WorkoutScopeFormMode>('create')
  const [formData, setFormData] = useState<WorkoutScopeFormValues>(createEmptyWorkoutScopeForm())

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await fetchAdminWorkoutScopes()
      setItems(rows)
    } catch (error) {
      console.error('[WorkoutScopeManager] load error:', error)
      showSnackbar({ message: '목록 조회에 실패했습니다.', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [showSnackbar])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  const handleFormChange = (
    field: keyof WorkoutScopeFormValues,
    value: string | number | boolean,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleOpenCreate = () => {
    setModalMode('create')
    setFormData(createEmptyWorkoutScopeForm())
    setSelectedId(null)
    setModalOpen(true)
  }

  const handleOpenEdit = (item: WorkoutScopeItem) => {
    setSelectedId(item.id)
    setModalMode('edit')
    setFormData(mapItemToForm(item))
    setModalOpen(true)
  }

  const handleRowSelect = (item: WorkoutScopeItem) => {
    setSelectedId(item.id)
  }

  const handleEditSelected = () => {
    const item = items.find((row) => row.id === selectedId)
    if (!item) {
      showSnackbar({ message: '수정할 scope를 선택해주세요.', severity: 'warning' })
      return
    }
    handleOpenEdit(item)
  }

  const handleModalOpenChange = (open: boolean) => {
    if (!open) {
      setModalOpen(false)
    }
  }

  const handleSubmit = async () => {
    if (!formData.scopeCode.trim() || !formData.scopeName.trim()) {
      showSnackbar({ message: '코드와 표시명은 필수입니다.', severity: 'warning' })
      return
    }

    setSaving(true)
    try {
      if (modalMode === 'create') {
        await createWorkoutScope(formData)
        showSnackbar({ message: '운동 scope가 등록되었습니다.', severity: 'success' })
      } else if (selectedId) {
        await updateWorkoutScope(selectedId, {
          scopeName: formData.scopeName,
          sortOrder: formData.sortOrder,
          isActive: formData.isActive,
        })
        showSnackbar({ message: '운동 scope가 수정되었습니다.', severity: 'success' })
      }
      setModalOpen(false)
      await loadItems()
    } catch (error) {
      const message = error instanceof Error ? error.message : '저장에 실패했습니다.'
      showSnackbar({ message, severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-[calc(100vh-140px)] p-0 flex flex-col gap-[3px] overflow-hidden bg-background">
      <div className="flex justify-between items-center px-4 py-2 bg-muted/30 border-b border-[#343637] dark:border-[#6b7280]">
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          운동 Scope 관리
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={!selectedId}
            onClick={handleEditSelected}
            aria-label="선택 scope 수정"
          >
            <Pencil className="w-4 h-4 mr-2" />
            수정
          </Button>
          <Button size="sm" className="h-8" onClick={handleOpenCreate} aria-label="scope 추가">
            <Plus className="w-4 h-4 mr-2" />
            추가
          </Button>
        </div>
      </div>

      <div className="px-4 py-2 text-sm text-muted-foreground border-b border-[#343637] dark:border-[#6b7280] bg-muted/20">
        운동 저장 시 사용할 scope 분류 코드입니다. 각 운동 페이지는 코드를 직접 지정하고,
        여기서 사용 여부만 관리합니다. 월간 프로그램은 scope별 저장 이력을 조회·실행합니다.
      </div>

      <div className="flex-1 min-h-0 px-0 pb-0">
        <WorkoutScopeTable
          items={items}
          selectedId={selectedId}
          loading={loading}
          onRowSelect={handleRowSelect}
          onRowDoubleClick={handleOpenEdit}
        />
      </div>

      <WorkoutScopeFormDialog
        open={modalOpen}
        mode={modalMode}
        formData={formData}
        saving={saving}
        onOpenChange={handleModalOpenChange}
        onChange={handleFormChange}
        onSubmit={handleSubmit}
      />
    </div>
  )
}

export default WorkoutScopeManager
