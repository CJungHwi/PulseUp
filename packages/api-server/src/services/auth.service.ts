import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { UserService } from './database.service.js'
import { executeQuery, callProcedure, executeTransaction } from '../lib/database.js'

export interface TokenPayload {
  userId: string
  email: string
  type: 'access' | 'refresh'
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
  refreshExpiresIn: number
}

export class AuthService {
  private static readonly ACCESS_TOKEN_EXPIRES_IN = '90m' // 1시간 30분
  private static readonly REFRESH_TOKEN_EXPIRES_IN = '7d' // 7일
  private static readonly SALT_ROUNDS = 12

  /**
   * 비밀번호 해시화
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS)
  }

  /**
   * 비밀번호 검증
   */
  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword)
  }

  /**
   * 액세스 토큰 생성
   */
  static generateAccessToken(userId: string, email: string): string {
    const payload: TokenPayload = {
      userId,
      email,
      type: 'access'
    }

    return jwt.sign(
      payload,
      process.env.JWT_SECRET as string,
      {
        expiresIn: this.ACCESS_TOKEN_EXPIRES_IN,
        issuer: 'multi-monitor-workout-system',
        audience: 'workout-app-users'
      } as SignOptions
    )
  }

  /**
   * 리프레시 토큰 생성
   */
  static generateRefreshToken(userId: string, email: string): string {
    const payload: TokenPayload = {
      userId,
      email,
      type: 'refresh'
    }

    return jwt.sign(
      payload,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET as string,
      {
        expiresIn: this.REFRESH_TOKEN_EXPIRES_IN,
        issuer: 'multi-monitor-workout-system',
        audience: 'workout-app-users'
      } as SignOptions
    )
  }

  /**
   * 액세스 토큰과 리프레시 토큰 모두 생성
   */
  static generateTokens(userId: string, email: string): AuthTokens {
    const accessToken = this.generateAccessToken(userId, email)
    const refreshToken = this.generateRefreshToken(userId, email)

    return {
      accessToken,
      refreshToken,
      expiresIn: 90 * 60, // 1시간 30분 (초 단위)
      refreshExpiresIn: 7 * 24 * 60 * 60 // 7일 (초 단위)
    }
  }

  /**
   * 토큰 검증
   */
  static verifyToken(token: string, isRefreshToken: boolean = false): TokenPayload {
    // 토큰이 비어있거나 유효하지 않은 형식인지 확인
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      throw new Error('토큰이 비어있거나 유효하지 않습니다')
    }

    const secret = isRefreshToken
      ? (process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET)
      : process.env.JWT_SECRET

    if (!secret) {
      throw new Error('JWT 시크릿이 설정되지 않았습니다')
    }

    const decoded = jwt.verify(token.trim(), secret as string, {
      issuer: 'multi-monitor-workout-system',
      audience: 'workout-app-users'
    }) as JwtPayload

    return decoded as TokenPayload
  }

  /**
   * 세션이 활성 상태인지 확인
   */
  static async isSessionActive(userId: string, sessionToken: string): Promise<boolean> {
    try {
      const results = await executeQuery(`
        SELECT COUNT(*) as count 
        FROM user_sessions 
        WHERE user_id = ? 
          AND session_token = ? 
          AND is_active = TRUE 
          AND expires_at > NOW()
          AND TIMESTAMPDIFF(MINUTE, last_activity, NOW()) < 90
      `, [userId, sessionToken])

      return results[0]?.count > 0
    } catch (error) {
      console.error('세션 활성 상태 확인 실패:', error)
      return false
    }
  }

  /**
   * 세션의 last_activity 업데이트
   */
  static async updateSessionActivity(userId: string, sessionToken: string): Promise<void> {
    try {
      await executeQuery(`
        UPDATE user_sessions 
        SET last_activity = NOW() 
        WHERE user_id = ? 
          AND session_token = ? 
          AND is_active = TRUE
      `, [userId, sessionToken])
    } catch (error) {
      console.error('세션 활동 시간 업데이트 실패:', error)
      // 에러가 발생해도 요청을 계속 진행하도록 에러를 던지지 않음
    }
  }

  /**
   * 토큰에서 사용자 정보 추출
   */
  static async getUserFromToken(token: string): Promise<{
    id: string
    email: string
    name: string
    role: string
    userid: string
    branchId?: string
    branchName?: string
    linkageEnabled: boolean
  } | null> {
    try {
      // 토큰이 비어있는지 먼저 확인
      if (!token || typeof token !== 'string' || token.trim().length === 0) {
        //console.error('🔍 getUserFromToken error: 토큰이 비어있습니다')
        return null
      }

      const decoded = this.verifyToken(token)

      //console.log('🔍 getUserFromToken - decoded token:', decoded)

      const results = await callProcedure('sp_get_user_by_token', [decoded.userId])

      //console.log('🔍 getUserFromToken - query results:', results)

      const row = results[0]?.[0]
      return AuthService.normalizeUserRow(row)
    } catch (error) {
      // 인증 관련 에러는 상위로 전파하여 미들웨어에서 처리하도록 함
      if (error instanceof Error && (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError')) {
        throw error
      }

      //console.error('🔍 getUserFromToken error:', error)
      if (error instanceof Error) {
        console.error('🔍 에러 상세:', error.message, error.name)
      }
      return null
    }
  }

  /**
   * 리프레시 토큰으로 새 액세스 토큰 생성
   */
  static async refreshAccessToken(refreshToken: string): Promise<AuthTokens | null> {
    try {
      const decoded = this.verifyToken(refreshToken, true)

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type')
      }

      // 사용자 존재 확인
      const results = await callProcedure('sp_check_user_exists', [decoded.userId])

      const user = results[0]?.[0]
      if (!user) {
        return null
      }

      // 새 토큰 생성
      const tokens = this.generateTokens(user.id, user.userid)

      // 기존 세션의 토큰과 만료 시간 업데이트
      const expiresAt = new Date()
      expiresAt.setTime(expiresAt.getTime() + (tokens.expiresIn * 1000))

      try {
        await callProcedure('sp_update_user_session', [user.id, tokens.accessToken, expiresAt])
      } catch (sessionError: any) {
        // 세션 업데이트 실패 시 로그 출력하지만 계속 진행
        // 중복 키 에러는 프로시저에서 처리되므로 여기서는 로그만 출력
        console.warn('세션 업데이트 중 오류 발생 (계속 진행):', sessionError?.message || sessionError)
        // 프로시저가 중복 키를 처리하지 못한 경우를 대비해 재시도
        if (sessionError?.code === 'ER_DUP_ENTRY' || sessionError?.errno === 1062) {
          // 중복 키 에러인 경우, 기존 세션을 업데이트 시도
          try {
            await callProcedure('sp_update_user_session', [user.id, tokens.accessToken, expiresAt])
          } catch (retryError) {
            console.error('세션 업데이트 재시도 실패:', retryError)
            // 재시도 실패해도 토큰은 반환 (세션 업데이트는 선택사항)
          }
        }
      }

      return tokens
    } catch (error) {
      console.error('토큰 갱신 실패:', error)
      return null
    }
  }

  /**
   * 사용자 등록
   */
  static async register(userid: string, email: string, name: string, password: string, role: string = 'user', branchId?: string | null) {
    // 이미 존재하는 사용자 확인 (아이디로)
    const existingUser = await UserService.authenticateUser(userid)

    if (existingUser) {
      throw new Error('이미 존재하는 아이디입니다')
    }

    // 지점 존재 확인 (branchId가 제공된 경우)
    if (branchId) {
      const { BranchService } = await import('./database.service.js')
      const branch = await BranchService.getBranchById(branchId)
      if (!branch) {
        throw new Error('존재하지 않는 지점입니다')
      }
    }

    // 비밀번호 해시화
    const hashedPassword = await this.hashPassword(password)

    // branchId가 빈 문자열이면 null로 변환
    const finalBranchId = branchId && branchId.trim() !== '' ? branchId : null

    // 사용자 생성
    const result = await UserService.createUser(userid, email, name, hashedPassword, role, finalBranchId)
    const userId = result[0]?.[0]?.user_id

    if (!userId) {
      throw new Error('사용자 생성에 실패했습니다')
    }

    // 공개 회원가입은 역할과 무관하게 반드시 관리자 승인 대기 상태로 둔다.
    await executeQuery(
      'UPDATE users SET is_approved = FALSE, approved_by = NULL, approved_at = NULL WHERE id = ?',
      [userId]
    )

    // 일반 사용자 회원가입 시 관리자 템플릿(운동설정/기본 이미지 URL) 복사
    if (role === 'user') {
      await this.copyAdminWorkoutSettingsToUser(userId)
      await this.copyAdminMonitorImagesToUser(userId)
    }

    const user = {
      id: userId,
      userid,
      email,
      name,
      role,
      branchId: finalBranchId,
      createdAt: new Date()
    }

    // 토큰 생성 (userid 사용)
    const tokens = this.generateTokens(user.id, user.userid)

    return {
      user,
      tokens
    }
  }

  /**
   * 가장 오래된 branch_admin 1명의 운동 설정을 신규 사용자에게 복사
   */
  static async copyAdminWorkoutSettingsToUser(newUserId: string): Promise<void> {
    await executeTransaction([
      async (connection) => {
        const [adminRows] = await connection.execute(
          `SELECT id
           FROM users
           WHERE role = 'branch_admin' AND used = TRUE
           ORDER BY created_at ASC
           LIMIT 1`
        ) as any

        const seedAdminId = adminRows?.[0]?.id
        if (!seedAdminId) {
          throw new Error('운동설정 템플릿 복사 실패: branch_admin 사용자를 찾을 수 없습니다')
        }

        await connection.execute(
          `INSERT INTO workout_setting_profile (
              owner_user_id, method_type, round_no, time_value, rest_value,
              water_break, reps, sort_order, is_active
           )
           SELECT
              ?, method_type, round_no, time_value, rest_value,
              water_break, reps, sort_order, is_active
           FROM workout_setting_profile
           WHERE owner_user_id = ?
           ON DUPLICATE KEY UPDATE
              time_value = VALUES(time_value),
              rest_value = VALUES(rest_value),
              water_break = VALUES(water_break),
              reps = VALUES(reps),
              sort_order = VALUES(sort_order),
              is_active = VALUES(is_active),
              updated_at = CURRENT_TIMESTAMP`,
          [newUserId, seedAdminId]
        )

        return true
      }
    ])
  }

  /**
   * 가장 오래된 branch_admin 1명의 모니터 기본 이미지 URL을 신규 사용자에게 복사
   */
  static async copyAdminMonitorImagesToUser(newUserId: string): Promise<void> {
    await executeTransaction([
      async (connection) => {
        const [adminRows] = await connection.execute(
          `SELECT id
           FROM users
           WHERE role = 'branch_admin' AND used = TRUE
           ORDER BY created_at ASC
           LIMIT 1`
        ) as any

        const seedAdminId = adminRows?.[0]?.id
        if (!seedAdminId) {
          throw new Error('모니터 이미지 템플릿 복사 실패: branch_admin 사용자를 찾을 수 없습니다')
        }

        await connection.execute(
          `INSERT INTO monitor_default_image_profile (
              owner_user_id, side, image_url, is_active
           )
           SELECT
              ?, side, image_url, is_active
           FROM monitor_default_image_profile
           WHERE owner_user_id = ?
           ON DUPLICATE KEY UPDATE
              image_url = VALUES(image_url),
              is_active = VALUES(is_active),
              updated_at = CURRENT_TIMESTAMP`,
          [newUserId, seedAdminId]
        )

        return true
      }
    ])
  }

  /**
   * 사용자 로그인
   */
  static async login(userid: string, password: string, ipAddress?: string, userAgent?: string) {
    //console.log('로그인 시도:', { userid, password: '***', ipAddress })

    // 사용자 찾기 (아이디로)
    const user = await UserService.authenticateUser(userid)
    //console.log('DB에서 찾은 사용자:', user ? { ...user, password: '***' } : null)

    if (!user) {
      // 실패한 로그인 이력 기록
      await this.recordLoginHistory(null, false, ipAddress, userAgent, '존재하지 않는 사용자')
      throw new Error('아이디 또는 비밀번호가 올바르지 않습니다')
    }

    // 비밀번호 확인
    const isPasswordValid = await this.verifyPassword(password, user.password)
    //console.log('비밀번호 검증 결과:', isPasswordValid)

    if (!isPasswordValid) {
      // 실패한 로그인 이력 기록
      await this.recordLoginHistory(user.id, false, ipAddress, userAgent, '잘못된 비밀번호')
      throw new Error('아이디 또는 비밀번호가 올바르지 않습니다')
    }

    // 관리자 승인 상태 확인
    if (!user.is_approved) {
      // 실패한 로그인 이력 기록
      await this.recordLoginHistory(user.id, false, ipAddress, userAgent, '관리자 승인 대기')
      throw new Error('관리자 승인 후 로그인 가능합니다')
    }

    // 사용 중지 상태 확인
    if (!user.used) {
      // 실패한 로그인 이력 기록
      await this.recordLoginHistory(user.id, false, ipAddress, userAgent, '사용중지된 사용자')
      throw new Error('사용중지된 사용자계정입니다. 관리자에게 문의하세요.')
    }

    // 기존 활성 세션 로그아웃 처리 (중복 로그인 방지)
    await this.logoutExistingSessions(user.id)

    // 토큰 생성
    const tokens = this.generateTokens(user.id, user.userid)
    const expiresAt = new Date()
    expiresAt.setTime(expiresAt.getTime() + (tokens.expiresIn * 1000))

    // 새 세션 생성
    await this.createUserSession(user.id, tokens.accessToken, ipAddress, userAgent, expiresAt)

    // 성공한 로그인 이력 기록
    await this.recordLoginHistory(user.id, true, ipAddress, userAgent)

    // 마지막 로그인 시간 업데이트
    await UserService.updateLastLogin(user.id)

    const le = (user as { linkage_enabled?: unknown }).linkage_enabled
    const linkageEnabled =
      le === undefined || le === null ? true : le === true || le === 1 || le === '1'

    return {
      user: {
        id: user.id,
        userid: user.userid,
        email: user.email,
        name: user.name,
        role: user.role,
        branchId: user.branch_id,
        branchName: user.branch_name,
        branchRegion: user.branch_region,
        isApproved: user.is_approved,
        approvedBy: user.approved_by,
        approvedAt: user.approved_at,
        used: user.used,
        linkageEnabled,
        createdAt: user.created_at,
        lastLoginAt: new Date()
      },
      tokens
    }
  }

  /** DB/프로시저 행 → 인증 사용자 객체 (linkage_enabled 컬럼 유무 호환) */
  static normalizeUserRow(row: Record<string, unknown> | null | undefined): {
    id: string
    email: string
    name: string
    role: string
    userid: string
    branchId?: string
    branchName?: string
    linkageEnabled: boolean
  } | null {
    if (!row || typeof row !== 'object' || !row.id) {
      return null
    }
    const le = (row as { linkageEnabled?: unknown; linkage_enabled?: unknown }).linkageEnabled ??
      (row as { linkage_enabled?: unknown }).linkage_enabled
    const linkageEnabled =
      le === undefined || le === null ? true : le === true || le === 1 || le === '1'
    return {
      id: String(row.id),
      email: String(row.email ?? ''),
      name: String(row.name ?? ''),
      role: String(row.role ?? 'user'),
      userid: String(row.userid ?? ''),
      branchId: row.branchId != null ? String(row.branchId) : undefined,
      branchName: row.branchName != null ? String(row.branchName) : undefined,
      linkageEnabled
    }
  }

  /**
   * 토큰 만료 시간 확인
   */
  static getTokenExpirationTime(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as JwtPayload
      if (decoded && decoded.exp) {
        return new Date(decoded.exp * 1000)
      }
      return null
    } catch (error) {
      return null
    }
  }

  /**
   * 토큰이 곧 만료되는지 확인 (5분 이내)
   */
  static isTokenExpiringSoon(token: string): boolean {
    const expirationTime = this.getTokenExpirationTime(token)
    if (!expirationTime) return true

    const now = new Date()
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)

    return expirationTime <= fiveMinutesFromNow
  }

  /**
   * 아이디 중복 확인
   */
  static async checkUserIdExists(userid: string): Promise<boolean> {
    const { UserService } = await import('./database.service.js')
    const existingUser = await UserService.authenticateUser(userid)
    return !!existingUser
  }

  /**
   * 로그인 이력 기록
   */
  static async recordLoginHistory(
    userId: string | null,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    failureReason?: string
  ): Promise<void> {
    try {
      if (!userId) {
        if (success) console.warn('성공한 로그인에 사용자 ID가 없습니다')
        return
      }

      await callProcedure('sp_record_login_history', [userId, ipAddress || null, userAgent || null, success, failureReason || null])

      //console.log('로그인 이력 기록됨:', { userId, success, ipAddress, failureReason })
    } catch (error) {
      console.error('로그인 이력 기록 실패:', error)
      // 로그인 이력 기록 실패가 로그인 프로세스를 방해하지 않도록 에러를 던지지 않음
    }
  }

  /**
   * 기존 활성 세션 로그아웃 (중복 로그인 방지)
   */
  static async logoutExistingSessions(userId: string): Promise<void> {
    try {
      const result = await callProcedure('sp_logout_existing_sessions', [userId])

      const affectedRows = result[0]?.[0]?.affected_rows || 0
      if (affectedRows > 0) {
        //console.log(`사용자 ${userId}의 기존 활성 세션 ${affectedRows}개 로그아웃 처리됨`)
      }
    } catch (error) {
      console.error('기존 세션 로그아웃 실패:', error)
      // 기존 세션 로그아웃 실패가 로그인 프로세스를 방해하지 않도록 에러를 던지지 않음
    }
  }

  /**
   * 새 사용자 세션 생성
   */
  static async createUserSession(
    userId: string,
    sessionToken: string,
    ipAddress?: string,
    userAgent?: string,
    expiresAt?: Date
  ): Promise<void> {
    try {
      await callProcedure('sp_create_user_session', [
        userId,
        sessionToken,
        ipAddress || null,
        userAgent || null,
        expiresAt || new Date(Date.now() + 90 * 60 * 1000) // 1시간 30분
      ])

      //console.log('새 사용자 세션 생성됨:', { userId, ipAddress })
    } catch (error) {
      console.error('사용자 세션 생성 실패:', error)
      // 세션 생성 실패가 로그인 프로세스를 방해하지 않도록 에러를 던지지 않음
    }
  }

  /**
   * 로그아웃 처리 (세션 종료)
   */
  static async logout(userId: string, sessionToken?: string): Promise<void> {
    try {
      // 사용자 세션 로그아웃 처리
      const result = await callProcedure('sp_logout_user_sessions', [userId])

      // 로그인 이력에 로그아웃 시간 업데이트
      const affectedRows = result[0]?.[0]?.affected_rows || 0
      if (affectedRows > 0) {
        await callProcedure('sp_update_login_history_logout', [userId])
        console.log(`사용자 ${userId} 로그아웃 처리됨`)
      }
    } catch (error) {
      console.error('로그아웃 처리 실패:', error)
      throw error
    }
  }

  /**
   * 승인(또는 관리자 생성) 시 사용자 역할 기준 기본 메뉴 권한 등록
   * sp_CreateUserMenuItems 프로시저 호출
   */
  static async createUserMenuItems(userid: string): Promise<void> {
    try {
      //console.log('🔄 사용자별 메뉴 생성 시작:', userid)

      // sp_CreateUserMenuItems 프로시저 호출
      const results = await callProcedure('sp_CreateUserMenuItems', [userid])
      const result = results[0]?.[0]

      // console.log('✅ 사용자별 메뉴 생성 완료:', {
      //   userid,
      //   user_id: result?.user_id,
      //   affected_rows: result?.affected_rows,
      //   message: result?.message
      // })

      // 생성된 결과 확인
      const [createdItems] = await executeQuery(`
        SELECT umi.id, umi.user_id, umi.menu_id, m.name as menu_name, m.parent_id
        FROM user_menu_items umi
        INNER JOIN menus m ON umi.menu_id = m.id
        WHERE umi.user_id = ?
        ORDER BY m.sort_order
      `, [userid])

      //console.log('📝 생성된 사용자 메뉴 항목들:', createdItems)

    } catch (error) {
      console.error('❌ 사용자별 메뉴 생성 실패:', error)
      throw error
    }
  }
}