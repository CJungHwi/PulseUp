/**
 * 페이지 요약 — 연동(디바이스) 관리 (`/admin/linkage-management`)
 *
 * 기능: 사용자–Electron 디바이스 연동 목록, 연동 on/off, 선택 디바이스 삭제.
 *
 * 호출/연동:
 * - `adminService.getLinkages`, `updateUserLinkage`
 * - `deleteDevice` (`services/deviceService.ts`)
 * - DB/SP는 `packages/api-server` 관리자·디바이스 연동 API 참조.
 *
 * 관련 컴포넌트(`./components/`):
 * - `LinkageTable`: 디바이스 목록 테이블 카드(헤더/체크박스/연동 토글)
 * - `LinkageDeleteDialog`: 선택 삭제 확인 다이얼로그
 * - `linkageTableStyles.ts`: 테이블 셀 스타일/날짜 포맷터
 *
 * 흐름: 목록 로드 → 스위치로 연동 토글 → 삭제 시 확인 후 `deleteDevice`.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { adminService, type LinkageDeviceRow } from '@/services/admin.service'
import { deleteDevice } from '@/services/deviceService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { LinkageTable } from './components/LinkageTable'
import { LinkageDeleteDialog } from './components/LinkageDeleteDialog'

type NotificationType = 'success' | 'error' | 'info'
interface NotificationState {
  message: string
  type: NotificationType
}

export const LinkageManagementPage: React.FC = () => {
  const [rows, setRows] = useState<LinkageDeviceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [toggleLoading, setToggleLoading] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [notification, setNotification] = useState<NotificationState | null>(null)

  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminService.getLinkages()
      setRows(data)
      setSelected(new Set())
    } catch (e) {
      console.error(e)
      setError('연동 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelected(new Set())
      return
    }
    setSelected(new Set(rows.map((r) => r.id)))
  }

  const handleSelectOne = (id: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const handleLinkageToggle = async (userId: string, next: boolean) => {
    setToggleLoading(userId)
    try {
      await adminService.updateUserLinkage(userId, next)
      await load()
      showNotification(`연동이 ${next ? '활성화' : '중지'}되었습니다.`, 'success')
    } catch (e) {
      console.error(e)
      setError('연동 사용 여부 변경에 실패했습니다.')
    } finally {
      setToggleLoading(null)
    }
  }

  const handleDeleteSelected = async () => {
    const ids = [...selected]
    setDeleteDialogOpen(false)
    setError(null)
    try {
      for (const id of ids) {
        await deleteDevice(id)
      }
      await load()
      showNotification(`${ids.length}개 디바이스가 삭제되었습니다.`, 'success')
    } catch (e) {
      console.error(e)
      setError('선택한 디바이스 삭제 중 오류가 발생했습니다.')
    }
  }

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

      {error && (
        <Alert variant="destructive" className="mb-2 shrink-0">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex-1 min-h-0">
        <LinkageTable
          rows={rows}
          loading={loading}
          selected={selected}
          toggleLoading={toggleLoading}
          onRefresh={() => void load()}
          onSelectAll={handleSelectAll}
          onSelectOne={handleSelectOne}
          onLinkageToggle={(userId, next) => void handleLinkageToggle(userId, next)}
          onOpenDeleteDialog={() => setDeleteDialogOpen(true)}
        />
      </div>

      <LinkageDeleteDialog
        open={deleteDialogOpen}
        selectedCount={selected.size}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => void handleDeleteSelected()}
      />
    </div>
  )
}

export default LinkageManagementPage
