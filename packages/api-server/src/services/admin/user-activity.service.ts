import { executeQuery } from '../../lib/database.js'

export interface UserActivityLogData {
  userId: string
  action: string
  targetType?: string
  targetId?: string
  details?: any
  ipAddress?: string
  userAgent?: string
}

export interface UserActivityLog extends UserActivityLogData {
  id: string
  createdAt: Date
  userName?: string
  userRole?: string
}

export class UserActivityService {
  /**
   * 사용자 활동 로그 기록
   */
  static async logActivity(data: UserActivityLogData): Promise<string> {
    try {
      const result = await executeQuery(
        `INSERT INTO user_activity_logs 
         (user_id, action, target_type, target_id, details, ip_address, user_agent) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          data.userId,
          data.action,
          data.targetType || null,
          data.targetId || null,
          data.details ? JSON.stringify(data.details) : null,
          data.ipAddress || null,
          data.userAgent || null
        ]
      )

      return result.insertId || result[0]?.insertId
    } catch (error) {
      console.error('Failed to log user activity:', error)
      throw new Error('사용자 활동 로그 기록에 실패했습니다')
    }
  }

  /**
   * 사용자 활동 로그 조회 (페이지네이션)
   */
  static async getActivityLogs(
    page: number = 1,
    limit: number = 50,
    userId?: string,
    userRole?: string,
    action?: string,
    targetType?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{ logs: UserActivityLog[]; total: number; totalPages: number }> {
    try {
      const offset = (page - 1) * limit
      let whereConditions: string[] = []
      let params: any[] = []

      // 필터 조건 구성
      if (userId) {
        whereConditions.push('ual.user_id = ?')
        params.push(userId)
      }

      if (userRole) {
        whereConditions.push('u.role = ?')
        params.push(userRole)
      }

      if (action) {
        whereConditions.push('ual.action = ?')
        params.push(action)
      }

      if (targetType) {
        whereConditions.push('ual.target_type = ?')
        params.push(targetType)
      }

      if (startDate) {
        whereConditions.push('ual.created_at >= ?')
        params.push(startDate)
      }

      if (endDate) {
        whereConditions.push('ual.created_at <= ?')
        params.push(endDate)
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : ''

      // 총 개수 조회
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM user_activity_logs ual 
        LEFT JOIN users u ON ual.user_id = u.id
        ${whereClause}
      `
      const countResult = await executeQuery(countQuery, params)
      const total = countResult[0]?.total || 0

      // 로그 데이터 조회
      const logsQuery = `
        SELECT 
          ual.id,
          ual.user_id as userId,
          ual.action,
          ual.target_type as targetType,
          ual.target_id as targetId,
          ual.details,
          ual.ip_address as ipAddress,
          ual.user_agent as userAgent,
          ual.created_at as createdAt,
          u.name as userName,
          u.userid as userLoginId,
          u.role as userRole
        FROM user_activity_logs ual
        LEFT JOIN users u ON ual.user_id = u.id
        ${whereClause}
        ORDER BY ual.created_at DESC
        LIMIT ? OFFSET ?
      `

      const logsResult = await executeQuery(logsQuery, [...params, limit, offset])

      const logs = logsResult.map((row: any) => ({
        id: row.id,
        userId: row.userId,
        userName: row.userName,
        userLoginId: row.userLoginId,
        userRole: row.userRole,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        details: row.details ? JSON.parse(row.details) : null,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        createdAt: row.createdAt
      }))

      return {
        logs,
        total,
        totalPages: Math.ceil(total / limit)
      }
    } catch (error) {
      console.error('Failed to get activity logs:', error)
      throw new Error('사용자 활동 로그 조회에 실패했습니다')
    }
  }

  /**
   * 특정 사용자의 최근 활동 조회
   */
  static async getRecentActivityByUser(
    userId: string,
    limit: number = 10
  ): Promise<UserActivityLog[]> {
    try {
      const query = `
        SELECT 
          ual.id,
          ual.user_id as userId,
          ual.action,
          ual.target_type as targetType,
          ual.target_id as targetId,
          ual.details,
          ual.ip_address as ipAddress,
          ual.user_agent as userAgent,
          ual.created_at as createdAt,
          u.name as userName,
          u.role as userRole
        FROM user_activity_logs ual
        LEFT JOIN users u ON ual.user_id = u.id
        WHERE ual.user_id = ?
        ORDER BY ual.created_at DESC
        LIMIT ?
      `

      const result = await executeQuery(query, [userId, limit])

      return result.map((row: any) => ({
        id: row.id,
        userId: row.userId,
        userName: row.userName,
        userRole: row.userRole,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        details: row.details ? JSON.parse(row.details) : null,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        createdAt: row.createdAt
      }))
    } catch (error) {
      console.error('Failed to get recent user activity:', error)
      throw new Error('사용자 최근 활동 조회에 실패했습니다')
    }
  }

  /**
   * 활동 통계 조회
   */
  static async getActivityStats(
    startDate?: Date,
    endDate?: Date,
    userRole?: string
  ): Promise<{
    totalActivities: number
    activitiesByAction: { action: string; count: number }[]
    activitiesByUser: { userId: string; userName: string; userRole: string; count: number }[]
    activitiesByDate: { date: string; count: number }[]
    activitiesByRole: { role: string; count: number }[]
  }> {
    try {
      let whereConditions: string[] = []
      let params: any[] = []

      if (startDate) {
        whereConditions.push('ual.created_at >= ?')
        params.push(startDate)
      }

      if (endDate) {
        whereConditions.push('ual.created_at <= ?')
        params.push(endDate)
      }

      if (userRole) {
        whereConditions.push('u.role = ?')
        params.push(userRole)
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : ''

      // 총 활동 수
      const totalQuery = `
        SELECT COUNT(*) as total 
        FROM user_activity_logs ual 
        LEFT JOIN users u ON ual.user_id = u.id
        ${whereClause}
      `
      const totalResult = await executeQuery(totalQuery, params)
      const totalActivities = totalResult[0]?.total || 0

      // 액션별 통계
      const actionStatsQuery = `
        SELECT ual.action, COUNT(*) as count
        FROM user_activity_logs ual
        LEFT JOIN users u ON ual.user_id = u.id
        ${whereClause}
        GROUP BY ual.action
        ORDER BY count DESC
      `
      const actionStats = await executeQuery(actionStatsQuery, params)

      // 사용자별 통계
      const userStatsQuery = `
        SELECT 
          ual.user_id as userId,
          u.name as userName,
          u.role as userRole,
          COUNT(*) as count
        FROM user_activity_logs ual
        LEFT JOIN users u ON ual.user_id = u.id
        ${whereClause}
        GROUP BY ual.user_id, u.name, u.role
        ORDER BY count DESC
        LIMIT 20
      `
      const userStats = await executeQuery(userStatsQuery, params)

      // 날짜별 통계
      const dateStatsQuery = `
        SELECT 
          DATE(ual.created_at) as date,
          COUNT(*) as count
        FROM user_activity_logs ual
        LEFT JOIN users u ON ual.user_id = u.id
        ${whereClause}
        GROUP BY DATE(ual.created_at)
        ORDER BY date DESC
        LIMIT 30
      `
      const dateStats = await executeQuery(dateStatsQuery, params)

      // 역할별 통계
      const roleStatsQuery = `
        SELECT 
          u.role,
          COUNT(*) as count
        FROM user_activity_logs ual
        LEFT JOIN users u ON ual.user_id = u.id
        ${whereClause}
        GROUP BY u.role
        ORDER BY count DESC
      `
      const roleStats = await executeQuery(roleStatsQuery, params)

      return {
        totalActivities,
        activitiesByAction: actionStats.map((row: any) => ({
          action: row.action,
          count: row.count
        })),
        activitiesByUser: userStats.map((row: any) => ({
          userId: row.userId,
          userName: row.userName,
          userRole: row.userRole,
          count: row.count
        })),
        activitiesByDate: dateStats.map((row: any) => ({
          date: row.date,
          count: row.count
        })),
        activitiesByRole: roleStats.map((row: any) => ({
          role: row.role,
          count: row.count
        }))
      }
    } catch (error) {
      console.error('Failed to get activity stats:', error)
      throw new Error('활동 통계 조회에 실패했습니다')
    }
  }

  /**
   * 로그 삭제 (보관 기간 초과)
   */
  static async deleteOldLogs(retentionDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

      const result = await executeQuery(
        'DELETE FROM user_activity_logs WHERE created_at < ?',
        [cutoffDate]
      )

      return result.affectedRows || 0
    } catch (error) {
      console.error('Failed to delete old logs:', error)
      throw new Error('오래된 로그 삭제에 실패했습니다')
    }
  }

  /**
   * 관리자만의 활동 로그 조회 (하위 호환성)
   */
  static async getAdminActivityLogs(
    page: number = 1,
    limit: number = 50,
    adminId?: string,
    action?: string,
    targetType?: string,
    startDate?: Date,
    endDate?: Date
  ) {
    return this.getActivityLogs(
      page,
      limit,
      adminId,
      'admin', // userRole을 admin으로 고정
      action,
      targetType,
      startDate,
      endDate
    )
  }

  /**
   * 일반 사용자 활동 로그 조회
   */
  static async getUserActivityLogs(
    page: number = 1,
    limit: number = 50,
    userId?: string,
    action?: string,
    targetType?: string,
    startDate?: Date,
    endDate?: Date
  ) {
    return this.getActivityLogs(
      page,
      limit,
      userId,
      'user', // userRole을 user로 고정
      action,
      targetType,
      startDate,
      endDate
    )
  }
}

