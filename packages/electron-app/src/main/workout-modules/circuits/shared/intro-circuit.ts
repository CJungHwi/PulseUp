export type IntroCircuitKind = 'stress' | 'loop' | 'amrap' | 'emom'

/** 인트로 영상(L1–L6 / R1–R6) 수집 시 workout-play 가 넘기는 컨텍스트 */
export interface IntroSequenceCollectContext {
  allExercises: any[]
  rounds: number[]
  mainRound: number
  isStretchingOrCoolDownRound: (r: number) => boolean
  /** Loop/EMOM 전·후반당 플랜 라운드 수 */
  halfRoundsCount?: number
}

export const resolveIntroCircuitKind = (
  metadata: { workoutCategory?: unknown; circuitType?: unknown } | null | undefined,
): IntroCircuitKind => {
  const wc = (metadata?.workoutCategory || '').toString().toUpperCase()
  const ct = String(metadata?.circuitType || '').toLowerCase()
  if (wc === 'EMOM' || ct === 'emom') return 'emom'
  if (wc === 'AMRAP' || ct === 'amrap') return 'amrap'
  if (wc === 'LOOP' || ct === 'loop') return 'loop'
  return 'stress'
}

/** 카운트다운 프리뷰: 메인 구간(비스트레칭) 최대 포지션 개수 */
export const getIntroPreviewMaxMainPositions = (
  circuit: IntroCircuitKind,
  isStretchingRound: boolean,
): number => {
  if (isStretchingRound) return 3
  return circuit === 'emom' ? 12 : 6
}
