/**
 * WorkoutScopeTable — 운동저장구분 목록 테이블
 *
 * 기능: 운동저장구분 목록 표시, 행 선택·더블클릭 수정, 로딩/빈 상태 처리.
 * 사용처: `WorkoutScopeManager.tsx`
 */

import React from 'react'
import { Layers, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import type { WorkoutScopeItem } from './workoutScopeTypes'

const HEADER_CELL =
  'h-[45px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]'
const HEADER_CELL_LAST =
  'h-[45px] text-center font-bold px-2 border-b-0 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]'
const BODY_CELL =
  'h-[35px] py-0 px-2 text-xs text-center border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit transition-colors'
const BODY_CELL_LAST =
  'h-[35px] py-0 px-2 text-xs text-center group-hover:text-inherit transition-colors'

interface WorkoutScopeTableProps {
  items: WorkoutScopeItem[]
  selectedId: string | null
  loading: boolean
  onRowSelect: (item: WorkoutScopeItem) => void
  onRowDoubleClick: (item: WorkoutScopeItem) => void
}

export const WorkoutScopeTable: React.FC<WorkoutScopeTableProps> = ({
  items,
  selectedId,
  loading,
  onRowSelect,
  onRowDoubleClick,
}) => (
  <Card className="h-full flex flex-col bg-card shadow-md overflow-hidden">
    <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
      <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
        <Layers className="h-5 w-5 text-primary" />
        운동저장구분 목록
      </CardTitle>
      <Badge variant="outline">총 {items.length}건</Badge>
    </CardHeader>

    <CardContent className="flex-1 min-h-0 p-0">
      <div className="h-full border border-[#343637] dark:border-[#6b7280] overflow-auto relative scrollbar-hide bg-[#f9fafb] dark:bg-[#1d1d1d]">
        <Table className="w-full table-fixed border-separate border-spacing-0">
          <TableHeader className="sticky top-0 z-10 shadow-sm">
            <TableRow className="hover:bg-transparent border-b-0">
              <TableHead className={cn(HEADER_CELL, 'w-[140px]')}>코드</TableHead>
              <TableHead className={cn(HEADER_CELL, 'w-[280px]')}>이름</TableHead>
              <TableHead className={cn(HEADER_CELL_LAST, 'w-[100px]')}>상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && items.length === 0 ? (
              <TableRow className="border-b-0">
                <TableCell colSpan={3} className="h-24 text-center border-b-0">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow className="border-b-0">
                <TableCell colSpan={3} className="h-24 text-center text-sm text-muted-foreground border-b-0">
                  등록된 운동저장구분이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow
                  key={item.id}
                  className={cn(
                    'group cursor-pointer h-[35px] border-b-0 transition-colors hover:bg-muted/30 hover:text-blue-600 dark:hover:text-yellow-400',
                    selectedId === item.id ? 'bg-primary/20' : 'bg-[#f9fafb] dark:bg-[#1d1d1d]',
                  )}
                  onClick={() => onRowSelect(item)}
                  onDoubleClick={() => onRowDoubleClick(item)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${item.scopeName} 운동저장구분 선택`}
                  aria-selected={selectedId === item.id}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onRowSelect(item)
                    }
                  }}
                >
                  <TableCell className={cn(BODY_CELL, 'font-mono')}>{item.scopeCode}</TableCell>
                  <TableCell className={cn(BODY_CELL, 'truncate text-left')} title={item.scopeName}>
                    {item.scopeName}
                  </TableCell>
                  <TableCell className={BODY_CELL_LAST}>
                    <Badge variant={item.isActive ? 'default' : 'secondary'}>
                      {item.isActive ? '사용' : '미사용'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </CardContent>
  </Card>
)
