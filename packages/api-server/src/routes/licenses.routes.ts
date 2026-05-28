import { Router } from 'express'
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.middleware.js'
import { requireSuperAdmin } from '../middleware/admin.middleware.js'
import {
  LicenseService,
  LICENSE_TERM_OPTIONS,
  type BranchLicenseStatus,
  type BranchLicenseUpdateInput,
  type LicenseTermYears,
} from '../services/license.service.js'
import { encryptLicensePayload } from '../lib/license-cipher.js'

const ALLOWED_STATUSES: BranchLicenseStatus[] = ['active', 'revoked', 'expired']
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const router = Router()

router.get('/admin/licenses', authenticateToken, requireSuperAdmin as any, async (req, res) => {
  try {
    const licenses = await LicenseService.list(req.query.branchId as string | undefined)
    res.json({ success: true, data: { licenses } })
  } catch (error) {
    console.error('GET /admin/licenses error:', error)
    res.status(500).json({ success: false, error: '라이선스 목록 조회에 실패했습니다' })
  }
})

router.post('/admin/licenses', authenticateToken, requireSuperAdmin as any, async (req: any, res) => {
  try {
    const { branchId, workoutCategoryId, validFrom, validTo, notes } = req.body
    if (!branchId || !workoutCategoryId || !validFrom) {
      return res.status(400).json({ success: false, error: 'branchId, workoutCategoryId, validFrom은 필수입니다' })
    }

    const license = await LicenseService.grant({
      branchId,
      workoutCategoryId,
      validFrom,
      validTo,
      notes,
      grantedBy: req.user.id
    })

    res.status(201).json({ success: true, data: { license } })
  } catch (error: any) {
    console.error('POST /admin/licenses error:', error)
    res.status(500).json({ success: false, error: error.sqlMessage || '라이선스 발급에 실패했습니다' })
  }
})

router.patch('/admin/licenses/:id', authenticateToken, requireSuperAdmin as any, async (req, res) => {
  try {
    const { validFrom, validTo, status, notes } = req.body ?? {}
    const payload: BranchLicenseUpdateInput = {}

    if (validFrom !== undefined) {
      if (validFrom !== null && (typeof validFrom !== 'string' || !DATE_PATTERN.test(validFrom))) {
        return res.status(400).json({ success: false, error: 'validFrom은 YYYY-MM-DD 형식이어야 합니다' })
      }
      payload.validFrom = validFrom
    }

    if (validTo !== undefined) {
      if (validTo !== null && (typeof validTo !== 'string' || !DATE_PATTERN.test(validTo))) {
        return res.status(400).json({ success: false, error: 'validTo는 YYYY-MM-DD 형식 또는 null이어야 합니다' })
      }
      payload.validTo = validTo
    }

    if (status !== undefined) {
      if (!ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, error: 'status는 active, revoked, expired 중 하나여야 합니다' })
      }
      payload.status = status
    }

    if (notes !== undefined) {
      if (notes !== null && typeof notes !== 'string') {
        return res.status(400).json({ success: false, error: 'notes는 문자열 또는 null이어야 합니다' })
      }
      payload.notes = notes
    }

    const license = await LicenseService.update(req.params.id, payload)
    if (!license) return res.status(404).json({ success: false, error: '라이선스를 찾을 수 없습니다' })
    res.json({ success: true, data: { license } })
  } catch (error) {
    console.error('PATCH /admin/licenses/:id error:', error)
    res.status(500).json({ success: false, error: '라이선스 수정에 실패했습니다' })
  }
})

router.post('/admin/licenses/bulk-renew', authenticateToken, requireSuperAdmin as any, async (req, res) => {
  try {
    const { licenseIds, termYears, validTo } = req.body ?? {}

    if (!Array.isArray(licenseIds) || licenseIds.length === 0) {
      return res.status(400).json({ success: false, error: '갱신할 라이선스를 선택해주세요' })
    }
    if (!licenseIds.every((id) => typeof id === 'string' && id.length > 0)) {
      return res.status(400).json({ success: false, error: 'licenseIds는 문자열 배열이어야 합니다' })
    }

    const hasTerm = termYears !== undefined && termYears !== null
    const hasDate = validTo !== undefined && validTo !== null
    if (hasTerm === hasDate) {
      return res.status(400).json({ success: false, error: 'termYears 또는 validTo 중 하나만 지정해야 합니다' })
    }

    const payload: { licenseIds: string[]; termYears?: LicenseTermYears; validTo?: string } = {
      licenseIds,
    }

    if (hasTerm) {
      const rawTerm = Number(termYears)
      if (!LICENSE_TERM_OPTIONS.includes(rawTerm as LicenseTermYears)) {
        return res.status(400).json({ success: false, error: 'termYears는 1, 2, 3, 5 중 하나여야 합니다' })
      }
      payload.termYears = rawTerm as LicenseTermYears
    } else {
      if (typeof validTo !== 'string' || !DATE_PATTERN.test(validTo)) {
        return res.status(400).json({ success: false, error: 'validTo는 YYYY-MM-DD 형식이어야 합니다' })
      }
      payload.validTo = validTo
    }

    const result = await LicenseService.bulkRenew(payload)
    res.json({ success: true, data: result })
  } catch (error: any) {
    console.error('POST /admin/licenses/bulk-renew error:', error)
    const message = error?.sqlMessage || error?.message || '라이선스 일괄 갱신에 실패했습니다'
    res.status(500).json({ success: false, error: message })
  }
})

router.get('/me/licenses', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const branchId = req.user?.branchId
    if (!branchId) return res.status(400).json({ success: false, error: '소속 지점 정보가 없습니다' })
    const licenses = await LicenseService.getActiveByBranch(branchId)
    res.json({ success: true, data: encryptLicensePayload({ branchId, licenses, issuedAt: new Date().toISOString() }) })
  } catch (error) {
    console.error('GET /me/licenses error:', error)
    res.status(500).json({ success: false, error: '라이선스 조회에 실패했습니다' })
  }
})

export default router
