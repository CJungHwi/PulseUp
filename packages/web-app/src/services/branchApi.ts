import { api } from './api'
import { Branch, CreateBranchRequest, UpdateBranchRequest } from '../types/branch'
import { ApiResponse } from '../types/api'

export const branchApi = {
  // 지점 목록 조회
  getBranches: async (params?: {
    page?: number
    limit?: number
    status?: string
    search?: string
  }) => {
    const response = await api.get<ApiResponse<{
      items: Branch[]
      total: number
      page: number
      limit: number
    }>>('/branches', { params })
    return response.data
  },

  // 지점 상세 조회
  getBranch: async (id: string) => {
    const response = await api.get<ApiResponse<Branch>>(`/branches/${id}`)
    return response.data
  },

  // 지점 생성
  createBranch: async (data: CreateBranchRequest) => {
    console.log('branchApi.createBranch - 요청 데이터:', data)
    const response = await api.post<ApiResponse<Branch>>('/branches', data)
    return response.data
  },

  // 지점 수정
  updateBranch: async (id: string, data: UpdateBranchRequest) => {
    const response = await api.put<ApiResponse<Branch>>(`/branches/${id}`, data)
    return response.data
  },

  // 지점 삭제
  deleteBranch: async (id: string) => {
    const response = await api.delete<ApiResponse<void>>(`/branches/${id}`)
    return response.data
  }
}


