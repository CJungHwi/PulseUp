/** workout_history_master.workout_scope — DB workout_scope 마스터 scope_code */
export type WorkoutScope = string

export type WorkoutScopeRecord = {
  id: string
  scopeCode: string
  scopeName: string
  sortOrder: number
  isActive: boolean
}

/** 페이지별 저장 scope 코드 (DB에서 사용 여부만 검증) */
export const WORKOUT_SCOPE_TOTAL = 'TOTAL'
export const WORKOUT_SCOPE_SINGLE = 'SINGLE'
