/**
 * DynamicStretching 타입 정의
 * - 서버 응답을 화면에서 다루기 쉬운 형태로 정규화한 타입들
 *
 * 사용처: `DynamicStretching.tsx`, `DynamicStretchingMasterPanel.tsx`, `DynamicStretchingEditorPanel.tsx`
 */

export interface WorkoutMaster {
  id: string
  date: string
  time: string
  workoutTime: string
  memo: string
}

export interface WorkoutDetail {
  id: string
  exerciseId: string
  sequence: number
  exerciseName: string
  name_en: string
  targetMuscle: string
  equipment: string
  characteristics: string
  purpose: string
  position: string
  video_url: string
  time: number
  video_start_time: number
  video_end_time: number
}

export interface Exercise {
  id: string
  originalExerciseId?: string
  name_ko: string
  name_en: string
  level: 'beginner' | 'intermediate' | 'advanced'
  target_muscles: string
  characteristics: string
  equipment: string
  purpose: string
  duration: number
  position?: string
  video_url?: string
  video_start_time?: number
  video_end_time?: number
  is_active: boolean
  major_category: string
}

export interface ToastConfig {
  open: boolean
  message: string
  type: 'success' | 'destructive'
}
