/**
 * WorkoutMemoBar — 운동 기록 메모 입력 + 저장 버튼
 *
 * 관리자 데이터(`is_admin`)는 readOnly 처리.
 */

import React from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { WorkoutMaster } from './monthProgramTypes'

interface WorkoutMemoBarProps {
  selectedMaster: WorkoutMaster | null
  memo: string
  onMemoChange: (v: string) => void
  onSave: () => void
}

export const WorkoutMemoBar: React.FC<WorkoutMemoBarProps> = ({
  selectedMaster,
  memo,
  onMemoChange,
  onSave,
}) => {
  const isAdmin = selectedMaster?.is_admin === true
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isAdmin) {
      e.preventDefault()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      onSave()
    }
  }

  return (
    <div className="flex-shrink-0 flex items-center gap-2 p-2 border-b border-[#343637] dark:border-[#6b7280] bg-muted/10">
      <span className="text-xs font-bold min-w-[40px]">메모</span>
      <Input
        value={memo}
        onChange={(e) => {
          if (!isAdmin) onMemoChange(e.target.value)
        }}
        disabled={!selectedMaster || isAdmin}
        readOnly={isAdmin}
        className="h-9 border-[#343637] dark:border-[#6b7280] bg-card"
        onKeyDown={handleKeyDown}
      />
      <Button
        size="sm"
        onClick={onSave}
        disabled={!selectedMaster || isAdmin || memo === (selectedMaster?.memo || '')}
        className="h-8 min-w-[60px]"
      >
        저장
      </Button>
    </div>
  )
}
