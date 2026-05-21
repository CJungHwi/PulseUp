import { Dayjs } from 'dayjs'
import { Exercise, PanelRow, WorkoutMaster } from '../types'

export interface SaveParamsBase {
    rightSelectedDate: Dayjs | null
    panelRows: PanelRow[]
    exercises: Exercise[]
    dynamicExercises: Exercise[]
    coolDownExercises: Exercise[]
    appliedDynamic: WorkoutMaster | null
    appliedCoolDown: WorkoutMaster | null
    memo: string
    currentEditingMasterId: string | null
    isAdmin: boolean
    onSuccess: (savedMasterId: string) => void
    dsCategoryId?: string | null
    cdCategoryId?: string | null
    majorCategory?: string
    circuitType?: string
}

export interface SaveCircuitParams extends SaveParamsBase {
    workoutCategory: string
    originalWorkoutCategory: string | null
    circuitType: string
}

export interface WorkoutExerciseItem {
    sequence: number
    round: number
    exercise_type: 'exercise' | 'rest' | 'water'
    exercise_id: string | null
    name: string
    duration: number
    reps?: number
    position: string | null
}

export interface WorkoutTimeSummaryWithRest {
    dsSeconds: number
    mainSeconds: number
    cdSeconds: number
    totalSeconds: number
    restSeconds: number
}
