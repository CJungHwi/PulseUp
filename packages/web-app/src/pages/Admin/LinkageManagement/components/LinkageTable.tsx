/**
 * LinkageTable — Electron 연동 디바이스 목록 테이블 카드
 *
 * 기능:
 * - 헤더(타이틀, 총 개수, 새로고침, 선택 삭제)
 * - 디바이스 행: 체크박스, 디바이스 ID, 표시 이름, 매장, 등록 사용자, 연동 사용 토글, 마지막 연결
 *
 * Props: 데이터/선택/로딩/콜백
 *
 * 사용처: `LinkageManagementPage.tsx`
 */
import React from 'react'
import { Link2, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { LinkageDeviceRow } from '@/services/admin.service'
import {
  HEADER_CELL,
  HEADER_CELL_LAST,
  BODY_CELL,
  BODY_CELL_LAST,
  formatDate,
} from './linkageTableStyles'

interface LinkageTableProps {
  rows: LinkageDeviceRow[]
  loading: boolean
  selected: Set<number>
  toggleLoading: string | null
  onRefresh: () => void
  onSelectAll: (checked: boolean) => void
  onSelectOne: (id: number, checked: boolean) => void
  onLinkageToggle: (userId: string, next: boolean) => void
  onOpenDeleteDialog: () => void
}

export const LinkageTable: React.FC<LinkageTableProps> = ({
  rows,
  loading,
  selected,
  toggleLoading,
  onRefresh,
  onSelectAll,
  onSelectOne,
  onLinkageToggle,
  onOpenDeleteDialog,
}) => {
  const allSelected = rows.length > 0 && selected.size === rows.length

  return (
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
            onClick={onRefresh}
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
            onClick={onOpenDeleteDialog}
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
                        onCheckedChange={(v) => onSelectAll(v === true)}
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
                              onCheckedChange={(v) => onSelectOne(row.id, v === true)}
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
                                  onLinkageToggle(row.registeredByUserId!, checked)
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
  )
}
