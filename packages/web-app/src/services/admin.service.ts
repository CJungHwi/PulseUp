import { apiClient } from './api.service'

export interface DashboardStats {
  userStats: {
    total: number
    admins: number
    superAdmins: number
    users: number
    activeLastWeek: number
    newThisMonth: number
    growthRate: number
  }
  contentStats: {
    totalVideos: number
    totalPlaylists: number
    activeSessions: number
    totalWorkoutSessions: number
    avgSessionDuration: number
    popularCategories: Array<{ category: string; count: number }>
  }
  systemStats: {
    totalStorage: number
    avgResponseTime: number
    uptime: number
    errorRate: number
    activeConnections: number
  }
  activityTrends: {
    dailyActiveUsers: Array<{ date: string; count: number }>
    weeklySignups: Array<{ week: string; count: number }>
    monthlyWorkouts: Array<{ month: string; count: number }>
  }
  systemAlerts: Array<{
    type: 'error' | 'warning' | 'info'
    title: string
    message: string
    timestamp: Date
  }>
  recentImportantActivities: Array<{
    id: string
    action: string
    targetType: string
    targetId: string
    adminName: string
    adminEmail: string
    createdAt: Date
  }>
}

export interface RealTimeStats {
  activeUsersLastHour: number
  newSessionsLastHour: number
  adminActionsLastHour: number
  newUsersLastHour: number
}

export interface User {
  id: string
  userid: string
  name: string
  email?: string
  role: 'user' | 'branch_admin' | 'super_admin'
  branchId?: string
  branchName?: string
  branchRegion?: string
  isApproved: boolean
  isActive: boolean
  createdAt: Date
  lastLoginAt?: Date
}

export interface UserListResponse {
  users: User[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface ActivityLog {
  id: string
  adminId: string
  adminName: string
  adminEmail: string
  action: string
  targetType?: string
  targetId?: string
  details?: any
  ipAddress?: string
  userAgent?: string
  createdAt: Date
}

export interface ActivityLogsResponse {
  logs: ActivityLog[]
  total: number
  totalPages: number
}

export interface ActivityStats {
  totalActivities: number
  activitiesByAction: Array<{ action: string; count: number }>
  activitiesByAdmin: Array<{ adminId: string; adminName: string; count: number }>
  activitiesByDate: Array<{ date: string; count: number }>
}

export interface SystemSetting {
  key: string
  value: any
  description: string
  updatedAt: Date
  updatedBy?: string
}

/** 관리자 연동 관리 테이블 행 */
export interface LinkageDeviceRow {
  id: number
  deviceId: string
  displayLabel: string | null
  storeId: number | null
  lastSeenAt: string | null
  registeredByUserId: string | null
  registeredByUserid: string | null
  registeredByName: string | null
  registrantLinkageEnabled: boolean
}

class AdminService {
  /**
   * 대시보드 통계 조회
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await apiClient.get('/admin/dashboard')
    return response.data.data
  }

  /**
   * 실시간 통계 조회
   */
  async getRealTimeStats(): Promise<RealTimeStats> {
    const response = await apiClient.get('/admin/dashboard/realtime')
    return response.data.data
  }

  /**
   * 차트 데이터 조회
   */
  async getChartData(type: string, period?: string): Promise<any[]> {
    const params = period ? { period } : {}
    const response = await apiClient.get(`/admin/dashboard/charts/${type}`, { params })
    return response.data.data
  }

  /**
   * 시스템 알림 조회
   */
  async getSystemAlerts(): Promise<Array<{
    type: 'error' | 'warning' | 'info'
    title: string
    message: string
    timestamp: Date
  }>> {
    const response = await apiClient.get('/admin/dashboard/alerts')
    return response.data.data
  }

  /**
   * 사용자 목록 조회
   */
  async getUsers(params: {
    page?: number
    limit?: number
    search?: string
    role?: string
    branchId?: string
  } = {}): Promise<UserListResponse> {
    const response = await apiClient.get('/admin/users', { params })
    return response.data.data
  }

  /**
   * 사용자 생성
   */
  async createUser(userData: {
    userid: string
    name: string
    email?: string | null
    role: 'user' | 'branch_admin' | 'super_admin'
    branchId?: string | null
    isApproved?: boolean
  }): Promise<User> {
    const response = await apiClient.post('/admin/users', userData)
    return response.data.data
  }

  /**
   * 사용자 상세 정보 조회
   */
  async getUserDetail(userId: string): Promise<User & {
    totalSessions: number
    totalPlaylists: number
  }> {
    const response = await apiClient.get(`/admin/users/${userId}`)
    return response.data.data
  }

  /**
   * 사용자 정보 수정
   */
  async updateUser(userId: string, userData: {
    userid?: string
    name?: string
    email?: string
    role?: 'user' | 'branch_admin' | 'super_admin'
    branchId?: string
  }): Promise<User> {
    console.log('=== adminService.updateUser 호출 ===')
    console.log('userId:', userId)
    console.log('userData:', userData)
    console.log('API URL:', `/admin/users/${userId}`)

    const response = await apiClient.patch(`/admin/users/${userId}`, userData)

    console.log('=== adminService.updateUser 응답 ===')
    console.log('response.status:', response.status)
    console.log('response.data:', response.data)

    return response.data.data
  }

  /**
   * 사용자 역할 변경
   */
  async updateUserRole(userId: string, role: 'user' | 'branch_admin' | 'super_admin'): Promise<void> {
    await apiClient.patch(`/admin/users/${userId}/role`, { role })
  }

  /**
   * 사용자 상태 변경
   */
  async updateUserStatus(userId: string, active: boolean): Promise<void> {
    await apiClient.patch(`/admin/users/${userId}/status`, { active })
  }

  /**
   * 사용자 승인
   */
  async approveUser(userId: string, options?: {
    role?: 'user' | 'branch_admin' | 'super_admin'
    branchId?: string | null
  }): Promise<User> {
    const response = await apiClient.patch(`/admin/users/${userId}/approve`, {
      approved: true,
      ...options
    })
    return response.data.data
  }

  /**
   * 사용자 사용중지
   */
  async suspendUser(userId: string): Promise<User> {
    const response = await apiClient.patch(`/admin/users/${userId}/status`, { active: false })
    return response.data.data
  }

  /**
   * 사용자 재활성화
   */
  async reactivateUser(userId: string): Promise<User> {
    const response = await apiClient.patch(`/admin/users/${userId}/status`, { active: true })
    return response.data.data
  }

  /**
   * 사용자 삭제
   */
  async deleteUser(userId: string): Promise<void> {
    await apiClient.delete(`/admin/users/${userId}`)
  }

  /**
   * 활동 로그 조회
   */
  async getActivityLogs(params: {
    page?: number
    limit?: number
    adminId?: string
    action?: string
    targetType?: string
    startDate?: string
    endDate?: string
  } = {}): Promise<ActivityLogsResponse> {
    const response = await apiClient.get('/admin/activity-logs', { params })
    return response.data.data
  }

  /**
   * 활동 통계 조회
   */
  async getActivityStats(params: {
    startDate?: string
    endDate?: string
  } = {}): Promise<ActivityStats> {
    const response = await apiClient.get('/admin/activity-stats', { params })
    return response.data.data
  }

  /**
   * 시스템 설정 조회
   */
  async getSystemSettings(): Promise<SystemSetting[]> {
    const response = await apiClient.get('/admin/settings')
    return response.data.data
  }

  /**
   * 시스템 설정 업데이트
   */
  async updateSystemSetting(key: string, value: any): Promise<void> {
    await apiClient.patch(`/admin/settings/${key}`, { value })
  }

  /**
   * 관리자 권한 확인
   */
  async checkAdminPermission(): Promise<boolean> {
    try {
      await apiClient.get('/admin/test')
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * 사용자 로그인 이력 조회
   */
  async getUserLoginHistory(params: {
    page?: number
    limit?: number
    search?: string
    branchId?: string
    onlyActive?: boolean
  } = {}): Promise<UserLoginHistoryResponse> {
    const response = await apiClient.get('/admin/userhistory', { params })
    return response.data.data
  }

  /**
   * 특정 사용자의 상세 세션 이력 조회
   */
  async getUserSessionDetail(userId: string, params: {
    page?: number
    limit?: number
  } = {}): Promise<UserSessionDetailResponse> {
    const response = await apiClient.get(`/admin/userhistory/${userId}/sessions`, { params })
    return response.data.data
  }

  /**
   * 사용자 강제 로그아웃
   */
  async forceUserLogout(userId: string, sessionId?: string): Promise<void> {
    await apiClient.post(`/admin/userhistory/${userId}/logout`, {
      sessionId
    })
  }

  /** Electron 연동 목록 (디바이스 + 등록 사용자) */
  async getLinkages(): Promise<LinkageDeviceRow[]> {
    const response = await apiClient.get('/admin/linkages')
    const data = response.data?.data
    return data?.devices ?? []
  }

  /** 사용자 연동 사용 여부 (데이터 유지) */
  async updateUserLinkage(userId: string, linkageEnabled: boolean): Promise<void> {
    await apiClient.patch(`/admin/users/${userId}/linkage`, { linkageEnabled })
  }
}

export const adminService = new AdminService()

// 사용자 로그인 이력 관련 타입
export interface UserLoginInfo {
  id: string
  userid: string
  name: string
  email: string
  branch_id: string | null
  branch_name: string | null
  last_login_at: string | null
  created_at: string
  is_currently_logged_in: boolean
  current_session_start: string | null
  current_session_activity: string | null
  current_session_ip: string | null
  total_login_count: number
  login_count_30days: number
}

export interface UserLoginHistoryResponse {
  users: UserLoginInfo[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  summary: {
    totalUsers: number
    currentlyLoggedIn: number
    totalOffline: number
  }
}

export interface UserSession {
  id: string
  session_token?: string
  login_time: string
  logout_time: string | null
  last_activity?: string
  ip_address: string | null
  user_agent: string | null
  login_method?: string
  success?: boolean
  failure_reason?: string | null
  session_duration?: number | null
  potentially_active?: boolean
  expires_at?: string
}

export interface UserSessionDetailResponse {
  user: {
    id: string
    userid: string
    name: string
  }
  activeSessions: UserSession[]
  sessionHistory: UserSession[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}