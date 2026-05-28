/**
 * WorkoutSummaryTable — 우측 요약 정보 테이블
 *
 * 라운드/세트 수, DS/CD 합계, 휴식, 총 시간을 계산하여 4×3 그리드로 표시.
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
import { fmtSeconds, isAMRAPorEMOMCategory, isCD, isDS } from './monthProgramUtils'
import type {
  ExerciseSequence,
  WorkoutDetail,
  WorkoutMaster,
  WorkoutPlan,
} from './monthProgramTypes'

interface WorkoutSummaryTableProps {
  selectedMaster: WorkoutMaster | null
  workoutDetails: WorkoutDetail[]
  workoutPlans: WorkoutPlan[]
  exerciseSequences: ExerciseSequence[]
}

const computeSummary = (
  selectedMaster: WorkoutMaster | null,
  workoutDetails: WorkoutDetail[],
  workoutPlans: WorkoutPlan[],
  exerciseSequences: ExerciseSequence[],
) => {
  const isAMRAPorEMOM = isAMRAPorEMOMCategory(
    selectedMaster?.workoutCategoriesId,
    selectedMaster?.workoutCategory,
    selectedMaster?.workoutCategoriesName,
  )

  const dsSeconds = workoutDetails
    .filter((d) => isDS(d.major_category))
    .reduce((s, d) => s + (d.time || 0), 0)
  const cdSeconds = workoutDetails
    .filter((d) => isCD(d.major_category))
    .reduce((s, d) => s + (d.time || 0), 0)
  const mainExerciseCount = workoutDetails.filter(
    (d) => !isDS(d.major_category) && !isCD(d.major_category),
  ).length

  let mainWithRest = 0
  let restOnly = 0

  if (workoutPlans.length > 0 && mainExerciseCount > 0) {
    const n = mainExerciseCount
    const numGroups = Math.ceil(n / 6)
    if (isAMRAPorEMOM) {
      const mcId = (selectedMaster?.workoutCategoriesId || selectedMaster?.workoutCategory || '')
        .toString()
        .toUpperCase()
      const mcName = (selectedMaster?.workoutCategoriesName || '').toString().toUpperCase()
      const isEMOM = mcId === 'EMOM' || mcName === 'EMOM'
      workoutPlans.forEach((row, idx) => {
        const isLast = idx === workoutPlans.length - 1
        const exSec = row.exerciseTime >= 60 ? row.exerciseTime : row.exerciseTime * 60
        const waterSec =
          (row.waterBreakTime || 0) >= 60
            ? row.waterBreakTime || 0
            : (row.waterBreakTime || 0) * 60
        if (isEMOM) {
          const inGroup = Math.min(6, n - idx * 6)
          mainWithRest += inGroup * exSec
        } else {
          mainWithRest += exSec
        }
        if (!isLast) restOnly += waterSec
      })
    } else {
      workoutPlans.forEach((row, idx) => {
        const isLast = idx === workoutPlans.length - 1
        mainWithRest += row.exerciseTime * n
        if (!isLast) {
          restOnly += row.restTime * n
        } else {
          restOnly += row.restTime * (n - numGroups)
          mainWithRest += (row.waterBreakTime || 0) * (numGroups - 1)
        }
      })
    }
  }

  const mainTotal = mainWithRest + restOnly
  const totalSeconds = dsSeconds + mainTotal + cdSeconds
  const roundSetCount =
    workoutPlans.length > 0
      ? workoutPlans.length
      : (() => {
          const r = exerciseSequences
            .filter((s) => s.round > 0 && s.round < 99)
            .map((s) => s.round)
          return r.length > 0 ? Math.max(...r) : 0
        })()

  return { dsSeconds, cdSeconds, mainTotal, restOnly, totalSeconds, roundSetCount }
}

export const WorkoutSummaryTable: React.FC<WorkoutSummaryTableProps> = ({
  selectedMaster,
  workoutDetails,
  workoutPlans,
  exerciseSequences,
}) => {
  const { dsSeconds, cdSeconds, mainTotal, restOnly, totalSeconds, roundSetCount } = computeSummary(
    selectedMaster,
    workoutDetails,
    workoutPlans,
    exerciseSequences,
  )

  return (
    <div className="w-[60%] flex flex-col bg-[#f9fafb] dark:bg-[#1d1d1d]">
      <ShadcnTable className="w-full table-fixed border-separate border-spacing-0">
        <ShadcnTableHeader>
          <ShadcnTableRow className="hover:bg-transparent border-b-0 bg-[#b9adb5] dark:bg-gray-800 h-[45px]">
            <ShadcnTableHead className="text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] text-[#27272a] dark:text-[#94a3b8] w-[25%]">
              구분
            </ShadcnTableHead>
            <ShadcnTableHead className="text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] text-[#27272a] dark:text-[#94a3b8] w-[25%]">
              값
            </ShadcnTableHead>
            <ShadcnTableHead className="text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] text-[#27272a] dark:text-[#94a3b8] w-[25%]">
              구분
            </ShadcnTableHead>
            <ShadcnTableHead className="text-center font-bold px-2 border-b-0 text-[#27272a] dark:text-[#94a3b8] w-[25%]">
              값
            </ShadcnTableHead>
          </ShadcnTableRow>
        </ShadcnTableHeader>
        <ShadcnTableBody>
          <ShadcnTableRow className="h-[30px] border-b-0">
            <ShadcnTableCell className="p-[8px] text-center font-bold bg-muted/30 dark:bg-gray-700/50 border-r border-[#343637] dark:border-[#6b7280]">
              {selectedMaster?.circuitType === 'stress' ? 'Set 수' : 'Round 수'}
            </ShadcnTableCell>
            <ShadcnTableCell className="p-[8px] text-center font-bold text-orange-600 dark:text-orange-400 border-r border-[#343637] dark:border-[#6b7280]">
              {roundSetCount} 번
            </ShadcnTableCell>
            <ShadcnTableCell className="p-[8px] text-center font-bold bg-muted/30 dark:bg-gray-700/50 border-r border-[#343637] dark:border-[#6b7280]">
              {selectedMaster?.workoutCategoriesName}
            </ShadcnTableCell>
            <ShadcnTableCell className="p-[8px] text-center font-bold text-blue-600 dark:text-blue-400">
              {fmtSeconds(mainTotal)}
            </ShadcnTableCell>
          </ShadcnTableRow>
          <ShadcnTableRow className="h-[30px] border-b-0">
            <ShadcnTableCell className="p-[8px] text-center font-bold bg-muted/30 dark:bg-gray-700/50 border-r border-[#343637] dark:border-[#6b7280]">
              Dynamic Stretching
            </ShadcnTableCell>
            <ShadcnTableCell className="p-[8px] text-center font-bold text-green-600 dark:text-green-400 border-r border-[#343637] dark:border-[#6b7280]">
              {fmtSeconds(dsSeconds)}
            </ShadcnTableCell>
            <ShadcnTableCell className="p-[8px] text-center font-bold bg-muted/30 dark:bg-gray-700/50 border-r border-[#343637] dark:border-[#6b7280]">
              Cool Down
            </ShadcnTableCell>
            <ShadcnTableCell className="p-[8px] text-center font-bold text-orange-600 dark:text-orange-400">
              {fmtSeconds(cdSeconds)}
            </ShadcnTableCell>
          </ShadcnTableRow>
          <ShadcnTableRow className="h-[30px] border-b-0">
            <ShadcnTableCell className="p-[8px] text-center font-bold bg-muted/30 dark:bg-gray-700/50 border-r border-[#343637] dark:border-[#6b7280]">
              휴식시간
            </ShadcnTableCell>
            <ShadcnTableCell className="p-[8px] text-center font-bold text-green-600 dark:text-green-400 border-r border-[#343637] dark:border-[#6b7280]">
              {fmtSeconds(restOnly)}
            </ShadcnTableCell>
            <ShadcnTableCell className="p-[8px] text-center font-bold bg-muted/30 dark:bg-gray-700/50 border-r border-[#343637] dark:border-[#6b7280]">
              Total
            </ShadcnTableCell>
            <ShadcnTableCell className="p-[8px] text-center font-bold text-green-600 dark:text-green-400">
              {fmtSeconds(totalSeconds)}
            </ShadcnTableCell>
          </ShadcnTableRow>
        </ShadcnTableBody>
      </ShadcnTable>
    </div>
  )
}
