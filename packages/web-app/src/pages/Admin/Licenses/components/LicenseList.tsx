/**
 * LicenseList — 발급된 라이선스 목록 테이블
 *
 * 기능: 지점/대분류/유효기간/상태 표시, 상태별 액션 버튼(취소/활성화/갱신)
 *
 * Props:
 * - licenses, loading
 * - onRevoke(licenseId)
 * - onReactivate(licenseId)
 * - onRenew(license)
 *
 * 사용처: `LicenseManagement.tsx`
 */
import React from 'react'
import { RefreshCw, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { BranchLicense } from '@/services/licenseApi'
import { formatDateDisplay } from './licenseDateUtils'

const HEADER_CELL =
  'h-[45px] text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] text-xs'
const HEADER_CELL_LAST =
  'h-[45px] text-center font-bold px-2 border-b-0 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] text-xs'
const BODY_CELL =
  'h-[35px] py-0 px-2 text-xs border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors'
const BODY_CELL_LAST =
  'h-[35px] py-0 px-2 text-xs group-hover:text-inherit transition-colors'

interface LicenseListProps {
  licenses: BranchLicense[]
  loading?: boolean
  onRevoke: (licenseId: string) => void | Promise<void>
  onReactivate: (licenseId: string) => void | Promise<void>
  onRenew: (license: BranchLicense) => void
  onBulkRenew: () => void
}

const getStatusLabel = (status: BranchLicense['status']) => {
  switch (status) {
    case 'active':
      return '활성'
    case 'revoked':
      return '취소됨'
    case 'expired':
      return '만료'
    default:
      return status
  }
}

const getStatusVariant = (status: BranchLicense['status']) => {
  switch (status) {
    case 'active':
      return 'default' as const
    case 'revoked':
      return 'secondary' as const
    case 'expired':
      return 'outline' as const
    default:
      return 'outline' as const
  }
}

const renderActions = (
  license: BranchLicense,
  onRevoke: LicenseListProps['onRevoke'],
  onReactivate: LicenseListProps['onReactivate'],
  onRenew: LicenseListProps['onRenew']
) => {
  if (license.status === 'active') {
    return (
      <div className="flex flex-wrap items-center justify-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onRenew(license)}
        >
          갱신
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs border-destructive text-destructive hover:bg-destructive/10"
          onClick={() => onRevoke(license.id)}
        >
          취소
        </Button>
      </div>
    )
  }

  if (license.status === 'revoked') {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs border-primary text-primary hover:bg-primary/10"
        onClick={() => onReactivate(license.id)}
      >
        활성화
      </Button>
    )
  }

  if (license.status === 'expired') {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={() => onRenew(license)}
      >
        갱신
      </Button>
    )
  }

  return <span className="text-muted-foreground">-</span>
}

export const LicenseList: React.FC<LicenseListProps> = ({
  licenses,
  loading = false,
  onRevoke,
  onReactivate,
  onRenew,
  onBulkRenew,
}) => (
  <Card className="flex-1 min-h-0 flex flex-col shadow-md border border-[#343637] dark:border-[#6b7280] overflow-hidden">
    <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5" />
        <CardTitle className="text-lg font-bold leading-none">라이선스 목록</CardTitle>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={onBulkRenew}
        >
          <RefreshCw className="size-4 mr-1" />
          지점 전체 갱신
        </Button>
        <Badge variant="outline" className="text-xs">
          총 {licenses.length}건
        </Badge>
      </div>
    </CardHeader>

    <div className="flex-1 min-h-0 overflow-hidden p-[3px]">
      <div className="h-full overflow-auto scrollbar-hide bg-[#f9fafb] dark:bg-[#1d1d1d] border border-[#343637] dark:border-[#6b7280]">
        <Table className="w-full table-fixed border-separate border-spacing-0">
          <TableHeader className="sticky top-0 z-10 shadow-sm">
            <TableRow className="hover:bg-transparent border-b-0">
              <TableHead className={cn(HEADER_CELL, 'w-[180px]')}>지점</TableHead>
              <TableHead className={cn(HEADER_CELL, 'w-[200px]')}>운동 대분류</TableHead>
              <TableHead className={cn(HEADER_CELL, 'w-[120px]')}>시작일</TableHead>
              <TableHead className={cn(HEADER_CELL, 'w-[120px]')}>종료일</TableHead>
              <TableHead className={cn(HEADER_CELL, 'w-[100px]')}>상태</TableHead>
              <TableHead className={cn(HEADER_CELL_LAST, 'w-[160px]')}>관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && licenses.length === 0 ? (
              <TableRow className="border-b-0">
                <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground border-b-0">
                  데이터를 불러오는 중...
                </TableCell>
              </TableRow>
            ) : licenses.length === 0 ? (
              <TableRow className="border-b-0">
                <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground border-b-0">
                  발급된 라이선스가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              licenses.map((license) => (
                <TableRow
                  key={license.id}
                  className={cn(
                    'h-[35px] border-b-0 group transition-colors bg-[#f9fafb] dark:bg-[#1d1d1d]',
                    'hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30'
                  )}
                >
                  <TableCell className={cn(BODY_CELL, 'truncate')}>
                    {license.branch_name || license.branch_id}
                  </TableCell>
                  <TableCell className={cn(BODY_CELL, 'truncate')}>
                    {license.major_category_name || license.workout_category_id}
                  </TableCell>
                  <TableCell className={cn(BODY_CELL, 'text-center')}>
                    {formatDateDisplay(license.valid_from)}
                  </TableCell>
                  <TableCell className={cn(BODY_CELL, 'text-center')}>
                    {formatDateDisplay(license.valid_to)}
                  </TableCell>
                  <TableCell className={cn(BODY_CELL, 'text-center')}>
                    <Badge variant={getStatusVariant(license.status)} className="text-[10px]">
                      {getStatusLabel(license.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className={cn(BODY_CELL_LAST, 'text-center')}>
                    {renderActions(license, onRevoke, onReactivate, onRenew)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  </Card>
)
