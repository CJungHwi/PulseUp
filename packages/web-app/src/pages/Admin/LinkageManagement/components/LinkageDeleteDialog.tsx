/**
 * LinkageDeleteDialog — 선택 디바이스 일괄 삭제 확인 다이얼로그
 *
 * 사용처: `LinkageManagementPage.tsx`
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

interface LinkageDeleteDialogProps {
  open: boolean
  selectedCount: number
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export const LinkageDeleteDialog: React.FC<LinkageDeleteDialogProps> = ({
  open,
  selectedCount,
  onOpenChange,
  onConfirm,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>선택한 디바이스 삭제</DialogTitle>
        <DialogDescription>
          선택한 {selectedCount}개 디바이스를 DB에서 삭제합니다. Electron 측은 다음에 재등록이 필요할 수 있습니다.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          취소
        </Button>
        <Button type="button" variant="destructive" onClick={onConfirm}>
          삭제
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
