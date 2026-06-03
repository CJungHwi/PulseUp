import { Router } from 'express'
import path from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'
import { z } from 'zod'
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.middleware.js'
import { requireAdmin, type AdminRequest } from '../middleware/admin.middleware.js'
import { successResponse, errorResponse } from '../utils/response.util.js'
import { callProcedure, executeTransaction } from '../lib/database.js'
import {
  monitorDisplayService,
  type ExerciseMonitorConfigPayload,
  type MonitorImageKind,
  type MonitorSide
} from '../services/monitorDisplay.service.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const stripApiSuffix = (url: string): string => url.replace(/\/api\/?$/, '').replace(/\/$/, '')

const resolvePublicUploadBaseUrl = (req?: { protocol: string; get: (name: string) => string | undefined }): string => {
  const raw = process.env.PUBLIC_UPLOAD_BASE_URL || process.env.API_BASE_URL
  if (raw) return stripApiSuffix(raw)
  if (req) return `${req.protocol}://${req.get('host')}`
  return process.env.NODE_ENV === 'production' ? 'https://linkhiit.co.kr' : 'http://127.0.0.1:3001'
}

const router = Router()

const monitorSideSchema = z.enum(['left', 'center', 'right'])
const monitorImageKindSchema = z.enum(['default', 'intro'])

const imageSetSchema = z.object({
  leftImageUrl: z.string().optional().nullable(),
  centerImageUrl: z.string().optional().nullable(),
  rightImageUrl: z.string().optional().nullable()
})

const monitorDisplayProfileSaveSchema = z.object({
  defaultImages: imageSetSchema.optional(),
  introImages: imageSetSchema.optional(),
  displayText: z.string().optional().nullable()
})

const monitorDisplayUploadSchema = z.object({
  imageKind: monitorImageKindSchema.default('default'),
  side: monitorSideSchema,
  imageBase64: z.string().min(1, '이미지 데이터가 필요합니다')
})

const exerciseMonitorConfigItemSchema = z.object({
  exerciseId: z.string().min(1),
  defaultImages: imageSetSchema.optional(),
  introImages: imageSetSchema.optional(),
  displayText: z.string().optional().nullable()
})

const exerciseMonitorConfigSaveSchema = z.object({
  configs: z.array(exerciseMonitorConfigItemSchema)
})

const resolveQuerySchema = z.object({
  masterId: z.string().optional(),
  exerciseId: z.string().optional(),
  context: z.enum(['default', 'intro']).default('default')
})

const masterIdParamsSchema = z.object({
  masterId: z.string().min(1)
})

const saveImageSetForUser = async (
  userId: string,
  imageKind: MonitorImageKind,
  set: z.infer<typeof imageSetSchema> | undefined
) => {
  if (!set) return
  const sides: MonitorSide[] = ['left', 'center', 'right']
  const keys = ['leftImageUrl', 'centerImageUrl', 'rightImageUrl'] as const

  for (let i = 0; i < sides.length; i++) {
    const side = sides[i]
    const key = keys[i]
    if (set[key] === undefined) continue
    const val = set[key]
    if (val === null || String(val).trim() === '') {
      await callProcedure('sp_DeleteMonitorDefaultImageProfileSide', [
        userId,
        imageKind,
        side
      ])
    } else {
      await callProcedure('sp_UpsertMonitorDefaultImageProfile', [
        userId,
        imageKind,
        side,
        String(val).trim()
      ])
    }
  }
}

const saveImageSetForSystem = async (
  imageKind: MonitorImageKind,
  set: z.infer<typeof imageSetSchema> | undefined
) => {
  if (!set) return
  const sides: MonitorSide[] = ['left', 'center', 'right']
  const keys = ['leftImageUrl', 'centerImageUrl', 'rightImageUrl'] as const

  for (let i = 0; i < sides.length; i++) {
    const side = sides[i]
    const key = keys[i]
    if (set[key] === undefined) continue
    const val = set[key]
    if (val === null || String(val).trim() === '') {
      await callProcedure('sp_DeleteSystemDefaultImageSide', [imageKind, side])
    } else {
      await callProcedure('sp_UpsertSystemDefaultImage', [
        imageKind,
        side,
        String(val).trim()
      ])
    }
  }
}

const uploadImageFile = async (
  prefix: string,
  side: string,
  imageBase64: string,
  req?: { protocol: string; get: (name: string) => string | undefined }
): Promise<string> => {
  const match = imageBase64.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!match) {
    throw new Error('유효한 base64 이미지 형식이 아닙니다')
  }

  const ext =
    match[1] === 'jpeg' || match[1] === 'jpg'
      ? 'jpg'
      : match[1] === 'png'
        ? 'png'
        : 'jpg'
  const buffer = Buffer.from(match[2], 'base64')

  const uploadsDir = path.join(__dirname, '../../uploads')
  try {
    await fs.access(uploadsDir)
  } catch {
    await fs.mkdir(uploadsDir, { recursive: true })
  }

  const fileName = `${prefix}_${side}_${Date.now()}.${ext}`
  await fs.writeFile(path.join(uploadsDir, fileName), buffer)

  const baseUrl = resolvePublicUploadBaseUrl(req)
  return `${baseUrl}/uploads/${fileName}`
}

/**
 * @route GET /monitor-display-profile
 */
router.get(
  '/monitor-display-profile',
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json(errorResponse('인증 정보가 없습니다'))
      }
      const data = await monitorDisplayService.getUserProfile(userId)
      res.json(successResponse(data, '모니터 표시 설정 조회 성공'))
    } catch (error) {
      console.error('모니터 표시 설정 조회 오류:', error)
      res.status(500).json(errorResponse('모니터 표시 설정 조회에 실패했습니다'))
    }
  }
)

/**
 * @route PUT /monitor-display-profile
 */
router.put(
  '/monitor-display-profile',
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json(errorResponse('인증 정보가 없습니다'))
      }

      const parsed = monitorDisplayProfileSaveSchema.parse(req.body)

      await executeTransaction([
        async () => {
          await saveImageSetForUser(userId, 'default', parsed.defaultImages)
          await saveImageSetForUser(userId, 'intro', parsed.introImages)
          if (parsed.displayText !== undefined) {
            await callProcedure('sp_UpsertMonitorDisplayTextProfile', [
              userId,
              parsed.displayText ?? ''
            ])
          }
          return true
        }
      ])

      res.json(successResponse(true, '모니터 표시 설정 저장 성공'))
    } catch (error) {
      console.error('모니터 표시 설정 저장 오류:', error)
      res.status(500).json(errorResponse('모니터 표시 설정 저장에 실패했습니다'))
    }
  }
)

/**
 * @route POST /monitor-display-profile/upload
 */
router.post(
  '/monitor-display-profile/upload',
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json(errorResponse('인증 정보가 없습니다'))
      }

      const parsed = monitorDisplayUploadSchema.parse(req.body)
      const imageUrl = await uploadImageFile(
        `${userId}_${parsed.imageKind}`,
        parsed.side,
        parsed.imageBase64,
        req
      )

      await callProcedure('sp_UpsertMonitorDefaultImageProfile', [
        userId,
        parsed.imageKind,
        parsed.side,
        imageUrl
      ])

      res.json(
        successResponse(
          { imageUrl, side: parsed.side, imageKind: parsed.imageKind },
          '이미지 업로드 및 저장 완료'
        )
      )
    } catch (error) {
      console.error('모니터 이미지 업로드 오류:', error)
      const errMsg = error instanceof Error ? error.message : '알 수 없는 오류'
      res.status(500).json(errorResponse(`이미지 업로드에 실패했습니다: ${errMsg}`))
    }
  }
)

/**
 * @route POST /monitor-display/upload-image
 * 파일만 업로드하고 URL 반환 (운동 기록 등 로컬 상태용 — 사용자 프로필에는 저장하지 않음)
 */
router.post(
  '/monitor-display/upload-image',
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json(errorResponse('인증 정보가 없습니다'))
      }

      const parsed = monitorDisplayUploadSchema.parse(req.body)
      const imageUrl = await uploadImageFile(
        `draft_${userId}_${parsed.imageKind}`,
        parsed.side,
        parsed.imageBase64,
        req
      )

      res.json(
        successResponse(
          { imageUrl, side: parsed.side, imageKind: parsed.imageKind },
          '이미지 업로드 완료'
        )
      )
    } catch (error) {
      console.error('모니터 이미지 업로드 오류:', error)
      const errMsg = error instanceof Error ? error.message : '알 수 없는 오류'
      res.status(500).json(errorResponse(`이미지 업로드에 실패했습니다: ${errMsg}`))
    }
  }
)

/**
 * @route GET /system-monitor-display-profile
 */
router.get(
  '/system-monitor-display-profile',
  authenticateToken,
  requireAdmin as any,
  async (_req: AdminRequest, res) => {
    try {
      const data = await monitorDisplayService.getSystemProfile()
      res.json(successResponse(data, '시스템 모니터 표시 설정 조회 성공'))
    } catch (error) {
      console.error('시스템 모니터 표시 설정 조회 오류:', error)
      res.status(500).json(errorResponse('시스템 모니터 표시 설정 조회에 실패했습니다'))
    }
  }
)

/**
 * @route PUT /system-monitor-display-profile
 */
router.put(
  '/system-monitor-display-profile',
  authenticateToken,
  requireAdmin as any,
  async (req: AdminRequest, res) => {
    try {
      const parsed = monitorDisplayProfileSaveSchema.parse(req.body)

      await executeTransaction([
        async () => {
          await saveImageSetForSystem('default', parsed.defaultImages)
          await saveImageSetForSystem('intro', parsed.introImages)
          if (parsed.displayText !== undefined) {
            await callProcedure('sp_UpsertSystemDisplayText', [parsed.displayText ?? ''])
          }
          return true
        }
      ])

      res.json(successResponse(true, '시스템 모니터 표시 설정 저장 성공'))
    } catch (error) {
      console.error('시스템 모니터 표시 설정 저장 오류:', error)
      res.status(500).json(errorResponse('시스템 모니터 표시 설정 저장에 실패했습니다'))
    }
  }
)

/**
 * @route POST /system-monitor-display-profile/upload
 */
router.post(
  '/system-monitor-display-profile/upload',
  authenticateToken,
  requireAdmin as any,
  async (req: AdminRequest, res) => {
    try {
      const parsed = monitorDisplayUploadSchema.parse(req.body)
      const imageUrl = await uploadImageFile(
        `system_${parsed.imageKind}`,
        parsed.side,
        parsed.imageBase64,
        req
      )

      await callProcedure('sp_UpsertSystemDefaultImage', [
        parsed.imageKind,
        parsed.side,
        imageUrl
      ])

      res.json(
        successResponse(
          { imageUrl, side: parsed.side, imageKind: parsed.imageKind },
          '시스템 이미지 업로드 완료'
        )
      )
    } catch (error) {
      console.error('시스템 모니터 이미지 업로드 오류:', error)
      const errMsg = error instanceof Error ? error.message : '알 수 없는 오류'
      res.status(500).json(errorResponse(`시스템 이미지 업로드에 실패했습니다: ${errMsg}`))
    }
  }
)

/**
 * @route GET /workout/:masterId/monitor-display-profile
 */
router.get(
  '/workout/:masterId/monitor-display-profile',
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { masterId } = masterIdParamsSchema.parse(req.params)
      const data = await monitorDisplayService.getWorkoutProfile(masterId)
      res.json(successResponse(data, '일자별 모니터 표시 설정 조회 성공'))
    } catch (error) {
      console.error('일자별 모니터 표시 설정 조회 오류:', error)
      res.status(500).json(errorResponse('일자별 모니터 표시 설정 조회에 실패했습니다'))
    }
  }
)

/**
 * @route PUT /workout/:masterId/monitor-display-profile
 */
router.put(
  '/workout/:masterId/monitor-display-profile',
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { masterId } = masterIdParamsSchema.parse(req.params)
      const parsed = monitorDisplayProfileSaveSchema.parse(req.body)
      await monitorDisplayService.saveWorkoutProfile(masterId, {
        defaultImages: {
          leftImageUrl: parsed.defaultImages?.leftImageUrl ?? '',
          centerImageUrl: parsed.defaultImages?.centerImageUrl ?? '',
          rightImageUrl: parsed.defaultImages?.rightImageUrl ?? ''
        },
        introImages: {
          leftImageUrl: parsed.introImages?.leftImageUrl ?? '',
          centerImageUrl: parsed.introImages?.centerImageUrl ?? '',
          rightImageUrl: parsed.introImages?.rightImageUrl ?? ''
        },
        displayText: parsed.displayText ?? ''
      })
      res.json(successResponse(true, '일자별 모니터 표시 설정 저장 성공'))
    } catch (error) {
      console.error('일자별 모니터 표시 설정 저장 오류:', error)
      res.status(500).json(errorResponse('일자별 모니터 표시 설정 저장에 실패했습니다'))
    }
  }
)

/**
 * @route GET /workout/:masterId/exercise-monitor-config
 * @deprecated 운동별 설정 — 일자별 workout monitor-display-profile 사용
 */
router.get(
  '/workout/:masterId/exercise-monitor-config',
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { masterId } = masterIdParamsSchema.parse(req.params)
      const configs = await monitorDisplayService.getWorkoutExerciseConfigs(masterId)
      res.json(successResponse(configs, '운동별 모니터 설정 조회 성공'))
    } catch (error) {
      console.error('운동별 모니터 설정 조회 오류:', error)
      res.status(500).json(errorResponse('운동별 모니터 설정 조회에 실패했습니다'))
    }
  }
)

/**
 * @route PUT /workout/:masterId/exercise-monitor-config
 */
router.put(
  '/workout/:masterId/exercise-monitor-config',
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { masterId } = masterIdParamsSchema.parse(req.params)
      const parsed = exerciseMonitorConfigSaveSchema.parse(req.body)
      const configs: ExerciseMonitorConfigPayload[] = parsed.configs.map((config) => ({
        exerciseId: config.exerciseId,
        defaultImages: config.defaultImages,
        introImages: config.introImages,
        displayText: config.displayText
      }))
      await monitorDisplayService.saveWorkoutExerciseConfigs(masterId, configs)
      res.json(successResponse(true, '운동별 모니터 설정 저장 성공'))
    } catch (error) {
      console.error('운동별 모니터 설정 저장 오류:', error)
      res.status(500).json(errorResponse('운동별 모니터 설정 저장에 실패했습니다'))
    }
  }
)

/**
 * @route GET /monitor-display/resolve
 */
router.get(
  '/monitor-display/resolve',
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json(errorResponse('인증 정보가 없습니다'))
      }

      const query = resolveQuerySchema.parse(req.query)
      const data = await monitorDisplayService.resolveDisplayConfig({
        userId,
        masterId: query.masterId,
        exerciseId: query.exerciseId,
        context: query.context
      })

      res.json(successResponse(data, '모니터 표시 설정 resolve 성공'))
    } catch (error) {
      console.error('모니터 표시 resolve 오류:', error)
      res.status(500).json(errorResponse('모니터 표시 resolve에 실패했습니다'))
    }
  }
)

export default router
