/**
 * LicenseRenewDialog — 라이선스 갱신 다이얼로그
 *
 * 기능: 선택한 라이선스의 갱신 기간(1/2/3/5년) 선택과 새 시작일/종료일 미리보기 후 갱신 요청
 *
 * Props:
 * - license: 갱신 대상 라이선스(null이면 닫힘)
 * - saving: 갱신 진행 여부
 * - onClose, onConfirm(termYears)
 *
 * 사용처: `LicenseManagement.tsx`
 * 관련 유틸: `licenseDateUtils.ts`
 */
import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { BranchLicense } from '@/services/licenseApi'
import {
  LICENSE_TERM_OPTIONS,
  calculateValidTo,
  formatDateDisplay,
  getRenewalStartDate,
  type LicenseTermYears,
} from './licenseDateUtils'

interface LicenseRenewDialogProps {
  license: BranchLicense | null
  saving?: boolean
  onClose: () => void
  onConfirm: (termYears: LicenseTermYears) => void | Promise<void>
}

const fieldClassName =
  'h-9 text-xs bg-card border-[#343637] dark:border-[#6b7280]'

export const LicenseRenewDialog: React.FC<LicenseRenewDialogProps> = ({
  license,
  saving = false,
  onClose,
  onConfirm,
}) => {
  const [termYears, setTermYears] = useState<LicenseTermYears>(1)

  useEffect(() => {
    if (license) setTermYears(1)
  }, [license])

  const renewalSelectId = 'license-renew-term'
  const renewalStart = license ? getRenewalStartDate(license.valid_to) : ''
  const renewalEnd = renewalStart ? calculateValidTo(renewalStart, termYears) : ''

  const handleOpenChange = (open: boolean) => {
    if (open || saving) return
    onClose()
  }

  const handleConfirm = () => {
    if (saving) return
    onConfirm(termYears)
  }

  return (
    <Dialog open={Boolean(license)} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg p-0 border-[#343637] dark:border-[#6b7280] overflow-hidden">
        <DialogHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
          <DialogTitle className="text-lg font-bold flex items-center gap-2 leading-none">
            라이선스 갱신
          </DialogTitle>
        </DialogHeader>

        {license ? (
          <div className="p-4 space-y-4 text-sm">
            <div className="space-y-1">
              <p className="font-bold">
                {license.major_category_name || license.workout_category_id}
              </p>
              <p className="text-muted-foreground">
                {license.branch_name || `지점 ${license.branch_id}`}
              </p>
              <p className="text-xs text-muted-foreground">
                현재 기간: {formatDateDisplay(license.valid_from)} ~ {formatDateDisplay(license.valid_to)}
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor={renewalSelectId} className="text-[11px] text-muted-foreground leading-none">
                갱신 기간
              </Label>
              <Select
                value={String(termYears)}
                onValueChange={(value) => setTermYears(Number(value) as LicenseTermYears)}
                disabled={saving}
              >
                <SelectTrigger id={renewalSelectId} className={fieldClassName}>
                  <SelectValue placeholder="기간 선택" />
                </SelectTrigger>
                <SelectContent>
                  {LICENSE_TERM_OPTIONS.map((years) => (
                    <SelectItem key={years} value={String(years)}>
                      {years}년
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border border-[#343637] dark:border-[#6b7280] bg-muted/30 p-3 text-xs space-y-1">
              <p>
                갱신 시작일: <span className="font-bold text-foreground">{formatDateDisplay(renewalStart)}</span>
              </p>
              <p>
                갱신 종료일: <span className="font-bold text-foreground">{formatDateDisplay(renewalEnd)}</span>
              </p>
              <p className="text-muted-foreground">
                기존 종료일 다음날부터 이어집니다. 종료일이 지났거나 무기한인 경우 오늘부터 계산됩니다.
              </p>
            </div>
          </div>
        ) : null}

        <DialogFooter className="px-4 py-3 border-t border-[#343637] dark:border-[#6b7280]">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button onClick={handleConfirm} disabled={saving || !renewalEnd}>
            {saving ? '갱신 중...' : '갱신'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default LicenseRenewDialog
