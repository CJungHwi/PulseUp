/**
 * 메뉴 서비스
 * 사용자 역할별 메뉴 데이터 관리
 */

import { Pool } from 'mysql2/promise'
import db from '../../lib/database.js'

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
  required_permissions: string | null
  target_audience: 'all' | 'admin' | 'user' | 'branch_admin'
  level: number
  created_at: string
  updated_at: string
  parent_name?: string
}

export interface MenuTreeItem extends Menu {
  children: MenuTreeItem[]
}

export interface GetMenusParams {
  user_role: string
  user_id: string
  include_inactive?: boolean
}

export interface MenuPermission {
  menu_id: string
  can_view: boolean
  can_create: boolean
  can_edit: boolean
  can_delete: boolean
  menu_name: string
  menu_url: string | null
}

class MenuService {
  public pool: Pool

  constructor() {
    this.pool = db
  }


  /**
   * 사용자별 활성 메뉴 트리 조회 (로그인시 사용)
   * user_menu_items 테이블에서 사용자별 메뉴를 가져옴
   */
  async getMenuTree(userId: string, targetAudience: string): Promise<MenuTreeItem[]> {
    try {
      // console.log('🔥 === getMenuTree 메서드 호출됨 ===')
      // console.log('🔥 userId:', userId)
      // console.log('🔥 targetAudience:', targetAudience)
      // console.info('user menu tree params:', { userId, targetAudience })

      // 사용자 역할이 'user'인 경우 user_menu_items 테이블에서 조회
      if (targetAudience === 'user') {
        console.info('사용자별 메뉴 테이블에서 조회 시작...')

        // 먼저 사용자가 접근 가능한 메뉴 ID들을 조회
        const [userMenuIds] = await this.pool.execute(`
          SELECT menu_id 
          FROM user_menu_items 
          WHERE user_id = ? AND is_enabled = TRUE
        `, [userId])

        const menuIds = (userMenuIds as any[]).map(row => row.menu_id)
        console.info('사용자 접근 가능 메뉴 ID들:', menuIds)

        if (menuIds.length === 0) {
          console.warn('사용자별 메뉴가 없습니다. 기본 메뉴로 fallback합니다.')
          return this.getDefaultMenuTree(targetAudience)
        }

        // 접근 가능한 메뉴들과 그 부모/자식들을 모두 포함하여 재귀 조회
        const placeholders = menuIds.map(() => '?').join(',')
        const [result] = await this.pool.execute(`
          WITH RECURSIVE menu_tree AS (
            -- 사용자가 접근 가능한 루트 메뉴들
            SELECT DISTINCT
              m.id,
              m.parent_id,
              m.name,
              m.name_en,
              m.description,
              m.menu_type,
              m.url,
              m.icon,
              m.sort_order,
              m.is_active,
              m.is_visible,
              m.required_permissions,
              m.target_audience,
              m.level,
              m.created_at,
              m.updated_at,
              0 as depth,
              CAST(COALESCE(m.sort_order, 999) AS CHAR(1000)) as sort_path
            FROM menus m
            WHERE m.parent_id IS NULL
              AND m.is_active = TRUE 
              AND m.is_visible = TRUE
              AND m.id IN (${placeholders})
            
            UNION ALL
            
            -- 하위 메뉴들 (재귀) - 부모가 이미 포함된 경우만
            SELECT DISTINCT
              child.id,
              child.parent_id,
              child.name,
              child.name_en,
              child.description,
              child.menu_type,
              child.url,
              child.icon,
              child.sort_order,
              child.is_active,
              child.is_visible,
              child.required_permissions,
              child.target_audience,
              child.level,
              child.created_at,
              child.updated_at,
              parent.depth + 1,
              CONCAT(parent.sort_path, '-', COALESCE(child.sort_order, 999))
            FROM menus child
            INNER JOIN menu_tree parent ON child.parent_id = parent.id
            WHERE child.is_active = TRUE 
              AND child.is_visible = TRUE
              AND child.id IN (${placeholders})
          )
          SELECT DISTINCT * FROM menu_tree 
          ORDER BY sort_path, depth, COALESCE(sort_order, 999), name
        `, [...menuIds, ...menuIds])

        console.info('사용자별 메뉴 테이블 조회 완료')

        const flatMenus = result as unknown as Menu[]
        console.info('조회된 메뉴 개수:', flatMenus.length)
        console.info('조회된 메뉴 상세:', flatMenus.map(m => ({ id: m.id, name: m.name, parent_id: m.parent_id, menu_type: m.menu_type })))

        if (flatMenus.length === 0) {
          console.warn('❌ 재귀 쿼리 결과가 없습니다. 기본 메뉴로 fallback합니다.')
          return this.getDefaultMenuTree(targetAudience)
        }

        const menuTree = this.buildMenuTreeFromFlat(flatMenus)
        console.info('✅ 사용자별 메뉴 트리 구성 완료:', menuTree.length)
        console.info('최종 메뉴 트리:', menuTree.map(m => ({ id: m.id, name: m.name, children_count: m.children.length })))

        return menuTree
      } else {
        // admin 등 다른 역할은 기존 방식 사용
        return this.getDefaultMenuTree(targetAudience)
      }
    } catch (error) {
      console.error('메뉴 트리 조회 실패:', error)
      throw error
    }
  }

  /**
   * 기본 메뉴 트리 조회 (target_audience 기반)
   */
  private async getDefaultMenuTree(targetAudience: string): Promise<MenuTreeItem[]> {
    console.info('기본 메뉴 트리 조회 시작...')

    // 재귀 CTE를 사용한 메뉴 트리 조회 (중복 제거)
    const [result] = await this.pool.execute(`
      WITH RECURSIVE menu_tree AS (
        -- 루트 메뉴들 (parent_id가 NULL인 것들)
        SELECT DISTINCT
          m.id,
          m.parent_id,
          m.name,
          m.name_en,
          m.description,
          m.menu_type,
          m.url,
          m.icon,
          m.sort_order,
          m.is_active,
          m.is_visible,
          m.required_permissions,
          m.target_audience,
          m.level,
          m.created_at,
          m.updated_at,
          0 as depth,
          CAST(COALESCE(m.sort_order, 999) AS CHAR(1000)) as sort_path
        FROM menus m
        WHERE m.parent_id IS NULL
          AND m.is_active = TRUE 
          AND m.is_visible = TRUE
          AND (m.target_audience = ? OR m.target_audience = 'all')
        
        UNION ALL
        
        -- 하위 메뉴들 (재귀)
        SELECT DISTINCT
          child.id,
          child.parent_id,
          child.name,
          child.name_en,
          child.description,
          child.menu_type,
          child.url,
          child.icon,
          child.sort_order,
          child.is_active,
          child.is_visible,
          child.required_permissions,
          child.target_audience,
          child.level,
          child.created_at,
          child.updated_at,
          parent.depth + 1,
          CONCAT(parent.sort_path, '-', COALESCE(child.sort_order, 999))
        FROM menus child
        INNER JOIN menu_tree parent ON child.parent_id = parent.id
        WHERE child.is_active = TRUE 
          AND child.is_visible = TRUE
          AND (child.target_audience = ? OR child.target_audience = 'all')
      )
      SELECT DISTINCT * FROM menu_tree 
      ORDER BY sort_path, depth, COALESCE(sort_order, 999), name
    `, [targetAudience, targetAudience])

    console.info('기본 메뉴 트리 조회 완료')
    const flatMenus = result as unknown as Menu[]
    console.info('조회된 메뉴 개수:', flatMenus.length)

    const menuTree = this.buildMenuTreeFromFlat(flatMenus)
    console.info('기본 메뉴 트리 구성 완료:', menuTree.length)

    return menuTree
  }

  /**
   * 관리자용 전체 메뉴 목록 조회
   * getMenuTree와 동일한 프로시저 사용 (sp_get_user_menu_tree)
   */
  async getAllMenusAdmin(userId: string, targetAudience: string = 'admin'): Promise<MenuTreeItem[]> {
    try {
      console.info('admin menu tree request:', { userId, targetAudience })
      return await this.getMenuTree(userId, targetAudience)
    } catch (error) {
      console.error('Error fetching all menus for admin:', error)
      throw new Error('관리자용 메뉴 목록 조회 중 오류가 발생했습니다.')
    }
  }

  // user_menu_permissions 테이블 사용 메서드 - 주석 처리
  /*
  /**
   * 사용자별 메뉴 권한 조회
   * procedures.sql의 sp_get_user_menu_permissions 프로시저 사용
   */
  /*
  async getUserMenuPermissions(userId: string, menuId?: string): Promise<MenuPermission[]> {
    try {
      const [result] = await this.pool.execute(
        'CALL sp_get_user_menu_permissions(?, ?)',
        [userId, menuId || null]
      )
      return result as MenuPermission[]
    } catch (error) {
      console.error('Error fetching user menu permissions:', error)
      throw new Error('사용자 메뉴 권한 조회 중 오류가 발생했습니다.')
    }
  }
  */

  /**
   * 메뉴 생성
   * procedures.sql의 sp_create_menu 프로시저 사용
   */
  async createMenu(menuData: {
    parent_id?: string
    name: string
    name_en?: string
    description?: string
    menu_type: 'page' | 'folder' | 'link' | 'divider'
    url?: string
    icon?: string
    sort_order: number
    target_audience: 'all' | 'admin' | 'user' | 'branch_admin'
    required_permissions?: string[]
  }): Promise<{ menu_id: string; status: string }> {
    try {
      const [result] = await this.pool.execute(
        'CALL sp_create_menu(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          menuData.parent_id || null,
          menuData.name,
          menuData.name_en || null,
          menuData.description || null,
          menuData.menu_type,
          menuData.url || null,
          menuData.icon || null,
          menuData.sort_order,
          menuData.target_audience,
          menuData.required_permissions ? JSON.stringify(menuData.required_permissions) : null
        ]
      )
      return (result as any)[0]
    } catch (error) {
      console.error('Error creating menu:', error)
      throw new Error('메뉴 생성 중 오류가 발생했습니다.')
    }
  }

  /**
   * 메뉴 수정
   * procedures.sql의 sp_update_menu 프로시저 사용
   */
  async updateMenu(
    menuId: string,
    menuData: {
      name: string
      name_en?: string
      description?: string
      menu_type: 'page' | 'folder' | 'link' | 'divider'
      url?: string
      icon?: string
      sort_order: number
      is_active: boolean
      is_visible: boolean
      target_audience: 'all' | 'admin' | 'user' | 'branch_admin'
      required_permissions?: string[]
    }
  ): Promise<{ status: string }> {
    try {
      const [result] = await this.pool.execute(
        'CALL sp_update_menu(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          menuId,
          menuData.name,
          menuData.name_en || null,
          menuData.description || null,
          menuData.menu_type,
          menuData.url || null,
          menuData.icon || null,
          menuData.sort_order,
          menuData.is_active,
          menuData.is_visible,
          menuData.target_audience,
          menuData.required_permissions ? JSON.stringify(menuData.required_permissions) : null
        ]
      )
      return (result as any)[0]
    } catch (error) {
      console.error('Error updating menu:', error)
      throw new Error('메뉴 수정 중 오류가 발생했습니다.')
    }
  }

  /**
   * 메뉴 삭제
   * procedures.sql의 sp_delete_menu 프로시저 사용
   */
  async deleteMenu(menuId: string): Promise<{ status: string }> {
    try {
      const [result] = await this.pool.execute('CALL sp_delete_menu(?)', [menuId])
      return (result as any)[0]
    } catch (error) {
      console.error('Error deleting menu:', error)
      throw new Error('메뉴 삭제 중 오류가 발생했습니다.')
    }
  }

  /**
   * 사용자 메뉴 권한 설정
   * procedures.sql의 sp_set_user_menu_permission 프로시저 사용
   */
  async setUserMenuPermission(
    userId: string,
    menuId: string,
    permissions: {
      can_view: boolean
      can_create: boolean
      can_edit: boolean
      can_delete: boolean
    },
    grantedBy: string
  ): Promise<{ status: string }> {
    try {
      const [result] = await this.pool.execute(
        'CALL sp_set_user_menu_permission(?, ?, ?, ?, ?, ?, ?)',
        [
          userId,
          menuId,
          permissions.can_view,
          permissions.can_create,
          permissions.can_edit,
          permissions.can_delete,
          grantedBy
        ]
      )
      return (result as any)[0]
    } catch (error) {
      console.error('Error setting user menu permission:', error)
      throw new Error('사용자 메뉴 권한 설정 중 오류가 발생했습니다.')
    }
  }

  /**
   * 역할별 메뉴 권한 설정
   * procedures.sql의 sp_set_role_menu_permission 프로시저 사용
   */
  async setRoleMenuPermission(
    roleName: string,
    menuId: string,
    permissions: {
      can_view: boolean
      can_create: boolean
      can_edit: boolean
      can_delete: boolean
    }
  ): Promise<{ status: string }> {
    try {
      const [result] = await this.pool.execute(
        'CALL sp_set_role_menu_permission(?, ?, ?, ?, ?, ?)',
        [
          roleName,
          menuId,
          permissions.can_view,
          permissions.can_create,
          permissions.can_edit,
          permissions.can_delete
        ]
      )
      return (result as any)[0]
    } catch (error) {
      console.error('Error setting role menu permission:', error)
      throw new Error('역할별 메뉴 권한 설정 중 오류가 발생했습니다.')
    }
  }

  /**
   * 메뉴 순서 변경
   * procedures.sql의 sp_reorder_menus 프로시저 사용
   */
  async reorderMenus(menuOrders: { menu_id: string; sort_order: number }[]): Promise<{ updated_count: number; status: string }> {
    try {
      const [result] = await this.pool.execute(
        'CALL sp_reorder_menus(?)',
        [JSON.stringify(menuOrders)]
      )
      return (result as any)[0]
    } catch (error) {
      console.error('Error reordering menus:', error)
      throw new Error('메뉴 순서 변경 중 오류가 발생했습니다.')
    }
  }



  /**
   * 플랫 메뉴 배열을 트리 구조로 변환
   */
  private buildMenuTree(menus: Menu[]): MenuTreeItem[] {
    const menuMap = new Map<string, MenuTreeItem>()
    const rootMenus: MenuTreeItem[] = []

    // 모든 메뉴를 Map에 저장하고 children 배열 초기화
    menus.forEach(menu => {
      menuMap.set(menu.id, { ...menu, children: [] })
    })

    // 부모-자식 관계 설정
    menus.forEach(menu => {
      const menuItem = menuMap.get(menu.id)!

      if (menu.parent_id && menuMap.has(menu.parent_id)) {
        // 부모 메뉴가 있는 경우 부모의 children에 추가
        const parentMenu = menuMap.get(menu.parent_id)!
        parentMenu.children.push(menuItem)
      } else {
        // 최상위 메뉴인 경우 rootMenus에 추가
        rootMenus.push(menuItem)
      }
    })

    // 각 레벨에서 sort_order로 정렬
    const sortMenus = (menus: MenuTreeItem[]) => {
      menus.sort((a, b) => a.sort_order - b.sort_order)
      menus.forEach(menu => {
        if (menu.children.length > 0) {
          sortMenus(menu.children)
        }
      })
    }

    sortMenus(rootMenus)
    return rootMenus
  }

  /**
   * 플랫 메뉴 배열을 트리 구조로 변환 (중복 제거)
   */
  private buildMenuTreeFromFlat(menus: Menu[]): MenuTreeItem[] {
    const menuMap = new Map<string, MenuTreeItem>()
    const rootMenus: MenuTreeItem[] = []

    // 중복 제거하면서 Map에 저장
    menus.forEach(menu => {
      if (!menuMap.has(menu.id)) {
        const treeItem: MenuTreeItem = { ...menu, children: [] }
        menuMap.set(menu.id, treeItem)
      }
    })

    // 부모-자식 관계 설정
    menuMap.forEach(menuItem => {
      if (menuItem.parent_id && menuMap.has(menuItem.parent_id)) {
        const parent = menuMap.get(menuItem.parent_id)!
        if (!parent.children.find(c => c.id === menuItem.id)) {
          parent.children.push(menuItem)
        }
      } else if (!menuItem.parent_id) {
        // 루트 메뉴
        if (!rootMenus.find(r => r.id === menuItem.id)) {
          rootMenus.push(menuItem)
        }
      }
    })

    // 정렬
    const sortMenus = (items: MenuTreeItem[]) => {
      items.sort((a, b) => a.sort_order - b.sort_order)
      items.forEach(item => {
        if (item.children.length > 0) {
          sortMenus(item.children)
        }
      })
    }

    sortMenus(rootMenus)
    return rootMenus
  }

  /**
   * 사용자가 특정 메뉴에 접근할 수 있는지 확인
   */
  async canUserAccessMenu(userId: string, userRole: string, menuId: string): Promise<boolean> {
    try {
      console.info('메뉴 접근 권한 확인:', { userId, userRole, menuId })

      // 먼저 메뉴의 target_audience 확인
      const [menuResult] = await this.pool.execute(
        'SELECT target_audience, name FROM menus WHERE id = ? AND is_active = TRUE AND is_visible = TRUE',
        [menuId]
      )

      const menu = (menuResult as any[])[0]
      if (!menu) {
        console.warn('메뉴를 찾을 수 없음:', menuId)
        return false
      }

      console.info('메뉴 정보:', { name: menu.name, target_audience: menu.target_audience })

      // target_audience 체크
      if (menu.target_audience === 'all') {
        console.info('모든 사용자 접근 가능')
        return true
      }
      if (menu.target_audience === userRole) {
        console.info('역할 일치로 접근 가능')
        return true
      }
      if (userRole === 'admin' && menu.target_audience === 'user') {
        console.info('관리자는 사용자 메뉴 접근 가능')
        return true
      }
      if (userRole === 'super_admin' && ['user', 'admin'].includes(menu.target_audience)) {
        console.info('최고관리자는 모든 메뉴 접근 가능')
        return true
      }

      console.warn('메뉴 접근 권한 없음')
      return false

    } catch (error) {
      console.error('Error checking user menu access:', error)
      return false
    }
  }

  /**
   * 기본 메뉴 데이터 초기화 (프로시저에서 처리되므로 단순화)
   */
  async initializeDefaultMenus(): Promise<void> {
    // console.log('메뉴 초기화는 데이터베이스에서 직접 관리됩니다.')
    // 프로시저에서 메뉴 데이터를 처리하므로 별도 초기화 불필요
  }
}

export const menuService = new MenuService()
