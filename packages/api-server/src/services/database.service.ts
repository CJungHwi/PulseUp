import { callProcedure, executeQuery } from '../lib/database.js'
import { randomUUID } from 'crypto'

// 지점 관리 서비스
export class BranchService {
  static async createBranch(name: string, address: string, phone: string, region: string, manager: string) {
    const result = await executeQuery(
      'INSERT INTO branches (name, address, phone, region, manager) VALUES (?, ?, ?, ?, ?)',
      [name, address, phone, region, manager]
    )
    return result
  }

  static async getBranches() {
    const branches = await executeQuery('SELECT * FROM branches ORDER BY name ASC')
    return [branches] // 프로시저 형태로 반환하기 위해 배열로 감싸기
  }

  static async getBranchById(branchId: string) {
    const results = await executeQuery('SELECT * FROM branches WHERE id = ?', [branchId])
    return results[0] || null
  }

  static async updateBranch(branchId: string, name: string, address: string, phone: string, region: string, manager: string) {
    const result = await executeQuery(
      'UPDATE branches SET name = ?, address = ?, phone = ?, region = ?, manager = ? WHERE id = ?',
      [name, address, phone, region, manager, branchId]
    )
    return result
  }

  static async deleteBranch(branchId: string) {
    const result = await executeQuery('DELETE FROM branches WHERE id = ?', [branchId])
    return result
  }
}

// 사용자 관리 서비스
export class UserService {
  static async createUser(userid: string, email: string, name: string, hashedPassword: string, role: string = 'user', branchId?: string | null) {
    return await callProcedure('sp_create_user', [userid, email, name, hashedPassword, role, branchId || null])
  }

  static async authenticateUser(userid: string) {
    //console.log('DB 조회 시도:', { userid })
    // sp_authenticate_user는 used=1 인 사용자만 반환하므로, 직접 쿼리로 조회하여 used 상태 확인 가능하게 함
    const query = `
      SELECT u.id, u.userid, u.email, u.name, u.password, u.role, u.branch_id, u.last_login_at,
             u.is_approved, u.approved_by, u.approved_at, u.used, u.linkage_enabled,
             b.name as branch_name, b.region as branch_region
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      WHERE u.userid = ?
    `
    const results = await executeQuery(query, [userid])
    // executeQuery는 [rows, fields]를 반환하거나 rows를 반환하는데, lib/database.ts 구현에 따라 다름.
    // 기존 executeQuery 사용 패턴(BranchService.getBranches 등)을 보면 results가 바로 rows 배열임.
    // 하지만 callProcedure는 [[rows], fields] 형태.

    // results가 배열이고 첫 번째 요소가 행 데이터인지 확인 필요.
    // executeQuery 구현을 보면 return [rows] or rows via pool.query
    // 보통 mysql2의 query는 [rows, fields] 반환. helper executeQuery가 rows만 반환하는지 확인 필요하지만
    // 여기서는 안전하게 처리. 

    // BranchService.getBranchById를 보면 results[0]을 사용함. 즉 results는 rows 배열임.

    //console.log('DB 조회 결과:', results)
    const user = results[0] || null
    //console.log('반환할 사용자:', user ? { ...user, password: '***' } : null)
    return user
  }

  static async updateLastLogin(userId: string) {
    return await callProcedure('sp_update_last_login', [userId])
  }

  static async updateUser(userId: string, name: string, branchId?: string) {
    return await callProcedure('sp_update_user', [userId, name, branchId])
  }

  static async getUsersByBranch(branchId: string) {
    return await callProcedure('sp_get_users_by_branch', [branchId])
  }

  static async getUserById(userId: string) {
    const results = await callProcedure('sp_get_user_by_id', [userId])
    return results[0]?.[0] || null
  }
}

// 동영상 관리 서비스 (삭제됨 - exercises 테이블에 통합)

// 플레이리스트 관리 서비스
export class PlaylistService {
  static async createPlaylist(userId: string, name: string) {
    return await callProcedure('sp_create_playlist', [userId, name])
  }

  static async addVideoToPlaylist(playlistId: string, videoId: string, orderNum: number) {
    return await callProcedure('sp_add_video_to_playlist', [playlistId, videoId, orderNum])
  }

  static async getPlaylistWithVideos(playlistId: string) {
    return await callProcedure('sp_get_playlist_with_videos', [playlistId])
  }

  static async getUserPlaylists(userId: string) {
    const query = `
      SELECT p.*, COUNT(pv.id) as video_count
      FROM playlists p
      LEFT JOIN playlist_videos pv ON p.id = pv.playlist_id
      WHERE p.user_id = ?
      GROUP BY p.id
      ORDER BY p.updated_at DESC
    `
    return await executeQuery(query, [userId])
  }
}

// 운동 세션 관리 서비스
export class WorkoutService {
  static async startSession(userId: string, playlistId?: string) {
    return await callProcedure('sp_start_workout_session', [userId, playlistId])
  }

  static async endSession(
    sessionId: string,
    completedVideos: string[],
    caloriesBurned?: number,
    averageHeartRate?: number,
    maxHeartRate?: number
  ) {
    const completedVideosJson = JSON.stringify(completedVideos)
    return await callProcedure('sp_end_workout_session', [
      sessionId,
      completedVideosJson,
      caloriesBurned,
      averageHeartRate,
      maxHeartRate
    ])
  }

  static async saveHeartRateData(sessionId: string, heartRateData: Array<{
    timestamp: string
    heartRate: number
  }>) {
    const heartRateJson = JSON.stringify(heartRateData)
    return await callProcedure('sp_save_heart_rate_batch', [sessionId, heartRateJson])
  }

  static async getActiveSession(userId: string) {
    const query = `
      SELECT * FROM workout_sessions 
      WHERE user_id = ? AND status IN ('active', 'paused')
      ORDER BY start_time DESC 
      LIMIT 1
    `
    const results = await executeQuery(query, [userId])
    return results[0] || null
  }
}

// 운동 기록 및 통계 서비스
export class HistoryService {
  static async createWorkoutHistory(historyData: {
    userId: string
    sessionId?: string
    playlistId?: string
    date: string
    duration: number
    caloriesBurned?: number
    averageHeartRate?: number
    maxHeartRate?: number
    categories?: string
    notes?: string
  }) {
    return await callProcedure('sp_create_workout_history', [
      historyData.userId,
      historyData.sessionId,
      historyData.playlistId,
      historyData.date,
      historyData.duration,
      historyData.caloriesBurned,
      historyData.averageHeartRate,
      historyData.maxHeartRate,
      historyData.categories,
      historyData.notes
    ])
  }

  static async getUserStats(userId: string, startDate: string, endDate: string) {
    return await callProcedure('sp_get_user_workout_stats', [userId, startDate, endDate])
  }

  static async getRecentWorkouts(userId: string, limit: number = 10) {
    return await callProcedure('sp_get_recent_workouts', [userId, limit])
  }

  static async getWorkoutHistory(userId: string, filters: {
    startDate?: string
    endDate?: string
    category?: string
    limit: number
    offset: number
  }) {
    let query = `
      SELECT wh.*, p.name as playlist_name
      FROM workout_history wh
      LEFT JOIN playlists p ON wh.playlist_id = p.id
      WHERE wh.user_id = ?
    `
    const params = [userId]

    if (filters.startDate) {
      query += ' AND wh.date >= ?'
      params.push(filters.startDate)
    }

    if (filters.endDate) {
      query += ' AND wh.date <= ?'
      params.push(filters.endDate)
    }

    if (filters.category) {
      query += ' AND wh.categories LIKE ?'
      params.push(`%${filters.category}%`)
    }

    query += ' ORDER BY wh.date DESC, wh.created_at DESC LIMIT ? OFFSET ?'
    params.push(filters.limit.toString(), filters.offset.toString())

    return await executeQuery(query, params)
  }
}