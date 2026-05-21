export interface Branch {
  id: string
  name: string
  region: string
  address?: string
  phone?: string
  manager?: string
  created_at: string
  updated_at: string
}

export interface CreateBranchRequest {
  name: string
  region: string
  address?: string
  phone?: string
  manager?: string
}

export interface UpdateBranchRequest extends CreateBranchRequest {
  id: string
}




