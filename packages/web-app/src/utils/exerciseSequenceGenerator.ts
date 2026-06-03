import { buildAmrapExerciseGroups } from '../pages/exercises/Totalexercises/components/amrapGroupBuilders'
import {
  generateWorkoutExercises,
  sortExercisesForExecution,
} from '../pages/exercises/Totalexercises/components/save-workout/workout-exercise-helpers'
import type { Exercise as TotExercise, PanelRow as TotPanelRow } from '../pages/exercises/Totalexercises/components/types'
import { DEFAULT_GRID_POSITION, MAIN_GRID_POSITION_ORDER } from './gridPositionCodes'

// 운동 정보 타입
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
  video_url?: string
  thumbnail_url?: string
  video_title?: string
  video_duration?: number
  video_start_time?: number
  video_end_time?: number
  video_loop_count?: number
  is_active: boolean
  major_category: string
  round?: number
  position?: string
}

// 패널 행 타입
export interface PanelRow {
  id: string
  round: number
  time: number
  rest: number
  waterBreak: number
  type: string
  selectedExercise?: Exercise
}

// 운동 실행 순서 타입
export interface ExerciseSequence {
  id: string
  type: 'exercise' | 'rest' | 'water'
  round: number
  sequence: number
  name: string
  duration: number
  exerciseId?: string
  position?: string
  reps?: number // AMRAP/EMOM 횟수
}

// 임시운동 ID 상수
export const TEMP_EXERCISE_ID = '260d18b7-9f3d-11f0-a881-8c8caa6f77e3'

/**
 * 운동 실행 순서 생성 함수 (임시운동 포함 - 저장용)
 * @param allExercises 모든 운동 목록 (실제 운동 + 임시운동)
 * @param panelRows 패널 설정 정보 (Round/Set별 시간, 휴식, 물보충)
 * @param circuitType 서킷 타입 ('stress' | 'loop')
 * @param actualExerciseCount 실제 운동 개수 (임시운동 제외)
 * @returns 운동 실행 순서 배열
 */
export function generateExerciseSequences(
  allExercises: Exercise[],
  panelRows: PanelRow[],
  circuitType: string,
  actualExerciseCount: number
): ExerciseSequence[] {
  const sequences: ExerciseSequence[] = []
  let sequenceId = 1

  // 패널 행과 운동 목록이 있는지 확인
  if (panelRows.length === 0 || allExercises.length === 0) {
    return sequences
  }

  if (circuitType === 'stress' || circuitType === 'loop') {
    // Totalexercises/saveWorkout.ts 의 generateWorkoutExercises 와 동일 (workout_exercises_logic.md)
    let globalSequence = 1
    const items = generateWorkoutExercises(
      panelRows as unknown as TotPanelRow[],
      allExercises as unknown as TotExercise[],
      [],
      [],
      circuitType
    )
    items.forEach((item) => {
      const seqType: ExerciseSequence['type'] =
        item.exercise_type === 'exercise'
          ? 'exercise'
          : item.exercise_type === 'water'
            ? 'water'
            : 'rest'
      sequences.push({
        id: `seq-${sequenceId++}`,
        type: seqType,
        round: item.round,
        sequence: globalSequence++,
        name: item.name,
        duration: item.duration,
        exerciseId: item.exercise_id ?? undefined,
        position: item.position ?? undefined,
        reps: item.reps
      })
    })
  }

  //console.log(`생성된 ${circuitType === 'stress' ? '스트레스' : '루프'} 서킷 운동실행순서 (임시운동 포함):`, sequences)

  // 임시운동과 그 바로 위의 휴식 제거
  const filteredSequences: ExerciseSequence[] = []

  for (let i = 0; i < sequences.length; i++) {
    const currentSeq = sequences[i]
    const nextSeq = sequences[i + 1]

    // 다음 시퀀스가 임시운동이면 현재 시퀀스(휴식)를 건너뜀
    if (nextSeq &&
      nextSeq.type === 'exercise' &&
      nextSeq.exerciseId === TEMP_EXERCISE_ID &&
      currentSeq.type === 'rest') {
      //console.log(`⏭️ 임시운동 전 휴식 제거: ${currentSeq.name} (sequence ${currentSeq.sequence})`)
      continue // 휴식을 건너뜀
    }

    // 임시운동 자체도 제거
    if (currentSeq.type === 'exercise' && currentSeq.exerciseId === TEMP_EXERCISE_ID) {
      //console.log(`⏭️ 임시운동 제거: ${currentSeq.name} (sequence ${currentSeq.sequence})`)
      continue // 임시운동을 건너뜀
    }

    filteredSequences.push(currentSeq)
  }

  //console.log(`임시운동 제거 후 최종 시퀀스 개수: ${sequences.length} → ${filteredSequences.length}`)
  return filteredSequences
}

/**
 * 운동을 6의 배수로 맞추기 위해 임시운동 생성
 * @param exercises 현재 운동 목록
 * @returns 추가할 임시운동 배열
 */
export function generateTempExercises(exercises: Exercise[]): Exercise[] {
  const exerciseCount = exercises.length
  const remainder = exerciseCount % 6
  const tempExercisesNeeded = remainder === 0 ? 0 : 6 - remainder

  //console.log('=== 6의 배수 운동 채우기 ===')
  //console.log('현재 운동 개수:', exerciseCount)
  //console.log('추가할 임시운동 개수:', tempExercisesNeeded)

  const positionOrder = [...MAIN_GRID_POSITION_ORDER]

  // 실제 운동들의 위치 파악
  const usedPositions = exercises.map(ex => ex.position || DEFAULT_GRID_POSITION)
  const lastUsedPosition = usedPositions[usedPositions.length - 1]
  const lastPositionIndex = positionOrder.indexOf(lastUsedPosition)

  // 임시운동 생성
  const tempExercises: Exercise[] = []
  for (let i = 0; i < tempExercisesNeeded; i++) {
    const nextPositionIndex = (lastPositionIndex + 1 + i) % positionOrder.length
    const nextPosition = positionOrder[nextPositionIndex]

    tempExercises.push({
      id: `temp-${Date.now()}-${i}`,
      originalExerciseId: TEMP_EXERCISE_ID,
      name_ko: '임시운동',
      name_en: 'Temporary Exercise',
      level: 'beginner',
      target_muscles: '전신',
      characteristics: '임시운동',
      equipment: '맨몸',
      purpose: 'Power Circuit',
      duration: 30,
      is_active: true,
      major_category: 'Power_Circuit',
      position: nextPosition
    })

    //console.log(`임시운동 ${i + 1}: 위치 ${nextPosition}`)
  }

  return tempExercises
}

/**
 * 운동 실행 순서 생성 함수 (임시운동 제외 - 표시용)
 * @param exercises 실제 운동 목록 (임시운동 제외)
 * @param panelRows 패널 설정 정보
 * @param circuitType 서킷 타입 ('stress' | 'loop')
 * @returns 운동 실행 순서 배열
 */
export function generateExerciseSequencesForDisplay(
  exercises: Exercise[],
  panelRows: PanelRow[],
  circuitType: string
): ExerciseSequence[] {
  const sequences: ExerciseSequence[] = []
  let sequenceId = 1

  // 패널 행과 운동 목록이 있는지 확인
  if (panelRows.length === 0 || exercises.length === 0) {
    return sequences
  }

  if (circuitType === 'stress' || circuitType === 'loop') {
    let globalSequence = 1
    const items = generateWorkoutExercises(
      panelRows as unknown as TotPanelRow[],
      exercises as unknown as TotExercise[],
      [],
      [],
      circuitType
    )
    items.forEach((item) => {
      const seqType: ExerciseSequence['type'] =
        item.exercise_type === 'exercise'
          ? 'exercise'
          : item.exercise_type === 'water'
            ? 'water'
            : 'rest'
      sequences.push({
        id: `seq-${sequenceId++}`,
        type: seqType,
        round: item.round,
        sequence: globalSequence++,
        name: item.name,
        duration: item.duration,
        exerciseId: item.exercise_id ?? undefined,
        position: item.position ?? undefined,
        reps: item.reps
      })
    })
  }

  //console.log(`생성된 ${circuitType === 'stress' ? '스트레스' : '루프'} 서킷 운동실행순서 (표시용):`, sequences)
  return sequences
}

/**
 * AMRAP 운동 시퀀스 생성 함수
 * - amrapGroupBuilders.buildAmrapExerciseGroups 와 동일 규칙 (workout_exercises_logic.md §4 예시1~4)
 * - panelRows.time/rest/waterBreak 는 호출부에서 초 단위로 통일 (예: TimeStructuredTrainingSave)
 */
export function generateAMRAPSequences(
  exercises: Exercise[],
  panelRows: PanelRow[]
): ExerciseSequence[] {
  const sequences: ExerciseSequence[] = []
  let sequenceId = 1
  let globalSequence = 1

  if (panelRows.length === 0 || exercises.length === 0) {
    console.warn('⚠️ AMRAP: 패널 또는 운동 목록이 비어있습니다.')
    return sequences
  }

  const actualExercises = exercises.filter(ex =>
    ex.originalExerciseId !== 'c9bec9b9-96ad-11f0-a821-8c8caa6f77e3' &&
    ex.originalExerciseId !== 'c9c17e55-96ad-11f0-a821-8c8caa6f77e3'
  )

  if (actualExercises.length === 0) {
    console.warn('⚠️ AMRAP: 실제 운동이 없습니다.')
    return sequences
  }

  const sortedExercises = sortExercisesForExecution(actualExercises as unknown as TotExercise[])
  const defaultRow: TotPanelRow = {
    id: 'amrap-default',
    round: 1,
    time: 600,
    rest: 60,
    waterBreak: 0,
    type: 'default',
  }
  const groups = buildAmrapExerciseGroups(
    sortedExercises as unknown as TotExercise[],
    panelRows as unknown as TotPanelRow[],
    defaultRow
  )

  for (let groupIdx = 0; groupIdx < groups.length; groupIdx++) {
    const { exercises: groupExercises, row, groupRound } = groups[groupIdx]
    const isLastGroup = groupIdx === groups.length - 1
    const roundTime = row.time

    groupExercises.forEach((exercise) => {
      sequences.push({
        id: `seq-${sequenceId++}`,
        type: 'exercise',
        round: groupRound,
        sequence: globalSequence++,
        name: exercise.name_ko,
        duration: roundTime,
        exerciseId: exercise.originalExerciseId || exercise.id,
        position: exercise.position,
        reps: (exercise as any).reps !== undefined ? (exercise as any).reps : 0,
      })
    })

    if (!isLastGroup) {
      const wb = Number(row.waterBreak ?? 0)
      if (wb > 0) {
        sequences.push({
          id: `seq-${sequenceId++}`,
          type: 'water',
          round: groupRound,
          sequence: globalSequence++,
          name: '물보충',
          duration: wb,
        })
      }
      if (row.rest > 0) {
        sequences.push({
          id: `seq-${sequenceId++}`,
          type: 'rest',
          round: groupRound,
          sequence: globalSequence++,
          name: '휴식',
          duration: row.rest,
        })
      }
    }
  }

  return sequences
}
