/**
 * 페이지 요약 — 라이선스 관리 (`/admin/licenses`)
 *
 * 기능: 슈퍼관리자가 지점별 운동 대분류 라이선스를 발급/취소/재활성화/갱신한다.
 *
 * 호출/연동:
 * - `licenseApi.getLicenses/grant/update`
 * - `branchApi.getBranches`
 * - `workoutCategoryApi.getWorkoutCategories`
 *
 * 관련 컴포넌트(`./components/`):
 * - `LicenseGrantForm`: 발급 폼(시작일 + 1/2/3/5년 기간 → 종료일 자동 계산)
 * - `LicenseList`: 라이선스 목록 테이블(상태별 액션)
 * - `LicenseRenewDialog`: 단건 갱신 기간 선택 다이얼로그
 * - `LicenseBulkRenewDialog`: 지점 라이선스 체크박스 선택 + 기간/종료일 선택 일괄 갱신
 * - `licenseDateUtils`: 기간/종료일/갱신 시작일 계산 유틸
 *
 * 흐름: 지점·운동 대분류 조회 → 라이선스 발급/목록 표시 → 상태별 액션(취소, 재활성화, 단건 갱신, 지점 라이선스 일괄 갱신) → 재조회.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { branchApi } from '@/services/branchApi'
import { licenseApi, type BranchLicense } from '@/services/licenseApi'
import { workoutCategoryApi } from '@/services/workoutCategoryApi'
import { useSnackbar } from '@/contexts/SnackbarContext'
import type { Branch } from '@/types/branch'
import type { WorkoutCategory } from '@/types/workoutCategory'
import { LicenseGrantForm, type LicenseGrantFormState } from './components/LicenseGrantForm'
import { LicenseList } from './components/LicenseList'
import { LicenseRenewDialog } from './components/LicenseRenewDialog'
import { LicenseBulkRenewDialog } from './components/LicenseBulkRenewDialog'
import {
  calculateValidTo,
  getRenewalStartDate,
  getTodayDateValue,
  type LicenseTermYears,
} from './components/licenseDateUtils'

const createInitialFormState = (): LicenseGrantFormState => ({
  branchId: '',
  workoutCategoryId: '',
  validFrom: getTodayDateValue(),
  termYears: 1,
  notes: '',
})

export const LicenseManagement: React.FC = () => {
  const { showSnackbar } = useSnackbar()
  const [branches, setBranches] = useState<Branch[]>([])
  const [categories, setCategories] = useState<WorkoutCategory[]>([])
  const [licenses, setLicenses] = useState<BranchLicense[]>([])
  const [form, setForm] = useState<LicenseGrantFormState>(createInitialFormState)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [renewTarget, setRenewTarget] = useState<BranchLicense | null>(null)
  const [renewing, setRenewing] = useState(false)
  const [bulkRenewOpen, setBulkRenewOpen] = useState(false)
  const [bulkRenewing, setBulkRenewing] = useState(false)

  const filterBranchId = useMemo(() => form.branchId || undefined, [form.branchId])

  const loadLicenses = useCallback(async (branchId?: string) => {
    setLoading(true)
    try {
      setLicenses(await licenseApi.getLicenses(branchId || undefined))
    } catch {
      setLicenses([])
      showSnackbar({ message: '라이선스 목록을 불러오지 못했습니다.', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [showSnackbar])

  useEffect(() => {
    branchApi
      .getBranches()
      .then((response) => setBranches(response.data.items || []))
      .catch(() => {
        setBranches([])
        showSnackbar({ message: '지점 목록을 불러오지 못했습니다.', severity: 'error' })
      })

    workoutCategoryApi
      .getWorkoutCategories({ is_active: true })
      .then(setCategories)
      .catch(() => {
        setCategories([])
        showSnackbar({ message: '운동 대분류 목록을 불러오지 못했습니다.', severity: 'error' })
      })

    loadLicenses()
  }, [loadLicenses, showSnackbar])

  const handleGrant = async () => {
    const computedValidTo = calculateValidTo(form.validFrom, form.termYears)
    if (!computedValidTo) {
      showSnackbar({ message: '발급 종료일을 계산할 수 없습니다. 시작일을 확인해주세요.', severity: 'warning' })
      return
    }

    setSaving(true)
    try {
      await licenseApi.grant({
        branchId: form.branchId,
        workoutCategoryId: form.workoutCategoryId,
        validFrom: form.validFrom,
        validTo: computedValidTo,
        notes: form.notes || null,
      })
      showSnackbar({ message: '라이선스가 발급되었습니다.', severity: 'success' })
      await loadLicenses(filterBranchId)
    } catch {
      showSnackbar({ message: '라이선스 발급에 실패했습니다.', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleRevoke = async (licenseId: string) => {
    if (!window.confirm('이 라이선스를 취소하시겠습니까?')) return

    try {
      await licenseApi.update(licenseId, { status: 'revoked' })
      showSnackbar({ message: '라이선스가 취소되었습니다.', severity: 'success' })
      await loadLicenses(filterBranchId)
    } catch {
      showSnackbar({ message: '라이선스 취소에 실패했습니다.', severity: 'error' })
    }
  }

  const handleReactivate = async (licenseId: string) => {
    if (!window.confirm('이 라이선스를 다시 활성화하시겠습니까?')) return

    try {
      await licenseApi.update(licenseId, { status: 'active' })
      showSnackbar({ message: '라이선스가 활성화되었습니다.', severity: 'success' })
      await loadLicenses(filterBranchId)
    } catch {
      showSnackbar({ message: '라이선스 활성화에 실패했습니다.', severity: 'error' })
    }
  }

  const handleOpenRenew = (license: BranchLicense) => {
    setRenewTarget(license)
  }

  const handleCloseRenew = () => {
    if (renewing) return
    setRenewTarget(null)
  }

  const handleConfirmRenew = async (termYears: LicenseTermYears) => {
    if (!renewTarget) return

    const renewalStart = getRenewalStartDate(renewTarget.valid_to)
    const newValidTo = calculateValidTo(renewalStart, termYears)
    if (!newValidTo) {
      showSnackbar({ message: '갱신 종료일을 계산할 수 없습니다.', severity: 'warning' })
      return
    }

    setRenewing(true)
    try {
      await licenseApi.update(renewTarget.id, {
        validTo: newValidTo,
        status: 'active',
      })
      showSnackbar({ message: '라이선스가 갱신되었습니다.', severity: 'success' })
      setRenewTarget(null)
      await loadLicenses(filterBranchId)
    } catch {
      showSnackbar({ message: '라이선스 갱신에 실패했습니다.', severity: 'error' })
    } finally {
      setRenewing(false)
    }
  }

  const handleOpenBulkRenew = () => {
    setBulkRenewOpen(true)
  }

  const handleCloseBulkRenew = () => {
    if (bulkRenewing) return
    setBulkRenewOpen(false)
  }

  const handleConfirmBulkRenew = async (payload: {
    licenseIds: string[]
    termYears?: LicenseTermYears
    validTo?: string
  }) => {
    if (payload.licenseIds.length === 0) return

    setBulkRenewing(true)
    try {
      const result = await licenseApi.bulkRenew(payload)
      const affected = result?.affectedRows ?? 0
      if (affected > 0) {
        showSnackbar({ message: `라이선스 ${affected}건이 갱신되었습니다.`, severity: 'success' })
      } else {
        showSnackbar({ message: '갱신된 라이선스가 없습니다.', severity: 'info' })
      }
      setBulkRenewOpen(false)
      await loadLicenses(filterBranchId)
    } catch {
      showSnackbar({ message: '라이선스 일괄 갱신에 실패했습니다.', severity: 'error' })
    } finally {
      setBulkRenewing(false)
    }
  }

  return (
    <div className="relative h-[calc(100vh-140px)] p-0 flex flex-col gap-[3px] overflow-hidden bg-background">
      <LicenseGrantForm
        form={form}
        branches={branches}
        categories={categories}
        saving={saving}
        onChange={setForm}
        onBranchChange={(branchId) => loadLicenses(branchId)}
        onGrant={handleGrant}
      />

      <LicenseList
        licenses={licenses}
        loading={loading}
        onRevoke={handleRevoke}
        onReactivate={handleReactivate}
        onRenew={handleOpenRenew}
        onBulkRenew={handleOpenBulkRenew}
      />

      <LicenseRenewDialog
        license={renewTarget}
        saving={renewing}
        onClose={handleCloseRenew}
        onConfirm={handleConfirmRenew}
      />

      <LicenseBulkRenewDialog
        open={bulkRenewOpen}
        branches={branches}
        defaultBranchId={form.branchId}
        saving={bulkRenewing}
        onClose={handleCloseBulkRenew}
        onConfirm={handleConfirmBulkRenew}
      />
    </div>
  )
}

export default LicenseManagement
