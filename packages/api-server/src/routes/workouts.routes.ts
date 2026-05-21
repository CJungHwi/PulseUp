import { Router } from 'express'
import { z } from 'zod'
// import { prisma } from '../lib/prisma.js'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware.js'
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware.js'
import { 
  startWorkoutSessionSchema, 
  endWorkoutSessionSchema,
  addHeartRateReadingSchema,
  createWorkoutHistorySchema,
  updateWorkoutHistorySchema
} from '../schemas/workout.schema.js'

const router = Router()

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken)

// 운동 세션 시작
router.post('/sessions', validateBody(startWorkoutSessionSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { playlistId } = req.body

    // 플레이리스트 소유권 확인
    const playlist = await prisma.playlist.findFirst({
      where: { 
        id: playlistId,
        userId: req.user!.id 
      }
    })

    if (!playlist) {
      return res.status(404).json({ error: '플레이리스트를 찾을 수 없습니다' })
    }

    const session = await prisma.workoutSession.create({
      data: {
        userId: req.user!.id,
        playlistId,
        startTime: new Date(),
      },
      include: {
        playlist: {
          include: {
            videos: {
              include: {
                video: true
              },
              orderBy: { order: 'asc' }
            }
          }
        }
      }
    })

    res.status(201).json({
      success: true,
      data: session
    })
  } catch (error) {
    next(error)
  }
})

// 운동 세션 종료
const sessionParamsSchema = z.object({
  sessionId: z.string().min(1, '세션 ID는 필수입니다'),
})

router.put('/sessions/:sessionId/end', validateParams(sessionParamsSchema), validateBody(endWorkoutSessionSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { sessionId } = req.params
    const { completedVideos = [] } = req.body

    const session = await prisma.workoutSession.findFirst({
      where: { 
        id: sessionId,
        userId: req.user!.id,
        endTime: null // 아직 종료되지 않은 세션만
      }
    })

    if (!session) {
      return res.status(404).json({ error: '활성 운동 세션을 찾을 수 없습니다' })
    }

    const updatedSession = await prisma.workoutSession.update({
      where: { id: sessionId },
      data: {
        endTime: new Date(),
        completedVideos
      },
      include: {
        playlist: true,
        heartRateData: true
      }
    })

    res.json({
      success: true,
      data: updatedSession
    })
  } catch (error) {
    next(error)
  }
})

// 현재 활성 세션 조회
router.get('/sessions/active', async (req: AuthenticatedRequest, res, next) => {
  try {
    const activeSession = await prisma.workoutSession.findFirst({
      where: { 
        userId: req.user!.id,
        endTime: null
      },
      include: {
        playlist: {
          include: {
            videos: {
              include: {
                video: true
              },
              orderBy: { order: 'asc' }
            }
          }
        },
        heartRateData: {
          orderBy: { timestamp: 'desc' },
          take: 1
        }
      }
    })

    res.json({
      success: true,
      data: activeSession
    })
  } catch (error) {
    next(error)
  }
})

// 심박수 데이터 추가
router.post('/sessions/:sessionId/heartrate', validateParams(sessionParamsSchema), validateBody(addHeartRateReadingSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { sessionId } = req.params
    const { heartRate, timestamp } = req.body

    // 세션 소유권 확인
    const session = await prisma.workoutSession.findFirst({
      where: { 
        id: sessionId,
        userId: req.user!.id 
      }
    })

    if (!session) {
      return res.status(404).json({ error: '운동 세션을 찾을 수 없습니다' })
    }

    const heartRateReading = await prisma.heartRateReading.create({
      data: {
        workoutSessionId: sessionId,
        heartRate,
        timestamp: timestamp ? new Date(timestamp) : new Date()
      }
    })

    res.status(201).json({
      success: true,
      data: heartRateReading
    })
  } catch (error) {
    next(error)
  }
})

// 운동 기록 생성
router.post('/history', validateBody(createWorkoutHistorySchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { sessionId, date, duration, averageHeartRate, maxHeartRate, notes } = req.body

    // 세션 소유권 확인
    const session = await prisma.workoutSession.findFirst({
      where: { 
        id: sessionId,
        userId: req.user!.id 
      }
    })

    if (!session) {
      return res.status(404).json({ error: '운동 세션을 찾을 수 없습니다' })
    }

    const workoutHistory = await prisma.workoutHistory.create({
      data: {
        userId: req.user!.id,
        sessionId,
        date: new Date(date),
        duration,
        averageHeartRate,
        maxHeartRate,
        notes
      },
      include: {
        session: {
          include: {
            playlist: true
          }
        }
      }
    })

    res.status(201).json({
      success: true,
      data: workoutHistory
    })
  } catch (error) {
    next(error)
  }
})

// 운동 기록 목록 조회
const getHistoryQuerySchema = z.object({
  page: z.string().transform(val => parseInt(val) || 1).optional(),
  limit: z.string().transform(val => Math.min(parseInt(val) || 10, 50)).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

router.get('/history', validateQuery(getHistoryQuerySchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { page = 1, limit = 10, startDate, endDate } = req.query as any

    const skip = (page - 1) * limit

    const where: any = {
      userId: req.user!.id
    }

    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = new Date(startDate)
      if (endDate) where.date.lte = new Date(endDate)
    }

    const [history, total] = await Promise.all([
      prisma.workoutHistory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          session: {
            include: {
              playlist: true
            }
          }
        }
      }),
      prisma.workoutHistory.count({ where })
    ])

    res.json({
      success: true,
      data: {
        history,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        }
      }
    })
  } catch (error) {
    next(error)
  }
})

// 운동 기록 상세 조회
const historyParamsSchema = z.object({
  historyId: z.string().min(1, '기록 ID는 필수입니다'),
})

router.get('/history/:historyId', validateParams(historyParamsSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { historyId } = req.params

    const history = await prisma.workoutHistory.findFirst({
      where: { 
        id: historyId,
        userId: req.user!.id 
      },
      include: {
        session: {
          include: {
            playlist: {
              include: {
                videos: {
                  include: {
                    video: true
                  },
                  orderBy: { order: 'asc' }
                }
              }
            },
            heartRateData: {
              orderBy: { timestamp: 'asc' }
            }
          }
        }
      }
    })

    if (!history) {
      return res.status(404).json({ error: '운동 기록을 찾을 수 없습니다' })
    }

    res.json({
      success: true,
      data: history
    })
  } catch (error) {
    next(error)
  }
})

// 운동 기록 수정 (새 revision 생성)
router.put('/history/:historyId', validateParams(historyParamsSchema), validateBody(updateWorkoutHistorySchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { historyId } = req.params
    const updateData = req.body

    // 기존 기록 조회
    const originalHistory = await prisma.workoutHistory.findFirst({
      where: { 
        id: historyId,
        userId: req.user!.id 
      }
    })

    if (!originalHistory) {
      return res.status(404).json({ error: '운동 기록을 찾을 수 없습니다' })
    }

    // 새 revision 생성
    const updatedHistory = await prisma.workoutHistory.update({
      where: { id: historyId },
      data: {
        ...updateData,
        revisionNumber: originalHistory.revisionNumber + 1,
        updatedAt: new Date()
      },
      include: {
        session: {
          include: {
            playlist: true
          }
        }
      }
    })

    res.json({
      success: true,
      data: updatedHistory
    })
  } catch (error) {
    next(error)
  }
})

// 운동 기록 revision 목록 조회
router.get('/history/:historyId/revisions', validateParams(historyParamsSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { historyId } = req.params

    // 기본 기록 조회 (소유권 확인)
    const baseHistory = await prisma.workoutHistory.findFirst({
      where: { 
        id: historyId,
        userId: req.user!.id 
      }
    })

    if (!baseHistory) {
      return res.status(404).json({ error: '운동 기록을 찾을 수 없습니다' })
    }

    // 모든 revision 조회 (현재는 단일 기록이지만 확장 가능)
    const revisions = [{
      revisionNumber: baseHistory.revisionNumber,
      date: baseHistory.date,
      duration: baseHistory.duration,
      averageHeartRate: baseHistory.averageHeartRate,
      maxHeartRate: baseHistory.maxHeartRate,
      notes: baseHistory.notes,
      createdAt: baseHistory.createdAt,
      updatedAt: baseHistory.updatedAt
    }]

    res.json({
      success: true,
      data: {
        historyId,
        currentRevision: baseHistory.revisionNumber,
        revisions
      }
    })
  } catch (error) {
    next(error)
  }
})

// 운동 기록 revision 비교
const compareRevisionsSchema = z.object({
  fromRevision: z.number().min(1),
  toRevision: z.number().min(1)
})

router.post('/history/:historyId/compare', validateParams(historyParamsSchema), validateBody(compareRevisionsSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { historyId } = req.params
    const { fromRevision, toRevision } = req.body

    // 기본 기록 조회 (소유권 확인)
    const history = await prisma.workoutHistory.findFirst({
      where: { 
        id: historyId,
        userId: req.user!.id 
      }
    })

    if (!history) {
      return res.status(404).json({ error: '운동 기록을 찾을 수 없습니다' })
    }

    // 현재는 단일 revision만 지원하므로 기본 비교 정보 제공
    const comparison = {
      historyId,
      fromRevision,
      toRevision,
      changes: {
        duration: {
          from: history.duration,
          to: history.duration,
          changed: false
        },
        averageHeartRate: {
          from: history.averageHeartRate,
          to: history.averageHeartRate,
          changed: false
        },
        maxHeartRate: {
          from: history.maxHeartRate,
          to: history.maxHeartRate,
          changed: false
        },
        notes: {
          from: history.notes,
          to: history.notes,
          changed: false
        }
      },
      summary: {
        totalChanges: 0,
        lastModified: history.updatedAt
      }
    }

    res.json({
      success: true,
      data: comparison
    })
  } catch (error) {
    next(error)
  }
})

// 운동 통계 조회
router.get('/stats', async (req: AuthenticatedRequest, res, next) => {
  try {
    const [totalSessions, totalDuration, avgHeartRate, recentSessions] = await Promise.all([
      prisma.workoutSession.count({
        where: { 
          userId: req.user!.id,
          endTime: { not: null }
        }
      }),
      prisma.workoutHistory.aggregate({
        where: { userId: req.user!.id },
        _sum: { duration: true }
      }),
      prisma.workoutHistory.aggregate({
        where: { 
          userId: req.user!.id,
          averageHeartRate: { not: null }
        },
        _avg: { averageHeartRate: true }
      }),
      prisma.workoutHistory.findMany({
        where: { userId: req.user!.id },
        take: 7,
        orderBy: { date: 'desc' },
        select: {
          date: true,
          duration: true,
          averageHeartRate: true
        }
      })
    ])

    res.json({
      success: true,
      data: {
        totalSessions,
        totalDuration: totalDuration._sum.duration || 0,
        averageHeartRate: avgHeartRate._avg.averageHeartRate || 0,
        recentSessions
      }
    })
  } catch (error) {
    next(error)
  }
})

export default router