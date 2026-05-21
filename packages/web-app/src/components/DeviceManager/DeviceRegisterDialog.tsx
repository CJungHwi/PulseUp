import { useState } from 'react'
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
import { registerDevice } from '@/services/deviceService'
import { useSnackbar } from '@/contexts/SnackbarContext'
import { useAppSelector } from '@/hooks/redux'
import { Monitor } from 'lucide-react'

interface DeviceRegisterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export const DeviceRegisterDialog = ({
  open,
  onOpenChange,
  onSuccess
}: DeviceRegisterDialogProps) => {
  const [code, setCode] = useState('')
  const [displayLabel, setDisplayLabel] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { showSnackbar } = useSnackbar()
  const user = useAppSelector((state) => state.auth.user)
  const hasBranch = Boolean(user?.branchId)
  const branchLabel = user?.branchName
    ? `${user.branchName} (${user.branchId})`
    : user?.branchId
      ? `지점 ID ${user.branchId}`
      : '지점 미지정'

  const handleSubmit = async () => {
    if (!hasBranch) {
      showSnackbar({
        message: '사용자 지점 정보가 없어 디바이스를 등록할 수 없습니다. 관리자에게 사용자 지점을 먼저 지정해 주세요.',
        severity: 'warning'
      })
      return
    }

    if (!code.trim()) {
      showSnackbar({ message: '등록 코드를 입력해주세요.', severity: 'warning' })
      return
    }

    setIsLoading(true)
    try {
      const result = await registerDevice(code, displayLabel || '링크힛')
      
      if (result.success) {
        showSnackbar({ message: '디바이스가 등록되었습니다.', severity: 'success' })
        setCode('')
        setDisplayLabel('')
        onOpenChange(false)
        onSuccess?.()
      } else {
        showSnackbar({ message: result.error || '등록에 실패했습니다.', severity: 'error' })
      }
    } catch (error) {
      showSnackbar({
        message: error instanceof Error ? error.message : '등록 중 오류가 발생했습니다.',
        severity: 'error'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 대문자로 변환하고 공백 제거
    const value = e.target.value.toUpperCase().replace(/\s/g, '')
    // 최대 6자리
    if (value.length <= 6) {
      setCode(value)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-lg font-bold flex items-center gap-2 leading-none">
            <Monitor className="w-5 h-5" />
            새 디바이스 등록
          </DialogTitle>
        </DialogHeader>
        <DialogDescription className="px-4 pt-4">
          Electron 앱 화면에 표시된 등록 코드를 입력하세요.
        </DialogDescription>
        <div className="space-y-4 px-4 pb-4">
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <div className="font-medium">등록 지점</div>
            <div className={hasBranch ? 'text-muted-foreground' : 'text-destructive'}>
              {branchLabel}
            </div>
            {!hasBranch && (
              <div className="mt-1 text-xs text-destructive">
                사용자 지점 정보가 없어 디바이스를 등록할 수 없습니다.
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-code">등록 코드</Label>
            <Input
              id="register-code"
              value={code}
              onChange={handleCodeChange}
              placeholder="ABC123"
              className="text-center text-2xl tracking-widest font-mono bg-card"
              maxLength={6}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && code.length === 6) {
                  handleSubmit()
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="display-label">디바이스 이름 (선택)</Label>
            <Input
              id="display-label"
              value={displayLabel}
              onChange={(e) => setDisplayLabel(e.target.value)}
              placeholder="예: 1번 모니터, 메인 TV"
              className="bg-card"
            />
          </div>
        </div>
        <DialogFooter className="px-4 pb-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !hasBranch || code.length < 6}
          >
            {isLoading ? '등록 중...' : '등록하기'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DeviceRegisterDialog
