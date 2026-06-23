/**
 * COMBO 운동 — workout_exercises 생성 및 시간 계산
 * 3개 운동 1세트: 지정 시간(work) 내 reps 수행 → 휴식(rest) → 다음 콤보 그룹
 */
import { COMBO_ROW_COUNT } from '@/pages/WorkoutSettings/components/workoutSettingsModel'
import { getMainPositionSortValue } from '@/utils/gridPositionCodes'
import type { Exercise, PanelRow } from '../types'
import type { WorkoutExerciseItem } from './save-types'

export const COMBO_GROUP_SIZE = 3

export const isComboMajorCategory = (majorCategory: string): boolean =>
  String(majorCategory || '').toUpperCase() === 'COMBO'

export const sortExercisesForCombo = (exercises: Exercise[]): Exercise[] =>
  [...exercises].sort(
    (a, b) => getMainPositionSortValue(a.position) - getMainPositionSortValue(b.position),
  )

export const buildComboExerciseGroups = (exercises: Exercise[]): Exercise[][] => {
  const sorted = sortExercisesForCombo(exercises)
  const groups: Exercise[][] = []
  for (let i = 0; i < sorted.length; i += COMBO_GROUP_SIZE) {
    const chunk = sorted.slice(i, i + COMBO_GROUP_SIZE)
    if (chunk.length === COMBO_GROUP_SIZE) groups.push(chunk)
  }
  return groups
}

const resolveComboPanel = (panelRows: PanelRow[]) => {
  const rows = panelRows.slice(0, COMBO_ROW_COUNT)
  const last = rows[rows.length - 1]
  return {
    workTime: Math.max(0, Number(last?.time ?? 0)),
    restTime: Math.max(0, Number(last?.rest ?? 0)),
    slotReps: rows.map((r, i) => {
      const reps = Number(r.reps ?? 0)
      return reps > 0 ? reps : 10
    }),
  }
}

const pushComboWorkBlock = (
  target: WorkoutExerciseItem[],
  sequenceStart: number,
  round: number,
  group: Exercise[],
  workTime: number,
  slotReps: number[],
): number => {
  let sequence = sequenceStart
  group.forEach((ex, slotIdx) => {
    target.push({
      sequence: sequence++,
      round,
      exercise_type: 'exercise',
      exercise_id: ex.originalExerciseId || ex.id,
      name: ex.name_ko || ex.name_en || '운동',
      duration: workTime,
      reps: ex.reps ?? slotReps[slotIdx] ?? 10,
      is_bilateral: !!ex.is_bilateral,
      position: ex.position || null,
    })
  })
  return sequence
}

export const generateComboWorkoutExercises = (
  panelRows: PanelRow[],
  exercises: Exercise[],
  circuitType: string,
): WorkoutExerciseItem[] => {
  const ct = String(circuitType || 'stress').toLowerCase() === 'loop' ? 'loop' : 'stress'
  const { workTime, restTime, slotReps } = resolveComboPanel(panelRows)
  const groups = buildComboExerciseGroups(exercises)
  if (groups.length === 0) return []

  const workoutExercises: WorkoutExerciseItem[] = []
  let sequence = 1

  if (ct === 'loop') {
    groups.forEach((group, comboIdx) => {
      const round = comboIdx + 1
      sequence = pushComboWorkBlock(workoutExercises, sequence, round, group, workTime, slotReps)
      if (restTime > 0) {
        workoutExercises.push({
          sequence: sequence++,
          round,
          exercise_type: 'rest',
          exercise_id: null,
          name: '휴식',
          duration: restTime,
          position: null,
        })
      }
    })
    return workoutExercises
  }

  groups.forEach((group, comboIdx) => {
    const round = comboIdx + 1
    sequence = pushComboWorkBlock(workoutExercises, sequence, round, group, workTime, slotReps)
    if (restTime > 0) {
      workoutExercises.push({
        sequence: sequence++,
        round,
        exercise_type: 'rest',
        exercise_id: null,
        name: '휴식',
        duration: restTime,
        position: null,
      })
    }
  })
  return workoutExercises
}

export const getComboTimeBreakdownFromPanels = (
  panelRows: PanelRow[],
  exercises: Exercise[],
): { mainSeconds: number; restSeconds: number } => {
  const { workTime, restTime } = resolveComboPanel(panelRows)
  const groups = buildComboExerciseGroups(exercises)
  if (groups.length === 0) return { mainSeconds: 0, restSeconds: 0 }

  const mainSeconds = groups.length * COMBO_GROUP_SIZE * workTime
  const restSeconds = groups.length * restTime
  return { mainSeconds, restSeconds }
}
