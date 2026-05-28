import { api } from './api'
import { ApiResponse } from '../types/api'

// 메뉴 타입 정의
export interface Menu {
  id: number // bigint
  name: string
  path?: string
  icon?: string
  parent_id?: number
  order_index: number
  sort_order?: number
  target_audience: 'all' | 'user' | 'super_admin' | 'branch_admin'
  menu_type: 'page' | 'folder' | 'link' | 'divider'
  is_active: boolean
  is_visible: boolean
  level: number
  created_at: string
  updated_at: string
}

import { MenuTreeItem } from '../types/menu.types'

export const menuApi = {
  // 메뉴 목록 조회
  getMenus: async (params?: {
    target_audience?: string
    is_active?: boolean
  }) => {
    const response = await api.get<ApiResponse<Menu[]>>('/menus', { params })
    return response.data
  },

  // 사용자 메뉴 트리 조회 (재귀 구조)
  getUserMenuTree: async () => {
    const response = await api.get<ApiResponse<MenuTreeItem[]>>('/menus/tree', {
      params: { target_audience: 'user' }
    })
    return response.data
  },

  // 관리자 메뉴 트리 조회 (재귀 구조)
  getAdminMenuTree: async () => {
    const response = await api.get<ApiResponse<MenuTreeItem[]>>('/menus/tree', {
      params: { target_audience: 'super_admin' }
    })
    return response.data
  },

  // 메뉴 관리 페이지용 사용자 메뉴 트리 조회 (menus 테이블만 사용)
  getAdminUserMenuTree: async () => {
    const response = await api.get<ApiResponse<MenuTreeItem[]>>('/menus/admin-tree', {
      params: { target_audience: 'user' }
    })
    return response.data
  },

  // 메뉴 관리 페이지용 관리자 메뉴 트리 조회 (menus 테이블만 사용)
  getAdminAdminMenuTree: async () => {
    const response = await api.get<ApiResponse<MenuTreeItem[]>>('/menus/admin-tree', {
      params: { target_audience: 'super_admin' }
    })
    return response.data
  },

  // 메뉴 관리 페이지용 트리 조회 (target_audience: user | user,branch_admin | user,branch_admin,super_admin)
  getAdminMenuTreeByAudience: async (
    target_audience: 'user' | 'user,branch_admin' | 'user,branch_admin,super_admin'
  ) => {
    const response = await api.get<ApiResponse<MenuTreeItem[]>>('/menus/admin-tree', {
      params: { target_audience }
    })
    return response.data
  },

  // 메뉴 활성화/비활성화
  updateMenuStatus: async (id: number, is_active: boolean) => {
    const response = await api.put<ApiResponse<Menu>>(`/menus/${id}`, {
      is_active
    })
    return response.data
  },

  // 메뉴 생성
  createMenu: async (data: Omit<Menu, 'id' | 'created_at' | 'updated_at'>) => {
    const response = await api.post<ApiResponse<Menu>>('/menus', data)
    return response.data
  },

  // 메뉴 수정
  updateMenu: async (id: number, data: Partial<Menu>) => {
    const response = await api.put<ApiResponse<Menu>>(`/menus/${id}`, data)
    return response.data
  },

  // 메뉴 삭제
  deleteMenu: async (id: number) => {
    const response = await api.delete<ApiResponse<void>>(`/menus/${id}`)
    return response.data
  },

  // 사용자별 메뉴 권한 조회
  getUserMenuItems: async (userId: string) => {
    const response = await api.get<ApiResponse<UserMenuItem[]>>(`/menus/user/${userId}/items`)
    return response.data
  },

  // 사용자 메뉴 권한 업데이트
  updateUserMenuItem: async (userid: string, menuId: number, isEnabled: boolean) => {
    const response = await api.put(`/menus/user/${userid}/items/${menuId}`, {
      is_enabled: isEnabled
    })
    return response.data
  },

  // 선택된 메뉴를 모든 사용자에게 활성화
  enableMenuForAllUsers: async (menuId: number) => {
    const response = await api.put(`/menus/enable-for-all/${menuId}`)
    return response.data
  },

  // 경로 기반 메뉴 접근 권한 확인
  checkAccessByPath: async (path: string) => {
    const response = await api.get<
      ApiResponse<{
        registered: boolean
        hasAccess: boolean
        reason?: 'target_audience' | 'menu_permission'
        target_audience?: string
      }>
    >('/menus/access-by-path', { params: { path } })
    return response.data
  },
}

// 사용자 메뉴 권한 인터페이스
export interface UserMenuItem {
  id: string;
  user_id: string;
  menu_id: string;
  menu_name: string;
  menu_path: string;
  is_enabled: boolean;
  menu_type: string;
  sort_order?: number;
}