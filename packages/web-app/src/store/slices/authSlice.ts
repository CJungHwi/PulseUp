import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface User {
  id: string
  userid: string
  name: string
  email: string
  role?: 'user' | 'branch_admin' | 'super_admin'
  branchId?: string
  branchName?: string
  isApproved?: boolean
  approvedBy?: string
  approvedAt?: string
  used?: boolean
  /** false: Electron 연동·릴레이 재생 불가 */
  linkageEnabled?: boolean
}

interface AuthState {
  user: User | null
  token: string | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

// sessionStorage에서 토큰을 복원하는 함수 (브라우저 닫으면 자동 만료)
const loadTokenFromStorage = () => {
  try {
    const token = sessionStorage.getItem('token')
    const accessToken = sessionStorage.getItem('accessToken')
    const refreshToken = sessionStorage.getItem('refreshToken')

    // 토큰이 있으면 인증된 상태로 초기화
    if (token || accessToken) {
      return {
        token: token || accessToken,
        accessToken: token || accessToken,
        isAuthenticated: true
      }
    }
  } catch (error) {
    console.error('토큰 복원 실패:', error)
  }

  return {
    token: null,
    accessToken: null,
    isAuthenticated: false
  }
}

const tokenData = loadTokenFromStorage()

const initialState: AuthState = {
  user: null,
  token: tokenData.token,
  accessToken: tokenData.accessToken,
  isAuthenticated: tokenData.isAuthenticated,
  isLoading: false,
  error: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess: (state, action: PayloadAction<{ user: User; token: string }>) => {
      state.user = action.payload.user
      state.token = action.payload.token
      state.accessToken = action.payload.token
      state.isAuthenticated = true
      state.isLoading = false
      state.error = null
    },
    logout: (state) => {
      state.user = null
      state.token = null
      state.accessToken = null
      state.isAuthenticated = false
      state.isLoading = false
      state.error = null

      // sessionStorage 정리
      try {
        sessionStorage.removeItem('token')
        sessionStorage.removeItem('accessToken')
        sessionStorage.removeItem('refreshToken')
      } catch (error) {
        console.error('토큰 정리 실패:', error)
      }
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload }
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
      state.isLoading = false
    },
    clearError: (state) => {
      state.error = null
    },
    restoreAuth: (state) => {
      // localStorage에서 토큰 복원
      const tokenData = loadTokenFromStorage()
      state.token = tokenData.token
      state.accessToken = tokenData.accessToken
      state.isAuthenticated = tokenData.isAuthenticated
      state.isLoading = true // 사용자 정보를 가져오는 동안 로딩
    },
    restoreUserSuccess: (state, action: PayloadAction<User>) => {
      state.user = action.payload
      state.isLoading = false
      state.error = null
    },
    restoreUserFailure: (state) => {
      // 토큰은 있지만 사용자 정보 조회 실패 시 로그아웃 처리
      state.user = null
      state.token = null
      state.accessToken = null
      state.isAuthenticated = false
      state.isLoading = false
      state.error = null

      // sessionStorage 정리
      try {
        sessionStorage.removeItem('token')
        sessionStorage.removeItem('accessToken')
        sessionStorage.removeItem('refreshToken')
      } catch (error) {
        console.error('토큰 정리 실패:', error)
      }
    },
  },
})

export const {
  loginSuccess,
  logout,
  updateUser,
  setLoading,
  setError,
  clearError,
  restoreAuth,
  restoreUserSuccess,
  restoreUserFailure
} = authSlice.actions

// Async actions
export const register = (userData: any) => async (dispatch: any) => {
  dispatch(setLoading(true))
  try {
    // TODO: Implement actual registration API call
    console.log('Register:', userData)
    dispatch(setLoading(false))
  } catch (error: any) {
    dispatch(setError(error.message))
  }
}

export const getCurrentUser = () => async (dispatch: any) => {
  try {
    // TODO: Implement actual getCurrentUser API call
    console.log('Get current user')
  } catch (error: any) {
    dispatch(setError(error.message))
  }
}

export default authSlice.reducer