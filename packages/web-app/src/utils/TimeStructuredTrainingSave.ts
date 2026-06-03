import { Dayjs } from 'dayjs'
import { generateAMRAPSequences } from './exerciseSequenceGenerator'
import { DEFAULT_GRID_POSITION } from './gridPositionCodes'
import { generateEmomWorkoutExercises } from '../pages/exercises/Totalexercises/components/save-workout/workout-exercise-helpers'
import type { Exercise as TotExercise, PanelRow as TotPanelRow } from '../pages/exercises/Totalexercises/components/types'

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
  reps?: number // AMRAP/EMOM에서 사용하는 횟수
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

// 적용된 운동 마스터 타입
export interface AppliedMaster {
  id: string
  date: string
  time: string
  workoutTime: string
  memo: string
  exercises?: Exercise[]
}

/**
 * AMRAP 저장 데이터 유효성 검사
 */
export function validateAMRAPSaveData(
  rightSelectedDate: Dayjs | null,
  panelRows: PanelRow[],
  dynamicExercises: Exercise[],
  coolDownExercises: Exercise[],
  exercises: Exercise[]
): { isValid: boolean; errorMessage?: string } {
  if (!rightSelectedDate) {
    return { isValid: false, errorMessage: '운동 날짜를 선택해주세요.' }
  }

  if (!panelRows || panelRows.length === 0) {
    return { isValid: false, errorMessage: '스트레스 / 루프 서킷 선택 후 + 버튼으로 추가 후 운동을 선택하세요.' }
  }

  if (panelRows.length < 1 || panelRows.length > 2) {
    return { isValid: false, errorMessage: 'AMRAP은 운동설계(Round)를 1개 이상 2개 이하로 등록해 주세요.' }
  }

  if (!dynamicExercises || dynamicExercises.length === 0) {
    return { isValid: false, errorMessage: 'Dynamic Stretching 운동이 없습니다. Dynamic Stretching 탭에서 운동을 추가해주세요.' }
  }

  if (!coolDownExercises || coolDownExercises.length === 0) {
    return { isValid: false, errorMessage: 'Cool Down 운동이 없습니다. Cool Down 탭에서 운동을 추가해주세요.' }
  }

  if (!exercises || exercises.length === 0) {
    return { isValid: false, errorMessage: '등록할 운동이 없습니다. 운동을 선택해주세요.' }
  }

  // 운동 데이터 유효성 검사
  const invalidExercises = exercises.filter(ex =>
    !ex.name_ko || !ex.target_muscles || ex.duration <= 0
  )

  if (invalidExercises.length > 0) {
    return {
      isValid: false,
      errorMessage: `${invalidExercises.length}개의 운동 데이터가 유효하지 않습니다. 운동명, 자극부위, 시간을 확인해주세요.`
    }
  }

  return { isValid: true }
}

/**
 * AMRAP 저장 데이터 생성
 */
export function createAMRAPSaveData(
  rightSelectedDate: Dayjs,
  finalTime: string,
  memo: string,
  panelRows: PanelRow[],
  dynamicExercises: Exercise[],
  coolDownExercises: Exercise[],
  exercises: Exercise[],
  currentEditingMasterId: string | null,
  appliedDynamic: AppliedMaster | null,
  appliedCoolDown: AppliedMaster | null
) {
  // UI에서 입력되는 AMRAP/EMOM panelRows.time/rest는 (분) 단위이므로,
  // 시퀀스 생성/DB 저장(초 단위)에 맞춰 초로 변환한다.
  const panelRowsInSeconds = panelRows.map((panel) => ({
    ...panel,
    time: Math.max(0, Number(panel.time ?? 0)) * 60,
    rest: Math.max(0, Number(panel.rest ?? 0)) * 60,
    waterBreak: Math.max(0, Number(panel.waterBreak ?? 0)) * 60
  }))

  // 운동실행순서 생성 (AMRAP 전용 함수 사용)
  // generateAMRAPSequences에서 이미 reps를 설정하므로 그대로 사용
  const exerciseSequences = generateAMRAPSequences(exercises, panelRowsInSeconds).map(seq => ({
    ...seq,
    reps: seq.type === 'exercise' ? (seq.reps !== undefined ? seq.reps : 0) : 0,
    method_name: '' // AMRAP은 서킷구분 없음
  }))

  // AMRAP 저장 데이터 준비 (Time-Structured AMRAP 방식)
  return {
    date: rightSelectedDate.format('YYYY-MM-DD'),
    time: finalTime,
    memo: memo || '',
    workoutCategory: 'AMRAP',
    masterId: currentEditingMasterId,
    dynamicMasterId: appliedDynamic?.id || 'none',
    staticMasterId: appliedCoolDown?.id || 'none',
    admin: false, // 기본값, 호출하는 곳에서 덮어씁
    // 설계영역의 AMRAP 계획 정보 (시간과 휴식만 사용)
    plans: panelRowsInSeconds.map((panel) => ({
      circuit_type: 'amrap',
      round: panel.round,
      time: panel.time,
      rest: panel.rest,
      hydration: panel.waterBreak ?? 0,
      method_name: '' // AMRAP은 서킷구분 없음
    })),
    // 운동 상세 정보 (Dynamic + AMRAP 운동들 + Cool Down 순서)
    exercises: [
      // 1. Dynamic Stretching 운동들
      ...dynamicExercises.map((exercise, index) => ({
        originalExerciseId: exercise.originalExerciseId || exercise.id,
        duration: exercise.duration || 30,
        reps: 0,
        // sp_SaveWorkout(with_reps)는 DS를 exercise_type='DS'로 인식해 workout_exercises에 Round 0으로 prepend 함
        // position도 DS1, DS2... 형태여야 Electron에서 정상 배치됨
        position: exercise.position || `DS${index + 1}`,
        exercise_type: 'DS',
        method_name: ''
      })),
      // 2. AMRAP 운동들 (선택된 운동만 한 번씩 저장, position 포함)
      ...exercises.map((exercise: any) => {
        const repsValue = exercise.reps !== undefined && exercise.reps !== null ? exercise.reps : 10
        console.log(`AMRAP 운동 저장: ${exercise.name_ko}, reps: ${exercise.reps} -> ${repsValue}`)
        return {
          originalExerciseId: exercise.originalExerciseId || exercise.id,
          duration: panelRowsInSeconds[0]?.time || 60, // 첫 번째 라운드의 시간(초) 사용
          reps: repsValue, // reps 값 저장 (undefined/null일 때만 기본값 10 사용)
          position: exercise.position || DEFAULT_GRID_POSITION, // 운동 위치 저장
          exercise_type: 'main',
          method_name: ''
        }
      }),
      // 3. Cool Down Stretching 운동들
      ...coolDownExercises.map((exercise, index) => ({
        originalExerciseId: exercise.originalExerciseId || exercise.id,
        duration: exercise.duration || 30,
        reps: 0,
        // sp_SaveWorkout(with_reps)는 CD를 exercise_type='CD'로 인식해 workout_exercises에 Round 99로 append 함
        position: exercise.position || `CD${index + 1}`,
        exercise_type: 'CD',
        method_name: ''
      }))
    ],
    // 4. 운동실행순서 정보 (workout_exercises 테이블용)
    workoutExercises: exerciseSequences.map((seq: any) => {
      // exercise일 때는 해당 운동의 reps 값과 exercise_id를 찾아서 사용
      let repsValue = 0
      let exerciseId = null
      
      if (seq.type === 'exercise' && seq.exerciseId) {
        // exercises 배열에서 해당 운동 찾기 (originalExerciseId 또는 id로 매칭)
        const matchingExercise = exercises.find((ex: any) => {
          const exId = ex.originalExerciseId || ex.id
          const seqId = seq.exerciseId
          return exId === seqId || exId === seqId.split('_')[0] // UUID_round 형식일 수도 있음
        })
        
        if (matchingExercise) {
          exerciseId = matchingExercise.originalExerciseId || matchingExercise.id || null
          repsValue = matchingExercise.reps !== undefined && matchingExercise.reps !== null 
            ? matchingExercise.reps 
            : (seq.reps !== undefined && seq.reps !== null ? seq.reps : 0)
          console.log(`workoutExercises AMRAP: ${seq.name}, exerciseId: ${seq.exerciseId}, matchingExercise.reps: ${matchingExercise.reps}, seq.reps: ${seq.reps}, 최종 repsValue: ${repsValue}`)
        } else {
          // 매칭되는 운동을 찾지 못한 경우 seq.reps 사용
          repsValue = seq.reps !== undefined && seq.reps !== null ? seq.reps : 0
          console.warn(`workoutExercises AMRAP: ${seq.name}, exerciseId: ${seq.exerciseId}에 매칭되는 운동을 찾지 못했습니다. seq.reps 사용: ${repsValue}`)
        }
      }
      
      return {
        sequence: seq.sequence,
        round: seq.round,
        exercise_type: seq.type,
        exercise_id: exerciseId, // 매칭된 originalExerciseId 사용
        duration: seq.duration,
        reps: repsValue,
        position: seq.position || DEFAULT_GRID_POSITION, // exerciseSequences에서 position 가져오기
        name: seq.name,
        method_name: seq.method_name || ''
      }
    })
  }
}

/**
 * EMOM 저장 데이터 유효성 검사
 */
export function validateEMOMSaveData(
  rightSelectedDate: Dayjs | null,
  panelRows: PanelRow[],
  dynamicExercises: Exercise[],
  coolDownExercises: Exercise[],
  exercises: Exercise[]
): { isValid: boolean; errorMessage?: string } {
  if (!rightSelectedDate) {
    return { isValid: false, errorMessage: '운동 날짜를 선택해주세요.' }
  }

  if (!panelRows || panelRows.length === 0) {
    return { isValid: false, errorMessage: '설계영역에 데이터를 추가해주세요.' }
  }

  if (!dynamicExercises || dynamicExercises.length === 0) {
    return { isValid: false, errorMessage: 'Dynamic Stretching 운동이 없습니다. Dynamic Stretching 탭에서 운동을 추가해주세요.' }
  }

  if (!coolDownExercises || coolDownExercises.length === 0) {
    return { isValid: false, errorMessage: 'Cool Down 운동이 없습니다. Cool Down 탭에서 운동을 추가해주세요.' }
  }

  if (!exercises || exercises.length === 0) {
    return { isValid: false, errorMessage: '등록할 운동이 없습니다. 운동을 선택해주세요.' }
  }

  // 운동 데이터 유효성 검사
  const invalidExercises = exercises.filter(ex =>
    !ex.name_ko || !ex.target_muscles
  )

  if (invalidExercises.length > 0) {
    return {
      isValid: false,
      errorMessage: `${invalidExercises.length}개의 운동 데이터가 유효하지 않습니다. 운동명, 자극부위를 확인해주세요.`
    }
  }

  return { isValid: true }
}

/**
 * EMOM 저장 데이터 생성
 */
export function createEMOMSaveData(
  rightSelectedDate: Dayjs,
  finalTime: string,
  memo: string,
  panelRows: PanelRow[],
  dynamicExercises: Exercise[],
  coolDownExercises: Exercise[],
  exercises: Exercise[],
  currentEditingMasterId: string | null,
  appliedDynamic: AppliedMaster | null,
  appliedCoolDown: AppliedMaster | null
) {
  // UI에서 입력되는 EMOM panelRows.time/rest는 (분) 단위이므로 초로 변환
  const panelRowsInSeconds = panelRows.map((panel) => ({
    ...panel,
    time: Math.max(0, Number(panel.time ?? 0)) * 60,
    rest: Math.max(0, Number(panel.rest ?? 0)) * 60,
    waterBreak: Math.max(0, Number(panel.waterBreak ?? 0)) * 60,
  }))

  // EMOM: 운동 연속 진행 후 라운드 끝에만 휴식/물보충 1회
  const workoutItems = generateEmomWorkoutExercises(
    panelRowsInSeconds as TotPanelRow[],
    exercises as TotExercise[],
  )
  const exerciseSequences = workoutItems.map((item, idx) => ({
    id: `seq-${idx + 1}`,
    type: item.exercise_type,
    round: item.round,
    sequence: item.sequence,
    name: item.name,
    duration: item.duration,
    exerciseId: item.exercise_id ?? undefined,
    position: item.position ?? undefined,
    reps: item.exercise_type === 'exercise' ? (item.reps ?? 0) : 0,
    method_name: ''
  }))

  // EMOM 저장 데이터 준비
  return {
    date: rightSelectedDate.format('YYYY-MM-DD'),
    time: finalTime,
    memo: memo || '',
    workoutCategory: 'EMOM',
    masterId: currentEditingMasterId,
    dynamicMasterId: appliedDynamic?.id || 'none',
    staticMasterId: appliedCoolDown?.id || 'none',
    admin: false, // 기본값, 호출하는 곳에서 덮어씁
    // 설계영역의 EMOM 계획 정보
    plans: panelRowsInSeconds.map((panel) => ({
      circuit_type: 'emom',
      round: panel.round,
      time: panel.time,
      rest: panel.rest,
      hydration: panel.waterBreak ?? 0
    })),
    // 운동 상세 정보 (Dynamic + EMOM 운동들 + Cool Down 순서)
    exercises: [
      // 1. Dynamic Stretching 운동들
      ...dynamicExercises.map((exercise, index) => ({
        originalExerciseId: exercise.originalExerciseId || exercise.id,
        duration: exercise.duration || 30,
        reps: 0,
        position: exercise.position || `DS${index + 1}`,
        exercise_type: 'DS'
      })),
      // 2. EMOM 운동들 (선택된 운동만 한 번씩 저장, position 포함)
      ...exercises.map((exercise: any) => {
        const repsValue = exercise.reps !== undefined && exercise.reps !== null ? exercise.reps : 10
        console.log(`EMOM 운동 저장: ${exercise.name_ko}, reps: ${exercise.reps} -> ${repsValue}`)
        return {
          originalExerciseId: exercise.originalExerciseId || exercise.id,
          duration: panelRowsInSeconds[0]?.time || 60, // 첫 번째 라운드의 설정시간(초) 사용
          reps: repsValue, // EMOM 횟수 저장 (undefined/null일 때만 기본값 10 사용)
          position: exercise.position || DEFAULT_GRID_POSITION, // 운동 위치 저장
          exercise_type: 'main'
        }
      }),
      // 3. Cool Down Stretching 운동들
      ...coolDownExercises.map((exercise, index) => ({
        originalExerciseId: exercise.originalExerciseId || exercise.id,
        duration: exercise.duration || 30,
        reps: 0,
        position: exercise.position || `CD${index + 1}`,
        exercise_type: 'CD'
      }))
    ],
    // 4. 운동실행순서 정보 (workout_exercises 테이블용)
    workoutExercises: exerciseSequences.map((seq: any) => {
      // exercise일 때는 해당 운동의 reps 값과 exercise_id를 찾아서 사용
      let repsValue = 0
      let exerciseId = null
      
      if (seq.type === 'exercise' && seq.exerciseId) {
        // exercises 배열에서 해당 운동 찾기 (originalExerciseId 또는 id로 매칭)
        const matchingExercise = exercises.find((ex: any) => {
          const exId = ex.originalExerciseId || ex.id
          const seqId = seq.exerciseId
          return exId === seqId || exId === seqId.split('_')[0] // UUID_round 형식일 수도 있음
        })
        
        if (matchingExercise) {
          exerciseId = matchingExercise.originalExerciseId || matchingExercise.id || null
          repsValue = matchingExercise.reps !== undefined && matchingExercise.reps !== null 
            ? matchingExercise.reps 
            : (seq.reps !== undefined && seq.reps !== null ? seq.reps : 0)
          console.log(`workoutExercises EMOM: ${seq.name}, exerciseId: ${seq.exerciseId}, matchingExercise.reps: ${matchingExercise.reps}, seq.reps: ${seq.reps}, 최종 repsValue: ${repsValue}`)
        } else {
          // 매칭되는 운동을 찾지 못한 경우 seq.reps 사용
          repsValue = seq.reps !== undefined && seq.reps !== null ? seq.reps : 0
          console.warn(`workoutExercises EMOM: ${seq.name}, exerciseId: ${seq.exerciseId}에 매칭되는 운동을 찾지 못했습니다. seq.reps 사용: ${repsValue}`)
        }
      }
      
      return {
        sequence: seq.sequence,
        round: seq.round,
        exercise_type: seq.type,
        exercise_id: exerciseId,
        duration: seq.duration,
        reps: repsValue,
        position: seq.position || DEFAULT_GRID_POSITION,
        name: seq.name
      }
    })
  }
}
