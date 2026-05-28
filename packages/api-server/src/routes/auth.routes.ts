import { Router } from 'express'
import { z } from 'zod'
import { AuthService } from '../services/auth.service.js'
import { validateBody } from '../middleware/validation.middleware.js'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware.js'
import { createUserSchema, loginSchema } from '../schemas/user.schema.js'
import { ResponseUtil } from '../utils/response.util.js'
import { executeQuery, callProcedure } from '../lib/database.js'
import { PublicSignupPolicyService } from '../services/auth/publicSignupPolicy.service.js'

const router = Router()

// 리프레시 토큰 스키마
const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, '리프레시 토큰은 필수입니다')
})

// 회원가입
router.post('/register', validateBody(createUserSchema), async (req, res, next) => {
  try {
    const signup = await PublicSignupPolicyService.normalize(req.body)
    const ipAddress = getClientIp(req)
    const userAgent = req.headers['user-agent'] || 'unknown'

    const result = await AuthService.register(
      signup.userid,
      signup.email || '',
      signup.name,
      signup.password,
      signup.role,
      signup.branchId
    )

    // 기본 메뉴 권한은 관리자 승인 시 등록 (auth.routes / admin.routes approve)
    if (result.user.id) {
      await AuthService.recordLoginHistory(result.user.id, true, ipAddress, userAgent)
    }

    return ResponseUtil.created(res, {
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      expiresIn: result.tokens.expiresIn
    }, '가입 신청이 완료되었습니다. 관리자 승인 후 로그인 가능합니다')
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === '이미 존재하는 아이디입니다') {
        return ResponseUtil.conflict(res, error.message)
      }
    }
    if (error instanceof Error) {
      if (error.message === '존재하지 않는 지점입니다') {
        return ResponseUtil.badRequest(res, error.message)
      }
    }
    next(error)
  }
})

// IP 주소 추출 헬퍼 함수
const getClientIp = (req: any): string => {
  return req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    'unknown'
}

// 로그인
router.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const { userid, password } = req.body
    const ipAddress = getClientIp(req)
    const userAgent = req.headers['user-agent'] || 'unknown'

    const result = await AuthService.login(userid, password, ipAddress, userAgent)

    return ResponseUtil.successResponse(res, {
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      expiresIn: result.tokens.expiresIn
    }, '로그인이 완료되었습니다')
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === '아이디 또는 비밀번호가 올바르지 않습니다') {
        return ResponseUtil.unauthorized(res, error.message)
      }
      if (error.message === '관리자 승인 후 로그인 가능합니다') {
        return ResponseUtil.forbidden(res, error.message)
      }
      if (error.message === '사용중지된 사용자계정입니다. 관리자에게 문의하세요.') {
        return ResponseUtil.forbidden(res, error.message)
      }
    }
    next(error)
  }
})

// 토큰 갱신
router.post('/refresh', validateBody(refreshTokenSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body

    const result = await AuthService.refreshAccessToken(refreshToken)

    if (!result) {
      return ResponseUtil.unauthorized(res, '유효하지 않은 리프레시 토큰입니다')
    }

    return ResponseUtil.successResponse(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn
    }, '토큰이 갱신되었습니다')
  } catch (error) {
    next(error)
  }
})

// 로그아웃 (세션 종료)
router.post('/logout', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user?.id
    const authHeader = req.headers['authorization']
    const sessionToken = authHeader && authHeader.split(' ')[1]

    if (userId) {
      await AuthService.logout(userId, sessionToken)
    }

    return ResponseUtil.successResponse(res, null, '로그아웃이 완료되었습니다')
  } catch (error) {
    next(error)
  }
})

// 현재 사용자 정보 조회 (토큰 검증)
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    return ResponseUtil.successResponse(res, {
      user: req.user,
      tokenExpiringSoon: req.tokenExpiringSoon
    })
  } catch (error) {
    next(error)
  }
})

// 현재 사용자 프로필 수정
router.patch('/profile', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id
    const { name, email, password } = req.body

    // name이나 email이 있으면 업데이트
    if (name || email) {
      await executeQuery(
        'CALL sp_update_user(?, NULL, ?, ?, NULL, NULL)',
        [userId, name || null, email || null]
      )
    }

    // password가 있으면 업데이트
    if (password) {
      const hashedPassword = await AuthService.hashPassword(password)
      await executeQuery(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, userId]
      )
    }

    // 업데이트된 사용자 정보 조회
    const results = await callProcedure('sp_get_user_by_token', [userId])
    const updatedUser = AuthService.normalizeUserRow(results[0]?.[0])

    return ResponseUtil.successResponse(res, updatedUser, '프로필이 성공적으로 업데이트되었습니다')
  } catch (error) {
    next(error)
  }
})

// 아이디 중복 확인
router.get('/check-duplicate/:userid', async (req, res, next) => {
  try {
    const { userid } = req.params

    if (!userid || userid.trim() === '') {
      return ResponseUtil.badRequest(res, '아이디를 입력해주세요')
    }

    const exists = await AuthService.checkUserIdExists(userid)

    return ResponseUtil.successResponse(res, {
      exists
    }, exists ? '이미 사용 중인 아이디입니다' : '사용 가능한 아이디입니다')
  } catch (error) {
    next(error)
  }
})

// 토큰 유효성 검사
router.post('/verify', async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]

    if (!token) {
      return ResponseUtil.unauthorized(res, '토큰이 필요합니다')
    }

    const user = await AuthService.getUserFromToken(token)

    if (!user) {
      return ResponseUtil.unauthorized(res, '유효하지 않은 토큰입니다')
    }

    const tokenExpiringSoon = AuthService.isTokenExpiringSoon(token)
    const expirationTime = AuthService.getTokenExpirationTime(token)

    return ResponseUtil.successResponse(res, {
      valid: true,
      user,
      tokenExpiringSoon,
      expirationTime
    })
  } catch (error) {
    return ResponseUtil.unauthorized(res, '토큰 검증에 실패했습니다')
  }
})

export default router