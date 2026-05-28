/**
 * ForceLogoutDialog — 강제 로그아웃 확인 모달
 *
 * 사용처: `UserHistory.tsx`
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
import type { UserLoginInfo } from '@/services/admin.service'

interface ForceLogoutDialogProps {
  open: boolean
  user: UserLoginInfo | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export const ForceLogoutDialog: React.FC<ForceLogoutDialogProps> = ({
  open,
  user,
  onOpenChange,
  onConfirm,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>강제 로그아웃</DialogTitle>
        <DialogDescription>
          정말로 "{user?.name}" 사용자를 강제 로그아웃 시키시겠습니까?
          <br />
          해당 사용자의 모든 활성 세션이 즉시 종료됩니다.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          취소
        </Button>
        <Button variant="destructive" onClick={onConfirm}>
          강제 로그아웃
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
