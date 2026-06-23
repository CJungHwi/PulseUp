import { Dayjs } from 'dayjs'

export interface WorkoutMaster {
    id: string
    date: string
    time: string
    workoutTime: string
    memo: string
    is_admin?: boolean
    workoutCategoriesId?: string
    workoutCategory?: string
    workoutCategoriesName?: string
    majorCategory?: string
    circuitType?: string
    created_at?: string
    originalExerciseId?: string
    exercises?: Exercise[]
}

export interface WorkoutDetail {
    id: string
    exerciseId: string
    sequence: number
    exerciseName: string
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
    is_bilateral?: boolean
    major_category?: string
    major_category_name?: string
    is_active?: boolean
    time: number
}

export interface Exercise {
    id: string
    originalExerciseId?: string
    name_ko: string
    name_en: string
    level: 'beginner' | 'intermediate' | 'advanced'
    target_muscles?: string
    characteristics?: string
    equipment?: string
    purpose?: string
    duration: number
    video_url?: string
    thumbnail_url?: string
    video_title?: string
    video_duration?: number
    video_start_time?: number
    video_end_time?: number
    video_loop_count?: number
    is_bilateral?: boolean
    is_active?: boolean
    major_category: string
    major_category_name?: string
    workout_category_id?: string
    round?: number
    position?: string
    reps?: number
}

export interface PanelRow {
    id: string
    round: number
    time: number
    rest: number
    waterBreak: number
    type: string
    /** COMBO 운동 슬롯별 기본 반복 횟수 */
    reps?: number
    selectedExercise?: Exercise
}

export interface ExerciseSequence {
    id: string
    type: 'exercise' | 'rest' | 'water'
    round: number
    sequence: number
    name: string
    duration: number
    exerciseId?: string
    position?: string
}

export interface WorkoutTimeSummary {
    dsSeconds: number
    mainSeconds: number
    cdSeconds: number
    totalSeconds: number
}
