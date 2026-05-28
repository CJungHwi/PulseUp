/**
 * NotificationDeleteDialog — 공지사항 삭제 확인 다이얼로그
 *
 * 사용처: `Notification.tsx`
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

interface NotificationDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export const NotificationDeleteDialog: React.FC<NotificationDeleteDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>공지사항 삭제</DialogTitle>
        <DialogDescription>
          정말로 이 공지사항을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
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
