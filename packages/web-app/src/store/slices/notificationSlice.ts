import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { notificationApi } from '../../services/notificationApi'
import { Notification, CreateNotificationRequest, UpdateNotificationRequest } from '../../types/notification'

// 공지사항 목록 조회
export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async (params: {
    page?: number
    limit?: number
    type?: string
    status?: string
    search?: string
    isAdmin?: boolean
    append?: boolean
  } = {}, { rejectWithValue }) => {
    try {
      const { append, ...apiParams } = params
      const response = await notificationApi.getNotifications(apiParams)
      if (response.success) {
        return response.data
      } else {
        return rejectWithValue(response.message || '공지사항 조회에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('Notifications fetch error:', error)
      return rejectWithValue(
        error.response?.data?.message ||
        error.message ||
        '공지사항 조회에 실패했습니다.'
      )
    }
  }
)

// 공지사항 생성
export const createNotification = createAsyncThunk(
  'notifications/createNotification',
  async (data: CreateNotificationRequest, { rejectWithValue }) => {
    try {
      const response = await notificationApi.createNotification(data)
      if (response.success) {
        return response.data
      } else {
        return rejectWithValue(response.message || '공지사항 등록에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('Notification create error:', error)
      return rejectWithValue(
        error.response?.data?.message ||
        error.message ||
        '공지사항 등록에 실패했습니다.'
      )
    }
  }
)

// 공지사항 수정
export const updateNotification = createAsyncThunk(
  'notifications/updateNotification',
  async ({ id, data }: { id: number; data: UpdateNotificationRequest }, { rejectWithValue }) => {
    try {
      const response = await notificationApi.updateNotification(id, data)
      if (response.success) {
        return response.data
      } else {
        return rejectWithValue(response.message || '공지사항 수정에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('Notification update error:', error)
      return rejectWithValue(
        error.response?.data?.message ||
        error.message ||
        '공지사항 수정에 실패했습니다.'
      )
    }
  }
)

// 공지사항 삭제
export const deleteNotification = createAsyncThunk(
  'notifications/deleteNotification',
  async (id: number, { rejectWithValue }) => {
    try {
      const response = await notificationApi.deleteNotification(id)
      if (response.success) {
        return id
      } else {
        return rejectWithValue(response.message || '공지사항 삭제에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('Notification delete error:', error)
      return rejectWithValue(
        error.response?.data?.message ||
        error.message ||
        '공지사항 삭제에 실패했습니다.'
      )
    }
  }
)

// 공지사항 상태 변경
export const updateNotificationStatus = createAsyncThunk(
  'notifications/updateNotificationStatus',
  async ({ id, status }: { id: number; status: 'active' | 'inactive' }, { rejectWithValue }) => {
    try {
      const response = await notificationApi.updateNotificationStatus(id, status)
      if (response.success) {
        return response.data
      } else {
        return rejectWithValue(response.message || '상태 변경에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('Notification status update error:', error)
      return rejectWithValue(
        error.response?.data?.message ||
        error.message ||
        '상태 변경에 실패했습니다.'
      )
    }
  }
)

interface NotificationState {
  notifications: Notification[]
  currentNotification: Notification | null
  loading: boolean
  error: string | null
  total: number
  page: number
  limit: number
}

const initialState: NotificationState = {
  notifications: [],
  currentNotification: null,
  loading: false,
  error: null,
  total: 0,
  page: 1,
  limit: 10
}

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setCurrentNotification: (state, action: PayloadAction<Notification | null>) => {
      state.currentNotification = action.payload
    },
    clearCurrentNotification: (state) => {
      state.currentNotification = null
    },
    clearError: (state) => {
      state.error = null
    },
    setPage: (state, action: PayloadAction<number>) => {
      state.page = action.payload
    },
    setLimit: (state, action: PayloadAction<number>) => {
      state.limit = action.payload
    },
    incrementViewCount: (state, action: PayloadAction<number>) => {
      const index = state.notifications.findIndex(n => n.id === action.payload)
      if (index !== -1) {
        state.notifications[index].view_count = (state.notifications[index].view_count || 0) + 1
      }
      if (state.currentNotification?.id === action.payload) {
        state.currentNotification.view_count = (state.currentNotification.view_count || 0) + 1
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // 공지사항 목록 조회
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false
        // 관리자용 API는 페이지네이션 구조, 사용자용 API는 단순 배열
        if (Array.isArray(action.payload)) {
          // 사용자용 API 응답 (단순 배열)
          if (action.meta.arg.append) {
            state.notifications = [...state.notifications, ...action.payload]
          } else {
            state.notifications = action.payload
          }
          state.total = action.payload.length
          // 사용자용은 페이지 개념이 없지만 호환성을 위해 설정
          if (!action.meta.arg.append) {
            state.page = 1
          }
          state.limit = action.payload.length
        } else {
          // 관리자용 API 응답 (페이지네이션 구조)
          if (action.meta.arg.append) {
            // 중복 제거를 위해 ID 기반 필터링 후 추가 (안전장치)
            const newItems = action.payload.items.filter(newItem =>
              !state.notifications.some(existingItem => existingItem.id === newItem.id)
            )
            state.notifications = [...state.notifications, ...newItems]
          } else {
            state.notifications = action.payload.items
          }
          state.total = action.payload.total
          state.page = action.payload.page
          state.limit = action.payload.limit
        }
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      // 공지사항 생성
      .addCase(createNotification.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createNotification.fulfilled, (state, action) => {
        state.loading = false
        state.notifications.unshift(action.payload)
        state.total += 1
        state.currentNotification = action.payload
      })
      .addCase(createNotification.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      // 공지사항 수정
      .addCase(updateNotification.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateNotification.fulfilled, (state, action) => {
        state.loading = false
        const index = state.notifications.findIndex(n => n.id === action.payload.id)
        if (index !== -1) {
          state.notifications[index] = action.payload
        }
        state.currentNotification = action.payload
      })
      .addCase(updateNotification.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      // 공지사항 삭제
      .addCase(deleteNotification.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteNotification.fulfilled, (state, action) => {
        state.loading = false
        state.notifications = state.notifications.filter(n => n.id !== action.payload)
        state.total -= 1
        if (state.currentNotification?.id === action.payload) {
          state.currentNotification = null
        }
      })
      .addCase(deleteNotification.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      // 상태 변경
      .addCase(updateNotificationStatus.fulfilled, (state, action) => {
        const index = state.notifications.findIndex(n => n.id === action.payload.id)
        if (index !== -1) {
          state.notifications[index] = action.payload
        }
        if (state.currentNotification?.id === action.payload.id) {
          state.currentNotification = action.payload
        }
      })
  }
})

export const {
  setCurrentNotification,
  clearCurrentNotification,
  clearError,
  setPage,
  setLimit,
  incrementViewCount
} = notificationSlice.actions

export default notificationSlice.reducer
