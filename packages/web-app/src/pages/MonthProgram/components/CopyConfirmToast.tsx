/**
 * CopyConfirmToast — 운동 복사 확인 스낵바 (헤더 70px 아래 고정)
 */

import React from 'react'
import dayjs, { Dayjs } from 'dayjs'
import { Button } from '@/components/ui/button'

interface CopyConfirmToastProps {
  open: boolean
  detailSelectedDate: Dayjs | null
  onCancel: () => void
  onConfirm: () => void
}

export const CopyConfirmToast: React.FC<CopyConfirmToastProps> = ({
  open,
  detailSelectedDate,
  onCancel,
  onConfirm,
}) => {
  if (!open || !detailSelectedDate) return null

  return (
    <div
      className="fixed top-[90px] left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg bg-red-600 text-white animate-in slide-in-from-top-2 fade-in duration-300"
      role="alert"
    >
      <span className="text-sm font-medium whitespace-nowrap">
        {dayjs(detailSelectedDate).format('YYYY-MM-DD')} 1회에 운동을 복사하시겠습니까?
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-white hover:bg-white/20"
          onClick={onCancel}
        >
          취소
        </Button>
        <Button
          size="sm"
          className="h-8 bg-white text-red-600 hover:bg-white/90"
          onClick={onConfirm}
        >
          확인
        </Button>
      </div>
    </div>
  )
}
