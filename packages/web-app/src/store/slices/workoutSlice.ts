import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import api from '../../services/api'
import { 
  WorkoutState, 
  WorkoutHistoryItem, 
  WorkoutHistoryFilters,
  WorkoutSession,
  WorkoutStats,
  WorkoutGoal,
  FetchWorkoutHistoryRequest,
  FetchWorkoutHistoryResponse,
  UpdateWorkoutHistoryRequest,
  CreateWorkoutSessionRequest,
  UpdateWorkoutSessionRequest,
  CreateWorkoutGoalRequest,
  UpdateWorkoutGoalRequest
} from '../../types/workout'

const initialState: WorkoutState = {
  // 운동 이력
  history: [],
  historyLoading: false,
  historyError: null,
  historyPagination: null,
  historyFilters: {},

  // 현재 운동 세션
  currentSession: null,
  sessionLoading: false,
  sessionError: null,

  // 운동 통계
  stats: null,
  statsLoading: false,
  statsError: null,

  // 운동 목표
  goals: [],
  goalsLoading: false,
  goalsError: null
}

// 운동 이력 조회
export const fetchWorkoutHistory = createAsyncThunk(
  'workout/fetchHistory',
  async (params: FetchWorkoutHistoryRequest, { rejectWithValue }) => {
    try {
      const response = await api.get('/workouts/history', { params })
      return response.data as FetchWorkoutHistoryResponse
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || '운동 이력 조회에 실패했습니다')
    }
  }
)

// 운동 이력 수정
export const updateWorkoutHistory = createAsyncThunk(
  'workout/updateHistory',
  async (params: UpdateWorkoutHistoryRequest, { rejectWithValue }) => {
    try {
      const response = await api.put(`/workouts/history/${params.id}`, {
        ...params.data,
        notes: params.notes,
        changes: params.changes
      })
      return response.data.data as WorkoutHistoryItem
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || '운동 이력 수정에 실패했습니다')
    }
  }
)

// 운동 세션 시작
export const startWorkoutSession = createAsyncThunk(
  'workout/startSession',
  async (params: { playlistId: string }, { rejectWithValue }) => {
    try {
      const response = await api.post('/workouts/sessions', params)
      return response.data.data || response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || '운동 세션 시작에 실패했습니다')
    }
  }
)

// 운동 세션 종료
export const endWorkoutSession = createAsyncThunk(
  'workout/endSession',
  async (params: { sessionId: string; completedVideos?: string[] }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/workouts/sessions/${params.sessionId}/end`, {
        completedVideos: params.completedVideos || []
      })
      return response.data.data || response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || '운동 세션 종료에 실패했습니다')
    }
  }
)

// 활성 세션 조회
export const fetchActiveSession = createAsyncThunk(
  'workout/fetchActiveSession',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/workouts/sessions/active')
      return response.data.data || response.data || null
    } catch (error: any) {
      // 404는 활성 세션이 없다는 의미이므로 null 반환
      if (error.response?.status === 404) {
        return null
      }
      return rejectWithValue(error.response?.data?.error || '활성 세션 조회에 실패했습니다')
    }
  }
)

// 운동 통계 조회
export const fetchWorkoutStats = createAsyncThunk(
  'workout/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/workouts/stats')
      return response.data.data as WorkoutStats
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || '운동 통계 조회에 실패했습니다')
    }
  }
)

// 운동 목표 조회
export const fetchWorkoutGoals = createAsyncThunk(
  'workout/fetchGoals',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/workouts/goals/progress')
      return response.data.data as WorkoutGoal[]
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || '운동 목표 조회에 실패했습니다')
    }
  }
)

// 운동 목표 생성
export const createWorkoutGoal = createAsyncThunk(
  'workout/createGoal',
  async (params: CreateWorkoutGoalRequest, { rejectWithValue }) => {
    try {
      const response = await api.post('/workouts/goals', params)
      return response.data.data as WorkoutGoal
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || '운동 목표 생성에 실패했습니다')
    }
  }
)

// 운동 목표 수정
export const updateWorkoutGoal = createAsyncThunk(
  'workout/updateGoal',
  async (params: UpdateWorkoutGoalRequest, { rejectWithValue }) => {
    try {
      const response = await api.put(`/workouts/goals/${params.id}`, {
        targetValue: params.targetValue,
        period: params.period
      })
      return response.data.data as WorkoutGoal
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || '운동 목표 수정에 실패했습니다')
    }
  }
)

const workoutSlice = createSlice({
  name: 'workout',
  initialState,
  reducers: {
    // 필터 설정
    setHistoryFilters: (state, action: PayloadAction<Partial<WorkoutHistoryFilters>>) => {
      state.historyFilters = { ...state.historyFilters, ...action.payload }
    },

    // 에러 클리어
    clearHistoryError: (state) => {
      state.historyError = null
    },
    clearSessionError: (state) => {
      state.sessionError = null
    },
    clearStatsError: (state) => {
      state.statsError = null
    },
    clearGoalsError: (state) => {
      state.goalsError = null
    },

    // 세션 클리어
    clearCurrentSession: (state) => {
      state.currentSession = null
    },

    // 심박수 데이터 추가
    addHeartRateData: (state, action: PayloadAction<{ timestamp: string; heartRate: number; zone?: 'rest' | 'fat-burn' | 'cardio' | 'peak' }>) => {
      if (state.currentSession) {
        state.currentSession.heartRateData.push(action.payload)
      }
    }
  },
  extraReducers: (builder) => {
    // 운동 이력 조회
    builder
      .addCase(fetchWorkoutHistory.pending, (state) => {
        state.historyLoading = true
        state.historyError = null
      })
      .addCase(fetchWorkoutHistory.fulfilled, (state, action) => {
        state.historyLoading = false
        state.history = action.payload.history
        state.historyPagination = action.payload.pagination
      })
      .addCase(fetchWorkoutHistory.rejected, (state, action) => {
        state.historyLoading = false
        state.historyError = action.payload as string
      })

    // 운동 이력 수정
    builder
      .addCase(updateWorkoutHistory.fulfilled, (state, action) => {
        const index = state.history.findIndex(item => item.id === action.payload.id)
        if (index !== -1) {
          state.history[index] = action.payload
        }
      })

    // 운동 세션 시작
    builder
      .addCase(startWorkoutSession.pending, (state) => {
        state.sessionLoading = true
        state.sessionError = null
      })
      .addCase(startWorkoutSession.fulfilled, (state, action) => {
        state.sessionLoading = false
        state.currentSession = action.payload
      })
      .addCase(startWorkoutSession.rejected, (state, action) => {
        state.sessionLoading = false
        state.sessionError = action.payload as string
      })

    // 운동 세션 종료
    builder
      .addCase(endWorkoutSession.fulfilled, (state, action) => {
        state.currentSession = action.payload
      })

    // 활성 세션 조회
    builder
      .addCase(fetchActiveSession.fulfilled, (state, action) => {
        state.currentSession = action.payload
      })

    // 운동 통계 조회
    builder
      .addCase(fetchWorkoutStats.pending, (state) => {
        state.statsLoading = true
        state.statsError = null
      })
      .addCase(fetchWorkoutStats.fulfilled, (state, action) => {
        state.statsLoading = false
        state.stats = action.payload
      })
      .addCase(fetchWorkoutStats.rejected, (state, action) => {
        state.statsLoading = false
        state.statsError = action.payload as string
      })

    // 운동 목표 조회
    builder
      .addCase(fetchWorkoutGoals.pending, (state) => {
        state.goalsLoading = true
        state.goalsError = null
      })
      .addCase(fetchWorkoutGoals.fulfilled, (state, action) => {
        state.goalsLoading = false
        state.goals = action.payload
      })
      .addCase(fetchWorkoutGoals.rejected, (state, action) => {
        state.goalsLoading = false
        state.goalsError = action.payload as string
      })

    // 운동 목표 생성
    builder
      .addCase(createWorkoutGoal.fulfilled, (state, action) => {
        state.goals.push(action.payload)
      })

    // 운동 목표 수정
    builder
      .addCase(updateWorkoutGoal.fulfilled, (state, action) => {
        const index = state.goals.findIndex(goal => goal.id === action.payload.id)
        if (index !== -1) {
          state.goals[index] = action.payload
        }
      })
  }
})

export const {
  setHistoryFilters,
  clearHistoryError,
  clearSessionError,
  clearStatsError,
  clearGoalsError,
  clearCurrentSession,
  addHeartRateData
} = workoutSlice.actions

export default workoutSlice.reducer