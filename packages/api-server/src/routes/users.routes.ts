import { Router } from 'express'
// import { prisma } from '../lib/prisma.js'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware.js'
import { validateBody } from '../middleware/validation.middleware.js'
import { updateUserSchema } from '../schemas/user.schema.js'

const router = Router()

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken)

// 현재 사용자 정보 조회
router.get('/me', async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: {
            playlists: true,
            workoutSessions: true,
          }
        }
      }
    })

    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다' })
    }

    res.json({
      success: true,
      data: user
    })
  } catch (error) {
    next(error)
  }
})

// 사용자 정보 수정
router.put('/me', validateBody(updateUserSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { name, email } = req.body

    // 이메일 중복 확인 (다른 사용자가 사용 중인지)
    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id: req.user!.id }
        }
      })

      if (existingUser) {
        return res.status(409).json({ error: '이미 사용 중인 이메일입니다' })
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        lastLoginAt: true,
      }
    })

    res.json({
      success: true,
      data: updatedUser
    })
  } catch (error) {
    next(error)
  }
})

// 사용자 계정 삭제
router.delete('/me', async (req: AuthenticatedRequest, res, next) => {
  try {
    await prisma.user.delete({
      where: { id: req.user!.id }
    })

    res.json({
      success: true,
      message: '계정이 성공적으로 삭제되었습니다'
    })
  } catch (error) {
    next(error)
  }
})

export default router