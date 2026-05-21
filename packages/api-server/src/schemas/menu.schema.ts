import { z } from 'zod';

// 메뉴 유형 및 대상 사용자 enum
export const MenuType = z.enum(['page', 'folder', 'link', 'divider']);
export const TargetAudience = z.enum(['all', 'admin', 'user', 'branch_admin']);

// 메뉴 생성 스키마
export const createMenuSchema = z.object({
  parent_id: z.string().uuid().optional(),
  name: z.string().min(1, '메뉴명은 필수입니다').max(100, '메뉴명은 100자를 초과할 수 없습니다'),
  name_en: z.string().max(100, '영문 메뉴명은 100자를 초과할 수 없습니다').optional(),
  description: z.string().optional(),
  menu_type: MenuType.default('page'),
  url: z.string().max(255, 'URL은 255자를 초과할 수 없습니다').optional(),
  icon: z.string().max(100, '아이콘은 100자를 초과할 수 없습니다').optional(),
  sort_order: z.number().int().min(0).default(0),
  target_audience: TargetAudience.default('all'),
  required_permissions: z.array(z.string()).optional()
});

// 메뉴 수정 스키마
export const updateMenuSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  name_en: z.string().max(100).optional(),
  description: z.string().optional(),
  menu_type: MenuType.optional(),
  url: z.string().max(255).optional(),
  icon: z.string().max(100).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  is_visible: z.boolean().optional(),
  target_audience: TargetAudience.optional(),
  required_permissions: z.array(z.string()).optional()
});

// 메뉴 권한 설정 스키마
export const menuPermissionSchema = z.object({
  user_id: z.string().uuid(),
  menu_id: z.string().uuid(),
  can_view: z.boolean().default(true),
  can_create: z.boolean().default(false),
  can_edit: z.boolean().default(false),
  can_delete: z.boolean().default(false)
});

// 역할별 메뉴 권한 설정 스키마
export const roleMenuPermissionSchema = z.object({
  role_name: z.string().min(1, '역할명은 필수입니다').max(50),
  menu_id: z.string().uuid(),
  can_view: z.boolean().default(true),
  can_create: z.boolean().default(false),
  can_edit: z.boolean().default(false),
  can_delete: z.boolean().default(false)
});

// 메뉴 순서 변경 스키마
export const reorderMenusSchema = z.object({
  menu_orders: z.array(z.object({
    menu_id: z.string().uuid(),
    sort_order: z.number().int().min(0)
  }))
});

// 메뉴 조회 쿼리 스키마
export const getMenusQuerySchema = z.object({
  target_audience: TargetAudience.optional(),
  parent_id: z.string().uuid().optional(),
  is_active: z.boolean().optional(),
  is_visible: z.boolean().optional()
});

// 메뉴 응답 타입
export type CreateMenuRequest = z.infer<typeof createMenuSchema>;
export type UpdateMenuRequest = z.infer<typeof updateMenuSchema>;
export type MenuPermissionRequest = z.infer<typeof menuPermissionSchema>;
export type RoleMenuPermissionRequest = z.infer<typeof roleMenuPermissionSchema>;
export type ReorderMenusRequest = z.infer<typeof reorderMenusSchema>;
export type GetMenusQuery = z.infer<typeof getMenusQuerySchema>;

export interface MenuResponse {
  id: string;
  parent_id?: string;
  name: string;
  name_en?: string;
  description?: string;
  menu_type: string;
  url?: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  is_visible: boolean;
  target_audience: string;
  required_permissions?: string[];
  level: number;
  created_at: string;
  updated_at: string;
  parent_name?: string;
  path?: string;
  depth?: number;
  children?: MenuResponse[];
}

export interface MenuPermissionResponse {
  menu_id: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  menu_name: string;
  menu_url?: string;
}