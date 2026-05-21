export interface UserInfo {
  id: string;
  userid?: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'super_admin';
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
  role?: 'admin' | 'user';
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  role?: 'admin' | 'user';
}

export interface UpdateUserStatusRequest {
  status: 'active' | 'inactive' | 'pending';
}

export interface FetchUsersQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: 'admin' | 'user';
  status?: 'active' | 'inactive' | 'pending';
}