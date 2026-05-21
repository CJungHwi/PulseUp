import { api } from './api';
import { 
  UserInfo, 
  CreateUserRequest, 
  UpdateUserRequest, 
  UpdateUserStatusRequest, 
  FetchUsersQuery 
} from '../types/userManager';

export interface GetUsersResponse {
  users: UserInfo[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const userManagerApi = {
  // 사용자 목록 조회
  getUsers: async (params: FetchUsersQuery = {}): Promise<GetUsersResponse> => {
    const response = await api.get('/admin/users', { params });
    return response.data.data; // 백엔드 응답: { success: true, data: { users: [...], pagination: {...} } }
  },

  // 특정 사용자 조회
  getUser: async (userId: string): Promise<UserInfo> => {
    const response = await api.get(`/admin/users/${userId}`);
    return response.data;
  },

  // 사용자 생성
  createUser: async (userData: CreateUserRequest): Promise<UserInfo> => {
    const response = await api.post('/admin/users', userData);
    return response.data;
  },

  // 사용자 정보 수정
  updateUser: async (userId: string, userData: UpdateUserRequest): Promise<UserInfo> => {
    const response = await api.put(`/admin/users/${userId}`, userData);
    return response.data;
  },

  // 사용자 상태 변경 (승인/사용중지/재사용)
  updateUserStatus: async (userId: string, statusData: UpdateUserStatusRequest): Promise<UserInfo> => {
    const response = await api.patch(`/admin/users/${userId}/status`, statusData);
    return response.data;
  },

  // 사용자 승인
  approveUser: async (userId: string): Promise<UserInfo> => {
    const response = await api.patch(`/admin/users/${userId}/approve`);
    return response.data;
  },

  // 사용자 사용중지
  suspendUser: async (userId: string): Promise<UserInfo> => {
    const response = await api.patch(`/admin/users/${userId}/suspend`);
    return response.data;
  },

  // 사용자 재사용
  reactivateUser: async (userId: string): Promise<UserInfo> => {
    const response = await api.patch(`/admin/users/${userId}/reactivate`);
    return response.data;
  },

  // 사용자 삭제
  deleteUser: async (userId: string): Promise<void> => {
    await api.delete(`/admin/users/${userId}`);
  },

  // 사용자 암호 초기화
  resetPassword: async (userId: string): Promise<{ message: string }> => {
    const response = await api.patch(`/admin/users/${userId}/reset-password`);
    return response.data;
  }
};

