/**
 * MonthProgramMasterTabs — 사용자 / 관리자 마스터 테이블 탭
 */

import React from 'react'
import dayjs from 'dayjs'
import {
  Tabs as ShadcnTabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs'
import {
  Table as ShadcnTable,
  TableBody as ShadcnTableBody,
  TableCell as ShadcnTableCell,
  TableHead as ShadcnTableHead,
  TableHeader as ShadcnTableHeader,
  TableRow as ShadcnTableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { WorkoutMaster } from './monthProgramTypes'

interface MasterTableProps {
  rows: WorkoutMaster[]
  selectedMasterId: string | null
  onRowClick: (master: WorkoutMaster) => void
}

const MasterTable: React.FC<MasterTableProps> = ({ rows, selectedMasterId, onRowClick }) => (
  <div className="flex-1 min-h-0 overflow-auto relative bg-[#f9fafb] dark:bg-[#1d1d1d] border border-[#343637] dark:border-[#6b7280] border-t-0 overscroll-behavior-contain touch-pan-y">
    <ShadcnTable className="w-full table-fixed border-separate border-spacing-0">
      <ShadcnTableHeader className="sticky top-0 z-10 bg-[#b9adb5] dark:bg-gray-800">
        <ShadcnTableRow className="hover:bg-transparent border-b-0 h-[45px]">
          <ShadcnTableHead className="w-[120px] text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] text-xs text-[#27272a] dark:text-[#94a3b8]">
            날짜
          </ShadcnTableHead>
          <ShadcnTableHead className="w-[150px] text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] text-xs text-[#27272a] dark:text-[#94a3b8]">
            운동구분
          </ShadcnTableHead>
          <ShadcnTableHead className="w-[100px] text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] text-xs text-[#27272a] dark:text-[#94a3b8]">
            서킷
          </ShadcnTableHead>
          <ShadcnTableHead className="w-[300px] text-center font-bold px-2 border-b-0 text-xs text-[#27272a] dark:text-[#94a3b8]">
            메모
          </ShadcnTableHead>
        </ShadcnTableRow>
      </ShadcnTableHeader>
      <ShadcnTableBody>
        {rows.map((row) => (
          <ShadcnTableRow
            key={row.id}
            className={cn(
              'group cursor-pointer h-[35px] border-b-0 transition-colors hover:bg-muted/30 hover:text-blue-600 dark:hover:text-yellow-400',
              selectedMasterId === row.id ? 'bg-primary/20' : 'bg-[#f9fafb] dark:bg-[#1d1d1d]',
            )}
            onClick={() => onRowClick(row)}
          >
            <ShadcnTableCell className="h-[35px] py-0 px-2 text-center border-r border-[#343637] dark:border-[#6b7280] text-xs group-hover:text-inherit transition-colors">
              {row.date ? dayjs(row.date).format('YYYY-MM-DD') : '-'}
            </ShadcnTableCell>
            <ShadcnTableCell className="h-[35px] py-0 px-2 text-center border-r border-[#343637] dark:border-[#6b7280] text-xs truncate group-hover:text-inherit transition-colors">
              {row.workoutCategoriesName}
            </ShadcnTableCell>
            <ShadcnTableCell className="h-[35px] py-0 px-2 text-center border-r border-[#343637] dark:border-[#6b7280] text-xs group-hover:text-inherit transition-colors">
              {!row.circuitType || row.circuitType === 'none'
                ? '-'
                : row.circuitType === 'stress'
                ? '스트레스'
                : '루프'}
            </ShadcnTableCell>
            <ShadcnTableCell
              className="h-[35px] py-0 px-2 text-left text-xs truncate group-hover:text-inherit transition-colors"
              title={row.memo}
            >
              {row.memo}
            </ShadcnTableCell>
          </ShadcnTableRow>
        ))}
      </ShadcnTableBody>
    </ShadcnTable>
  </div>
)

interface MonthProgramMasterTabsProps {
  recordTabValue: number
  onTabChange: (newValue: number) => void
  userName: string
  workoutMasters: WorkoutMaster[]
  adminWorkoutMasters: WorkoutMaster[]
  selectedMasterId: string | null
  onRowClick: (master: WorkoutMaster) => void
}

export const MonthProgramMasterTabs: React.FC<MonthProgramMasterTabsProps> = ({
  recordTabValue,
  onTabChange,
  userName,
  workoutMasters,
  adminWorkoutMasters,
  selectedMasterId,
  onRowClick,
}) => (
  <ShadcnTabs
    value={recordTabValue.toString()}
    onValueChange={(val) => onTabChange(parseInt(val))}
    className="flex flex-col h-full"
  >
    <TabsList className="grid grid-cols-2 h-9 bg-muted/40 dark:bg-gray-800/60 border border-[#343637] dark:border-[#6b7280] p-1 mx-0 my-0">
      <TabsTrigger
        value="0"
        className="text-xs font-bold text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none hover:bg-muted/60 dark:hover:bg-gray-700/60"
      >
        {userName}
      </TabsTrigger>
      <TabsTrigger
        value="1"
        className="text-xs font-bold text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none hover:bg-muted/60 dark:hover:bg-gray-700/60"
      >
        관리자
      </TabsTrigger>
    </TabsList>

    <TabsContent value="0" className="flex-1 min-h-0 !m-0 !p-0 overflow-hidden flex flex-col">
      <MasterTable
        rows={workoutMasters}
        selectedMasterId={selectedMasterId}
        onRowClick={onRowClick}
      />
    </TabsContent>

    <TabsContent value="1" className="flex-1 min-h-0 !m-0 !p-0 overflow-hidden flex flex-col">
      <MasterTable
        rows={adminWorkoutMasters}
        selectedMasterId={selectedMasterId}
        onRowClick={onRowClick}
      />
    </TabsContent>
  </ShadcnTabs>
)
