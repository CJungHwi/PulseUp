/**
 * BranchDeleteDialog — 지점 일괄 삭제 확인 다이얼로그
 *
 * 사용처: `Branch.tsx`
 */
import React from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface BranchDeleteDialogProps {
  open: boolean
  count: number
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export const BranchDeleteDialog: React.FC<BranchDeleteDialogProps> = ({
  open,
  count,
  onOpenChange,
  onConfirm,
}) => (
  <Dialog
    open={open}
    onOpenChange={(next) => {
      if (!next) onOpenChange(false)
    }}
  >
    <DialogContent>
      <DialogHeader>
        <DialogTitle>지점 삭제 확인</DialogTitle>
        <DialogDescription>
          선택된 {count}개의 지점을 삭제하시겠습니까?
          <br />
          삭제된 데이터는 복구할 수 없습니다.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          취소
        </Button>
        <Button variant="destructive" onClick={onConfirm}>
          삭제
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
