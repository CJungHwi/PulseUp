// 운동 관련 타입 정의

export interface WorkoutHistoryItem {
  id: string
  userId: string
  sessionId?: string
  playlistId?: string
  playlist?: {
    id: string
    name: string
  }
  date: string
  duration: number // 초 단위
  caloriesBurned?: number
  averageHeartRate?: number
  maxHeartRate?: number
  categories?: string // 쉼표로 구분된 카테고리
  createdAt: string
  updatedAt: string
}

export interface WorkoutHistoryFilters {
  search?: string
  startDate?: string
  endDate?: string
  category?: string
  intensity?: string
  minDuration?: number // 초 단위
  maxDuration?: number // 초 단위
}

export interface WorkoutHistoryPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface WorkoutHistoryRevision {
  id: string
  workoutHistoryId: string
  revisionNumber: number
  createdAt: string
  createdBy: string
  changes: {
    type: 'create' | 'update'
    description: string
    details?: Array<{
      field: string
      from: any
      to: any
    }>
  }
  data: WorkoutHistoryItem
}

export interface WorkoutSession {
  id: string
  userId: string
  playlistId?: string
  startTime: string
  endTime?: string
  status: 'active' | 'paused' | 'completed' | 'cancelled'
  duration?: number
  caloriesBurned?: number
  averageHeartRate?: number
  maxHeartRate?: number
  heartRateData: HeartRateReading[]
}

export interface HeartRateReading {
  timestamp: string
  heartRate: number
  zone?: 'rest' | 'fat-burn' | 'cardio' | 'peak'
}

export interface WorkoutGoal {
  id: string
  userId: string
  goalType: 'duration' | 'calories' | 'sessions'
  targetValue: number
  period: 'daily' | 'weekly' | 'monthly'
  currentValue?: number
  progressPercentage?: number
  isCompleted?: boolean
  createdAt: string
  updatedAt: string
}

export interface WorkoutStats {
  totalSessions: number
  totalDuration: number // 초 단위
  totalCalories: number
  averageHeartRate: number
  sessionsThisWeek: number
  sessionsThisMonth: number
  favoriteCategories: Array<{
    category: string
    count: number
  }>
}

// Redux 상태 타입
export interface WorkoutState {
  // 운동 이력
  history: WorkoutHistoryItem[]
  historyLoading: boolean
  historyError: string | null
  historyPagination: WorkoutHistoryPagination | null
  historyFilters: WorkoutHistoryFilters

  // 현재 운동 세션
  currentSession: WorkoutSession | null
  sessionLoading: boolean
  sessionError: string | null

  // 운동 통계
  stats: WorkoutStats | null
  statsLoading: boolean
  statsError: string | null

  // 운동 목표
  goals: WorkoutGoal[]
  goalsLoading: boolean
  goalsError: string | null
}

// API 요청/응답 타입
export interface FetchWorkoutHistoryRequest {
  page: number
  limit: number
  search?: string
  startDate?: string
  endDate?: string
  category?: string
  intensity?: string
  minDuration?: number
  maxDuration?: number
}

export interface FetchWorkoutHistoryResponse {
  history: WorkoutHistoryItem[]
  pagination: WorkoutHistoryPagination
}

export interface UpdateWorkoutHistoryRequest {
  id: string
  data: Partial<WorkoutHistoryItem>
  notes?: string
  changes?: Array<{
    field: string
    from: any
    to: any
  }>
}

export interface CreateWorkoutSessionRequest {
  playlistId?: string
  startTime: string
}

export interface UpdateWorkoutSessionRequest {
  id: string
  endTime?: string
  status?: WorkoutSession['status']
  caloriesBurned?: number
  heartRateData?: HeartRateReading[]
}

export interface CreateWorkoutGoalRequest {
  goalType: WorkoutGoal['goalType']
  targetValue: number
  period: WorkoutGoal['period']
}

export interface UpdateWorkoutGoalRequest {
  id: string
  targetValue?: number
  period?: WorkoutGoal['period']
}