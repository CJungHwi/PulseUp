/**
 * BranchListTable — 지점 목록 카드
 *
 * 기능:
 * - 헤더(타이틀, 삭제/추가 버튼)
 * - 테이블(지점명/지역/주소/전화/담당자)
 * - 행 선택, 신규 행(노란 강조) 표시
 *
 * 사용처: `Branch.tsx`
 */
import React from 'react'
import {
  Building2,
  Plus,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { Branch as BranchItem } from '@/types/branch'

const HEADER_CELL =
  'h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]'
const HEADER_CELL_LAST =
  'h-[45px] px-2 text-xs font-bold text-center border-b-0 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]'

interface BranchListTableProps {
  data: BranchItem[]
  loading: boolean
  selectedRowId: string | null
  newRowId: string | null
  hasSelection: boolean
  onAdd: () => void
  onDelete: () => void
  onSelect: (branch: BranchItem) => void
}

export const BranchListTable: React.FC<BranchListTableProps> = ({
  data,
  loading,
  selectedRowId,
  newRowId,
  hasSelection,
  onAdd,
  onDelete,
  onSelect,
}) => (
  <Card className="h-full flex flex-col bg-card shadow-md overflow-hidden">
    <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
      <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
        <Building2 className="h-5 w-5 text-blue-500" />
        지점 목록
      </CardTitle>
      <div className="flex gap-2">
        <Button variant="destructive" size="sm" onClick={onDelete} disabled={!hasSelection}>
          <Trash2 className="h-4 w-4 mr-2" />
          삭제
        </Button>
        <Button variant="default" size="sm" onClick={onAdd}>
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
                <TableHead className={cn(HEADER_CELL, 'w-[150px]')}>지점명</TableHead>
                <TableHead className={cn(HEADER_CELL, 'w-[120px]')}>지점지역</TableHead>
                <TableHead className={cn(HEADER_CELL, 'w-[250px]')}>주소</TableHead>
                <TableHead className={cn(HEADER_CELL, 'w-[150px]')}>전화번호</TableHead>
                <TableHead className={cn(HEADER_CELL_LAST, 'w-[120px]')}>담당자</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && data.length === 0 ? (
                <TableRow className="border-b-0">
                  <TableCell colSpan={5} className="h-24 text-center border-b-0 text-muted-foreground">
                    데이터를 불러오는 중...
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow className="border-b-0">
                  <TableCell colSpan={5} className="h-24 text-center border-b-0 text-muted-foreground">
                    데이터가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((branch) => (
                  <TableRow
                    key={branch.id}
                    className={cn(
                      'cursor-pointer h-[35px] border-b-0 group transition-colors bg-[#f9fafb] dark:bg-[#1d1d1d]',
                      'hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30',
                      selectedRowId === String(branch.id) && 'bg-muted/80 ring-1 ring-inset ring-primary/30',
                      String(branch.id) === newRowId && 'bg-yellow-100 dark:bg-yellow-900/20 italic'
                    )}
                    onClick={() => {
                      if (String(branch.id) !== newRowId) onSelect(branch)
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
)
