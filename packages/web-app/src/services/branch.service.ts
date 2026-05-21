import { apiClient } from './api.service'

export interface Branch {
  id: string
  name: string
  region: string
  created_at: string
  updated_at: string
}

export const branchService = {
  async getBranches(): Promise<Branch[]> {
    const response = await apiClient.get('/branches')
    return response.data.data || []
  },

  async getBranchById(id: string): Promise<Branch> {
    const response = await apiClient.get(`/branches/${id}`)
    return response.data.data
  }
}