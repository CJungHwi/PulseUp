import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware.js'
import { callProcedure, executeQuery } from '../lib/database.js'
import { successResponse, errorResponse } from '../utils/response.util.js'

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

// 메뉴 트리 구조 조회 (all -> user/admin folder -> page 재귀)
router.get('/tree', authenticateToken, async (req: any, res) => {
  try {
    const { target_audience } = req.query
    const userRole = req.user?.role || 'user'
    const userid = req.user?.userid

    // target_audience 파라미터를 우선시하고, 없으면 사용자 역할에 따라 결정
    let childrenAudience = 'user'
    if (target_audience === 'admin') {
      childrenAudience = 'admin'
    } else if (target_audience === 'user') {
      childrenAudience = 'user'
    } else {
      // target_audience가 명시되지 않은 경우에만 사용자 역할로 결정
      if (userRole === 'admin' || userRole === 'super_admin') {
        childrenAudience = 'admin'
      }
    }

    //console.log('메뉴 트리 요청:', { target_audience, userRole, childrenAudience, userid })

    // 모든 사용자(관리자 포함)가 user_menu_items와 조인하여 조회하도록 변경
    if (!userid) {
      return res.status(400).json(errorResponse('사용자 ID가 필요합니다'))
    }

    // 관리자와 일반 사용자 모두 동일한 로직 사용 (user_menu_items 권한 확인)
    // 1. root 메뉴들 조회 - 사용자별 (parent_id = 0)
    // target_audience를 'all'로 고정하면 user/admin 메뉴가 안 나오므로 childrenAudience 사용
    const rootResults = await callProcedure('sp_GetUserMenus', [userid, childrenAudience, 0])
    const rootMenus = rootResults[0] || []

    // 2. 각 root 메뉴에 대해 재귀적으로 하위 메뉴 조회 - 사용자별
    const menuTree = await Promise.all(
      rootMenus.map(async (rootMenu: any) => {
        const children = await getUserMenuChildren(rootMenu.id, childrenAudience, userid)
        return {
          ...rootMenu,
          children
        }
      })
    )

    // 자식이 없는 빈 폴더 제거
    const filteredMenuTree = filterEmptyFolders(menuTree)

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
    const userRole = req.user?.role || 'user'

    // target_audience 파라미터를 우선시하고, 없으면 사용자 역할에 따라 결정
    let childrenAudience = 'user'
    if (target_audience === 'admin') {
      childrenAudience = 'admin'
    } else if (target_audience === 'user') {
      childrenAudience = 'user'
    } else {
      // target_audience가 명시되지 않은 경우에만 사용자 역할로 결정
      if (userRole === 'admin' || userRole === 'super_admin') {
        childrenAudience = 'admin'
      }
    }

    //console.log('관리 페이지 메뉴 트리 요청:', { target_audience, userRole, childrenAudience })

    // 관리 페이지에서는 항상 sp_GetMenus 사용 (user_menu_items 조인 안함)
    // 1. root 메뉴들 (target_audience = 'all') 조회 (parent_id = 0)
    const rootResults = await callProcedure('sp_GetMenus', ['all', 0])
    const rootMenus = rootResults[0] || []

    // 2. 각 root 메뉴에 대해 재귀적으로 하위 메뉴 조회
    const menuTree = await Promise.all(
      rootMenus.map(async (rootMenu: any) => {
        const children = await getMenuChildren(rootMenu.id, childrenAudience)
        return {
          ...rootMenu,
          children
        }
      })
    )
    res.json(successResponse(menuTree))
  } catch (error: any) {
    console.error('Get admin menu tree error:', error)
    res.status(500).json(errorResponse('관리 페이지 메뉴 트리 조회에 실패했습니다'))
  }
})

// 재귀적으로 하위 메뉴 조회 (관리자용)
async function getMenuChildren(parentId: number, targetAudience: string): Promise<any[]> {
  try {
    const results = await callProcedure('sp_GetMenus', [targetAudience, parentId])
    const children = results[0] || []

    // 각 자식 메뉴에 대해 다시 재귀 호출
    return await Promise.all(
      children.map(async (child: any) => {
        let grandChildren: any[] = []

        // folder 타입인 경우 page 타입의 하위 메뉴 조회
        if (child.menu_type === 'folder') {
          grandChildren = await getMenuChildren(child.id, targetAudience)
        }

        return {
          ...child,
          children: grandChildren
        }
      })
    )
  } catch (error) {
    console.error('Get menu children error:', error)
    return []
  }
}

// 재귀적으로 하위 메뉴 조회 (사용자별 - user_menu_items와 조인)
async function getUserMenuChildren(parentId: number, targetAudience: string, userid: string): Promise<any[]> {
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