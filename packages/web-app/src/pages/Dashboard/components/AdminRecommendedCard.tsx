/**
 * AdminRecommendedCard — 관리자 추천 운동 카드 (테이블, 최근 5개)
 */

import React from 'react'
import { Activity } from 'lucide-react'
import dayjs from 'dayjs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { AdminWorkoutGridRow } from './userDashboardTypes'

interface AdminRecommendedCardProps {
  rows: AdminWorkoutGridRow[]
  onMore: () => void
}

export const AdminRecommendedCard: React.FC<AdminRecommendedCardProps> = ({ rows, onMore }) => (
  <div className="flex-[1.08] lg:order-2 order-1 min-w-0">
    <Card className="flex flex-col h-full shadow-md overflow-hidden">
      <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          관리자 추천 운동
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onMore}>
          더보기
        </Button>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 p-0 overflow-hidden flex flex-col">
        <div className="flex-1 min-h-0 border border-[#343637] dark:border-[#6b7280] overflow-auto relative scrollbar-hide bg-[#f9fafb] dark:bg-[#1d1d1d]">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <Activity className="w-12 h-12 opacity-20" />
              <div className="text-center">
                <p className="text-lg font-semibold">관리자 추천 운동이 없습니다</p>
                <p className="text-sm">관리자가 운동을 등록하면 표시됩니다</p>
              </div>
            </div>
          ) : (
            <Table className="w-full table-fixed border-separate border-spacing-0">
              <TableHeader className="sticky top-0 z-10 shadow-sm bg-[#b9adb5] dark:bg-gray-800">
                <TableRow className="hover:bg-transparent border-b-0 h-[45px]">
                  <TableHead className="w-[100px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">날짜</TableHead>
                  <TableHead className="w-[120px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">운동구분</TableHead>
                  <TableHead className="w-[80px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">서킷</TableHead>
                  <TableHead className="text-center font-bold px-2 border-b-0 text-[#27272a] dark:text-[#94a3b8]">메모</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="h-[35px] border-b-0 group transition-colors bg-[#f9fafb] dark:bg-[#1d1d1d] hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30"
                  >
                    <TableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 truncate group-hover:text-inherit group-hover:font-inherit transition-colors">
                      {row.date ? dayjs(row.date).format('YYYY-MM-DD') : '-'}
                    </TableCell>
                    <TableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 truncate font-semibold group-hover:text-inherit group-hover:font-inherit transition-colors">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="truncate w-full">
                            {row.workoutCategoriesName || '-'}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{row.workoutCategoriesName}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 truncate group-hover:text-inherit group-hover:font-inherit transition-colors">
                      {!row.circuitType || row.circuitType === 'none'
                        ? '-'
                        : row.circuitType === 'stress'
                        ? '스트레스'
                        : '루프'}
                    </TableCell>
                    <TableCell className="h-[35px] py-0 px-2 text-xs truncate group-hover:text-inherit group-hover:font-inherit transition-colors">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="truncate w-full">{row.memo || '-'}</div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs whitespace-pre-wrap">{row.memo || '-'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  </div>
)
