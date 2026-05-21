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
 * 관련 컴포넌트: shadcn `Table`, `Switch`, `Checkbox`, 확인 `Dialog`.
 *
 * 흐름: 목록 로드 → 스위치로 연동 토글 → 삭제 시 확인 후 `deleteDevice`.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Trash2, Link2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { adminService, type LinkageDeviceRow } from '@/services/admin.service'
import { deleteDevice } from '@/services/deviceService'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const formatDate = (v: string | null) => {
  if (!v) return '—'
  try {
    return new Date(v).toLocaleString('ko-KR')
  } catch {
    return '—'
  }
}

const HEADER_CELL =
  'h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]'
const HEADER_CELL_LAST =
  'h-[45px] px-2 text-xs font-bold text-center border-b-0 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]'
const BODY_CELL =
  'h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors'
const BODY_CELL_LAST =
  'h-[35px] py-0 px-2 text-xs group-hover:text-inherit group-hover:font-inherit transition-colors'

export const LinkageManagementPage: React.FC = () => {
  const [rows, setRows] = useState<LinkageDeviceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [toggleLoading, setToggleLoading] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [notification, setNotification] = useState<{
    message: string
    type: 'success' | 'error' | 'info'
  } | null>(null)

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
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

  const allSelected = rows.length > 0 && selected.size === rows.length

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
              {notification.type === 'success' ? '성공' : notification.type === 'error' ? '오류' : '알림'}
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
        <Card className="h-full flex flex-col bg-card shadow-md overflow-hidden">
          <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
              <Link2 className="h-5 w-5 text-blue-500" />
              Electron 연동 관리
              <Badge variant="outline" className="ml-2 font-normal">
                총 {rows.length}대
              </Badge>
            </CardTitle>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void load()}
                disabled={loading}
              >
                <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
                새로고침
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={selected.size === 0 || loading}
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                선택 삭제 ({selected.size})
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 min-h-0 p-0">
            <div className="h-full overflow-hidden border border-[#343637] dark:border-[#6b7280] bg-[#f9fafb] dark:bg-[#1d1d1d] shadow-md">
              <div className="h-full overflow-auto scrollbar-hide">
                <Table className="w-full table-fixed border-separate border-spacing-0">
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow className="hover:bg-transparent border-b-0">
                      <TableHead className={cn(HEADER_CELL, 'w-[50px]')}>
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={(v) => handleSelectAll(v === true)}
                            aria-label="전체 선택"
                          />
                        </div>
                      </TableHead>
                      <TableHead className={cn(HEADER_CELL, 'w-[220px]')}>디바이스 ID</TableHead>
                      <TableHead className={cn(HEADER_CELL, 'w-[160px]')}>표시 이름</TableHead>
                      <TableHead className={cn(HEADER_CELL, 'w-[120px]')}>매장</TableHead>
                      <TableHead className={cn(HEADER_CELL, 'w-[180px]')}>등록 사용자</TableHead>
                      <TableHead className={cn(HEADER_CELL, 'w-[140px]')}>연동 사용</TableHead>
                      <TableHead className={cn(HEADER_CELL_LAST, 'w-[180px]')}>마지막 연결</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && rows.length === 0 ? (
                      <TableRow className="border-b-0">
                        <TableCell colSpan={7} className="h-24 text-center border-b-0 text-muted-foreground">
                          데이터를 불러오는 중...
                        </TableCell>
                      </TableRow>
                    ) : rows.length === 0 ? (
                      <TableRow className="border-b-0">
                        <TableCell colSpan={7} className="h-24 text-center border-b-0 text-muted-foreground">
                          등록된 디바이스가 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row) => {
                        const isSelected = selected.has(row.id)
                        return (
                          <TableRow
                            key={row.id}
                            className={cn(
                              'h-[35px] border-b-0 group transition-colors bg-[#f9fafb] dark:bg-[#1d1d1d]',
                              'hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30',
                              isSelected && 'bg-muted/80 ring-1 ring-inset ring-primary/30'
                            )}
                          >
                            <TableCell className={cn(BODY_CELL, 'text-center')}>
                              <div className="flex items-center justify-center">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(v) => handleSelectOne(row.id, v === true)}
                                  aria-label={`디바이스 ${row.deviceId} 선택`}
                                />
                              </div>
                            </TableCell>
                            <TableCell className={cn(BODY_CELL, 'font-mono truncate')} title={row.deviceId}>
                              {row.deviceId}
                            </TableCell>
                            <TableCell className={cn(BODY_CELL, 'truncate')} title={row.displayLabel || ''}>
                              {row.displayLabel || '—'}
                            </TableCell>
                            <TableCell className={cn(BODY_CELL, 'text-center')}>
                              {row.storeId ?? '—'}
                            </TableCell>
                            <TableCell className={cn(BODY_CELL, 'truncate')}>
                              {row.registeredByUserid || row.registeredByName ? (
                                <span>
                                  {row.registeredByName || '—'}{' '}
                                  <span className="text-muted-foreground text-[10px]">
                                    ({row.registeredByUserid || '—'})
                                  </span>
                                </span>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                            <TableCell className={cn(BODY_CELL, 'text-center')}>
                              {row.registeredByUserId ? (
                                <div className="flex items-center justify-center gap-2">
                                  <Switch
                                    checked={row.registrantLinkageEnabled}
                                    disabled={toggleLoading === row.registeredByUserId}
                                    onCheckedChange={(checked) =>
                                      void handleLinkageToggle(row.registeredByUserId!, checked)
                                    }
                                    aria-label={`${row.registeredByUserid} 연동 사용`}
                                  />
                                  <span className="text-[10px] text-muted-foreground">
                                    {row.registrantLinkageEnabled ? '사용' : '중지'}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className={cn(BODY_CELL_LAST, 'text-center text-muted-foreground')}>
                              {formatDate(row.lastSeenAt)}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>선택한 디바이스 삭제</DialogTitle>
            <DialogDescription>
              선택한 {selected.size}개 디바이스를 DB에서 삭제합니다. Electron 측은 다음에 재등록이 필요할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              취소
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleDeleteSelected()}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default LinkageManagementPage
