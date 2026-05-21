import { Request, Response, NextFunction } from 'express'
import { AuthService } from '../services/auth.service.js'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string
    name: string
    role: string
    userid: string
    branchId?: string
    branchName?: string
    /** false 이면 Electron 연동·릴레이 제어 불가 */
    linkageEnabled?: boolean
  }
  tokenExpiringSoon?: boolean
}

/**
 * linkage_enabled가 false인 사용자의 Electron 릴레이/등록 등 연동 API 차단
 */
export const requireLinkageEnabled = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const u = req.user
  if (!u) {
    return res.status(401).json({
      success: false,
      error: '인증이 필요합니다',
      code: 'TOKEN_REQUIRED'
    })
  }
  const enabled = u.linkageEnabled !== false
  if (!enabled) {
    return res.status(403).json({
      success: false,
      error: '현재 LINKHIIT앱 연동 사용이 중지되어 있습니다. 관리자에 문의하세요.',
      code: 'LINKAGE_DISABLED'
    })
  }
  next()
}

/**
 * JWT 토큰 인증 미들웨어
 */
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    //console.log(`🔐 인증 미들웨어 - ${req.method} ${req.path}`)
    const authHeader = req.headers['authorization']

    // Authorization 헤더 형식 검증
    if (!authHeader || typeof authHeader !== 'string') {
      //console.log('❌ Authorization 헤더 없음')
      return res.status(401).json({
        success: false,
        error: '액세스 토큰이 필요합니다',
        code: 'TOKEN_REQUIRED'
      })
    }

    // Bearer 토큰 형식 검증
    const parts = authHeader.split(' ')
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      console.log('❌ 잘못된 Authorization 헤더 형식:', authHeader.substring(0, 20))
      return res.status(401).json({
        success: false,
        error: '액세스 토큰 형식이 올바르지 않습니다',
        code: 'INVALID_TOKEN_FORMAT'
      })
    }

    const token = parts[1].trim()

    // 토큰이 비어있는지 확인
    if (!token || token.length === 0) {
      //console.log('❌ 토큰이 비어있음')
      return res.status(401).json({
        success: false,
        error: '액세스 토큰이 필요합니다',
        code: 'TOKEN_REQUIRED'
      })
    }

    // 토큰에서 사용자 정보 추출
    //console.log('🔍 토큰 검증 중...')
    const user = await AuthService.getUserFromToken(token)

    if (!user) {
      //console.log('❌ 유효하지 않은 토큰')
      return res.status(401).json({
        success: false,
        error: '유효하지 않은 토큰입니다',
        code: 'INVALID_TOKEN'
      })
    }

    // 세션 활성 상태 확인 (중복 로그인 방지)
    const isActive = await AuthService.isSessionActive(user.id, token)
    if (!isActive) {
      console.log('❌ 세션이 비활성 상태이거나 만료됨:', user.userid)
      return res.status(401).json({
        success: false,
        error: '세션이 만료되었거나 다른 곳에서 로그인되었습니다',
        code: 'SESSION_INACTIVE'
      })
    }

    // 세션 활동 시간 업데이트 (90분 비활성 타임아웃용)
    await AuthService.updateSessionActivity(user.id, token)

    //console.log('✅ 토큰 검증 성공:', user.userid)

    // 토큰이 곧 만료되는지 확인
    const tokenExpiringSoon = AuthService.isTokenExpiringSoon(token)

    req.user = user
    req.tokenExpiringSoon = tokenExpiringSoon

    // 토큰이 곧 만료되면 응답 헤더에 알림
    if (tokenExpiringSoon) {
      res.setHeader('X-Token-Expiring-Soon', 'true')
    }

    next()
  } catch (error) {
    console.log('❌ 인증 미들웨어 에러:', error)
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        console.log('❌ 토큰 만료됨')
        return res.status(401).json({
          success: false,
          error: '토큰이 만료되었습니다',
          code: 'TOKEN_EXPIRED'
        })
      } else if (error.name === 'JsonWebTokenError') {
        console.log('❌ 잘못된 토큰 형식')
        return res.status(401).json({
          success: false,
          error: '유효하지 않은 토큰입니다',
          code: 'INVALID_TOKEN'
        })
      }
    }

    return res.status(403).json({
      success: false,
      error: '토큰 검증에 실패했습니다',
      code: 'TOKEN_VERIFICATION_FAILED'
    })
  }
}

/**
 * 선택적 인증 미들웨어 (토큰이 있으면 검증하지만 없어도 통과)
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return next()
  }

  try {
    const user = await AuthService.getUserFromToken(token)
    if (user) {
      req.user = user
      req.tokenExpiringSoon = AuthService.isTokenExpiringSoon(token)
    }
  } catch (error) {
    // 선택적 인증이므로 에러가 발생해도 계속 진행
  }

  next()
}

// authMiddleware alias for authenticateToken
export const authMiddleware = authenticateToken