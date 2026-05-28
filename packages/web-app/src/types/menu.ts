// 메뉴 관련 타입 정의

export type MenuType = 'page' | 'folder' | 'link' | 'divider';
export type TargetAudience = 'all' | 'super_admin' | 'user' | 'branch_admin';

export interface Menu {
  id: string;
  parent_id?: string;
  name: string;
  name_en?: string;
  description?: string;
  menu_type: MenuType;
  url?: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  is_visible: boolean;
  target_audience: TargetAudience;
  required_permissions?: string[];
  level: number;
  created_at: string;
  updated_at: string;
  parent_name?: string;
  path?: string;
  depth?: number;
  children?: Menu[];
}

export interface CreateMenuRequest {
  parent_id?: string;
  name: string;
  name_en?: string;
  description?: string;
  menu_type?: MenuType;
  url?: string;
  icon?: string;
  sort_order?: number;
  target_audience?: TargetAudience;
  required_permissions?: string[];
}

export interface UpdateMenuRequest {
  name?: string;
  name_en?: string;
  description?: string;
  menu_type?: MenuType;
  url?: string;
  icon?: string;
  sort_order?: number;
  is_active?: boolean;
  is_visible?: boolean;
  target_audience?: TargetAudience;
  required_permissions?: string[];
}

export interface MenuPermission {
  menu_id: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  menu_name: string;
  menu_url?: string;
}

export interface MenuPermissionRequest {
  user_id: string;
  menu_id: string;
  can_view?: boolean;
  can_create?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
}

export interface RoleMenuPermissionRequest {
  role_name: string;
  menu_id: string;
  can_view?: boolean;
  can_create?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
}

export interface MenuOrderItem {
  menu_id: string;
  sort_order: number;
}

export interface ReorderMenusRequest {
  menu_orders: MenuOrderItem[];
}

export interface GetMenusQuery {
  target_audience?: TargetAudience;
  parent_id?: string;
  is_active?: boolean;
  is_visible?: boolean;
}

// 메뉴 유형별 라벨
export const MENU_TYPE_LABELS: Record<MenuType, string> = {
  page: '페이지',
  folder: '폴더',
  link: '링크',
  divider: '구분선'
};

// 대상 사용자별 라벨
export const TARGET_AUDIENCE_LABELS: Record<TargetAudience, string> = {
  all: '전체',
  super_admin: '슈퍼관리자',
  user: '일반 사용자',
  branch_admin: '지점 관리자'
};

// 기본 아이콘 목록
export const DEFAULT_MENU_ICONS = [
  'dashboard',
  'fitness_center',
  'video_library',
  'playlist_play',
  'history',
  'announcement',
  'admin_panel_settings',
  'settings',
  'people',
  'business',
  'analytics',
  'help',
  'info',
  'home',
  'menu',
  'folder',
  'link',
  'star',
  'favorite'
];