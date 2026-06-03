import { Dayjs } from 'dayjs'
import {
  generateExerciseSequences,
  generateTempExercises,
  type Exercise as ExerciseType,
  type PanelRow as PanelRowType
} from './exerciseSequenceGenerator'
import { DEFAULT_GRID_POSITION } from './gridPositionCodes'

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

// 운동 마스터 타입
export interface WorkoutMaster {
  id: string
  date: string
  time: string
  workoutTime: string
  memo: string
  originalExerciseId?: string
  exercises?: Exercise[]
}

// 저장 데이터 생성 파라미터
export interface CreateSaveDataParams {
  rightSelectedDate: Dayjs | null
  finalTime: string
  memo: string
  workoutCategory: string
  appliedDynamic: WorkoutMaster | null
  appliedCooldown: WorkoutMaster | null
  currentEditingMasterId: string | null
  panelRows: PanelRow[]
  circuitType: string
  exercises: Exercise[]
  appliedDynamicExercises: Exercise[]
  appliedCooldownExercises: Exercise[]
}

/**
 * Hybrid Strength Circuit 저장 데이터 생성 함수
 * PowerCircuit, CircuitTraining, FunctionalCircuit, CoreCarryFocus에서 공통으로 사용
 */
export function createHybridStrengthCircuitSaveData(params: CreateSaveDataParams) {
  const {
    rightSelectedDate,
    finalTime,
    memo,
    workoutCategory,
    appliedDynamic,
    appliedCooldown,
    currentEditingMasterId,
    panelRows,
    circuitType,
    exercises,
    appliedDynamicExercises,
    appliedCooldownExercises
  } = params

  // 1. 운동을 6의 배수로 맞추기 위해 임시운동 추가
  const tempExercises = generateTempExercises(exercises)

  // 실제 운동 + 임시운동 합치기
  const allExercises = [...exercises, ...tempExercises]
  //console.log('최종 운동 개수 (실제 + 임시):', allExercises.length)

  // 2. 운동실행순서 생성 (임시운동 포함)
  const exerciseSequences = generateExerciseSequences(
    allExercises,
    panelRows,
    circuitType,
    exercises.length
  )

  // 3. 저장 데이터 준비
  const saveData = {
    date: rightSelectedDate?.format('YYYY-MM-DD'),
    time: finalTime,
    memo: memo || '',
    workoutCategory: 'MAIN', // Main Training
    admin: false, // 기본값, 호출하는 곳에서 덮어씀
    // dynamicMasterId, cooldownMasterId 제거 (직접 운동 데이터 전송)
    masterId: currentEditingMasterId, // 수정 모드인 경우 기존 master ID
    // 설계영역의 서킷 계획 정보 (테이블 구조에 맞춤)
    plans: panelRows.map((panel, index) => {
      //console.log(`Panel ${index + 1} waterBreak value:`, panel.waterBreak)
      //console.log(`Panel ${index + 1} circuit_type: ${circuitType}`)
      return {
        circuit_type: circuitType, // 상태값 직접 사용 (stress 또는 loop)
        round: panel.round,
        time: panel.time,
        rest: panel.rest,
        hydration: panel.waterBreak
      }
    }),
    // 운동 상세 정보 (Dynamic + 운동영역(실제+임시) + Cool Down 순서)
    exercises: [
      // 1. Dynamic Stretching 운동들
      ...appliedDynamicExercises.map((exercise, index) => ({
        originalExerciseId: exercise.originalExerciseId || exercise.id,
        duration: exercise.duration || 30,
        position: exercise.position || `DS${index + 1}`, // Dynamic Stretching의 실제 위치 사용
        exercise_type: 'DS'
      })),
      // 2. 운동영역의 운동들 (실제 운동 + 임시운동)
      ...allExercises.map((exercise, index) => ({
        originalExerciseId: exercise.originalExerciseId || exercise.id,
        duration: Math.max(10, exercise.duration || 30),
        // workout_history_detail.method_round 저장을 위해 round 전달 (Loop의 Set / Stress의 Round)
        // round가 없으면 1로 저장되어 모두 1로 보이는 문제가 발생할 수 있음
        round: typeof exercise.round === 'number' && Number.isFinite(exercise.round) ? exercise.round : 1,
        position: exercise.position || DEFAULT_GRID_POSITION,
        exercise_type: 'main'
      })),
      // 3. Cool Down Stretching 운동들
      ...appliedCooldownExercises.map((exercise, index) => ({
        originalExerciseId: exercise.originalExerciseId || exercise.id,
        duration: exercise.duration || 30,
        position: exercise.position || `CD${index + 1}`, // Cool Down Stretching의 실제 위치 사용
        exercise_type: 'CD'
      }))
    ],
    // 4. 운동실행순서 정보 (workout_exercises 테이블용)
    workoutExercises: exerciseSequences.map((seq, index) => {
      // exercise_id는 originalExerciseId를 사용해야 함 (타임스탬프 없는 순수 ID)
      let cleanExerciseId: string | null = null

      if (seq.type === 'exercise' && seq.exerciseId) {
        // console.log(`[SAVE DEBUG] seq.exerciseId: ${seq.exerciseId}`)
        // console.log(`[SAVE DEBUG] allExercises:`, allExercises.map(ex => ({
        //   id: ex.id,
        //   originalExerciseId: ex.originalExerciseId,
        //   name: ex.name_ko
        // })))

        // seq.exerciseId에서 originalExerciseId를 찾기
        const matchedExercise = allExercises.find(ex =>
          (ex.originalExerciseId === seq.exerciseId) ||
          (ex.id === seq.exerciseId)
        )

        if (matchedExercise) {
          cleanExerciseId = matchedExercise.originalExerciseId || null
          //console.log(`[SAVE DEBUG] 매칭 성공! cleanExerciseId: ${cleanExerciseId}`)
        } else {
          console.warn(`[SAVE DEBUG] ⚠️ 매칭 실패! seq.exerciseId: ${seq.exerciseId}`)
        }
      }

      return {
        sequence: seq.sequence,
        round: seq.round,
        exercise_type: seq.type,
        exercise_id: cleanExerciseId, // 순수 originalExerciseId 사용
        duration: seq.duration,
        position: seq.position || null,
        name: seq.name
      }
    })
  }

  //console.log('=== 저장 데이터 상세 ===')
  //console.log('appliedDynamic:', appliedDynamic)
  //console.log('appliedCooldown:', appliedCooldown)
  //console.log('dynamicMasterId:', appliedDynamic?.id)
  //console.log('cooldownMasterId:', appliedCooldown?.id)
  //console.log('전체 저장 데이터:', saveData)
  //console.log('운동 개수:', saveData.exercises.length)
  //console.log('각 운동 데이터:')
  //saveData.exercises.forEach((ex, index) => {
  //  console.log(`운동 ${index + 1}:`, ex)
  //})
  //console.log('운동실행순서 개수:', saveData.workoutExercises.length)
  //console.log('운동실행순서 데이터:')
  // saveData.workoutExercises.forEach((seq, index) => {
  //   console.log(`순서 ${index + 1}:`, seq)
  // })
  //console.log('원본 exercises 배열:', exercises)

  return saveData
}

/**
 * 저장 전 유효성 검사
 */
export interface ValidationParams {
  rightSelectedDate: Dayjs | null
  panelRows: PanelRow[]
  appliedDynamic: WorkoutMaster | null
  appliedCooldown: WorkoutMaster | null
  exercises: Exercise[]
  appliedDynamicExercises?: Exercise[]
  appliedCooldownExercises?: Exercise[]
}

export interface ValidationResult {
  isValid: boolean
  message?: string
  severity?: 'error' | 'warning' | 'info' | 'success'
}

export function validateSaveData(params: ValidationParams): ValidationResult {
  const { rightSelectedDate, panelRows, appliedDynamic, appliedCooldown, exercises } = params

  // 1. 날짜 선택 확인
  if (!rightSelectedDate) {
    return {
      isValid: false,
      message: '운동 날짜를 선택해주세요.',
      severity: 'warning'
    }
  }

  // 2. 패널 DataGrid에 데이터 없으면 확인
  if (!panelRows || panelRows.length === 0) {
    return {
      isValid: false,
      message: '스트레스 / 루프 서킷 선택 후 + 버튼으로 추가 후 운동을 선택하세요.',
      severity: 'warning'
    }
  }

  // 3. 적용된 운동 정보 확인 (기존 로직 주석 처리)
  /*
  if (!appliedDynamic) {
    return {
      isValid: false,
      message: 'Dynamic 정보가 없습니다. Dynamic Stretching 기록에서 선택 후 적용을 클릭하세요.',
      severity: 'warning'
    }
  }

  if (!appliedStatic) {
    return {
      isValid: false,
      message: 'Static 정보가 없습니다. Static Stretching 기록에서 선택 후 적용을 클릭하세요.',
      severity: 'warning'
    }
  }
  */

  // Dynamic Stretching 데이터 확인
  if (!params.appliedDynamicExercises || params.appliedDynamicExercises.length === 0) {
    return {
      isValid: false,
      message: 'Dynamic Stretching 운동이 선택되지 않았습니다.',
      severity: 'warning'
    }
  }

  // Cool Down 데이터 확인
  if (!params.appliedCooldownExercises || params.appliedCooldownExercises.length === 0) {
    return {
      isValid: false,
      message: 'Cool Down 운동이 선택되지 않았습니다.',
      severity: 'warning'
    }
  }

  // 4. DataGrid에 데이터 없으면 확인
  if (!exercises || exercises.length === 0) {
    return {
      isValid: false,
      message: '등록할 운동이 없습니다. 운동을 선택해주세요.',
      severity: 'warning'
    }
  }

  // 5. 운동 데이터 유효성 검사
  //console.log('=== 저장 전 운동 데이터 검증 ===')
  //console.log('총 운동 개수:', exercises.length)

  const invalidExercises = exercises.filter((ex, index) => {
    const isValid = ex.name_ko && ex.target_muscles && ex.duration > 0
    //console.log(`운동 ${index + 1} 검증:`, {
    //  name_ko: ex.name_ko,
    //  target_muscles: ex.target_muscles,
    //  duration: ex.duration,
    //  isValid: isValid
    //})
    return !isValid
  })

  if (invalidExercises.length > 0) {
    //console.error('유효하지 않은 운동 데이터:', invalidExercises)
    return {
      isValid: false,
      message: `${invalidExercises.length}개의 운동 데이터가 유효하지 않습니다. 운동명, 자극부위, 시간을 확인해주세요.`,
      severity: 'warning'
    }
  }

  return { isValid: true }
}
