import { apiClient } from './api.service'

interface LoginRequest {
  userid: string
  password: string
}

export interface RegisterRequest {
  userid: string
  email: string | null
  name: string
  password: string
  role: 'user' | 'admin' // | 'super_admin'
  branchId?: string | null
}

interface User {
  id: string
  userid: string
  email: string
  name: string
  role: 'user' | 'admin' // | 'super_admin'
  branchId?: string
  branchName?: string
  linkageEnabled?: boolean
}

interface LoginResponse {
  user: User
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export const authService = {
  async register(userData: RegisterRequest): Promise<void> {
    const response = await apiClient.post('/auth/register', userData)
    return response.data
  },

  async login(userid: string, password: string): Promise<LoginResponse> {
    console.log('authService.login 호출:', { userid })
    const response = await apiClient.post('/auth/login', { userid, password })
    console.log('authService 응답:', response.data)
    console.log('응답 구조 확인:', {
      hasData: !!response.data.data,
      hasUser: !!response.data.user,
      keys: Object.keys(response.data)
    })

    // 응답 구조에 따라 다르게 처리
    if (response.data.data) {
      return response.data.data
    } else if (response.data.user) {
      return response.data
    } else {
      console.error('예상치 못한 응답 구조:', response.data)
      throw new Error('응답 형식이 올바르지 않습니다')
    }
  },

  async logout(): Promise<void> {
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('refreshToken')
  },

  async getCurrentUser(): Promise<User> {
    console.log('🔍 getCurrentUser 호출 중...')
    const response = await apiClient.get('/auth/me')
    console.log('🔍 getCurrentUser 응답:', response.data)

    // 서버에서 {success: true, data: {user: {...}, tokenExpiringSoon: false}} 형태로 응답
    const userData = response.data.data?.user || response.data.user || response.data.data || response.data
    console.log('🔍 추출된 사용자 데이터:', userData)

    return userData
  },

  async refreshToken(): Promise<{ accessToken: string }> {
    const refreshToken = sessionStorage.getItem('refreshToken')
    const response = await apiClient.post('/auth/refresh', { refreshToken })
    return response.data
  },

  async checkUserIdDuplicate(userid: string): Promise<boolean> {
    const response = await apiClient.get(`/auth/check-duplicate/${userid}`)
    return response.data.data.exists
  },

  async updateProfile(userData: { name?: string; email?: string; password?: string }): Promise<User> {
    const response = await apiClient.patch('/auth/profile', userData)
    // 서버 응답: { success: true, data: user }
    return response.data.data || response.data
  }
} as const