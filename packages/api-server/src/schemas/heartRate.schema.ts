import { z } from 'zod'

const heartRateZoneSchema = z.enum(['rest', 'fat-burn', 'cardio', 'peak']).optional()

const heartRateReadingSchema = z.object({
  deviceId: z.string().min(1, 'deviceId가 필요합니다'),
  deviceName: z.string().optional().nullable(),
  heartRate: z.number().int().positive('heartRate는 1 이상의 정수여야 합니다'),
  timestamp: z.union([z.string().min(1), z.date()]),
  zone: heartRateZoneSchema,
  slotNumber: z.number().int().positive().optional().nullable(),
})

export const heartRateWorkoutParamsSchema = z.object({
  workoutHistoryMasterId: z.string().min(1, '운동기록 ID가 필요합니다'),
})

export const heartRateParticipantParamsSchema = heartRateWorkoutParamsSchema.extend({
  participantId: z.string().min(1, '참가자 매핑 ID가 필요합니다'),
})

export const saveBatchHeartRateSchema = z.object({
  workoutHistoryMasterId: z.string().min(1, '운동기록 ID가 필요합니다'),
  heartRateData: z.array(heartRateReadingSchema).min(1, '심박 데이터가 필요합니다'),
})

export const saveSingleHeartRateSchema = z.object({
  workout_history_master_id: z.string().min(1, '운동기록 ID가 필요합니다'),
  device_id: z.string().min(1, 'device_id가 필요합니다'),
  device_name: z.string().optional().nullable(),
  heart_rate: z.number().int().positive('heart_rate는 1 이상의 정수여야 합니다'),
  timestamp: z.union([z.string().min(1), z.date()]),
  zone: heartRateZoneSchema,
  slot_number: z.number().int().positive().optional().nullable(),
})

export const upsertHeartRateParticipantsSchema = z.object({
  participants: z.array(z.object({
    userId: z.string().min(1, 'userId가 필요합니다'),
    deviceId: z.string().min(1, 'deviceId가 필요합니다'),
    deviceName: z.string().optional().nullable(),
    slotNumber: z.number().int().positive().optional().nullable(),
  })).min(1, '참가자 매핑이 필요합니다'),
})

export type SaveBatchHeartRateInput = z.infer<typeof saveBatchHeartRateSchema>
export type SaveSingleHeartRateInput = z.infer<typeof saveSingleHeartRateSchema>
export type UpsertHeartRateParticipantsInput = z.infer<typeof upsertHeartRateParticipantsSchema>
