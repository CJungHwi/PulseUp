/**
 * ElectronIPDialog — Electron 앱 IP 주소 설정 다이얼로그 (직접 연결 모드)
 */

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ElectronIPDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  electronIPInput: string
  onIPChange: (v: string) => void
  onConfirm: () => void
}

export const ElectronIPDialog: React.FC<ElectronIPDialogProps> = ({
  open,
  onOpenChange,
  electronIPInput,
  onIPChange,
  onConfirm,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Electron 앱 IP 주소 설정</DialogTitle>
        <DialogDescription>
          Electron 앱이 실행 중인 PC의 IP 주소를 입력하세요.
          <br />
          <br />
          <strong>설정 방법:</strong>
          <br />
          1. 같은 PC인 경우: localhost
          <br />
          2. 다른 PC인 경우: 해당 PC의 IP 주소 (예: 192.168.0.100)
          <br />
          <br />
          <strong>참고:</strong> Electron 앱이 실행 중인 PC의 방화벽에서 포트 3002가 열려 있어야 합니다.
        </DialogDescription>
      </DialogHeader>
      <div className="py-4">
        <Label htmlFor="electron-ip" className="mb-2 block">
          IP 주소
        </Label>
        <Input
          id="electron-ip"
          value={electronIPInput}
          onChange={(e) => onIPChange(e.target.value)}
          placeholder="localhost 또는 IP 주소"
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirm()
          }}
          autoFocus
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          취소
        </Button>
        <Button onClick={onConfirm}>확인</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
