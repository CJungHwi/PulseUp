import axios from 'axios'

// API 클라이언트 생성
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 30000, // 30초로 증가
  headers: {
    'Content-Type': 'application/json',
  },
})

// 리프레시 상태 관리
let isRefreshing = false
let failedQueue: any[] = []

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })

  failedQueue = []
}

// 요청 인터셉터 - 토큰 자동 추가
apiClient.interceptors.request.use(
  (config) => {
    // 호환성을 위해 두 키를 모두 확인 (sessionStorage 사용 - 브라우저 닫으면 만료)
    const token = sessionStorage.getItem('token') || sessionStorage.getItem('accessToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 응답 인터셉터 - 토큰 만료 처리 및 에러 처리
apiClient.interceptors.response.use(
  (response) => {
    return response
  },
  async (error) => {
    const originalRequest = error.config

    // 502 Bad Gateway 에러 로깅
    if (error.response?.status === 502) {
      console.error('502 Bad Gateway 에러:', {
        url: originalRequest?.url,
        baseURL: originalRequest?.baseURL,
        message: error.message,
        response: error.response?.data
      })
    }

    // 네트워크 에러 로깅
    if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      console.error('네트워크 연결 에러:', {
        url: originalRequest?.url,
        baseURL: originalRequest?.baseURL,
        code: error.code,
        message: error.message
      })
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return apiClient(originalRequest)
          })
          .catch((err) => {
            return Promise.reject(err)
          })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const refreshToken = sessionStorage.getItem('refreshToken')
        if (refreshToken) {
          const response = await axios.post(
            `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/auth/refresh`,
            { refreshToken }
          )

          // 서버 응답 구조: { success: true, data: { accessToken, refreshToken, expiresIn }, message: "..." }
          const { accessToken, refreshToken: newRefreshToken } = response.data.data

          sessionStorage.setItem('token', accessToken)
          sessionStorage.setItem('accessToken', accessToken)
          if (newRefreshToken) {
            sessionStorage.setItem('refreshToken', newRefreshToken)
          }

          processQueue(null, accessToken)

          // 원래 요청 재시도
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return apiClient(originalRequest)
        }
      } catch (refreshError) {
        processQueue(refreshError, null)

        // 리프레시 토큰도 만료된 경우 로그아웃
        console.warn('토큰 리프레시 실패 (세션 만료):', refreshError)
        sessionStorage.removeItem('token')
        sessionStorage.removeItem('accessToken')
        sessionStorage.removeItem('refreshToken')

        // Redux 상태도 초기화
        const { store } = await import('../store')
        const { logout } = await import('../store/slices/authSlice')
        store.dispatch(logout())

        // 로그인 페이지로 리다이렉트
        window.location.href = '/login'
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)