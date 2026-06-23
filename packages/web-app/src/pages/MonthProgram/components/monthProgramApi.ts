/**
 * MonthProgram — API 호출 wrapper
 *
 * 모든 API 호출을 순수 함수로 캡슐화하여 페이지 컴포넌트에서 setState 처리만 하도록 분리.
 *
 * - `fetchWorkoutMasters({yearMonth, workoutCategory, circuitType, admin, workoutScope?})`
 * - `fetchWorkoutDetail(masterId)`: { details, plans }
 * - `fetchWorkoutPlansFromExercises(masterId)`: workout_exercises에서 round별 plan 추출
 * - `fetchWorkoutExercises(masterId)`: 정렬된 ExerciseSequence
 * - `fetchWorkoutCategories()`
 * - `checkExistingWorkout({userId, date, time})`
 * - `copyWorkout(payload)`
 * - `updateMasterMemo(masterId, memo)`
 * - `deleteWorkout(masterId)`
 * - `requestControlToken()`
 */

import api from '@/services/api'
import type {
  ExerciseSequence,
  WorkoutDetail,
  WorkoutMaster,
  WorkoutPlan,
} from './monthProgramTypes'

const normalizeMaster = (item: any, index: number, defaultIsAdmin = false): WorkoutMaster => ({
  id: item.id || `temp-${index}`,
  date: item.date || '',
  time: item.time || '',
  workoutTime: item.workoutTime || item.workout_time || item.total_workout_time || '',
  memo: item.memo || '',
  workoutCategory: item.workoutCategory || item.workout_category || 'Unknown',
  workoutCategoriesId: item.workout_categories_id || 'Unknown',
  workoutCategoriesName: item.major_category_name || '-',
  circuitType: item.circuit_type || item.circuitType || null,
  created_at: item.created_at || '',
  dsSeconds: item.ds_seconds ?? item.dsSeconds ?? undefined,
  mainSeconds: item.main_seconds ?? item.mainSeconds ?? undefined,
  cdSeconds: item.cd_seconds ?? item.cdSeconds ?? undefined,
  totalSeconds: item.total_seconds ?? item.totalSeconds ?? undefined,
  restSeconds: item.rest_seconds ?? item.restSeconds ?? undefined,
  is_admin: item.is_admin ?? item.admin ?? defaultIsAdmin,
  workoutScope: item.workoutScope || item.workout_scope || 'TOTAL',
})

const sortByDateThenCreated = (a: WorkoutMaster, b: WorkoutMaster): number => {
  const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime()
  if (dateCompare !== 0) return dateCompare
  return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
}

export interface FetchMastersParams {
  yearMonth: string
  workoutCategory: string
  circuitType: string
  admin: '0' | '1'
  workoutScope?: string
}

export const fetchWorkoutMasters = async (
  params: FetchMastersParams,
): Promise<WorkoutMaster[]> => {
  const response = await api.get('/workout-categories/workout-history-master', {
    params: {
      ...params,
      memo: '',
      ...(params.workoutScope ? { workoutScope: params.workoutScope } : {}),
    },
  })
  if (!response.data.success) return []
  const masterData = response.data.data || []
  const defaultIsAdmin = params.admin === '1'
  const validatedData = masterData.map((item: any, index: number) =>
    normalizeMaster(item, index, defaultIsAdmin),
  )
  return validatedData.sort(sortByDateThenCreated)
}

const normalizeDetail = (item: any, index: number): WorkoutDetail => ({
  id: item.seq ? `${item.workout_history_master_id}-${item.seq}` : `detail-${index}`,
  exerciseId: item.exerciseId || item.exercises_id || '',
  sequence: item.seq || item.sequence || index + 1,
  exerciseName: item.exerciseName || item.exercise_name || item.name_ko || '',
  name_ko: item.name_ko || item.exerciseName || item.exercise_name || '',
  name_en: item.name_en || '',
  targetMuscle: item.targetMuscle || item.target_muscle || item.target_muscles || '',
  equipment: item.equipment || '',
  level: item.level || 'beginner',
  characteristics: item.characteristics || '',
  purpose: item.purpose || '',
  video_url: item.video_url || '',
  thumbnail_url: item.thumbnail_url || '',
  video_title: item.video_title || '',
  video_duration: item.video_duration || 0,
  video_start_time: item.video_start_time || 0,
  video_end_time: item.video_end_time || 0,
  video_loop_count: item.video_loop_count || 1,
  major_category: item.major_category || '',
  major_category_name: item.major_category_name || '',
  is_active: item.is_active !== false,
  time: item.duration || item.time || 0,
  position: item.position || '',
  reps: item.reps != null ? item.reps : undefined,
  is_bilateral: !!(item.is_bilateral ?? item.isBilateral ?? item.exercise_is_bilateral),
})

export interface FetchDetailResult {
  details: WorkoutDetail[]
  plans: WorkoutPlan[]
}

export const fetchWorkoutDetail = async (masterId: string): Promise<FetchDetailResult> => {
  const response = await api.get(`/workout-categories/workout-history-detail/${masterId}`)
  if (!response.data.success) return { details: [], plans: [] }

  const responseData = response.data.data
  const detailData = responseData.details || []
  const planData = responseData.plans || []

  const details: WorkoutDetail[] = detailData.map(normalizeDetail)

  if (planData && planData.length > 0) {
    const plans: WorkoutPlan[] = planData.map((plan: any, index: number) => ({
      id: `plan-${index}`,
      round: plan.round,
      exerciseTime: plan.time,
      restTime: plan.rest,
      waterBreakTime: plan.hydration,
    }))
    return { details, plans }
  }

  // fall back to extracting plans from exercises
  const fallbackPlans = await fetchWorkoutPlansFromExercises(masterId)
  return { details, plans: fallbackPlans }
}

export const fetchWorkoutPlansFromExercises = async (
  masterId: string,
): Promise<WorkoutPlan[]> => {
  const response = await api.get(`/workout-categories/workout-exercises/${masterId}`)
  if (!response.data.success) return []

  const exerciseData = response.data.data || []
  const roundMap = new Map<number, { time: number; rest: number; water: number }>()

  exerciseData.forEach((item: any) => {
    const round = item.round
    if (round === 0 || round === 99 || round === 999) return
    if (!roundMap.has(round)) {
      roundMap.set(round, { time: 0, rest: 0, water: 0 })
    }
    const roundData = roundMap.get(round)!
    if (item.exercise_type === 'exercise') roundData.time = item.duration
    else if (item.exercise_name === '휴식') roundData.rest = item.duration
    else if (item.exercise_name === '물보충') roundData.water = item.duration
  })

  return Array.from(roundMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([round, data]) => ({
      id: `plan-${round}`,
      round,
      exerciseTime: data.time,
      restTime: data.rest,
      waterBreakTime: data.water,
    }))
}

const normalizeSequence = (
  item: any,
  index: number,
  fallbackMasterId: string,
): ExerciseSequence => {
  const isStretching =
    item.major_category === 'Dynamic_stretching' || item.major_category === 'Static_stretching'
  const displayName =
    isStretching && item.name_ko
      ? item.name_ko
      : item.exercise_name || item.name_ko || '운동'

  return {
    id: item.id || `seq-${index}`,
    workout_history_master_id: item.workout_history_master_id || fallbackMasterId,
    sequence: item.sequence || index + 1,
    round: item.round !== null && item.round !== undefined ? item.round : 1,
    exercise_type: item.exercise_type || 'exercise',
    exercise_id: item.exercise_id || null,
    exercise_name: displayName,
    duration: item.duration || 0,
    reps: item.reps !== null && item.reps !== undefined ? item.reps : null,
    is_bilateral: !!(item.is_bilateral ?? item.isBilateral ?? item.exercise_is_bilateral),
    position: item.position || null,
    name_ko: item.name_ko || null,
    name_en: item.name_en || null,
    target_muscles: item.target_muscles || null,
    equipment: item.equipment || null,
    level: item.level || null,
    characteristics: item.characteristics || null,
    purpose: item.purpose || null,
    video_url: item.video_url || null,
    video_start_time: item.video_start_time || 0,
    video_end_time: item.video_end_time || 0,
    thumbnail_url: item.thumbnail_url || null,
    major_category: item.major_category || null,
    major_category_name: item.major_category_name || null,
    created_at: item.created_at || null,
    updated_at: item.updated_at || null,
  }
}

export const fetchWorkoutExercises = async (
  masterId: string,
): Promise<ExerciseSequence[]> => {
  const response = await api.get(`/workout-categories/workout-exercises/${masterId}`)
  if (!response.data.success) return []

  const exerciseData = response.data.data || []
  const validatedSequences = exerciseData.map((item: any, index: number) =>
    normalizeSequence(item, index, masterId),
  )

  // DS(round 0) → Main(1~98) → CD(round 99) 순서, 각 그룹은 sequence 기준
  return [...validatedSequences].sort((a, b) => {
    const groupA = a.round === 0 ? 0 : a.round >= 99 ? 2 : 1
    const groupB = b.round === 0 ? 0 : b.round >= 99 ? 2 : 1
    if (groupA !== groupB) return groupA - groupB
    return a.sequence - b.sequence
  })
}

export const fetchWorkoutCategories = async () => {
  const fallback = [
    { major_category: 'Power_Circuit', major_category_name: 'Power Circuit' },
    { major_category: 'Dynamic_stretching', major_category_name: 'Dynamic Stretching' },
    { major_category: 'Static_stretching', major_category_name: 'Static Stretching' },
  ]
  try {
    let response
    try {
      response = await api.get('/workout-categories/stats')
    } catch {
      response = await api.get('/workout-categories')
    }
    if (response.data.success) {
      return response.data.data || []
    }
    return fallback
  } catch {
    return fallback
  }
}

export interface CheckExistingParams {
  userId: string | number
  date: string
  time: string
}

export const checkExistingWorkout = async (params: CheckExistingParams): Promise<boolean> => {
  const response = await api.get('/workout-categories/check-existing-workout', { params })
  return Boolean(response.data?.success && response.data.data?.exists)
}

export interface CopyWorkoutPayload {
  originalMasterId: string
  newDate: string
  newTime: string
  userId: string | number
  exerciseSequences: ExerciseSequence[]
}

export const copyWorkout = async (payload: CopyWorkoutPayload) => {
  const response = await api.post('/workout-categories/copy-workout', payload)
  return response.data
}

export const updateMasterMemo = async (masterId: string, memo: string) => {
  const response = await api.put(
    `/workout-categories/workout-history-master/${masterId}`,
    { memo },
  )
  return response.data
}

export const deleteWorkout = async (masterId: string) => {
  const response = await api.delete(`/workout-categories/workout-history/${masterId}`)
  return response.data
}

export const requestControlToken = async () => {
  const response = await api.post('/electron/control-token')
  return {
    controlToken: response?.data?.controlToken as string | undefined,
    expiresIn: response?.data?.expiresIn as number | undefined,
  }
}
