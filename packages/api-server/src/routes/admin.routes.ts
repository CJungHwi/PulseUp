import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware.js'
import { requireAdmin, requireSuperAdmin, logAdminActivity, AdminRequest } from '../middleware/admin.middleware.js'
import { UserActivityService } from '../services/admin/user-activity.service.js'
import { DashboardStatsService } from '../services/admin/dashboard-stats.service.js'
import { executeQuery, callProcedure } from '../lib/database.js'
import { AuthService } from '../services/auth.service.js'
import { DeviceService } from '../services/device.service.js'
import { announcementFilesUpload } from '../middleware/announcement-upload.middleware.js'
import { decodeMultipartFilename, safeAttachmentDisplayName } from '../lib/multipart-filename.js'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const router = Router()

const isBranchAdmin = (req: AdminRequest | any) => req.user?.role === 'branch_admin'

const getRequestBranchId = (req: AdminRequest | any): string | null => {
  const branchId = req.user?.branchId
  return branchId == null || branchId === '' ? null : String(branchId)
}

const ensureUserInBranch = async (req: AdminRequest | any, res: any, userId: string): Promise<boolean> => {
  if (!isBranchAdmin(req)) return true

  const branchId = getRequestBranchId(req)
  if (!branchId) {
    res.status(400).json({
      success: false,
      error: '소속 지점 정보가 없습니다'
    })
    return false
  }

  const rows = await executeQuery(
    'SELECT id FROM users WHERE id = ? AND branch_id = ?',
    [userId, branchId]
  )

  if (rows.length === 0) {
    res.status(403).json({
      success: false,
      error: '소속 지점 사용자만 관리할 수 있습니다'
    })
    return false
  }

  return true
}

// 모든 관리자 라우트에 인증 및 관리자 권한 확인 적용
router.use(authenticateToken as any)
router.use(requireAdmin as any)

/**
 * 관리자 대시보드 - 시스템 개요 정보
 */
router.get('/dashboard',
  logAdminActivity('VIEW_DASHBOARD') as any,
  async (req: any, res) => {
    try {
      const dashboardStats = await DashboardStatsService.getDashboardStats()
      const systemAlerts = await DashboardStatsService.getSystemAlerts()
      const recentImportantActivities = await DashboardStatsService.getRecentImportantActivities(10)

      res.json({
        success: true,
        data: {
          ...dashboardStats,
          systemAlerts,
          recentImportantActivities
        }
      })

    } catch (error) {
      console.error('Dashboard error:', error)
      res.status(500).json({
        success: false,
        error: '대시보드 데이터 조회에 실패했습니다'
      })
    }
  }
)

/**
 * 사용자 관리 - 사용자 목록 조회
 */
router.get('/users',
  logAdminActivity('VIEW_USERS') as any,
  async (req: any, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 20
      const search = req.query.search as string
      const role = req.query.role as string
      const branchId = req.query.branchId as string

      const offset = (page - 1) * limit
      let whereConditions: string[] = []
      let params: any[] = []

      if (search) {
        whereConditions.push('(u.name LIKE ? OR u.userid LIKE ?)')
        params.push(`%${search}%`, `%${search}%`)
      }

      if (role) {
        whereConditions.push('u.role = ?')
        params.push(role)
      }

      if (isBranchAdmin(req)) {
        const scopedBranchId = getRequestBranchId(req)
        if (!scopedBranchId) {
          return res.status(400).json({
            success: false,
            error: '소속 지점 정보가 없습니다'
          })
        }
        whereConditions.push('u.branch_id = ?')
        params.push(scopedBranchId)
      } else if (branchId === 'none') {
        whereConditions.push('u.branch_id IS NULL')
      } else if (branchId && branchId !== 'all') {
        whereConditions.push('u.branch_id = ?')
        params.push(branchId)
      }

      const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : ''

      // 총 사용자 수
      const countResult = await executeQuery(
        `SELECT COUNT(*) as total FROM users u ${whereClause}`,
        params
      )
      const total = countResult[0]?.total || 0

      // 사용자 목록
      const users = await executeQuery(`
        SELECT 
          u.id,
          u.userid,
          u.name,
          u.email,
          u.role,
          u.branch_id,
          b.name as branch_name,
          b.region as branch_region,
          u.is_approved as isApproved,
          u.used as isActive,
          u.created_at,
          u.last_login_at
        FROM users u
        LEFT JOIN branches b ON u.branch_id = b.id
        ${whereClause}
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset])

      // 프론트엔드 형식에 맞게 변환
      const formattedUsers = users.map((user: any) => ({
        ...user,
        branchId: user.branch_id,
        branchName: user.branch_name,
        branchRegion: user.branch_region,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at
      }))

      res.json({
        success: true,
        data: {
          users: formattedUsers,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      })

    } catch (error) {
      console.error('Get users error:', error)
      res.status(500).json({
        success: false,
        error: '사용자 목록 조회에 실패했습니다'
      })
    }
  }
)

/**
 * 사용자 상세 정보 조회
 */
router.get('/users/:id',
  logAdminActivity('VIEW_USER_DETAIL', 'user') as any,
  async (req: any, res) => {
    try {
      const userId = req.params.id

      if (!(await ensureUserInBranch(req, res, userId))) return

      const user = await executeQuery(`
        SELECT 
          u.id,
          u.userid,
          u.name,
          u.role,
          u.branch_id,
          b.name as branch_name,
          b.region as branch_region,
          u.created_at,
          u.last_login_at,
          (SELECT COUNT(*) FROM workout_sessions WHERE user_id = u.id) as total_sessions,
          (SELECT COUNT(*) FROM playlists WHERE user_id = u.id) as total_playlists
        FROM users u
        LEFT JOIN branches b ON u.branch_id = b.id
        WHERE u.id = ?
      `, [userId])

      if (user.length === 0) {
        return res.status(404).json({
          success: false,
          error: '사용자를 찾을 수 없습니다'
        })
      }

      res.json({
        success: true,
        data: user[0]
      })

    } catch (error) {
      console.error('Get user detail error:', error)
      res.status(500).json({
        success: false,
        error: '사용자 정보 조회에 실패했습니다'
      })
    }
  }
)

/**
 * 사용자 생성
 */
router.post('/users',
  requireAdmin as any,
  logAdminActivity('CREATE_USER', 'user') as any,
  async (req: any, res) => {
    try {
      let { userid, name, email, password = '123456', role = 'user', branchId, isApproved = true } = req.body

      // 입력 검증
      if (!userid || !name) {
        return res.status(400).json({
          success: false,
          error: '필수 필드가 누락되었습니다'
        })
      }

      if (!['user', 'branch_admin', 'super_admin'].includes(role)) {
        return res.status(400).json({
          success: false,
          error: '유효하지 않은 역할입니다'
        })
      }

      if (isBranchAdmin(req)) {
        const scopedBranchId = getRequestBranchId(req)
        if (!scopedBranchId) {
          return res.status(400).json({
            success: false,
            error: '소속 지점 정보가 없습니다'
          })
        }

        if (role !== 'user') {
          return res.status(403).json({
            success: false,
            error: '지점관리자는 지점별 사용자만 생성할 수 있습니다'
          })
        }

        branchId = scopedBranchId
        isApproved = true
      }

      // 슈퍼 관리자 생성은 슈퍼 관리자만 가능
      if (role === 'super_admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: '슈퍼 관리자 계정은 슈퍼 관리자만 생성할 수 있습니다'
        })
      }

      // 중복 사용자 확인
      const existingUser = await executeQuery(
        'SELECT id FROM users WHERE userid = ?',
        [userid]
      )

      if (existingUser.length > 0) {
        return res.status(400).json({
          success: false,
          error: '이미 존재하는 사용자 ID입니다'
        })
      }

      // 지점 존재 확인
      if (branchId) {
        const branch = await executeQuery(
          'SELECT id FROM branches WHERE id = ?',
          [branchId]
        )

        if (branch.length === 0) {
          return res.status(400).json({
            success: false,
            error: '존재하지 않는 지점입니다'
          })
        }
      }

      // 비밀번호 해시화
      const { AuthService } = await import('../services/auth.service.js')
      const hashedPassword = await AuthService.hashPassword(password)

      // 사용자 생성 (승인된 상태로)
      const result = await executeQuery(
        'INSERT INTO users (userid, name, email, password, role, branch_id, is_approved, approved_by, approved_at, used) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)',
        [userid, name, email || null, hashedPassword, role, branchId || null, isApproved, req.user.id, true]
      )

      if (isApproved) {
        try {
          await AuthService.createUserMenuItems(userid)
        } catch (menuError) {
          console.error('사용자 생성 후 기본 메뉴 등록 실패:', menuError)
        }
      }

      res.status(201).json({
        success: true,
        message: '사용자가 성공적으로 생성되었습니다',
        data: {
          id: result.insertId,
          userid,
          name,
          email,
          role,
          branchId,
          isApproved
        }
      })

    } catch (error) {
      console.error('Create user error:', error)
      res.status(500).json({
        success: false,
        error: '사용자 생성에 실패했습니다'
      })
    }
  }
)

/**
 * 사용자 정보 수정
 */
router.patch('/users/:id',
  requireAdmin as any,
  logAdminActivity('UPDATE_USER', 'user') as any,
  async (req: any, res) => {
    try {
      const userId = req.params.id
      const { userid, name, email, role, branchId } = req.body

      if (!(await ensureUserInBranch(req, res, userId))) return

      if (isBranchAdmin(req) && role && role !== 'user') {
        return res.status(403).json({
          success: false,
          error: '지점관리자는 지점별 사용자 역할만 수정할 수 있습니다'
        })
      }

      const effectiveBranchId = isBranchAdmin(req) ? getRequestBranchId(req) : branchId

      // console.log('=== 사용자 업데이트 요청 ===')
      // console.log('userId:', userId)
      // console.log('요청 데이터:', { userid, name, email, role, branchId })

      // sp_update_user 프로시저 호출
      const result = await executeQuery(
        'CALL sp_update_user(?, ?, ?, ?, ?, ?)',
        [
          userId,
          userid || null,
          name || null,
          email || null,
          role || null,
          effectiveBranchId || null
        ]
      )

      //console.log('프로시저 실행 결과:', result)

      if (result.length === 0 || !result[0] || result[0].length === 0) {
        return res.status(404).json({
          success: false,
          error: '사용자를 찾을 수 없습니다'
        })
      }

      const updatedUser = result[0][0]
      //console.log('업데이트된 사용자 데이터:', updatedUser)

      res.json({
        success: true,
        message: '사용자 정보가 성공적으로 수정되었습니다',
        data: updatedUser
      })

    } catch (error: any) {
      console.error('Update user error:', error)

      // 프로시저에서 발생한 에러 메시지 처리
      let errorMessage = '사용자 정보 수정에 실패했습니다'
      if (error.sqlMessage) {
        errorMessage = error.sqlMessage
      }

      res.status(500).json({
        success: false,
        error: errorMessage
      })
    }
  }
)

/**
 * 사용자 역할 변경 (슈퍼 관리자만)
 */
router.patch('/users/:id/role',
  requireSuperAdmin as any,
  logAdminActivity('UPDATE_USER_ROLE', 'user') as any,
  async (req: any, res) => {
    try {
      const userId = req.params.id
      const { role } = req.body

      if (!['user', 'branch_admin', 'super_admin'].includes(role)) {
        return res.status(400).json({
          success: false,
          error: '유효하지 않은 역할입니다'
        })
      }

      // 자기 자신의 역할은 변경할 수 없음
      if (userId === req.user.id) {
        return res.status(400).json({
          success: false,
          error: '자신의 역할은 변경할 수 없습니다'
        })
      }

      const result = await executeQuery(
        'UPDATE users SET role = ? WHERE id = ?',
        [role, userId]
      )

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: '사용자를 찾을 수 없습니다'
        })
      }

      res.json({
        success: true,
        message: '사용자 역할이 성공적으로 변경되었습니다'
      })

    } catch (error) {
      console.error('Update user role error:', error)
      res.status(500).json({
        success: false,
        error: '사용자 역할 변경에 실패했습니다'
      })
    }
  }
)

/**
 * 사용자 승인
 */
router.patch('/users/:id/approve',
  requireAdmin as any,
  logAdminActivity('APPROVE_USER', 'user') as any,
  async (req: any, res) => {
    try {
      const userId = req.params.id
      const { approved, role, branchId } = req.body
      const approvedBy = req.user.id

      if (!(await ensureUserInBranch(req, res, userId))) return

      if (typeof approved !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: '유효하지 않은 승인 값입니다'
        })
      }

      if (approved) {
        const targetRows = await executeQuery(
          'SELECT id, userid, name, email, role, branch_id, used FROM users WHERE id = ?',
          [userId]
        )

        if (targetRows.length === 0) {
          return res.status(404).json({
            success: false,
            error: '사용자를 찾을 수 없습니다'
          })
        }

        const targetUser = targetRows[0]
        const isSuperAdmin = req.user.role === 'super_admin'

        if (isBranchAdmin(req) && targetUser.role !== 'user') {
          return res.status(403).json({
            success: false,
            error: '지점관리자는 일반 사용자만 승인할 수 있습니다'
          })
        }

        const approvalRole = isSuperAdmin && role ? role : targetUser.role
        if (!['user', 'branch_admin', 'super_admin'].includes(approvalRole)) {
          return res.status(400).json({
            success: false,
            error: '유효하지 않은 역할입니다'
          })
        }

        const normalizedBranchId = isSuperAdmin
          ? (branchId === undefined ? targetUser.branch_id : (branchId || null))
          : targetUser.branch_id

        if (isSuperAdmin && approvalRole !== 'super_admin' && !normalizedBranchId) {
          return res.status(400).json({
            success: false,
            error: '일반 사용자 또는 지점관리자로 승인하려면 소속 지점을 선택해주세요'
          })
        }

        if (normalizedBranchId) {
          const branchRows = await executeQuery(
            'SELECT id FROM branches WHERE id = ?',
            [normalizedBranchId]
          )
          if (branchRows.length === 0) {
            return res.status(400).json({
              success: false,
              error: '존재하지 않는 지점입니다'
            })
          }
        }

        await executeQuery(
          `UPDATE users
           SET role = ?, branch_id = ?, is_approved = TRUE, approved_by = ?, approved_at = NOW()
           WHERE id = ?`,
          [approvalRole, normalizedBranchId, approvedBy, userId]
        )

        const updatedRows = await executeQuery(
          `SELECT
             u.id,
             u.userid,
             u.name,
             u.email,
             u.role,
             u.branch_id,
             b.name as branch_name,
             b.region as branch_region,
             u.is_approved as isApproved,
             u.used as isActive,
             u.created_at,
             u.last_login_at
           FROM users u
           LEFT JOIN branches b ON u.branch_id = b.id
           WHERE u.id = ?`,
          [userId]
        )

        const updatedUser = updatedRows[0]

        try {
          await AuthService.createUserMenuItems(updatedUser.userid)
        } catch (menuError) {
          console.error('승인 후 기본 메뉴 등록 실패:', menuError)
        }

        res.json({
          success: true,
          message: '사용자가 성공적으로 승인되었습니다',
          data: updatedUser ? {
            ...updatedUser,
            branchId: updatedUser.branch_id,
            branchName: updatedUser.branch_name,
            branchRegion: updatedUser.branch_region,
            createdAt: updatedUser.created_at,
            lastLoginAt: updatedUser.last_login_at
          } : null
        })
      } else {
        // sp_reject_user 프로시저 호출 (승인 취소)
        const result = await executeQuery(
          'CALL sp_reject_user(?, ?)',
          [userId, approvedBy]
        )

        res.json({
          success: true,
          message: '사용자 승인이 취소되었습니다'
        })
      }

    } catch (error) {
      console.error('Approve user error:', error)
      res.status(500).json({
        success: false,
        error: '사용자 승인 처리에 실패했습니다'
      })
    }
  }
)

/**
 * 사용자 비활성화/활성화
 */
router.patch('/users/:id/status',
  requireAdmin as any,
  logAdminActivity('UPDATE_USER_STATUS', 'user') as any,
  async (req: any, res) => {
    try {
      const userId = req.params.id
      const { active } = req.body

      if (!(await ensureUserInBranch(req, res, userId))) return

      if (typeof active !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: '유효하지 않은 상태 값입니다'
        })
      }

      // 자기 자신은 비활성화할 수 없음
      if (userId === req.user.id && !active) {
        return res.status(400).json({
          success: false,
          error: '자신의 계정은 비활성화할 수 없습니다'
        })
      }

      // sp_update_user_status 프로시저 호출
      const result = await executeQuery(
        'CALL sp_update_user_status(?, ?)',
        [userId, active]
      )

      if (result.length === 0) {
        return res.status(404).json({
          success: false,
          error: '사용자를 찾을 수 없습니다'
        })
      }

      res.json({
        success: true,
        message: `사용자가 성공적으로 ${active ? '활성화' : '비활성화'}되었습니다`,
        data: result[0]?.[0] // 업데이트된 사용자 정보 반환
      })

    } catch (error) {
      console.error('Update user status error:', error)
      res.status(500).json({
        success: false,
        error: '사용자 상태 변경에 실패했습니다'
      })
    }
  }
)

/**
 * 사용자 암호 초기화
 */
router.patch('/users/:id/reset-password',
  requireAdmin as any,
  logAdminActivity('RESET_USER_PASSWORD', 'user') as any,
  async (req: any, res) => {
    try {
      const userId = req.params.id

      if (!(await ensureUserInBranch(req, res, userId))) return

      // 사용자 존재 확인
      const existingUser = await executeQuery(
        'SELECT id, userid, name FROM users WHERE id = ?',
        [userId]
      )

      if (existingUser.length === 0) {
        return res.status(404).json({
          success: false,
          error: '사용자를 찾을 수 없습니다'
        })
      }

      // 비밀번호 해시화 (111111)
      const { AuthService } = await import('../services/auth.service.js')
      const hashedPassword = await AuthService.hashPassword('111111')

      // 비밀번호 업데이트
      const result = await executeQuery(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, userId]
      )

      if (result.affectedRows === 0) {
        return res.status(500).json({
          success: false,
          error: '암호 초기화에 실패했습니다'
        })
      }

      res.json({
        success: true,
        message: '암호가 111111로 초기화되었습니다'
      })

    } catch (error) {
      console.error('Reset password error:', error)
      res.status(500).json({
        success: false,
        error: '암호 초기화에 실패했습니다'
      })
    }
  }
)

/**
 * 사용자 삭제 (슈퍼 관리자만)
 */
router.delete('/users/:id',
  requireSuperAdmin as any,
  logAdminActivity('DELETE_USER', 'user') as any,
  async (req: any, res) => {
    try {
      const userId = req.params.id

      // 자기 자신은 삭제할 수 없음
      if (userId === req.user.id) {
        return res.status(400).json({
          success: false,
          error: '자신의 계정은 삭제할 수 없습니다'
        })
      }

      // 사용자 존재 확인
      const existingUser = await executeQuery(
        'SELECT id, name FROM users WHERE id = ?',
        [userId]
      )

      if (existingUser.length === 0) {
        return res.status(404).json({
          success: false,
          error: '사용자를 찾을 수 없습니다'
        })
      }

      // 관련 데이터 확인 (삭제 전 경고)
      const relatedData = await executeQuery(`
        SELECT 
          (SELECT COUNT(*) FROM playlists WHERE user_id = ?) as playlists,
          (SELECT COUNT(*) FROM workout_sessions WHERE user_id = ?) as sessions
      `, [userId, userId])

      const { playlists, sessions } = relatedData[0]

      if (playlists > 0 || sessions > 0) {
        return res.status(400).json({
          success: false,
          error: `사용자에게 연결된 데이터가 있습니다 (플레이리스트: ${playlists}개, 운동 세션: ${sessions}개). 먼저 관련 데이터를 정리해주세요.`,
          details: { playlists, sessions }
        })
      }

      // 사용자 삭제
      const result = await executeQuery(
        'DELETE FROM users WHERE id = ?',
        [userId]
      )

      res.json({
        success: true,
        message: '사용자가 성공적으로 삭제되었습니다'
      })

    } catch (error) {
      console.error('Delete user error:', error)
      res.status(500).json({
        success: false,
        error: '사용자 삭제에 실패했습니다'
      })
    }
  }
)

/**
 * 활동 로그 조회
 */
router.get('/activity-logs',
  logAdminActivity('VIEW_ACTIVITY_LOGS') as any,
  async (req: any, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 50
      const adminId = req.query.adminId as string
      const action = req.query.action as string
      const targetType = req.query.targetType as string
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined

      const result = await UserActivityService.getActivityLogs(
        page,
        limit,
        adminId,
        'admin', // userRole을 admin으로 지정 (관리자 활동만 조회)
        action,
        targetType,
        startDate,
        endDate
      )

      res.json({
        success: true,
        data: result
      })

    } catch (error) {
      console.error('Get activity logs error:', error)
      res.status(500).json({
        success: false,
        error: '활동 로그 조회에 실패했습니다'
      })
    }
  }
)

/**
 * 활동 통계 조회
 */
router.get('/activity-stats',
  logAdminActivity('VIEW_ACTIVITY_STATS') as any,
  async (req: any, res) => {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined

      const stats = await UserActivityService.getActivityStats(startDate, endDate, 'admin')

      res.json({
        success: true,
        data: stats
      })

    } catch (error) {
      console.error('Get activity stats error:', error)
      res.status(500).json({
        success: false,
        error: '활동 통계 조회에 실패했습니다'
      })
    }
  }
)

/**
 * 시스템 설정 조회
 */
router.get('/settings',
  logAdminActivity('VIEW_SYSTEM_SETTINGS') as any,
  async (req: any, res) => {
    try {
      const settings = await executeQuery(`
        SELECT 
          setting_key,
          setting_value,
          description,
          updated_at,
          u.name as updated_by_name
        FROM system_settings ss
        LEFT JOIN users u ON ss.updated_by = u.id
        ORDER BY setting_key
      `)

      const formattedSettings = settings.map((setting: any) => ({
        key: setting.setting_key,
        value: JSON.parse(setting.setting_value) as any,
        description: setting.description,
        updatedAt: setting.updated_at,
        updatedBy: setting.updated_by_name
      }))

      res.json({
        success: true,
        data: formattedSettings
      })

    } catch (error) {
      console.error('Get system settings error:', error)
      res.status(500).json({
        success: false,
        error: '시스템 설정 조회에 실패했습니다'
      })
    }
  }
)

/**
 * 시스템 설정 업데이트 (슈퍼 관리자만)
 */
router.patch('/settings/:key',
  requireSuperAdmin as any,
  logAdminActivity('UPDATE_SYSTEM_SETTING', 'system_setting') as any,
  async (req: any, res) => {
    try {
      const settingKey = req.params.key
      const { value } = req.body

      const result = await executeQuery(
        'UPDATE system_settings SET setting_value = ?, updated_by = ? WHERE setting_key = ?',
        [JSON.stringify(value) as any, req.user.id, settingKey]
      )

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: '설정을 찾을 수 없습니다'
        })
      }

      res.json({
        success: true,
        message: '시스템 설정이 성공적으로 업데이트되었습니다'
      })

    } catch (error) {
      console.error('Update system setting error:', error)
      res.status(500).json({
        success: false,
        error: '시스템 설정 업데이트에 실패했습니다'
      })
    }
  }
)

/**
 * 공지사항 목록 조회
 */
router.get('/announcements',
  logAdminActivity('VIEW_ANNOUNCEMENTS') as any,
  async (req: any, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 20
      const type = req.query.type as string
      const status = req.query.status as string
      const search = req.query.search as string

      // 수정된 프로시저 호출로 공지사항 목록 조회
      const results = await callProcedure('sp_GetAnnouncements', [
        page,
        limit,
        type || null,
        status || null,
        search || null
      ])

      // 프로시저는 두 개의 결과셋을 반환: [총 개수], [공지사항 목록]
      const total = results[0]?.[0]?.total || 0
      const announcements = results[1] || []

      res.json({
        success: true,
        data: {
          items: announcements,
          total,
          page,
          limit
        }
      })

    } catch (error: any) {
      console.error('Get announcements error:', error)
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        sqlMessage: error.sqlMessage,
        code: error.code
      })
      res.status(500).json({
        success: false,
        error: '공지사항 목록 조회에 실패했습니다',
        details: error.message
      })
    }
  }
)

/**
 * 공지사항 첨부파일 업로드 (등록/수정 전에 호출)
 */
router.post(
  '/announcements/attachments',
  requireAdmin as any,
  logAdminActivity('UPLOAD_ANNOUNCEMENT_ATTACHMENTS', 'announcement') as any,
  announcementFilesUpload.array('files', 8),
  async (req: any, res) => {
    try {
      const files = req.files as Express.Multer.File[] | undefined
      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: '업로드할 파일이 없습니다',
        })
      }

      let clientNames: string[] | undefined
      const rawNames = req.body?.originalNames
      if (typeof rawNames === 'string') {
        try {
          const parsed = JSON.parse(rawNames) as unknown
          if (Array.isArray(parsed) && parsed.length === files.length) {
            clientNames = parsed.map((x) => (typeof x === 'string' ? x : ''))
          }
        } catch {
          /* ignore */
        }
      }

      const data = files.map((f, i) => {
        const fromClient = clientNames?.[i]
        const decoded =
          fromClient && fromClient.trim().length > 0
            ? fromClient
            : decodeMultipartFilename(f.originalname)
        return {
          url: `/uploads/announcements/${f.filename}`,
          originalName: safeAttachmentDisplayName(decoded, 'file'),
        }
      })

      return res.status(201).json({
        success: true,
        message: '파일이 업로드되었습니다',
        data: { files: data },
      })
    } catch (error: any) {
      console.error('Announcement attachment upload error:', error)
      return res.status(500).json({
        success: false,
        error: '첨부파일 업로드에 실패했습니다',
      })
    }
  }
)

/**
 * 공지사항 생성
 */
router.post('/announcements',
  requireAdmin as any,
  logAdminActivity('CREATE_ANNOUNCEMENT', 'announcement') as any,
  async (req: any, res) => {
    try {
      const {
        title,
        content,
        type = 'general',
        priority = 'normal',
        targetAudience = 'all',
        branchId,
        isPinned = false,
        startDate,
        endDate,
        attachments,
      } = req.body

      // 필수 필드 검증
      if (!title || !content) {
        return res.status(400).json({
          success: false,
          error: '제목과 내용은 필수입니다'
        })
      }

      // 지점 대상일 때 지점 ID 확인
      if (targetAudience === 'branch' && !branchId) {
        return res.status(400).json({
          success: false,
          error: '지점 대상 공지사항은 지점 ID가 필요합니다'
        })
      }

      if (branchId) {
        const branch = await executeQuery(
          'SELECT id FROM branches WHERE id = ?',
          [branchId]
        )

        if (branch.length === 0) {
          return res.status(400).json({
            success: false,
            error: '존재하지 않는 지점입니다'
          })
        }
      }

      // type 값 매핑 (프론트엔드 -> 데이터베이스)
      const typeMapping: Record<string, string> = {
        'general': 'general',
        'important': 'urgent',  // important -> urgent로 매핑
        'urgent': 'urgent'
      }
      const mappedType = typeMapping[type] || type

      let attachmentsJson: string | null = null
      if (Array.isArray(attachments) && attachments.length > 0) {
        const cleaned = attachments
          .filter((a: any) => a && typeof a.url === 'string' && a.url.startsWith('/uploads/announcements/'))
          .map((a: any) => ({
            url: String(a.url),
            originalName: String(a.originalName || a.originalname || 'file'),
          }))
        if (cleaned.length > 0) {
          attachmentsJson = JSON.stringify(cleaned)
        }
      }

      // 프로시저 호출로 공지사항 생성
      const results = await callProcedure('sp_CreateAnnouncement', [
        title,
        content,
        mappedType,
        priority,
        targetAudience,
        branchId || null,
        req.user.id,
        true, // is_active
        isPinned,
        startDate || null,
        endDate || null,
        attachmentsJson,
      ])

      const createdAnnouncement = results[0][0]

      res.status(201).json({
        success: true,
        message: '공지사항이 성공적으로 생성되었습니다',
        data: createdAnnouncement
      })

    } catch (error) {
      console.error('Create announcement error:', error)
      res.status(500).json({
        success: false,
        error: '공지사항 생성에 실패했습니다'
      })
    }
  }
)

/**
 * 공지사항 수정
 */
router.put('/announcements/:id',
  requireAdmin as any,
  logAdminActivity('UPDATE_ANNOUNCEMENT', 'announcement') as any,
  async (req: any, res) => {
    try {
      const announcementId = req.params.id

      const {
        title,
        content,
        type,
        status,
        priority,
        targetAudience,
        branchId,
        isActive,
        isPinned,
        startDate,
        endDate,
        attachments,
      } = req.body

      // type 값 매핑 (프론트엔드 -> 데이터베이스)
      const typeMapping: Record<string, string> = {
        'general': 'general',
        'important': 'urgent',  // important -> urgent로 매핑
        'urgent': 'urgent'
      }
      const mappedType = type ? typeMapping[type] || type : null

      const attachmentsProvided = Object.prototype.hasOwnProperty.call(req.body, 'attachments')
      let attachmentsJson: string | null | undefined
      if (attachmentsProvided) {
        if (Array.isArray(attachments) && attachments.length > 0) {
          const cleaned = attachments
            .filter((a: any) => a && typeof a.url === 'string' && a.url.startsWith('/uploads/announcements/'))
            .map((a: any) => ({
              url: String(a.url),
              originalName: String(a.originalName || a.originalname || 'file'),
            }))
          attachmentsJson = JSON.stringify(cleaned)
        } else {
          attachmentsJson = JSON.stringify([])
        }
      } else {
        attachmentsJson = null
      }

      // 프로시저 호출로 공지사항 수정
      const results = await callProcedure('sp_UpdateAnnouncement', [
        announcementId,
        title || null,
        content || null,
        mappedType,
        priority || null,
        targetAudience || null,
        branchId || null,
        status ? (status === 'active') : (isActive !== undefined ? isActive : null),
        isPinned !== undefined ? isPinned : null,
        startDate || null,
        endDate || null,
        attachmentsJson,
      ])

      const updatedAnnouncement = results[0][0]

      res.json({
        success: true,
        message: '공지사항이 성공적으로 수정되었습니다',
        data: updatedAnnouncement
      })

    } catch (error) {
      console.error('Update announcement error:', error)
      res.status(500).json({
        success: false,
        error: '공지사항 수정에 실패했습니다'
      })
    }
  }
)

/**
 * 공지사항 삭제
 */
router.delete('/announcements/:id',
  requireAdmin as any,
  logAdminActivity('DELETE_ANNOUNCEMENT', 'announcement') as any,
  async (req: any, res) => {
    try {
      const announcementId = req.params.id

      // 프로시저 호출로 공지사항 삭제
      await callProcedure('sp_DeleteAnnouncement', [announcementId])

      res.json({
        success: true,
        message: '공지사항이 성공적으로 삭제되었습니다'
      })

    } catch (error) {
      console.error('Delete announcement error:', error)
      res.status(500).json({
        success: false,
        error: '공지사항 삭제에 실패했습니다'
      })
    }
  }
)

/**
 * 데이터베이스 백업 요청
 */
router.post('/backup',
  requireSuperAdmin as any,
  logAdminActivity('REQUEST_DATABASE_BACKUP') as any,
  async (req: any, res) => {
    try {
      // 실제 구현에서는 백업 프로세스를 시작
      // 여기서는 시뮬레이션
      const backupId = `backup_${Date.now()}`

      res.json({
        success: true,
        message: '데이터베이스 백업이 요청되었습니다',
        data: {
          backupId,
          status: 'started',
          estimatedTime: '5-10분'
        }
      })

    } catch (error) {
      console.error('Database backup error:', error)
      res.status(500).json({
        success: false,
        error: '데이터베이스 백업 요청에 실패했습니다'
      })
    }
  }
)

/**
 * 백업 상태 조회
 */
router.get('/backup/:id/status',
  requireSuperAdmin as any,
  async (req: any, res) => {
    try {
      const backupId = req.params.id

      // 실제 구현에서는 백업 상태를 조회
      // 여기서는 시뮬레이션
      res.json({
        success: true,
        data: {
          backupId,
          status: 'completed',
          progress: 100,
          fileSize: '125MB',
          completedAt: new Date() as any,
          downloadUrl: `/admin/backup/${backupId}/download`
        }
      })

    } catch (error) {
      console.error('Get backup status error:', error)
      res.status(500).json({
        success: false,
        error: '백업 상태 조회에 실패했습니다'
      })
    }
  }
)

/**
 * 실시간 통계 조회
 */
router.get('/dashboard/realtime',
  logAdminActivity('VIEW_REALTIME_STATS') as any,
  async (req: any, res) => {
    try {
      const realTimeStats = await DashboardStatsService.getRealTimeStats()

      res.json({
        success: true,
        data: realTimeStats
      })

    } catch (error) {
      console.error('Real-time stats error:', error)
      res.status(500).json({
        success: false,
        error: '실시간 통계 조회에 실패했습니다'
      })
    }
  }
)

/**
 * 차트 데이터 조회
 */
router.get('/dashboard/charts/:type',
  logAdminActivity('VIEW_CHART_DATA') as any,
  async (req: any, res) => {
    try {
      const chartType = req.params.type
      const period = req.query.period as string || '30d'

      let chartData

      switch (chartType) {
        case 'user-growth':
          const activityTrends = await DashboardStatsService.getActivityTrends()
          chartData = activityTrends.weeklySignups
          break

        case 'daily-active':
          const dailyTrends = await DashboardStatsService.getActivityTrends()
          chartData = dailyTrends.dailyActiveUsers
          break

        case 'workout-sessions':
          const workoutTrends = await DashboardStatsService.getActivityTrends()
          chartData = workoutTrends.monthlyWorkouts
          break

        default:
          return res.status(400).json({
            success: false,
            error: '지원하지 않는 차트 타입입니다'
          })
      }

      res.json({
        success: true,
        data: chartData
      })

    } catch (error) {
      console.error('Chart data error:', error)
      res.status(500).json({
        success: false,
        error: '차트 데이터 조회에 실패했습니다'
      })
    }
  }
)

/**
 * 시스템 알림 조회
 */
router.get('/dashboard/alerts',
  logAdminActivity('VIEW_SYSTEM_ALERTS') as any,
  async (req: any, res) => {
    try {
      const alerts = await DashboardStatsService.getSystemAlerts()

      res.json({
        success: true,
        data: alerts
      })

    } catch (error) {
      console.error('System alerts error:', error)
      res.status(500).json({
        success: false,
        error: '시스템 알림 조회에 실패했습니다'
      })
    }
  }
)

/**
 * 콘텐츠 관리 - 비디오 관리 (삭제됨 - exercises 테이블에 통합)
 */

/**
 * 콘텐츠 관리 - 모든 플레이리스트 조회
 */
router.get('/content/playlists',
  logAdminActivity('VIEW_ALL_PLAYLISTS') as any,
  async (req: any, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 20
      const search = req.query.search as string

      const offset = (page - 1) * limit
      let whereConditions: string[] = []
      let params: any[] = []

      if (search) {
        whereConditions.push('(p.name LIKE ? OR u.name LIKE ?)')
        params.push(`%${search}%`, `%${search}%`)
      }

      const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : ''

      // 총 플레이리스트 수
      const countResult = await executeQuery(
        `SELECT COUNT(*) as total FROM playlists p 
         LEFT JOIN users u ON p.user_id = u.id ${whereClause}`,
        params
      )
      const total = countResult[0]?.total || 0

      // 플레이리스트 목록
      const playlists = await executeQuery(`
        SELECT 
          p.id,
          p.name,
          p.user_id,
          u.name as user_name,
          u.userid as user_email,
          p.created_at,
          p.updated_at,
          (SELECT COUNT(*) FROM playlist_videos pv WHERE pv.playlist_id = p.id) as video_count,
          (SELECT COUNT(*) FROM workout_sessions ws WHERE ws.playlist_id = p.id) as session_count
        FROM playlists p
        LEFT JOIN users u ON p.user_id = u.id
        ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset])

      res.json({
        success: true,
        data: {
          playlists,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      })

    } catch (error) {
      console.error('Get all playlists error:', error)
      res.status(500).json({
        success: false,
        error: '플레이리스트 목록 조회에 실패했습니다'
      })
    }
  }
)

/**
 * 콘텐츠 관리 - 비디오 삭제
 */
router.delete('/content/videos/:id',
  requireAdmin as any,
  logAdminActivity('DELETE_VIDEO', 'video') as any,
  async (req: any, res) => {
    try {
      const videoId = req.params.id

      // 비디오 존재 확인
      const video = await executeQuery(
        'SELECT id, title FROM videos WHERE id = ?',
        [videoId]
      )

      if (video.length === 0) {
        return res.status(404).json({
          success: false,
          error: '비디오를 찾을 수 없습니다'
        })
      }

      // 관련 데이터 확인
      const relatedData = await executeQuery(`
        SELECT 
          (SELECT COUNT(*) FROM playlist_videos WHERE video_id = ?) as playlist_count
      `, [videoId])

      const { playlist_count } = relatedData[0]

      if (playlist_count > 0) {
        return res.status(400).json({
          success: false,
          error: `이 비디오는 ${playlist_count}개의 플레이리스트에서 사용 중입니다. 먼저 플레이리스트에서 제거해주세요.`,
          details: { playlist_count }
        })
      }

      // 비디오 삭제
      await executeQuery('DELETE FROM videos WHERE id = ?', [videoId])

      res.json({
        success: true,
        message: '비디오가 성공적으로 삭제되었습니다'
      })

    } catch (error) {
      console.error('Delete video error:', error)
      res.status(500).json({
        success: false,
        error: '비디오 삭제에 실패했습니다'
      })
    }
  }
)

/**
 * 콘텐츠 관리 - 플레이리스트 삭제
 */
router.delete('/content/playlists/:id',
  requireAdmin as any,
  logAdminActivity('DELETE_PLAYLIST', 'playlist') as any,
  async (req: any, res) => {
    try {
      const playlistId = req.params.id

      // 플레이리스트 존재 확인
      const playlist = await executeQuery(
        'SELECT id, name, user_id FROM playlists WHERE id = ?',
        [playlistId]
      )

      if (playlist.length === 0) {
        return res.status(404).json({
          success: false,
          error: '플레이리스트를 찾을 수 없습니다'
        })
      }

      // 관련 데이터 확인
      const relatedData = await executeQuery(`
        SELECT 
          (SELECT COUNT(*) FROM workout_sessions WHERE playlist_id = ?) as session_count
      `, [playlistId])

      const { session_count } = relatedData[0]

      if (session_count > 0) {
        return res.status(400).json({
          success: false,
          error: `이 플레이리스트는 ${session_count}개의 운동 세션에서 사용되었습니다. 정말로 삭제하시겠습니까?`,
          details: { session_count }
        })
      }

      // 플레이리스트 삭제 (CASCADE로 playlist_videos도 함께 삭제됨)
      await executeQuery('DELETE FROM playlists WHERE id = ?', [playlistId])

      res.json({
        success: true,
        message: '플레이리스트가 성공적으로 삭제되었습니다'
      })

    } catch (error) {
      console.error('Delete playlist error:', error)
      res.status(500).json({
        success: false,
        error: '플레이리스트 삭제에 실패했습니다'
      })
    }
  }
)

/**
 * 콘텐츠 관리 - 운동 구분 대분류 목록 조회
 */
router.get('/content/workout-major-categories',
  logAdminActivity('VIEW_WORKOUT_CATEGORIES') as any,
  async (req: any, res) => {
    try {
      const results = await callProcedure('sp_GetWorkoutMajorCategories', [])
      const categories = results[0] || []

      res.json({
        success: true,
        data: categories,
        message: '운동 구분 대분류 목록을 조회했습니다'
      })
    } catch (error: any) {
      console.error('Get workout major categories error:', error)
      res.status(500).json({
        success: false,
        error: '운동 구분 대분류 조회에 실패했습니다'
      })
    }
  }
)

/**
 * 콘텐츠 관리 - 운동 목록 조회 및 검색 (통합)
 */
router.get('/content/exercises/list',
  logAdminActivity('GET_EXERCISES') as any,
  async (req: any, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 20
      const majorCategory = req.query.major_category as string
      const searchType = req.query.search_type as string
      const searchKeyword = req.query.search_keyword as string
      const includeInactiveRaw = req.query.include_inactive as string | undefined
      const includeInactive = includeInactiveRaw === 'true' || includeInactiveRaw === '1'

      const results = await callProcedure('sp_GetExercises', [
        majorCategory || null,
        searchType || null,
        searchKeyword || null,
        page,
        limit,
        includeInactive
      ])

      const totalResult = results[0] || []
      const dataResult = results[1] || []

      const total = totalResult[0]?.total || 0
      const exercises = dataResult || []

      res.json({
        success: true,
        data: {
          exercises,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        },
        message: '운동 목록을 조회했습니다'
      })
    } catch (error: any) {
      console.error('Get exercises error:', error)
      res.status(500).json({
        success: false,
        error: '운동 목록 조회에 실패했습니다'
      })
    }
  }
)

/**
 * 콘텐츠 관리 - 운동정보 조회
 */
router.get('/content/exercises',
  logAdminActivity('VIEW_EXERCISES') as any,
  async (req: any, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 20
      const search = req.query.search as string
      const level = req.query.level as string
      const category = req.query.category as string

      const offset = (page - 1) * limit
      let whereConditions: string[] = []
      let params: any[] = []

      if (search) {
        whereConditions.push('(e.name_en LIKE ? OR e.name_ko LIKE ? OR e.characteristics LIKE ?)')
        params.push(`%${search}%`, `%${search}%`, `%${search}%`)
      }

      if (level) {
        whereConditions.push('e.level = ?')
        params.push(level)
      }

      if (category) {
        whereConditions.push('wc.major_category = ?')
        params.push(category)
      }

      const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : ''

      // 총 운동정보 수
      const countResult = await executeQuery(
        `SELECT COUNT(*) as total FROM exercises e 
         LEFT JOIN workout_categories wc ON e.workout_category_id = wc.id ${whereClause}`,
        params
      )
      const total = countResult[0]?.total || 0

      // 운동정보 목록
      const exercises = await executeQuery(`
        SELECT 
          e.id,
          e.number,
          e.level,
          e.name_en,
          e.name_ko,
          e.target_muscles,
          e.characteristics,
          e.equipment,
          e.purpose,
          e.is_bilateral,
          e.is_active,
          e.created_at,
          e.updated_at,
          wc.major_category,
          wc.minor_category
        FROM exercises e
        LEFT JOIN workout_categories wc ON e.workout_category_id = wc.id
        ${whereClause}
        ORDER BY e.number ASC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset])

      res.json({
        success: true,
        data: {
          exercises,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      })

    } catch (error) {
      console.error('Get exercises error:', error)
      res.status(500).json({
        success: false,
        error: '운동정보 조회에 실패했습니다'
      })
    }
  }
)

/**
 * 콘텐츠 관리 - 운동정보 생성
 */
router.post('/content/exercises',
  requireAdmin as any,
  logAdminActivity('CREATE_EXERCISE', 'exercise') as any,
  async (req: any, res) => {
    try {
      const {
        number,
        workoutCategoryId,
        level,
        nameEn,
        nameKo,
        targetMuscles,
        characteristics,
        equipment,
        purpose,
        isBilateral
      } = req.body

      // 필수 필드 검증
      if (!number || !workoutCategoryId || !level || !nameEn || !nameKo || !purpose) {
        return res.status(400).json({
          success: false,
          error: '필수 필드가 누락되었습니다'
        })
      }

      // 운동 번호 중복 확인
      const existingExercise = await executeQuery(
        'SELECT id FROM exercises WHERE number = ?',
        [number]
      )

      if (existingExercise.length > 0) {
        return res.status(400).json({
          success: false,
          error: '이미 존재하는 운동 번호입니다'
        })
      }

      // 운동 카테고리 존재 확인
      const category = await executeQuery(
        'SELECT id FROM workout_categories WHERE id = ?',
        [workoutCategoryId]
      )

      if (category.length === 0) {
        return res.status(400).json({
          success: false,
          error: '존재하지 않는 운동 카테고리입니다'
        })
      }

      // 운동정보 생성
      const result = await executeQuery(`
        INSERT INTO exercises 
        (number, workout_category_id, level, name_en, name_ko, target_muscles, characteristics, equipment, purpose, is_bilateral)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        number,
        workoutCategoryId,
        level,
        nameEn,
        nameKo,
        targetMuscles,
        characteristics,
        equipment,
        purpose,
        !!isBilateral
      ])

      res.status(201).json({
        success: true,
        message: '운동정보가 성공적으로 생성되었습니다',
        data: {
          id: result.insertId,
          number,
          level,
          nameEn,
          nameKo
        }
      })

    } catch (error) {
      console.error('Create exercise error:', error)
      res.status(500).json({
        success: false,
        error: '운동정보 생성에 실패했습니다'
      })
    }
  }
)

/**
 * 콘텐츠 관리 - 운동정보 수정
 */
router.patch('/content/exercises/:id',
  requireAdmin as any,
  logAdminActivity('UPDATE_EXERCISE', 'exercise') as any,
  async (req: any, res) => {
    try {
      const exerciseId = req.params.id
      const {
        level,
        nameEn,
        nameKo,
        targetMuscles,
        characteristics,
        equipment,
        purpose,
        isBilateral,
        isActive
      } = req.body

      // 운동정보 존재 확인
      const existingExercise = await executeQuery(
        'SELECT id FROM exercises WHERE id = ?',
        [exerciseId]
      )

      if (existingExercise.length === 0) {
        return res.status(404).json({
          success: false,
          error: '운동정보를 찾을 수 없습니다'
        })
      }

      // 업데이트할 필드 구성
      const updateFields = []
      const updateValues = []

      if (level) {
        updateFields.push('level = ?')
        updateValues.push(level)
      }

      if (nameEn) {
        updateFields.push('name_en = ?')
        updateValues.push(nameEn)
      }

      if (nameKo) {
        updateFields.push('name_ko = ?')
        updateValues.push(nameKo)
      }

      if (targetMuscles) {
        updateFields.push('target_muscles = ?')
        updateValues.push(targetMuscles)
      }

      if (characteristics) {
        updateFields.push('characteristics = ?')
        updateValues.push(characteristics)
      }

      if (equipment) {
        updateFields.push('equipment = ?')
        updateValues.push(equipment)
      }

      if (purpose) {
        updateFields.push('purpose = ?')
        updateValues.push(purpose)
      }

      if (typeof isBilateral === 'boolean') {
        updateFields.push('is_bilateral = ?')
        updateValues.push(isBilateral)
      }

      if (typeof isActive === 'boolean') {
        updateFields.push('is_active = ?')
        updateValues.push(isActive)
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          error: '업데이트할 필드가 없습니다'
        })
      }

      updateValues.push(exerciseId)

      await executeQuery(
        `UPDATE exercises SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      )

      res.json({
        success: true,
        message: '운동정보가 성공적으로 수정되었습니다'
      })

    } catch (error) {
      console.error('Update exercise error:', error)
      res.status(500).json({
        success: false,
        error: '운동정보 수정에 실패했습니다'
      })
    }
  }
)

/**
 * 콘텐츠 검색
 */
router.get('/content/search',
  logAdminActivity('SEARCH_CONTENT') as any,
  async (req: any, res) => {
    try {
      const query = req.query.q as string
      const type = req.query.type as string // 'videos', 'playlists', 'exercises', 'all'
      const limit = parseInt(req.query.limit as string) || 10

      if (!query) {
        return res.status(400).json({
          success: false,
          error: '검색어를 입력해주세요'
        })
      }

      const results: any = {}

      // 비디오 검색
      if (!type || type === 'videos' || type === 'all') {
        const videos = await executeQuery(`
          SELECT id, title, description, category, duration, created_at
          FROM videos 
          WHERE title LIKE ? OR description LIKE ?
          ORDER BY created_at DESC
          LIMIT ?
        `, [`%${query}%`, `%${query}%`, limit])
        results.videos = videos
      }

      // 플레이리스트 검색
      if (!type || type === 'playlists' || type === 'all') {
        const playlists = await executeQuery(`
          SELECT p.id, p.name, p.created_at, u.name as user_name
          FROM playlists p
          LEFT JOIN users u ON p.user_id = u.id
          WHERE p.name LIKE ?
          ORDER BY p.created_at DESC
          LIMIT ?
        `, [`%${query}%`, limit])
        results.playlists = playlists
      }

      // 운동정보 검색
      if (!type || type === 'exercises' || type === 'all') {
        const exercises = await executeQuery(`
          SELECT e.id, e.number, e.name_en, e.name_ko, e.level, e.purpose, wc.major_category
          FROM exercises e
          LEFT JOIN workout_categories wc ON e.workout_category_id = wc.id
          WHERE e.name_en LIKE ? OR e.name_ko LIKE ? OR e.characteristics LIKE ?
          ORDER BY e.number ASC
          LIMIT ?
        `, [`%${query}%`, `%${query}%`, `%${query}%`, limit])
        results.exercises = exercises
      }

      res.json({
        success: true,
        data: {
          query,
          results,
          totalResults: Object.values(results).reduce((sum: number, arr: any) => sum + arr.length, 0)
        }
      })

    } catch (error) {
      console.error('Content search error:', error)
      res.status(500).json({
        success: false,
        error: '콘텐츠 검색에 실패했습니다'
      })
    }
  }
)

/**
 * 사용자 로그인 이력 조회 (admin/userhistory)
 */
router.get('/userhistory',
  logAdminActivity('VIEW_USER_LOGIN_HISTORY') as any,
  async (req: any, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 20
      const search = req.query.search as string || null
      const branchId = req.query.branchId as string || null
      const onlyActive = req.query.onlyActive === 'true'

      // 프로시저 호출
      const result = await executeQuery(
        'CALL sp_get_user_login_history(?, ?, ?, ?, ?)',
        [page, limit, search, branchId, onlyActive]
      )

      const users = result[0] || []
      const total = users.length > 0 ? users.length : 0

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          },
          summary: {
            totalUsers: total,
            currentlyLoggedIn: users.filter((u: any) => u.is_currently_logged_in).length,
            totalOffline: users.filter((u: any) => !u.is_currently_logged_in).length
          }
        }
      })

    } catch (error) {
      console.error('Get user login history error:', error)
      res.status(500).json({
        success: false,
        error: '사용자 로그인 정보 조회에 실패했습니다'
      })
    }
  }
)

/**
 * 특정 사용자의 상세 로그인 이력 조회
 */
router.get('/userhistory/:userId/sessions',
  logAdminActivity('VIEW_USER_SESSION_DETAIL', 'user') as any,
  async (req: any, res) => {
    try {
      const userId = req.params.userId
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 50

      // 프로시저 호출
      const result = await executeQuery(
        'CALL sp_get_user_session_detail(?, ?, ?)',
        [userId, page, limit]
      )

      if (!result || result.length === 0) {
        return res.status(404).json({
          success: false,
          error: '사용자를 찾을 수 없습니다'
        })
      }

      const user = result[0][0] // 첫 번째 결과셋: 사용자 정보
      const activeSessions = result[1] || [] // 두 번째 결과셋: 활성 세션
      const totalResult = result[2] || [] // 세 번째 결과셋: 총 이력 수
      const sessionHistory = result[3] || [] // 네 번째 결과셋: 세션 이력

      const total = totalResult[0]?.total || 0

      res.json({
        success: true,
        data: {
          user,
          activeSessions,
          sessionHistory,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      })

    } catch (error) {
      console.error('Get user session detail error:', error)
      res.status(500).json({
        success: false,
        error: '사용자 세션 상세 정보 조회에 실패했습니다'
      })
    }
  }
)

/**
 * 사용자 강제 로그아웃
 */
router.post('/userhistory/:userId/logout',
  requireAdmin as any,
  logAdminActivity('FORCE_USER_LOGOUT', 'user') as any,
  async (req: any, res) => {
    try {
      const userId = req.params.userId
      const { sessionId } = req.body

      // 사용자 존재 확인
      const user = await executeQuery(
        'SELECT id, userid, name FROM users WHERE id = ?',
        [userId]
      )

      if (user.length === 0) {
        return res.status(404).json({
          success: false,
          error: '사용자를 찾을 수 없습니다'
        })
      }

      // 프로시저 호출
      const result = await executeQuery(
        'CALL sp_force_user_logout(?, ?)',
        [userId, sessionId || null]
      )

      const affectedSessions = result[0]?.[0]?.affected_sessions || 0

      if (affectedSessions === 0) {
        return res.status(404).json({
          success: false,
          error: '활성화된 세션을 찾을 수 없습니다'
        })
      }

      res.json({
        success: true,
        message: `${user[0].name} (${user[0].userid})의 ${sessionId ? '특정 세션이' : '모든 세션이'} 강제 로그아웃되었습니다`,
        data: {
          affectedSessions
        }
      })

    } catch (error) {
      console.error('Force user logout error:', error)
      res.status(500).json({
        success: false,
        error: '사용자 강제 로그아웃에 실패했습니다'
      })
    }
  }
)

/**
 * 테스트용 엔드포인트
 */
router.get('/test', (req: any, res: any) => {
  res.json({
    success: true,
    message: '관리자 권한 테스트 성공',
    user: req.user
  })
})

/**
 * 유튜브 썸네일 저장
 */
router.post('/content/exercises/save-thumbnail',
  logAdminActivity('SAVE_EXERCISE_THUMBNAIL') as any,
  async (req: any, res) => {
    try {
      const { thumbnailUrl, exerciseId, videoId } = req.body

      if (!thumbnailUrl) {
        return res.status(400).json({
          success: false,
          error: '썸네일 URL이 필요합니다'
        })
      }

      // 썸네일 다운로드
      const response = await fetch(thumbnailUrl)
      if (!response.ok) {
        throw new Error('썸네일 다운로드 실패')
      }

      const buffer = await response.arrayBuffer()
      const uint8Array = new Uint8Array(buffer)

      // 파일명 생성 (videoId 또는 exerciseId 기반)
      const fileName = `${videoId || exerciseId || Date.now()}_thumbnail.jpg`

      // 현재 파일의 디렉토리 경로 구하기
      const __filename = fileURLToPath(import.meta.url)
      const __dirname = path.dirname(__filename)

      // uploads 디렉토리 경로
      const uploadsDir = path.join(__dirname, '../../uploads/thumbnails')

      // 디렉토리가 없으면 생성
      try {
        await fs.access(uploadsDir)
      } catch {
        await fs.mkdir(uploadsDir, { recursive: true })
      }

      // 파일 저장
      const filePath = path.join(uploadsDir, fileName)
      await fs.writeFile(filePath, uint8Array)

      // 저장된 파일의 URL 생성
      const thumbnailPath = `/uploads/thumbnails/${fileName}`

      res.json({
        success: true,
        data: {
          thumbnailPath,
          fileName,
          originalUrl: thumbnailUrl
        },
        message: '썸네일이 성공적으로 저장되었습니다'
      })

    } catch (error) {
      console.error('썸네일 저장 실패:', error)
      res.status(500).json({
        success: false,
        error: '썸네일 저장 중 오류가 발생했습니다'
      })
    }
  }
)

/**
 * Electron 연동 목록 (디바이스 + 등록 사용자)
 */
router.get(
  '/linkages',
  logAdminActivity('VIEW_LINKAGES') as any,
  async (req: AdminRequest, res) => {
    try {
      let filterStoreId: number | null = null
      if (req.user.role !== 'super_admin') {
        filterStoreId = req.user.branchId ? parseInt(String(req.user.branchId), 10) : null
        if (!filterStoreId && req.user.role === 'branch_admin') {
          filterStoreId = 1
        }
        if (filterStoreId == null || Number.isNaN(filterStoreId)) {
          return res.status(400).json({
            success: false,
            error: '매장 정보가 없습니다'
          })
        }
      }

      const rows = await DeviceService.listLinkagesForAdmin(filterStoreId)
      const devices = rows.map((r) => ({
        id: r.id,
        deviceId: r.device_id,
        displayLabel: r.display_label,
        storeId: r.store_id,
        lastSeenAt: r.last_seen_at,
        registeredByUserId: r.registered_by,
        registeredByUserid: r.registeredByUserid,
        registeredByName: r.registeredByName,
        registrantLinkageEnabled:
          r.registrantLinkageEnabled === 1 ||
          r.registrantLinkageEnabled == null
      }))

      res.json({
        success: true,
        data: { devices }
      })
    } catch (error) {
      console.error('GET /admin/linkages error:', error)
      res.status(500).json({
        success: false,
        error: '연동 목록 조회에 실패했습니다'
      })
    }
  }
)

/**
 * 사용자 Electron 연동 사용 여부 (데이터 유지, 연동만 중지)
 */
router.patch(
  '/users/:userId/linkage',
  logAdminActivity('UPDATE_USER_LINKAGE', 'user') as any,
  async (req: AdminRequest, res) => {
    try {
      const { userId } = req.params
      const { linkageEnabled } = req.body

      if (typeof linkageEnabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'linkageEnabled(boolean)가 필요합니다'
        })
      }

      const targets = await executeQuery(
        'SELECT id, branch_id FROM users WHERE id = ?',
        [userId]
      )
      if (!targets.length) {
        return res.status(404).json({
          success: false,
          error: '사용자를 찾을 수 없습니다'
        })
      }

      const targetBranch = (targets[0] as { branch_id: string | null }).branch_id

      if (req.user.role !== 'super_admin') {
        const sameBranch =
          String(targetBranch ?? '') === String(req.user.branchId ?? '')
        if (!sameBranch) {
          return res.status(403).json({
            success: false,
            error: '해당 사용자의 연동 설정을 변경할 권한이 없습니다'
          })
        }
      }

      await executeQuery('UPDATE users SET linkage_enabled = ? WHERE id = ?', [
        linkageEnabled,
        userId
      ])

      res.json({
        success: true,
        message: '연동 사용 여부가 변경되었습니다'
      })
    } catch (error) {
      console.error('PATCH /admin/users/:userId/linkage error:', error)
      res.status(500).json({
        success: false,
        error: '연동 사용 여부 변경에 실패했습니다'
      })
    }
  }
)

export default router