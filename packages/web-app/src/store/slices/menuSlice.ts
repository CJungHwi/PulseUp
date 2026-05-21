/**
 * 메뉴 관련 Redux 스토어
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import api from '../../services/api'
import { MenuTreeItem } from '../../types/menu.types'

export interface MenuPermission {
  menu_id: string
  can_view: boolean
  can_create: boolean
  can_edit: boolean
  can_delete: boolean
  menu_name: string
  menu_url: string | null
}

interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

// 비동기 액션: 메뉴 트리 로드
export const loadMenuTree = createAsyncThunk(
  'menu/loadMenuTree',
  async (userRole: string | undefined, { rejectWithValue }) => {
    try {
      // 사용자 역할을 target_audience로 매핑
      const targetAudience = userRole === 'super_admin' ? 'admin' : userRole
      const params = targetAudience ? { target_audience: targetAudience } : {}

      //console.log('📡 메뉴 트리 API 요청:', { userRole, targetAudience, params })

      const response = await api.get<ApiResponse<MenuTreeItem[]>>('/menus/tree', { params })
      //console.log('📡 메뉴 트리 API 응답:', response.data)

      if (response.data.success) {
        //console.log('✅ 메뉴 트리 데이터 수신:', response.data.data?.length, '개 메뉴', response.data.data)
        return response.data.data
      } else {
        console.error('❌ 메뉴 트리 API 실패:', response.data.message)
        throw new Error(response.data.message || '메뉴 트리 조회에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('Menu tree fetch error:', error)
      return rejectWithValue(
        error.response?.data?.message ||
        error.message ||
        '메뉴 트리 조회 중 오류가 발생했습니다.'
      )
    }
  },
  {
    condition: (userRole, { getState }) => {
      // Redux Toolkit의 기본 중복 방지 기능 사용
      const state = getState() as { menus: MenuState }

      // 이미 로딩 중이면 요청하지 않음
      if (state.menus.menuTreeLoading) {
        //console.log('⚠️ 메뉴 트리 로딩 중이므로 요청 스킵')
        return false
      }

      // 이미 메뉴가 로드되어 있으면 요청하지 않음
      if (state.menus.menuTree && state.menus.menuTree.length > 0) {
        //console.log('ℹ️ 메뉴 트리가 이미 로드되어 있음')
        return false
      }

      return true
    }
  }
)

// 비동기 액션: 메뉴 권한 로드
export const loadMenuPermissions = createAsyncThunk(
  'menu/loadMenuPermissions',
  async (menuId: string | undefined, { rejectWithValue }) => {
    try {
      const params = menuId ? { menu_id: menuId } : {}
      const response = await api.get<ApiResponse<MenuPermission[]>>('/menus/my-permissions', { params })

      if (response.data.success) {
        return response.data.data
      } else {
        throw new Error(response.data.message || '메뉴 권한 조회에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('Menu permissions fetch error:', error)
      return rejectWithValue(
        error.response?.data?.message ||
        error.message ||
        '메뉴 권한 조회 중 오류가 발생했습니다.'
      )
    }
  }
)

// 비동기 액션: 메뉴 접근 권한 확인
export const checkMenuAccess = createAsyncThunk(
  'menu/checkMenuAccess',
  async (menuId: string, { rejectWithValue }) => {
    try {
      const response = await api.get<ApiResponse<{ hasAccess: boolean }>>(`/menus/${menuId}/access`)

      if (response.data.success) {
        return { menuId, hasAccess: response.data.data.hasAccess }
      } else {
        return { menuId, hasAccess: false }
      }
    } catch (error: any) {
      console.error('Menu access check error:', error)
      return rejectWithValue(
        error.response?.data?.message ||
        error.message ||
        '메뉴 접근 권한 확인에 실패했습니다.'
      )
    }
  }
)

// 인터페이스 정의
interface MenuState {
  // 메뉴 트리
  menuTree: MenuTreeItem[]
  menuTreeLoading: boolean
  menuTreeError: string | null

  // 메뉴 권한
  permissions: MenuPermission[]
  permissionsLoading: boolean
  permissionsError: string | null

  // 메뉴 접근 권한 캐시
  accessCache: Record<string, boolean>

  // 현재 활성 메뉴
  currentMenuId: string | null

  // 로딩 상태
  loading: boolean
  error: string | null
}

// 초기 상태
const initialState: MenuState = {
  menuTree: [],
  menuTreeLoading: false,
  menuTreeError: null,

  permissions: [],
  permissionsLoading: false,
  permissionsError: null,

  accessCache: {},

  currentMenuId: null,

  loading: false,
  error: null
}

// 슬라이스 생성
const menuSlice = createSlice({
  name: 'menu',
  initialState,
  reducers: {
    // 현재 메뉴 설정
    setCurrentMenu: (state, action: PayloadAction<string | null>) => {
      state.currentMenuId = action.payload
    },

    // 메뉴 트리 초기화
    clearMenuTree: (state) => {
      state.menuTree = []
      state.menuTreeError = null
    },

    // 권한 초기화
    clearPermissions: (state) => {
      state.permissions = []
      state.permissionsError = null
    },

    // 접근 권한 캐시 초기화
    clearAccessCache: (state) => {
      state.accessCache = {}
    },

    // 모든 메뉴 상태 초기화
    resetMenuState: (state) => {
      Object.assign(state, initialState)
    },

    // 에러 초기화
    clearError: (state) => {
      state.error = null
      state.menuTreeError = null
      state.permissionsError = null
    }
  },
  extraReducers: (builder) => {
    // 메뉴 트리 로드
    builder
      .addCase(loadMenuTree.pending, (state) => {
        state.menuTreeLoading = true
        state.menuTreeError = null
      })
      .addCase(loadMenuTree.fulfilled, (state, action) => {
        state.menuTreeLoading = false
        state.menuTree = action.payload
        state.menuTreeError = null
      })
      .addCase(loadMenuTree.rejected, (state, action) => {
        state.menuTreeLoading = false
        state.menuTreeError = action.payload as string
      })

    // 메뉴 권한 로드
    builder
      .addCase(loadMenuPermissions.pending, (state) => {
        state.permissionsLoading = true
        state.permissionsError = null
      })
      .addCase(loadMenuPermissions.fulfilled, (state, action) => {
        state.permissionsLoading = false
        state.permissions = action.payload
        state.permissionsError = null
      })
      .addCase(loadMenuPermissions.rejected, (state, action) => {
        state.permissionsLoading = false
        state.permissionsError = action.payload as string
      })

    // 메뉴 접근 권한 확인
    builder
      .addCase(checkMenuAccess.fulfilled, (state, action) => {
        const { menuId, hasAccess } = action.payload
        state.accessCache[menuId] = hasAccess
      })
      .addCase(checkMenuAccess.rejected, (state, action) => {
        // 접근 권한 확인 실패 시 false로 설정
        // menuId는 meta.arg에서 가져올 수 있음
        if (action.meta.arg) {
          state.accessCache[action.meta.arg] = false
        }
      })
  }
})

// 액션 내보내기
export const {
  setCurrentMenu,
  clearMenuTree,
  clearPermissions,
  clearAccessCache,
  resetMenuState,
  clearError
} = menuSlice.actions

// 셀렉터
export const selectMenuTree = (state: { menus: MenuState }) => state.menus?.menuTree || []
export const selectMenuTreeLoading = (state: { menus: MenuState }) => state.menus?.menuTreeLoading || false
export const selectMenuTreeError = (state: { menus: MenuState }) => state.menus?.menuTreeError || null

export const selectMenuPermissions = (state: { menus: MenuState }) => state.menus?.permissions || []
export const selectPermissionsLoading = (state: { menus: MenuState }) => state.menus?.permissionsLoading || false
export const selectPermissionsError = (state: { menus: MenuState }) => state.menus?.permissionsError || null

export const selectCurrentMenuId = (state: { menus: MenuState }) => state.menus?.currentMenuId || null
export const selectAccessCache = (state: { menus: MenuState }) => state.menus?.accessCache || {}

export const selectMenuLoading = (state: { menus: MenuState }) =>
  state.menus?.menuTreeLoading || state.menus?.permissionsLoading || state.menus?.loading || false

export const selectMenuError = (state: { menus: MenuState }) =>
  state.menus?.error || state.menus?.menuTreeError || state.menus?.permissionsError || null

// 특정 메뉴 접근 권한 셀렉터
export const selectCanAccessMenu = (menuId: string) => (state: { menus: MenuState }) => {
  return state.menus?.accessCache?.[menuId] ?? null
}

// 플랫한 메뉴 리스트 셀렉터 (검색 등에 유용)
export const selectFlatMenuList = (state: { menus: MenuState }): MenuTreeItem[] => {
  const flattenMenu = (menus: MenuTreeItem[]): MenuTreeItem[] => {
    const result: MenuTreeItem[] = []

    menus.forEach(menu => {
      result.push(menu)
      if (menu.children && menu.children.length > 0) {
        result.push(...flattenMenu(menu.children))
      }
    })

    return result
  }

  return flattenMenu(state.menus?.menuTree || [])
}

// 특정 URL의 메뉴 찾기 셀렉터
export const selectMenuByUrl = (url: string) => (state: { menus: MenuState }): MenuTreeItem | null => {
  const flatMenus = selectFlatMenuList(state)
  return flatMenus.find(menu => menu.url === url) || null
}

// 권한이 있는 메뉴만 필터링하는 셀렉터
export const selectAccessibleMenus = (state: { menus: MenuState }): MenuTreeItem[] => {
  const filterAccessibleMenus = (menus: MenuTreeItem[]): MenuTreeItem[] => {
    return menus
      .filter(menu => {
        // 접근 권한이 명시적으로 false가 아닌 경우 포함
        const hasAccess = state.menus?.accessCache?.[menu.id]
        return hasAccess !== false
      })
      .map(menu => ({
        ...menu,
        children: menu.children ? filterAccessibleMenus(menu.children) : []
      }))
  }

  return filterAccessibleMenus(state.menus?.menuTree || [])
}

// 리듀서 내보내기
export default menuSlice.reducer