/**
 * LicenseBulkRenewDialog — 지점 라이선스 일괄 갱신 다이얼로그
 *
 * 기능: 지점 선택 → 해당 지점 라이선스 목록 체크박스 선택 → 기간(1/2/3/5년) 또는 특정 종료일로 일괄 갱신.
 *
 * Props:
 * - open, branches, defaultBranchId, saving
 * - onClose, onConfirm({ licenseIds, termYears? | validTo? })
 *
 * 사용처: `LicenseManagement.tsx`
 * 관련: `licenseApi.getLicenses`, `licenseApi.bulkRenew`, `licenseDateUtils`
 *
 * 흐름: 지점 변경 시 라이선스 재조회 → active/expired 기본 체크 → 모드 선택 → 미리보기 → 확인.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { licenseApi, type BranchLicense } from '@/services/licenseApi'
import type { Branch } from '@/types/branch'
import {
  LICENSE_TERM_OPTIONS,
  calculateValidTo,
  formatDateDisplay,
  getRenewalStartDate,
  getTodayDateValue,
  type LicenseTermYears,
} from './licenseDateUtils'

type RenewMode = 'term' | 'date'

interface LicenseBulkRenewPayload {
  licenseIds: string[]
  termYears?: LicenseTermYears
  validTo?: string
}

interface LicenseBulkRenewDialogProps {
  open: boolean
  branches: Branch[]
  defaultBranchId?: string
  saving?: boolean
  onClose: () => void
  onConfirm: (payload: LicenseBulkRenewPayload) => void | Promise<void>
}

const fieldClassName = 'h-9 text-xs bg-card border-[#343637] dark:border-[#6b7280]'

const STATUS_LABEL: Record<BranchLicense['status'], string> = {
  active: '활성',
  expired: '만료',
  revoked: '취소됨',
}

const STATUS_BADGE_CLASS: Record<BranchLicense['status'], string> = {
  active: 'border-primary text-primary',
  expired: 'border-amber-500 text-amber-600 dark:text-amber-400',
  revoked: 'border-muted-foreground text-muted-foreground',
}

export const LicenseBulkRenewDialog: React.FC<LicenseBulkRenewDialogProps> = ({
  open,
  branches,
  defaultBranchId = '',
  saving = false,
  onClose,
  onConfirm,
}) => {
  const [branchId, setBranchId] = useState(defaultBranchId)
  const [branchLicenses, setBranchLicenses] = useState<BranchLicense[]>([])
  const [loadingLicenses, setLoadingLicenses] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<RenewMode>('term')
  const [termYears, setTermYears] = useState<LicenseTermYears>(1)
  const [customDate, setCustomDate] = useState<string>(getTodayDateValue())

  useEffect(() => {
    if (!open) return
    setBranchId(defaultBranchId)
    setSelectedIds(new Set())
    setMode('term')
    setTermYears(1)
    setCustomDate(getTodayDateValue())
  }, [open, defaultBranchId])

  useEffect(() => {
    if (!open || !branchId) {
      setBranchLicenses([])
      setSelectedIds(new Set())
      return
    }

    let canceled = false
    setLoadingLicenses(true)

    licenseApi
      .getLicenses(branchId)
      .then((rows) => {
        if (canceled) return
        setBranchLicenses(rows)
        const defaultChecked = new Set(
          rows.filter((row) => row.status === 'active' || row.status === 'expired').map((row) => row.id),
        )
        setSelectedIds(defaultChecked)
      })
      .catch(() => {
        if (canceled) return
        setBranchLicenses([])
        setSelectedIds(new Set())
      })
      .finally(() => {
        if (canceled) return
        setLoadingLicenses(false)
      })

    return () => {
      canceled = true
    }
  }, [open, branchId])

  const selectedCount = selectedIds.size
  const totalCount = branchLicenses.length
  const allSelected = totalCount > 0 && selectedCount === totalCount

  const previewByLicense = useMemo(() => {
    if (mode === 'date') return null

    const preview = new Map<string, string>()
    for (const license of branchLicenses) {
      if (!selectedIds.has(license.id)) continue
      const start = getRenewalStartDate(license.valid_to)
      preview.set(license.id, calculateValidTo(start, termYears))
    }
    return preview
  }, [mode, branchLicenses, selectedIds, termYears])

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen || saving) return
    onClose()
  }

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(branchLicenses.map((license) => license.id)))
      return
    }
    setSelectedIds(new Set())
  }

  const handleToggleOne = (licenseId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(licenseId)
      else next.delete(licenseId)
      return next
    })
  }

  const canConfirm =
    Boolean(branchId) &&
    selectedCount > 0 &&
    !saving &&
    (mode === 'term' || Boolean(customDate))

  const handleConfirm = () => {
    if (!canConfirm) return
    const payload: LicenseBulkRenewPayload = { licenseIds: Array.from(selectedIds) }
    if (mode === 'term') payload.termYears = termYears
    else payload.validTo = customDate
    onConfirm(payload)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl p-0 border-[#343637] dark:border-[#6b7280] overflow-hidden">
        <DialogHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
          <DialogTitle className="text-lg font-bold flex items-center gap-2 leading-none">
            지점 라이선스 일괄 갱신
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-3 text-sm">
          <div className="space-y-1">
            <Label htmlFor="license-bulk-branch" className="text-[11px] text-muted-foreground leading-none">
              지점
            </Label>
            <Select value={branchId} onValueChange={setBranchId} disabled={saving}>
              <SelectTrigger id="license-bulk-branch" className={fieldClassName}>
                <SelectValue placeholder="지점 선택" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={String(branch.id)}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border border-[#343637] dark:border-[#6b7280] overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 h-9 bg-muted/30 border-b border-[#343637] dark:border-[#6b7280]">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="license-bulk-all"
                  checked={allSelected}
                  disabled={saving || totalCount === 0}
                  onCheckedChange={(checked) => handleToggleAll(checked === true)}
                />
                <Label htmlFor="license-bulk-all" className="text-xs font-bold cursor-pointer">
                  전체 선택
                </Label>
              </div>
              <span className="text-[11px] text-muted-foreground">
                선택 {selectedCount} / 전체 {totalCount}
              </span>
            </div>

            <div className="max-h-[260px] overflow-auto bg-card">
              {!branchId ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  지점을 먼저 선택해주세요.
                </p>
              ) : loadingLicenses ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  라이선스를 불러오는 중...
                </p>
              ) : branchLicenses.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  발급된 라이선스가 없습니다.
                </p>
              ) : (
                <ul className="divide-y divide-[#343637]/40 dark:divide-[#6b7280]/40">
                  {branchLicenses.map((license) => {
                    const checked = selectedIds.has(license.id)
                    const previewTo = previewByLicense?.get(license.id)
                    const checkboxId = `license-bulk-item-${license.id}`

                    return (
                      <li key={license.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                        <Checkbox
                          id={checkboxId}
                          checked={checked}
                          disabled={saving}
                          onCheckedChange={(value) => handleToggleOne(license.id, value === true)}
                        />
                        <Label htmlFor={checkboxId} className="flex-1 min-w-0 cursor-pointer">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate font-bold">
                              {license.major_category_name || license.workout_category_id}
                            </span>
                            <span
                              className={cn(
                                'shrink-0 rounded border px-1.5 py-0.5 text-[10px]',
                                STATUS_BADGE_CLASS[license.status],
                              )}
                            >
                              {STATUS_LABEL[license.status]}
                            </span>
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            {formatDateDisplay(license.valid_from)} ~ {formatDateDisplay(license.valid_to)}
                            {previewTo ? (
                              <>
                                {' → '}
                                <span className="text-foreground font-bold">{formatDateDisplay(previewTo)}</span>
                              </>
                            ) : null}
                          </div>
                        </Label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] text-muted-foreground leading-none">갱신 방식</Label>
            <div className="flex gap-[3px]">
              <Button
                type="button"
                variant={mode === 'term' ? 'default' : 'outline'}
                className="h-9 text-xs flex-1"
                onClick={() => setMode('term')}
                disabled={saving}
              >
                기간 선택
              </Button>
              <Button
                type="button"
                variant={mode === 'date' ? 'default' : 'outline'}
                className="h-9 text-xs flex-1"
                onClick={() => setMode('date')}
                disabled={saving}
              >
                종료일 직접 선택
              </Button>
            </div>

            {mode === 'term' ? (
              <div className="space-y-1">
                <Label htmlFor="license-bulk-term" className="text-[11px] text-muted-foreground leading-none">
                  갱신 기간
                </Label>
                <Select
                  value={String(termYears)}
                  onValueChange={(value) => setTermYears(Number(value) as LicenseTermYears)}
                  disabled={saving}
                >
                  <SelectTrigger id="license-bulk-term" className={fieldClassName}>
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
                <p className="text-[11px] text-muted-foreground">
                  각 라이선스의 기존 종료일 다음날부터 이어집니다. 종료일이 지났거나 무기한인 경우 오늘부터 계산됩니다.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="license-bulk-date" className="text-[11px] text-muted-foreground leading-none">
                  새 종료일
                </Label>
                <Input
                  id="license-bulk-date"
                  type="date"
                  value={customDate}
                  min={getTodayDateValue()}
                  onChange={(event) => setCustomDate(event.target.value)}
                  disabled={saving}
                  className={fieldClassName}
                />
                <p className="text-[11px] text-muted-foreground">
                  선택한 모든 라이선스의 종료일을 동일하게 설정합니다.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-4 py-3 border-t border-[#343637] dark:border-[#6b7280]">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {saving ? '갱신 중...' : `${selectedCount}건 갱신`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default LicenseBulkRenewDialog
