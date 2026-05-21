/** 인트로 오버레이 상단 타이틀 — workoutCategory 또는 circuitType 기반 */
export const introOverlayTitleFromMetadata = (metadata?: Record<string, unknown>): string => {
  const candidates = [
    metadata?.workoutCategory,
    metadata?.circuitType,
    metadata?.major_category_name,
  ]
  for (const val of candidates) {
    const upper = String(val ?? '').toUpperCase()
    if (upper === 'EMOM') return 'EMOM'
    if (upper === 'AMRAP') return 'AMRAP'
  }
  return 'MAIN TRAINING'
}
