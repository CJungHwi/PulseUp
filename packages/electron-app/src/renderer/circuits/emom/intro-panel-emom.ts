/**
 * 인트로 메타 기준 EMOM·AMRAP 여부
 * — 플랜 행을 분 단위로 표시할 때 WORK=운동, REST=휴식(rest). 물보충은 별도 UI.
 */
export const isEmomIntroMetadata = (metadata?: Record<string, unknown>): boolean => {
  const cat = String(metadata?.workoutCategory ?? '').toUpperCase()
  const ct = String(metadata?.circuitType ?? '').toLowerCase()
  return (
    cat === 'EMOM' ||
    ct === 'emom' ||
    cat === 'AMRAP' ||
    ct === 'amrap'
  )
}

/** 초 단위 값을 인트로에 표시할 분 숫자 문자열(반올림) */
export const formatIntroSecondsAsWholeMinutes = (seconds: number): string => {
  const n = Number(seconds) || 0
  if (n <= 0) return '0'
  return String(Math.max(1, Math.round(n / 60)))
}

/** 운동설정(플랜) 개수 = EMOM 인트로 ROUND 표시값 */
export const getEmomIntroRoundCountFromMetadata = (metadata?: Record<string, unknown>): number => {
  const plans = metadata?.workoutPlans
  if (Array.isArray(plans) && plans.length > 0) return plans.length
  const c = Number(metadata?.exerciseCount ?? 0)
  return Number.isFinite(c) && c > 0 ? c : 0
}

/**
 * 타이머 상단 RND·SET 분모: **workoutPlans.length만** 사용.
 * (슬롯 수·totalSets·emomExerciseTotal 등은 재생/IPC용이지 표시 분모가 아님. 플랜 없으면 1)
 */
export const getTimerStripPlanDenominator = (metadata?: Record<string, unknown> | null): number => {
  const plans = metadata?.workoutPlans
  if (Array.isArray(plans) && plans.length > 0) return plans.length
  return 1
}
