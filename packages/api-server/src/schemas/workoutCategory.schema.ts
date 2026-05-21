import { z } from 'zod';

// 운동구분 생성 스키마
export const createWorkoutCategorySchema = z.object({
  major_category: z.string().min(1, '대분류는 필수입니다').max(100, '대분류는 100자를 초과할 수 없습니다'),
  minor_category: z.string().min(1, '중분류는 필수입니다').max(100, '중분류는 100자를 초과할 수 없습니다'),
  menu_id: z.string().uuid().optional(),
  description: z.string().optional(),
  sort_order: z.number().int().min(0).default(0)
});

// 운동구분 수정 스키마
export const updateWorkoutCategorySchema = z.object({
  major_category: z.string().min(1).max(100).optional(),
  minor_category: z.string().min(1).max(100).optional(),
  menu_id: z.string().uuid().optional(),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional()
});

// 운동구분 조회 쿼리 스키마
export const getWorkoutCategoriesQuerySchema = z.object({
  major_category: z.string().max(100).optional(),
  is_active: z.boolean().optional()
});

// 운동정보 생성 스키마 (운동구분 포함)
export const createExerciseSchema = z.object({
  number: z.number().int().min(1, '운동 번호는 1 이상이어야 합니다'),
  workout_category_id: z.string().uuid('유효한 운동구분 ID가 필요합니다'),
  level: z.enum(['beginner', 'intermediate', 'advanced'], {
    errorMap: () => ({ message: '운동 레벨은 beginner, intermediate, advanced 중 하나여야 합니다' })
  }),
  name_en: z.string().min(1, '영문 운동명은 필수입니다').max(255, '영문 운동명은 255자를 초과할 수 없습니다'),
  name_ko: z.string().min(1, '한글 운동명은 필수입니다').max(255, '한글 운동명은 255자를 초과할 수 없습니다'),
  target_muscles: z.string().min(1, '자극 부위는 필수입니다'),
  characteristics: z.string().optional(),
  equipment: z.string().max(255, '사용 기구는 255자를 초과할 수 없습니다').optional(),
  purpose: z.string().min(1, '운동 목적은 필수입니다').max(255, '운동 목적은 255자를 초과할 수 없습니다'),
  is_active: z.boolean().default(true)
});

// 운동정보 수정 스키마
export const updateExerciseSchema = z.object({
  number: z.number().int().min(1).optional(),
  workout_category_id: z.string().uuid().optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  name_en: z.string().min(1).max(255).optional(),
  name_ko: z.string().min(1).max(255).optional(),
  target_muscles: z.string().min(1).optional(),
  characteristics: z.string().optional(),
  equipment: z.string().max(255).optional(),
  purpose: z.string().min(1).max(255).optional(),
  is_active: z.boolean().optional()
});

// 운동정보 조회 쿼리 스키마
export const getExercisesQuerySchema = z.object({
  workout_category_id: z.string().uuid().optional(),
  major_category: z.string().max(100).optional(),
  minor_category: z.string().max(100).optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  is_active: z.boolean().optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0)
});

// 운동구분 응답 타입
export type CreateWorkoutCategoryRequest = z.infer<typeof createWorkoutCategorySchema>;
export type UpdateWorkoutCategoryRequest = z.infer<typeof updateWorkoutCategorySchema>;
export type GetWorkoutCategoriesQuery = z.infer<typeof getWorkoutCategoriesQuerySchema>;

export type CreateExerciseRequest = z.infer<typeof createExerciseSchema>;
export type UpdateExerciseRequest = z.infer<typeof updateExerciseSchema>;
export type GetExercisesQuery = z.infer<typeof getExercisesQuerySchema>;

export interface WorkoutCategoryResponse {
  id: string;
  major_category: string;
  minor_category: string;
  menu_id?: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  menu_name?: string;
  menu_url?: string;
  exercise_count?: number;
}

export interface ExerciseResponse {
  id: string;
  number: number;
  workout_category_id: string;
  level: string;
  name_en: string;
  name_ko: string;
  target_muscles: string;
  characteristics?: string;
  equipment?: string;
  purpose: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  major_category: string;
  minor_category: string;
}

export interface MinorCategoryResponse {
  id: string;
  minor_category: string;
  menu_id?: string;
  description?: string;
  sort_order: number;
}