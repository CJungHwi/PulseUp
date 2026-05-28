import { Response, NextFunction } from 'express'
import { AuthenticatedRequest } from './auth.middleware.js'
import { UserActivityService } from '../services/admin/user-activity.service.js'

export interface AdminRequest extends AuthenticatedRequest {
  user: {
    id: string
    email: string
    name: string
    role: 'branch_admin' | 'super_admin'
    userid: string
    branchId?: string
    branchName?: string
  }
}

/**
 * 지점관리자 이상 권한 검증 미들웨어
 * 사용자가 branch_admin 또는 super_admin 역할을 가지고 있는지 확인
 */
export const requireBranchAdminOrAbove = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: '인증이 필요합니다',
        code: 'AUTHENTICATION_REQUIRED'
      })
    }

    // 사용자 역할 확인
    if (!req.user.role || !['branch_admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: '지점관리자 권한이 필요합니다',
        code: 'BRANCH_ADMIN_REQUIRED'
      })
    }

    next()
  } catch (error) {
    console.error('Admin middleware error:', error)
    return res.status(500).json({
      success: false,
      error: '권한 검증 중 오류가 발생했습니다',
      code: 'PERMISSION_CHECK_ERROR'
    })
  }
}

// 기존 호출처 호환용 alias. 신규 코드는 의미가 명확한 미들웨어를 직접 사용한다.
export const requireAdmin = requireBranchAdminOrAbove

/**
 * 슈퍼 관리자 권한 검증 미들웨어
 * 사용자가 super_admin 역할을 가지고 있는지 확인
 */
export const requireSuperAdmin = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: '인증이 필요합니다',
        code: 'AUTHENTICATION_REQUIRED'
      })
    }

    // 슈퍼 관리자 역할 확인
    if (!req.user.role || req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: '슈퍼 관리자 권한이 필요합니다',
        code: 'SUPER_ADMIN_REQUIRED'
      })
    }

    next()
  } catch (error) {
    console.error('Super admin middleware error:', error)
    return res.status(500).json({
      success: false,
      error: '권한 검증 중 오류가 발생했습니다',
      code: 'PERMISSION_CHECK_ERROR'
    })
  }
}

/**
 * branch_admin 사용자가 자기 지점 리소스에만 접근하도록 제한한다.
 * super_admin은 모든 지점 리소스에 접근할 수 있다.
 */
export const requireSameBranch = (
  getTargetBranchId: (req: AdminRequest) => string | number | null | undefined
) => {
  return async (req: AdminRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: '인증이 필요합니다',
          code: 'AUTHENTICATION_REQUIRED'
        })
      }

      if (req.user.role === 'super_admin') {
        return next()
      }

      const targetBranchId = getTargetBranchId(req)
      const userBranchId = req.user.branchId

      if (!targetBranchId || !userBranchId || String(targetBranchId) !== String(userBranchId)) {
        return res.status(403).json({
          success: false,
          error: '소속 지점의 리소스만 접근할 수 있습니다',
          code: 'BRANCH_SCOPE_REQUIRED'
        })
      }

      next()
    } catch (error) {
      console.error('Same branch middleware error:', error)
      return res.status(500).json({
        success: false,
        error: '지점 권한 검증 중 오류가 발생했습니다',
        code: 'BRANCH_PERMISSION_CHECK_ERROR'
      })
    }
  }
}

/**
 * 관리자 활동 로깅 미들웨어
 * 관리자의 모든 활동을 로그에 기록
 */
export const logAdminActivity = (action: string, targetType?: string) => {
  return async (req: AdminRequest, res: Response, next: NextFunction) => {
    try {
      // 요청 처리 전에 활동 로그 준비
      const originalSend = res.send
      
      res.send = function(data) {
        // 응답이 성공적일 때만 로그 기록
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // 비동기로 로그 기록 (응답 속도에 영향 주지 않도록)
          setImmediate(async () => {
            try {
              await UserActivityService.logActivity({
                userId: req.user.id,
                action,
                targetType,
                targetId: req.params.id || req.body?.id,
                details: {
                  method: req.method,
                  url: req.originalUrl,
                  body: req.method !== 'GET' ? req.body : undefined,
                  query: req.query
                },
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent')
              })
            } catch (logError) {
              console.error('Failed to log admin activity:', logError)
            }
          })
        }
        
        return originalSend.call(this, data)
      }

      next()
    } catch (error) {
      console.error('Admin activity logging middleware error:', error)
      next() // 로깅 실패해도 요청은 계속 처리
    }
  }
}

/**
 * 관리자 권한 레벨 확인 유틸리티
 */
export const hasAdminPermission = (userRole: string, requiredLevel: 'branch_admin' | 'super_admin'): boolean => {
  if (requiredLevel === 'branch_admin') {
    return ['branch_admin', 'super_admin'].includes(userRole)
  }
  
  if (requiredLevel === 'super_admin') {
    return userRole === 'super_admin'
  }
  
  return false
}

/**
 * 관리자 역할 타입 가드
 */
export const isAdminUser = (user: any): user is AdminRequest['user'] => {
  return user && user.role && ['branch_admin', 'super_admin'].includes(user.role)
}