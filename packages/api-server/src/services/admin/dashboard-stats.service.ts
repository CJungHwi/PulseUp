import { executeQuery } from '../../lib/database.js'

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
}

export class DashboardStatsService {
  /**
   * 전체 대시보드 통계 조회
   */
  static async getDashboardStats(): Promise<DashboardStats> {
    try {
      const [userStats, contentStats, systemStats, activityTrends] = await Promise.all([
        this.getUserStats(),
        this.getContentStats(),
        this.getSystemStats(),
        this.getActivityTrends()
      ])

      return {
        userStats,
        contentStats,
        systemStats,
        activityTrends
      }
    } catch (error) {
      console.error('Failed to get dashboard stats:', error)
      throw new Error('대시보드 통계 조회에 실패했습니다')
    }
  }

  /**
   * 사용자 통계 조회
   */
  static async getUserStats() {
    try {
      // 기본 사용자 통계
      const basicStats = await executeQuery(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
          SUM(CASE WHEN role = 'super_admin' THEN 1 ELSE 0 END) as superAdmins,
          SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as users,
          SUM(CASE WHEN last_login_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as activeLastWeek,
          SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as newThisMonth
        FROM users
      `)

      // 성장률 계산 (지난달 대비)
      const lastMonthStats = await executeQuery(`
        SELECT COUNT(*) as lastMonthTotal
        FROM users 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) 
        AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
      `)

      const currentStats = basicStats[0]
      const lastMonthTotal = lastMonthStats[0]?.lastMonthTotal || 0
      const growthRate = lastMonthTotal > 0 
        ? ((currentStats.newThisMonth - lastMonthTotal) / lastMonthTotal) * 100 
        : 0

      return {
        ...currentStats,
        growthRate: Math.round(growthRate * 100) / 100
      }
    } catch (error) {
      console.error('Failed to get user stats:', error)
      throw error
    }
  }

  /**
   * 콘텐츠 통계 조회
   */
  static async getContentStats() {
    try {
      // 기본 콘텐츠 통계
      const basicStats = await executeQuery(`
        SELECT 
          (SELECT COUNT(*) FROM videos) as totalVideos,
          (SELECT COUNT(*) FROM playlists) as totalPlaylists,
          (SELECT COUNT(*) FROM workout_sessions WHERE status = 'active') as activeSessions,
          (SELECT COUNT(*) FROM workout_sessions) as totalWorkoutSessions,
          (SELECT AVG(duration) FROM workout_sessions WHERE duration IS NOT NULL) as avgSessionDuration
      `)

      // 인기 카테고리
      const popularCategories = await executeQuery(`
        SELECT 
          v.category,
          COUNT(*) as count
        FROM videos v
        INNER JOIN playlist_videos pv ON v.id = pv.video_id
        GROUP BY v.category
        ORDER BY count DESC
        LIMIT 5
      `)

      return {
        ...basicStats[0],
        avgSessionDuration: Math.round(basicStats[0]?.avgSessionDuration || 0),
        popularCategories: popularCategories.map((cat: any) => ({
          category: cat.category,
          count: cat.count
        }))
      }
    } catch (error) {
      console.error('Failed to get content stats:', error)
      throw error
    }
  }

  /**
   * 시스템 통계 조회
   */
  static async getSystemStats() {
    try {
      // 기본 시스템 통계 (실제 구현에서는 모니터링 시스템과 연동)
      const errorLogs = await executeQuery(`
        SELECT COUNT(*) as errorCount
        FROM user_activity_logs 
        WHERE action LIKE '%ERROR%' 
        AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `)

      const totalRequests = await executeQuery(`
        SELECT COUNT(*) as totalRequests
        FROM user_activity_logs 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `)

      const errorCount = errorLogs[0]?.errorCount || 0
      const requestCount = totalRequests[0]?.totalRequests || 1
      const errorRate = (errorCount / requestCount) * 100

      return {
        totalStorage: 0, // 실제 구현에서는 파일 시스템 조회
        avgResponseTime: 150, // 실제 구현에서는 모니터링 데이터
        uptime: 99.9, // 실제 구현에서는 시스템 업타임
        errorRate: Math.round(errorRate * 100) / 100,
        activeConnections: 0 // 실제 구현에서는 연결 풀 상태
      }
    } catch (error) {
      console.error('Failed to get system stats:', error)
      throw error
    }
  }

  /**
   * 활동 트렌드 조회
   */
  static async getActivityTrends() {
    try {
      // 일일 활성 사용자 (지난 30일)
      const dailyActiveUsers = await executeQuery(`
        SELECT 
          DATE(last_login_at) as date,
          COUNT(DISTINCT id) as count
        FROM users 
        WHERE last_login_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(last_login_at)
        ORDER BY date DESC
        LIMIT 30
      `)

      // 주간 신규 가입자 (지난 12주)
      const weeklySignups = await executeQuery(`
        SELECT 
          CONCAT(YEAR(created_at), '-W', LPAD(WEEK(created_at), 2, '0')) as week,
          COUNT(*) as count
        FROM users 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 WEEK)
        GROUP BY YEAR(created_at), WEEK(created_at)
        ORDER BY week DESC
        LIMIT 12
      `)

      // 월간 운동 세션 (지난 12개월)
      const monthlyWorkouts = await executeQuery(`
        SELECT 
          DATE_FORMAT(start_time, '%Y-%m') as month,
          COUNT(*) as count
        FROM workout_sessions 
        WHERE start_time >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        GROUP BY DATE_FORMAT(start_time, '%Y-%m')
        ORDER BY month DESC
        LIMIT 12
      `)

      return {
        dailyActiveUsers: dailyActiveUsers.map((row: any) => ({
          date: row.date,
          count: row.count
        })),
        weeklySignups: weeklySignups.map((row: any) => ({
          week: row.week,
          count: row.count
        })),
        monthlyWorkouts: monthlyWorkouts.map((row: any) => ({
          month: row.month,
          count: row.count
        }))
      }
    } catch (error) {
      console.error('Failed to get activity trends:', error)
      throw error
    }
  }

  /**
   * 실시간 통계 조회 (최근 1시간)
   */
  static async getRealTimeStats() {
    try {
      const stats = await executeQuery(`
        SELECT 
          (SELECT COUNT(*) FROM users WHERE last_login_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)) as activeUsersLastHour,
          (SELECT COUNT(*) FROM workout_sessions WHERE start_time >= DATE_SUB(NOW(), INTERVAL 1 HOUR)) as newSessionsLastHour,
          (SELECT COUNT(*) FROM user_activity_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)) as userActionsLastHour,
          (SELECT COUNT(*) FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)) as newUsersLastHour
      `)

      return stats[0] || {
        activeUsersLastHour: 0,
        newSessionsLastHour: 0,
        userActionsLastHour: 0,
        newUsersLastHour: 0
      }
    } catch (error) {
      console.error('Failed to get real-time stats:', error)
      throw error
    }
  }

  /**
   * 시스템 알림 조회
   */
  static async getSystemAlerts() {
    try {
      const alerts = []

      // 높은 오류율 확인
      const errorRate = await this.getSystemStats()
      if (errorRate.errorRate > 5) {
        alerts.push({
          type: 'error',
          title: '높은 오류율 감지',
          message: `지난 24시간 동안 오류율이 ${errorRate.errorRate}%입니다.`,
          timestamp: new Date()
        })
      }

      // 비활성 사용자 확인
      const inactiveUsers = await executeQuery(`
        SELECT COUNT(*) as count
        FROM users 
        WHERE last_login_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
        AND role = 'user'
      `)

      if (inactiveUsers[0]?.count > 100) {
        alerts.push({
          type: 'warning',
          title: '비활성 사용자 증가',
          message: `30일 이상 로그인하지 않은 사용자가 ${inactiveUsers[0].count}명입니다.`,
          timestamp: new Date()
        })
      }

      // 저장 공간 확인 (실제 구현에서는 파일 시스템 모니터링)
      const storageUsage = 75 // 예시 값
      if (storageUsage > 80) {
        alerts.push({
          type: 'warning',
          title: '저장 공간 부족',
          message: `저장 공간 사용률이 ${storageUsage}%입니다.`,
          timestamp: new Date()
        })
      }

      return alerts
    } catch (error) {
      console.error('Failed to get system alerts:', error)
      return []
    }
  }

  /**
   * 최근 중요 활동 조회
   */
  static async getRecentImportantActivities(limit: number = 10) {
    try {
      const activities = await executeQuery(`
        SELECT 
          ual.id,
          ual.action,
          ual.target_type,
          ual.target_id,
          ual.created_at,
          u.name as user_name,
          u.userid as user_login_id,
          u.role as user_role
        FROM user_activity_logs ual
        LEFT JOIN users u ON ual.user_id = u.id
        WHERE ual.action IN (
          'CREATE_USER', 'UPDATE_USER_ROLE', 'DELETE_USER',
          'UPDATE_SYSTEM_SETTING', 'CREATE_ANNOUNCEMENT',
          'DELETE_VIDEO', 'DELETE_PLAYLIST'
        )
        ORDER BY ual.created_at DESC
        LIMIT ?
      `, [limit])

      return activities.map((activity: any) => ({
        id: activity.id,
        action: activity.action,
        targetType: activity.target_type,
        targetId: activity.target_id,
        userName: activity.user_name,
        userLoginId: activity.user_login_id,
        userRole: activity.user_role,
        createdAt: activity.created_at
      }))
    } catch (error) {
      console.error('Failed to get recent important activities:', error)
      return []
    }
  }
}