/**
 * MonthProgram — 공통 타입 정의
 *
 * - `WorkoutMaster`: 운동 기록 마스터 (사용자/관리자 공용)
 * - `WorkoutDetail`: 운동 상세 (운동명/자극부위/기구 등)
 * - `WorkoutPlan`: 라운드/세트 계획 (시간/휴식/물보충)
 * - `ExerciseSequence`: 실제 실행 순서 (workout_exercises 기반)
 */

export interface WorkoutMaster {
  id: string
  date: string
  time: string
  workoutTime: string
  memo: string
  workoutCategory: string
  workoutCategoriesId?: string
  workoutCategoriesName?: string
  circuitType?: string
  created_at?: string
  dsSeconds?: number
  mainSeconds?: number
  cdSeconds?: number
  totalSeconds?: number
  restSeconds?: number
  is_admin?: boolean
  /** workout_history_master.workout_scope (TOTAL | SINGLE 등) */
  workoutScope?: string
}

export interface WorkoutDetail {
  id: string
  exerciseId: string
  sequence: number
  exerciseName: string
  name_ko?: string
  name_en?: string
  targetMuscle: string
  equipment: string
  level?: string
  characteristics?: string
  purpose?: string
  video_url?: string
  thumbnail_url?: string
  video_title?: string
  video_duration?: number
  video_start_time?: number
  video_end_time?: number
  video_loop_count?: number
  major_category?: string
  major_category_name?: string
  is_active?: boolean
  time: number
  position?: string
  reps?: number
}

export interface WorkoutPlan {
  id: string
  round: number
  exerciseTime: number
  restTime: number
  waterBreakTime?: number
}

export interface ExerciseSequence {
  id: string
  workout_history_master_id: string
  sequence: number
  round: number
  exercise_type: 'exercise' | 'rest' | 'water'
  exercise_id?: string
  exercise_name: string
  duration: number
  reps?: number
  position?: string
  name_ko?: string
  name_en?: string
  target_muscles?: string
  equipment?: string
  level?: string
  characteristics?: string
  purpose?: string
  video_url?: string
  video_start_time?: number
  video_end_time?: number
  thumbnail_url?: string
  major_category?: string
  major_category_name?: string
  created_at?: string
  updated_at?: string
}

export interface WorkoutCategoryItem {
  major_category: string
  major_category_name: string
  [key: string]: unknown
}
