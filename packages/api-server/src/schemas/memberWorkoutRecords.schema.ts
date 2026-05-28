import { z } from 'zod'

export const memberWorkoutRecordsOverviewQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'month는 YYYY-MM 형식이어야 합니다')
    .optional(),
})

export const memberWorkoutHistoryParamsSchema = z.object({
  workoutHistoryMasterId: z.string().min(1, '운동기록 ID가 필요합니다'),
})

export type MemberWorkoutRecordsOverviewQuery = z.infer<typeof memberWorkoutRecordsOverviewQuerySchema>
export type MemberWorkoutHistoryParams = z.infer<typeof memberWorkoutHistoryParamsSchema>
