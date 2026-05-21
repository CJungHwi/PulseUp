import { z } from 'zod'

export const startWorkoutSessionSchema = z.object({
  playlistId: z.string().min(1, '플레이리스트 ID는 필수입니다'),
})

export const endWorkoutSessionSchema = z.object({
  completedVideos: z.array(z.string()).optional(),
})

export const addHeartRateReadingSchema = z.object({
  heartRate: z.number().int().min(30).max(250, '심박수는 30-250 범위여야 합니다'),
  timestamp: z.string().datetime().optional(),
})

export const createWorkoutHistorySchema = z.object({
  sessionId: z.string().min(1, '세션 ID는 필수입니다'),
  date: z.string().datetime(),
  duration: z.number().int().min(0, '운동 시간은 0 이상이어야 합니다'),
  averageHeartRate: z.number().optional(),
  maxHeartRate: z.number().int().min(30).max(250).optional(),
  notes: z.string().optional(),
})

export const updateWorkoutHistorySchema = z.object({
  duration: z.number().int().min(0, '운동 시간은 0 이상이어야 합니다').optional(),
  averageHeartRate: z.number().optional(),
  maxHeartRate: z.number().int().min(30).max(250).optional(),
  notes: z.string().optional(),
})

export type StartWorkoutSessionInput = z.infer<typeof startWorkoutSessionSchema>
export type EndWorkoutSessionInput = z.infer<typeof endWorkoutSessionSchema>
export type AddHeartRateReadingInput = z.infer<typeof addHeartRateReadingSchema>
export type CreateWorkoutHistoryInput = z.infer<typeof createWorkoutHistorySchema>
export type UpdateWorkoutHistoryInput = z.infer<typeof updateWorkoutHistorySchema>