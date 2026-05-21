import axios, { AxiosInstance, AxiosResponse } from 'axios'
import { store } from '../store/store'
import { logout } from '../store/slices/authSlice'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001/api'

// 세션 만료 이벤트 (전역에서 수신 가능)
export const SESSION_EXPIRED_EVENT = 'session-expired'

declare global {
  interface Window {
    __LINKHIIT_SESSION_EXPIRED__?: boolean
  }
}

// 세션 만료 알림 발생
const notifySessionExpired = (reason: string) => {
  console.log('Session expired:', reason)
  
  // Redux 상태 정리
  store.dispatch(logout())

  // 세션 만료 플래그 (다른 UI에서 불필요한 에러/알림을 스킵하는 용도)
  window.__LINKHIIT_SESSION_EXPIRED__ = true
  
  // 세션 만료 이벤트 발생 (다른 컴포넌트에서 수신 가능)
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { reason } }))
  
  // 로그인 페이지로 이동 (현재 페이지가 로그인 페이지가 아닌 경우에만)
  if (!window.location.pathname.includes('/login')) {
    // 메시지 없이 즉시 로그인 화면으로 이동
    window.location.href = '/login'
  }
}

// Axios 인스턴스 생성
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// sessionStorage 접근 가능 여부 확인 함수 (브라우저 닫으면 자동 만료)
const isStorageAvailable = (): boolean => {
  try {
    const test = '__storage_test__'
    sessionStorage.setItem(test, test)
    sessionStorage.removeItem(test)
    return true
  } catch {
    return false
  }
}

// sessionStorage 안전하게 읽기
const safeGetItem = (key: string): string | null => {
  try {
    if (!isStorageAvailable()) {
      return null
    }
    return sessionStorage.getItem(key)
  } catch (error) {
    console.warn(`sessionStorage 접근 실패 (${key}):`, error)
    return null
  }
}

// sessionStorage 안전하게 쓰기
const safeSetItem = (key: string, value: string): void => {
  try {
    if (!isStorageAvailable()) {
      console.warn('sessionStorage를 사용할 수 없습니다.')
      return
    }
    sessionStorage.setItem(key, value)
  } catch (error) {
    console.warn(`sessionStorage 저장 실패 (${key}):`, error)
  }
}

// sessionStorage 안전하게 삭제
const safeRemoveItem = (key: string): void => {
  try {
    if (!isStorageAvailable()) {
      return
    }
    sessionStorage.removeItem(key)
  } catch (error) {
    console.warn(`sessionStorage 삭제 실패 (${key}):`, error)
  }
}

// 요청 인터셉터 - 토큰 자동 추가
api.interceptors.request.use(
  (config) => {
    // 두 가지 키로 토큰을 찾아봄 (호환성을 위해)
    const token = safeGetItem('token') || safeGetItem('accessToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
      console.log('API 요청에 토큰 추가:', config.url)
    } else {
      console.warn('토큰이 없어서 인증 헤더를 추가할 수 없습니다.')
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 응답 인터셉터 - 토큰 만료 처리
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = safeGetItem('refreshToken')
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          })

          const { accessToken, refreshToken: newRefreshToken } = response.data.data
          // 두 가지 키로 모두 저장 (호환성을 위해)
          safeSetItem('token', accessToken)
          safeSetItem('accessToken', accessToken)
          safeSetItem('refreshToken', newRefreshToken)

          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return api(originalRequest)
        } else {
          // Refresh token이 없으면 세션 만료 처리
          safeRemoveItem('token')
          safeRemoveItem('accessToken')
          safeRemoveItem('refreshToken')
          notifySessionExpired('세션이 만료되었습니다. 다시 로그인해주세요.')
        }
      } catch (refreshError) {
        // Refresh token 갱신 실패 - 세션 만료 처리
        safeRemoveItem('token')
        safeRemoveItem('accessToken')
        safeRemoveItem('refreshToken')
        notifySessionExpired('세션이 만료되었습니다. 다시 로그인해주세요.')
      }
    }

    return Promise.reject(error)
  }
)

// 인증 API
export const authAPI = {
  login: (credentials: { email: string; password: string }) =>
    api.post('/auth/login', credentials),
  
  register: (userData: { email: string; name: string; password: string }) =>
    api.post('/auth/register', userData),
  
  refreshToken: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
  
  getCurrentUser: () =>
    api.get('/auth/me'),
  
  logout: () =>
    api.post('/auth/logout'),
}

// 비디오 API
export const videosAPI = {
  getVideos: (params: {
    page?: number
    limit?: number
    search?: string
    category?: string
    sortBy?: string
    sortOrder?: string
  } = {}) => api.get('/videos', { params }),
  
  getVideoById: (id: string) =>
    api.get(`/videos/${id}`),
  
  createVideo: (data: {
    title: string
    description?: string
    category: string
    youtubeUrl: string
    duration: number
    thumbnailUrl?: string
  }) => api.post('/videos', data),
  
  updateVideo: (id: string, data: Partial<{
    title: string
    description?: string
    category: string
    youtubeUrl: string
    duration: number
    thumbnailUrl?: string
  }>) => api.put(`/videos/${id}`, data),
  
  deleteVideo: (id: string) =>
    api.delete(`/videos/${id}`),
  
  getCategories: () =>
    api.get('/videos/categories/list'),
  
  getYouTubeMetadata: (url: string) =>
    api.post('/videos/youtube/metadata', { url }),
  
  searchYouTube: (params: { query: string; maxResults?: number; categoryId?: string }) =>
    api.post('/videos/youtube/search', params),
  
  importFromYouTube: (data: { youtubeUrl: string; category?: string }) =>
    api.post('/videos/youtube/import', data),
}

// 플레이리스트 API
export const playlistsAPI = {
  getPlaylists: (params: {
    page?: number
    limit?: number
    search?: string
    sortBy?: string
    sortOrder?: string
  } = {}) => api.get('/playlists', { params }),
  
  getPlaylistById: (id: string) =>
    api.get(`/playlists/${id}`),
  
  createPlaylist: (data: { name: string }) =>
    api.post('/playlists', data),
  
  updatePlaylist: (id: string, data: { name: string }) =>
    api.put(`/playlists/${id}`, data),
  
  deletePlaylist: (id: string) =>
    api.delete(`/playlists/${id}`),
  
  addVideoToPlaylist: (playlistId: string, data: { videoId: string; order: number }) =>
    api.post(`/playlists/${playlistId}/videos`, data),
  
  removeVideoFromPlaylist: (playlistId: string, videoId: string) =>
    api.delete(`/playlists/${playlistId}/videos/${videoId}`),
  
  reorderVideos: (playlistId: string, data: { videoOrders: Array<{ videoId: string; order: number }> }) =>
    api.put(`/playlists/${playlistId}/reorder`, data),
  
  duplicatePlaylist: (id: string) =>
    api.post(`/playlists/${id}/duplicate`),
  
  getPlaylistStats: (id: string) =>
    api.get(`/playlists/${id}/stats`),
}

// 운동 API
export const workoutAPI = {
  startSession: (data: { playlistId: string }) =>
    api.post('/workouts/sessions', data),
  
  endSession: (sessionId: string, data: { completedVideos?: string[] }) =>
    api.put(`/workouts/sessions/${sessionId}/end`, data),
  
  getActiveSession: () =>
    api.get('/workouts/sessions/active'),
  
  addHeartRateReading: (sessionId: string, data: { heartRate: number; timestamp?: string }) =>
    api.post(`/workouts/sessions/${sessionId}/heartrate`, data),
  
  createWorkoutHistory: (data: {
    sessionId: string
    date: string
    duration: number
    averageHeartRate?: number
    maxHeartRate?: number
    notes?: string
  }) => api.post('/workouts/history', data),
  
  getHistory: (params: {
    page?: number
    limit?: number
    startDate?: string
    endDate?: string
  } = {}) => api.get('/workouts/history', { params }),
  
  getHistoryById: (id: string) =>
    api.get(`/workouts/history/${id}`),
  
  updateHistory: (id: string, data: Partial<{
    date: string
    duration: number
    averageHeartRate?: number
    maxHeartRate?: number
    notes?: string
  }>) => api.put(`/workouts/history/${id}`, data),
  
  getWorkoutStats: () =>
    api.get('/workouts/stats'),
}

// Named export 추가
export { api }

export default api