/**
 * 메뉴 관련 타입 정의
 */

export interface Menu {
  id: string
  parent_id: string | null
  name: string
  name_en: string | null
  description: string | null
  menu_type: 'page' | 'folder' | 'link' | 'divider'
  url: string | null
  icon: string | null
  sort_order: number
  is_active: boolean
  is_visible: boolean
  required_permissions: string[] | null
  target_audience: 'all' | 'admin' | 'user' | 'branch_admin'
  level: number
  created_at: string
  updated_at: string
}

export interface MenuTreeItem {
  id: string
  parent_id: string | null
  name: string
  name_en: string | null
  description: string | null
  menu_type: 'page' | 'folder' | 'link' | 'divider'
  url: string | null
  path: string | null
  icon: string | null
  sort_order: number
  order_index: number
  is_active: boolean
  is_visible: boolean
  required_permissions: string[] | null
  target_audience: 'all' | 'admin' | 'user' | 'branch_admin'
  level: number
  created_at: string
  updated_at: string
  children: MenuTreeItem[]
}

export interface MenuPermission {
  can_view: boolean
  can_create: boolean
  can_edit: boolean
  can_delete: boolean
}

export interface GetMenusParams {
  user_role: string
  user_id?: string
  include_inactive?: boolean
}

export interface MenuApiResponse {
  success: boolean
  data: Menu[]
  message?: string
}
