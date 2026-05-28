import { apiClient } from './api.service'

export type BranchLicenseStatus = 'active' | 'revoked' | 'expired'

export interface BranchLicense {
  id: string
  branch_id: number
  workout_category_id: string
  valid_from: string
  valid_to?: string | null
  status: BranchLicenseStatus
  notes?: string | null
  branch_name?: string
  major_category_name?: string
}

export interface LicenseGrantPayload {
  branchId: string
  workoutCategoryId: string
  validFrom: string
  validTo?: string | null
  notes?: string | null
}

export interface LicenseUpdatePayload {
  validFrom?: string | null
  validTo?: string | null
  status?: BranchLicenseStatus
  notes?: string | null
}

export const licenseApi = {
  async getLicenses(branchId?: string) {
    const response = await apiClient.get('/admin/licenses', { params: { branchId } })
    return response.data.data.licenses as BranchLicense[]
  },

  async grant(data: LicenseGrantPayload) {
    const response = await apiClient.post('/admin/licenses', data)
    return response.data.data.license as BranchLicense
  },

  async update(id: string, data: LicenseUpdatePayload) {
    const response = await apiClient.patch(`/admin/licenses/${id}`, data)
    return response.data.data.license as BranchLicense
  },

  async bulkRenew(payload: {
    licenseIds: string[]
    termYears?: 1 | 2 | 3 | 5
    validTo?: string
  }) {
    const response = await apiClient.post('/admin/licenses/bulk-renew', payload)
    return response.data.data as { affectedRows: number; licenses: BranchLicense[] }
  },
}
