export interface UserInfo {
  id: string;
  userid?: string;
  email: string;
  name: string;
  role: 'branch_admin' | 'user' | 'super_admin';
  status: 'active' | 'inactive' | 'pending';
  isApproved?: boolean;
  isActive?: boolean;
  branchId?: number;
  branchName?: string;
  branch_name?: string;
  branchRegion?: string;
  branch_region?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  created_at?: string;
  last_login_at?: string;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
  role?: 'branch_admin' | 'user' | 'super_admin';
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  role?: 'branch_admin' | 'user' | 'super_admin';
}

export interface UpdateUserStatusRequest {
  status: 'active' | 'inactive' | 'pending';
}

export interface FetchUsersQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: 'branch_admin' | 'user' | 'super_admin';
  status?: 'active' | 'inactive' | 'pending';
}