/**
 * 사용자 대시보드 — 공통 타입 정의
 */

import type {
  PopularWorkout,
  RecentWorkout,
} from '@/services/userDashboard.service'

export interface ExtendedUserStats {
  workout_days: number
  total_minutes: number
  avg_daily_minutes: number
  exercise_types_used: number
}

export interface UserTopExercise {
  exercise_id: string
  exercise_name: string
  exercise_name_en: string
  target_muscles: string
  equipment: string
  level: 'beginner' | 'intermediate' | 'advanced'
  characteristics?: string
  purpose?: string
  video_url?: string
  thumbnail_url?: string
  video_title?: string
  video_duration?: number
  is_active: boolean
  exercise_count: number
  total_duration: number
  avg_duration: number
  first_workout_date: string
  last_workout_date: string
  category_name: string
  category_id: string
  avg_duration_rounded: number
  frequency_level: string
  level_ko: string
}

export interface ExtendedPopularWorkout extends PopularWorkout {
  name_ko?: string
  target_muscles?: string
  equipment?: string
}

export type ExtendedRecentWorkout = RecentWorkout

export interface AdminWorkoutMaster {
  id: string | number
  date: string
  time: string
  workoutTime: string
  memo: string
  workoutCategory: string
  workoutCategoriesId: string
  workoutCategoriesName: string
  circuitType: string | null
  created_at: string
}

export interface AdminWorkoutGridRow {
  id: string | number
  date: string
  workoutCategoriesName: string
  circuitType: string | null
  workoutTime: string
  memo: string
}

export interface UserPopularGridRow {
  id: string
  rank: number
  exercise_count: number
  exercise_name: string
  exercise_name_en: string
  frequency_level: string
  total_duration: number
  avg_duration: number
  avg_duration_rounded: number
  target_muscles: string
  equipment: string
  level: string
  level_ko: string
  category_name: string
  first_workout_date: string
  last_workout_date: string
  characteristics?: string
  purpose?: string
  video_url?: string
  thumbnail_url?: string
}

export type UserPopularView = '전체' | '날짜별' | '자극부위'
