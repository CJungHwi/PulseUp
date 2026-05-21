export type WorkoutCircuitType = 'stress' | 'loop' | 'amrap' | 'emom'

/** MAIN 등은 서킷 종류가 아니므로 추론 후보에서 제외 (누락 시 stress로 잘못 고정되는 것 방지) */
const IGNORE_CANDIDATES = new Set(['main', ''])

export const resolveWorkoutCircuitType = (data: any): WorkoutCircuitType => {
  const metadata = data?.metadata || {}
  const seqMeta = data?.sequence?.metadata || {}
  const candidates = [
    data?.circuitType,
    metadata.circuitType,
    seqMeta.circuitType,
    metadata.workoutCategory,
    seqMeta.workoutCategory,
    metadata.major_category,
    metadata.major_category_name,
    metadata.method_type,
    metadata.method_name,
    data?.workoutCategory,
    data?.major_category,
    data?.major_category_name,
    data?.method_type,
    data?.method_name,
  ]
    .map((v) => String(v || '').trim().toLowerCase())
    .filter(Boolean)
    .filter((v) => !IGNORE_CANDIDATES.has(v))

  for (const v of candidates) {
    if (v === 'emom') return 'emom'
    if (v === 'amrap') return 'amrap'
    if (v === 'loop') return 'loop'
    if (v === 'stress') return 'stress'
    if (v.includes('emom')) return 'emom'
    if (v.includes('amrap')) return 'amrap'
    if (v.includes('loop')) return 'loop'
    if (v.includes('stress')) return 'stress'
  }

  return 'stress'
}

/**
 * 타이머 모니터용: IPC 일부(휴식 등)에서 metadata.circuitType이 빠지면 resolve만으로는 stress로 떨어져
 * MM:SS가 초 단위로 바뀐다. 한번이라도 확정된 서킷은 sticky로 유지한다.
 */
export const resolveTimerCircuitType = (
  data: any,
  sticky: WorkoutCircuitType | null,
): { circuitType: WorkoutCircuitType; sticky: WorkoutCircuitType | null } => {
  const meta = data?.metadata || {}
  const rootCt = String(data?.circuitType || '').trim().toLowerCase()
  const metaCt = String(meta.circuitType || '').trim().toLowerCase()
  const explicit = rootCt || metaCt
  if (explicit === 'emom' || explicit === 'amrap' || explicit === 'loop' || explicit === 'stress') {
    return { circuitType: explicit as WorkoutCircuitType, sticky: explicit as WorkoutCircuitType }
  }

  const resolved = resolveWorkoutCircuitType(data)
  if (resolved !== 'stress') {
    return { circuitType: resolved, sticky: resolved }
  }

  if (sticky && (sticky === 'emom' || sticky === 'amrap' || sticky === 'loop')) {
    return { circuitType: sticky, sticky }
  }

  return { circuitType: resolved, sticky }
}
