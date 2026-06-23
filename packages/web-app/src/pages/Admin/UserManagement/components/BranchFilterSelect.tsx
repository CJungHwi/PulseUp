/**
 * BranchFilterSelect — 사용자 관리 조회용 지점 필터
 *
 * 기능: 슈퍼관리자가 사용자 목록을 지점별로 필터링할 때 사용한다.
 *
 * 사용처: `UserManagementFilterBar.tsx`
 */
import React, { useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface BranchFilterOption {
  id: string
  name: string
  region: string
}

interface BranchFilterSelectProps {
  value: string
  branches: BranchFilterOption[]
  loading?: boolean
  onChange: (value: string) => void
}

export const BranchFilterSelect: React.FC<BranchFilterSelectProps> = ({
  value,
  branches,
  loading = false,
  onChange,
}) => {
  const labels = useMemo(
    () => ({
      all: '모든 지점',
      none: '지점 미지정',
      ...Object.fromEntries(
        branches.map((branch) => [branch.id, `${branch.name} (${branch.region})`])
      ),
    }),
    [branches]
  )

  return (
    <Select value={value} onValueChange={onChange} disabled={loading} labels={labels}>
      <SelectTrigger className="h-9 text-xs border-[#343637] dark:border-[#6b7280] bg-card">
        <SelectValue placeholder="지점 필터" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">모든 지점</SelectItem>
        <SelectItem value="none">지점 미지정</SelectItem>
        {branches.map((branch) => (
          <SelectItem key={branch.id} value={branch.id}>
            {branch.name} ({branch.region})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
