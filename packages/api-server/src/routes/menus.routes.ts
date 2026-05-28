import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware.js'
import { callProcedure, executeQuery } from '../lib/database.js'
import { successResponse, errorResponse } from '../utils/response.util.js'
import {
  canAccessByTargetAudience,
  filterMenuTreeByTargetAudience,
  menuMatchesAudienceCsv,
  normalizeMenuPath,
} from '../lib/menu-audience.util.js'

const router = Router()

// 메뉴 목록 조회 (재귀 구조)
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const { target_audience, parent_id } = req.query

    // 메뉴 조회 프로시저 호출
    const results = await callProcedure('sp_GetMenus', [
      target_audience || null,
      parent_id || null
    ])

    const menus = results[0] || []

    res.json(successResponse(menus))
  } catch (error: any) {
    console.error('Get menus error:', error)
    res.status(500).json(errorResponse('메뉴 목록 조회에 실패했습니다'))
  }
})

// 메뉴 트리 구조 조회 (all -> role folder -> page 재귀)
router.get('/tree', authenticateToken, async (req: any, res) => {
  try {
    const { target_audience } = req.query
    const userRole = req.user?.role || 'user'
    const userid = req.user?.userid

    if (!userid) {
      return res.status(400).json(errorResponse('사용자 ID가 필요합니다'))
    }

    const childrenAudience = resolveChildrenAudience(
      userRole,
      typeof target_audience === 'string' ? target_audience : undefined
    )

    // 모든 역할: user_menu_items.is_enabled 반영 (super_admin은 audience=null로 전체 범위)
    const rootResults = await callProcedure('sp_GetUserMenus', [userid, childrenAudience, 0])
    const rootMenus = rootResults[0] || []

    const menuTree = await Promise.all(
      rootMenus.map(async (rootMenu: any) => {
        const children = await getUserMenuChildren(rootMenu.id, childrenAudience, userid)
        return {
          ...rootMenu,
          children
        }
      })
    )

    const filteredMenuTree = filterEmptyFolders(
      filterMenuTreeByTargetAudience(menuTree, userRole)
    )
    res.json(successResponse(filteredMenuTree))
  } catch (error: any) {
    console.error('Get menu tree error:', error)
    res.status(500).json(errorResponse('메뉴 트리 조회에 실패했습니다'))
  }
})

// 메뉴 관리 페이지용 트리 구조 조회 (menus 테이블만 사용, user_menu_items 조인 안함)
router.get('/admin-tree', authenticateToken, async (req: any, res) => {
  try {
    const { target_audience } = req.query
    const childrenAudience = resolveAdminTreeAudience(
      typeof target_audience === 'string' ? target_audience : undefined
    )
    const menuTree = await buildAdminMenuTree(childrenAudience)
    res.json(successResponse(menuTree))
  } catch (error: any) {
    console.error('Get admin menu tree error:', error)
    res.status(500).json(errorResponse('관리 페이지 메뉴 트리 조회에 실패했습니다'))
  }
})

// 경로 기반 메뉴 접근 권한 확인 (target_audience + user_menu_items.is_enabled)
router.get('/access-by-path', authenticateToken, async (req: any, res) => {
  try {
    const rawPath = typeof req.query.path === 'string' ? req.query.path : ''
    const path = normalizeMenuPath(rawPath)
    const userRole = req.user?.role || 'user'
    const userid = req.user?.userid

    if (!path) {
      return res.status(400).json(errorResponse('path가 필요합니다'))
    }

    const menus = await executeQuery(
      `SELECT id, menu_type, target_audience
       FROM menus
       WHERE url = ? AND is_active = TRUE AND is_visible = TRUE
       ORDER BY FIELD(target_audience, ?, 'all') DESC, sort_order ASC, id ASC`,
      [path, userRole]
    )

    if (!menus.length) {
      return res.json(successResponse({ registered: false, hasAccess: true }))
    }

    const menu = menus.find((item: any) => canAccessByTargetAudience(userRole, item.target_audience))

    if (!menu) {
      return res.json(successResponse({
        registered: true,
        hasAccess: false,
        reason: 'target_audience',
        target_audience: menus.map((item: any) => item.target_audience).join(','),
      }))
    }

    if (menu.menu_type === 'page' && userid) {
      const permissions = await executeQuery(
        `SELECT is_enabled
         FROM user_menu_items
         WHERE user_id = ? AND menu_id = ?
         LIMIT 1`,
        [userid, menu.id]
      )

      if (!permissions.length || !permissions[0].is_enabled) {
        return res.json(successResponse({
          registered: true,
          hasAccess: false,
          reason: 'menu_permission',
          target_audience: menu.target_audience,
        }))
      }
    }

    return res.json(successResponse({
      registered: true,
      hasAccess: true,
      target_audience: menu.target_audience,
    }))
  } catch (error) {
    console.error('access-by-path error:', error)
    res.status(500).json(errorResponse('메뉴 접근 권한 확인에 실패했습니다'))
  }
})

// 메뉴 ID 기반 접근 권한 확인
router.get('/:menuId/access', authenticateToken, async (req: any, res) => {
  try {
    const menuId = parseInt(req.params.menuId, 10)
    const userRole = req.user?.role || 'user'
    const userid = req.user?.userid

    if (Number.isNaN(menuId)) {
      return res.status(400).json(errorResponse('유효하지 않은 menuId입니다'))
    }

    const menus = await executeQuery(
      `SELECT id, menu_type, target_audience
       FROM menus
       WHERE id = ? AND is_active = TRUE AND is_visible = TRUE
       LIMIT 1`,
      [menuId]
    )

    if (!menus.length) {
      return res.json(successResponse({ hasAccess: false }))
    }

    const menu = menus[0]

    if (!canAccessByTargetAudience(userRole, menu.target_audience)) {
      return res.json(successResponse({ hasAccess: false, reason: 'target_audience' }))
    }

    if (menu.menu_type === 'page' && userid) {
      const permissions = await executeQuery(
        `SELECT is_enabled FROM user_menu_items WHERE user_id = ? AND menu_id = ? LIMIT 1`,
        [userid, menu.id]
      )
      const hasAccess = permissions.length > 0 && !!permissions[0].is_enabled
      return res.json(successResponse({ hasAccess }))
    }

    return res.json(successResponse({ hasAccess: true }))
  } catch (error) {
    console.error('menu access check error:', error)
    res.status(500).json(errorResponse('메뉴 접근 권한 확인에 실패했습니다'))
  }
})

// 재귀적으로 하위 메뉴 조회 (관리자용 — folder/page 모두 target_audience strict 필터)
async function getMenuChildren(parentId: number, targetAudience: string | null): Promise<any[]> {
  try {
    const results = await callProcedure('sp_GetMenus', [targetAudience, parentId])
    const children = (results[0] || []).filter(
      (child: any) => !targetAudience || menuMatchesAudienceCsv(child.target_audience, targetAudience)
    )

    return await Promise.all(
      children.map(async (child: any) => {
        const grandChildren =
          child.menu_type === 'folder'
            ? await getMenuChildren(child.id, targetAudience)
            : []

        return {
          ...child,
          children: grandChildren,
        }
      })
    )
  } catch (error) {
    console.error('Get menu children error:', error)
    return []
  }
}

// 재귀적으로 하위 메뉴 조회 (사용자별 - user_menu_items와 조인)
async function getUserMenuChildren(
  parentId: number,
  targetAudience: string | null,
  userid: string
): Promise<any[]> {
  try {
    const results = await callProcedure('sp_GetUserMenus', [userid, targetAudience, parentId])
    const children = results[0] || []

    // 각 자식 메뉴에 대해 다시 재귀 호출
    return await Promise.all(
      children.map(async (child: any) => {
        let grandChildren: any[] = []

        // folder 타입인 경우 page 타입의 하위 메뉴 조회
        if (child.menu_type === 'folder') {
          grandChildren = await getUserMenuChildren(child.id, targetAudience, userid)
        }

        return {
          ...child,
          children: grandChildren
        }
      })
    )
  } catch (error) {
    console.error('Get user menu children error:', error)
    return []
  }
}

// 메뉴 업데이트 (상태, 메뉴명, 정렬순서)
router.put('/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params
    const { is_active, name, sort_order } = req.body

    // name이 있으면 메뉴명 업데이트
    if (name !== undefined) {
      const updateNameQuery = `
        UPDATE menus 
        SET name = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `
      await executeQuery(updateNameQuery, [name, parseInt(id)])
    }

    // is_active가 있으면 메뉴 상태 업데이트
    if (is_active !== undefined) {
      const results = await callProcedure('sp_UpdateMenuStatus', [
        parseInt(id), // bigint이므로 parseInt 사용
        is_active
      ])
    }

    // sort_order가 있으면 정렬순서 업데이트 (같은 레벨 내 이동용)
    if (sort_order !== undefined && typeof sort_order === 'number') {
      const updateSortQuery = `
        UPDATE menus 
        SET sort_order = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `
      await executeQuery(updateSortQuery, [sort_order, parseInt(id)])
    }

    res.json(successResponse({ id, name, is_active, sort_order }))
  } catch (error: any) {
    console.error('Update menu error:', error)
    res.status(500).json(errorResponse('메뉴 업데이트에 실패했습니다'))
  }
})

// 메뉴 생성
router.post('/', authenticateToken, async (req: any, res) => {
  try {
    const {
      name,
      path,
      icon,
      parent_id,
      order_index,
      target_audience,
      menu_type,
      is_active
    } = req.body

    // parent_id가 없으면 0으로 설정 (최상위 메뉴)
    const normalizedParentId = (parent_id === undefined || parent_id === null || parent_id === '') ? 0 : parent_id

    const results = await callProcedure('sp_CreateMenu', [
      name,
      path || null,
      icon || null,
      normalizedParentId,
      order_index || 0,
      target_audience,
      menu_type || 'page',
      is_active !== undefined ? is_active : true
    ])

    const newMenu = results[0]?.[0]

    res.status(201).json(successResponse(newMenu))
  } catch (error: any) {
    console.error('Create menu error:', error)
    res.status(500).json(errorResponse('메뉴 생성에 실패했습니다'))
  }
})

// 사용자별 메뉴 권한 조회
router.get('/user/:userid/items', authenticateToken, async (req, res) => {
  try {
    const { userid } = req.params;

    // sp_GetUserMenuItems 프로시저 호출
    const result = await callProcedure('sp_GetUserMenuItems', [userid]);

    // 프로시저 결과는 배열의 첫 번째 요소에 있음
    const menuItems = result[0] || [];

    res.json(successResponse(menuItems));
  } catch (error) {
    console.error('사용자 메뉴 권한 조회 실패:', error);
    res.status(500).json(errorResponse('사용자 메뉴 권한 조회에 실패했습니다.'));
  }
});

// 사용자 메뉴 권한 업데이트
router.put('/user/:userid/items/:menuId', authenticateToken, async (req, res) => {
  try {
    const { userid, menuId } = req.params;
    const { is_enabled } = req.body;

    // sp_UpdateUserMenuItems 프로시저 호출
    const result = await callProcedure('sp_UpdateUserMenuItems', [
      userid,
      parseInt(menuId),
      is_enabled
    ]);

    res.json(successResponse(result[0]?.[0] || { userid, menuId, is_enabled }));
  } catch (error) {
    console.error('사용자 메뉴 권한 업데이트 실패:', error);
    res.status(500).json(errorResponse('사용자 메뉴 권한 업데이트에 실패했습니다.'));
  }
});

// 선택된 메뉴를 모든 사용자에게 활성화
router.put('/enable-for-all/:menuId', authenticateToken, async (req, res) => {
  try {
    const { menuId } = req.params;

    // sp_EnableMenuForAllUsers 프로시저 호출
    const result = await callProcedure('sp_EnableMenuForAllUsers', [
      parseInt(menuId)
    ]);

    const resultData = result[0]?.[0];
    res.json(successResponse(resultData));
  } catch (error) {
    console.error('모든 사용자 메뉴 활성화 실패:', error);
    res.status(500).json(errorResponse('모든 사용자 메뉴 활성화에 실패했습니다.'));
  }
});

export { router as menusRoutes }

/** 역할/쿼리 파라미터에 따른 하위 메뉴 audience 필터 */
function resolveChildrenAudience(userRole: string, targetAudience?: string): string | null {
  if (targetAudience === 'all') return null
  if (targetAudience && targetAudience.includes(',')) return targetAudience.trim()
  if (targetAudience === 'user' || targetAudience === 'branch_admin' || targetAudience === 'super_admin') {
    return targetAudience
  }
  if (userRole === 'super_admin') return null
  if (userRole === 'branch_admin') return 'user,branch_admin'
  return 'user'
}

/** 메뉴 관리 화면 탭별 audience (누적: user → +branch_admin → +super_admin) */
function resolveAdminTreeAudience(targetAudience?: string): string {
  const raw = targetAudience?.trim() || 'user'
  if (raw === 'all') {
    return 'user,branch_admin,super_admin'
  }
  return raw
}

/** 메뉴 관리 페이지용 트리 — folder/page 모두 target_audience strict 필터 */
async function buildAdminMenuTree(childrenAudience: string): Promise<any[]> {
  const roots = await getMenusAtParentLevel(childrenAudience)

  const tree = await Promise.all(
    roots.map(async (menu: any) => {
      const children =
        menu.menu_type === 'folder'
          ? await getMenuChildren(menu.id, childrenAudience)
          : []

      return { ...menu, children }
    })
  )

  return sortMenusByOrder(filterEmptyFolders(tree))
}

async function getMenusAtParentLevel(childrenAudience: string): Promise<any[]> {
  const nullRootResults = await callProcedure('sp_GetMenus', [childrenAudience, null])
  const zeroRootResults = await callProcedure('sp_GetMenus', [childrenAudience, '0'])
  const seenIds = new Set<number>()

  return [...(nullRootResults[0] || []), ...(zeroRootResults[0] || [])].filter((menu: any) => {
    if (seenIds.has(menu.id)) return false
    seenIds.add(menu.id)
    return menuMatchesAudienceCsv(menu.target_audience, childrenAudience)
  })
}

function sortMenusByOrder(menus: any[]): any[] {
  return [...menus].sort(
    (a, b) =>
      (a.order_index ?? a.sort_order ?? 0) - (b.order_index ?? b.sort_order ?? 0)
  )
}

// 빈 폴더 제거 헬퍼 함수
function filterEmptyFolders(menus: any[]): any[] {
  return menus.filter(menu => {
    if (menu.menu_type === 'folder') {
      // 자식이 있으면 재귀적으로 필터링
      if (menu.children && menu.children.length > 0) {
        menu.children = filterEmptyFolders(menu.children)
        // 필터링 후에도 자식이 남아있으면 유지
        return menu.children.length > 0
      }
      // 자식이 없거나 필터링 후 모두 제거된 경우 폴더 제거
      return false
    }
    return true // 페이지는 유지
  })
}