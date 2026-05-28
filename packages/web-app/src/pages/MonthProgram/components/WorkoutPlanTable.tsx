/**
 * WorkoutPlanTable — 좌측 Round/Set 계획 테이블
 */

import React from 'react'
import {
  Table as ShadcnTable,
  TableBody as ShadcnTableBody,
  TableCell as ShadcnTableCell,
  TableHead as ShadcnTableHead,
  TableHeader as ShadcnTableHeader,
  TableRow as ShadcnTableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { fmtPlanTime } from './monthProgramUtils'
import type { WorkoutMaster, WorkoutPlan } from './monthProgramTypes'

interface WorkoutPlanTableProps {
  plans: WorkoutPlan[]
  selectedPlanId: string | null
  onSelectPlan: (id: string) => void
  selectedMaster: WorkoutMaster | null
  isAMRAPorEMOM: boolean
}

export const WorkoutPlanTable: React.FC<WorkoutPlanTableProps> = ({
  plans,
  selectedPlanId,
  onSelectPlan,
  selectedMaster,
  isAMRAPorEMOM,
}) => (
  <div className="w-[40%] flex flex-col border-r border-[#343637] dark:border-[#6b7280] bg-[#f9fafb] dark:bg-[#1d1d1d]">
    {plans.length > 0 ? (
      <ShadcnTable className="w-full table-fixed border-separate border-spacing-0">
        <ShadcnTableHeader className="sticky top-0 z-10 bg-[#b9adb5] dark:bg-gray-800">
          <ShadcnTableRow className="hover:bg-transparent border-b-0 h-[45px]">
            <ShadcnTableHead className="text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] text-[#27272a] dark:text-[#94a3b8]">
              {selectedMaster?.circuitType === 'stress' ? 'Set' : 'Round'}
            </ShadcnTableHead>
            <ShadcnTableHead className="text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] text-[#27272a] dark:text-[#94a3b8]">
              {isAMRAPorEMOM ? '시간(분)' : '시간'}
            </ShadcnTableHead>
            <ShadcnTableHead
              className={cn(
                'text-center font-bold px-2 border-b-0 text-[#27272a] dark:text-[#94a3b8]',
                !isAMRAPorEMOM && 'border-r border-[#343637] dark:border-[#6b7280]',
              )}
            >
              {isAMRAPorEMOM ? '물보충(분)' : '휴식'}
            </ShadcnTableHead>
            {!isAMRAPorEMOM && (
              <ShadcnTableHead className="text-center font-bold px-2 border-b-0 text-[#27272a] dark:text-[#94a3b8]">
                물
              </ShadcnTableHead>
            )}
          </ShadcnTableRow>
        </ShadcnTableHeader>
        <ShadcnTableBody>
          {plans.map((row) => (
            <ShadcnTableRow
              key={row.id}
              className={cn(
                'h-[35px] border-b-0 group cursor-pointer hover:bg-muted/30 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors',
                selectedPlanId === row.id ? 'bg-primary/20' : 'bg-[#f9fafb] dark:bg-[#1d1d1d]',
              )}
              onClick={() => onSelectPlan(row.id)}
            >
              <ShadcnTableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors">
                {row.round}
              </ShadcnTableCell>
              <ShadcnTableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-[#343637] dark:border-[#6b7280] font-medium text-blue-600 dark:text-blue-400 group-hover:text-inherit transition-colors">
                {fmtPlanTime(row.exerciseTime, isAMRAPorEMOM)}
              </ShadcnTableCell>
              <ShadcnTableCell
                className={cn(
                  'text-center h-[35px] py-0 px-2 text-xs group-hover:text-inherit transition-colors',
                  isAMRAPorEMOM
                    ? 'text-cyan-600 dark:text-cyan-400'
                    : 'text-orange-600 dark:text-orange-400 border-r border-[#343637] dark:border-[#6b7280]',
                )}
              >
                {isAMRAPorEMOM
                  ? fmtPlanTime(row.waterBreakTime || 0, true)
                  : fmtPlanTime(row.restTime, false)}
              </ShadcnTableCell>
              {!isAMRAPorEMOM && (
                <ShadcnTableCell className="text-center h-[35px] py-0 px-2 text-xs text-cyan-600 dark:text-cyan-400 group-hover:text-inherit transition-colors">
                  {`${row.waterBreakTime || 0}s`}
                </ShadcnTableCell>
              )}
            </ShadcnTableRow>
          ))}
        </ShadcnTableBody>
      </ShadcnTable>
    ) : (
      <div className="flex items-center justify-center h-[165px] text-muted-foreground text-xs italic">
        운동 계획 데이터 없음
      </div>
    )}
  </div>
)
