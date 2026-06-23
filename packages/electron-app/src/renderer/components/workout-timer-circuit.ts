export type WorkoutCircuitType = 'stress' | 'loop' | 'amrap' | 'emom'

/** MAIN 등은 서킷 종류가 아니므로 추론 후보에서 제외 (누락 시 stress로 잘못 고정되는 것 방지) */
const IGNORE_CANDIDATES = new Set(['main', ''])

const normalizeMethod = (value: unknown): 'stress' | 'loop' | null => {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'stress' || normalized.includes('stress')) return 'stress'
  if (normalized === 'loop' || normalized.includes('loop')) return 'loop'
  return null
}

export const resolveWorkoutMethodType = (data: any): 'stress' | 'loop' | null => {
  if (String(data?.counterMode || '').toLowerCase() === 'emom-stress') return 'stress'

  const metadata = data?.metadata || {}
  const seqMeta = data?.sequence?.metadata || {}
  const candidates = [
    metadata.emomCircuitType,
    metadata.method_type,
    metadata.methodType,
    metadata.circuit_type,
    seqMeta.emomCircuitType,
    seqMeta.method_type,
    seqMeta.methodType,
    seqMeta.circuit_type,
    data?.emomCircuitType,
    data?.method_type,
    data?.methodType,
    data?.circuit_type,
  ]

  for (const candidate of candidates) {
    const method = normalizeMethod(candidate)
    if (method) return method
  }

  const workoutCategory = String(metadata.workoutCategory || data?.workoutCategory || '').toUpperCase()
  if (workoutCategory === 'EMOM') {
    return normalizeMethod(metadata.circuitType || data?.circuitType)
  }

  return null
}

export const resolveWorkoutCircuitType = (data: any): WorkoutCircuitType => {
  const metadata = data?.metadata || {}
  const seqMeta = data?.sequence?.metadata || {}
  const categorySignals = [
    metadata.workoutCategory,
    seqMeta.workoutCategory,
    metadata.major_category,
    metadata.major_category_name,
    data?.workoutCategory,
    data?.major_category,
    data?.major_category_name,
    data?.sequence?.major_category,
    data?.sequence?.major_category_name,
  ].map((v) => String(v || '').trim().toLowerCase())

  for (const category of categorySignals) {
    if (category === 'emom') return 'emom'
    if (category === 'amrap') return 'amrap'
  }

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
  const seqMeta = data?.sequence?.metadata || {}

  // EMOM/AMRAP 은 '시간 구조형' 카테고리 → loop/stress 서브메서드(재생 순서)와 무관하게
  // 타이머는 MM:SS·RND 표시를 따라야 한다. 따라서 타이머 한정으로 카테고리를 서킷타입보다 우선한다.
  // (재생 모듈 선택용 resolveWorkoutCircuitType 은 변경하지 않아 LoopModule 등 재생 동작은 그대로)
  const categorySignals = [
    meta.workoutCategory,
    seqMeta.workoutCategory,
    meta.major_category,
    meta.major_category_name,
    data?.workoutCategory,
    data?.major_category,
    data?.major_category_name,
    data?.sequence?.major_category,
    data?.sequence?.major_category_name,
  ].map((v) => String(v || '').trim().toLowerCase())
  for (const c of categorySignals) {
    if (c === 'emom') return { circuitType: 'emom', sticky: 'emom' }
    if (c === 'amrap') return { circuitType: 'amrap', sticky: 'amrap' }
  }

  // EMOM/AMRAP 으로 한번 확정되면, 이후 rest/countdown 등 카테고리 신호가 없는 브로드캐스트에서
  // 모듈 기준으로 주입된 loop/stress 가 덮어쓰지 않도록 sticky 를 우선 유지한다.
  if (sticky === 'emom' || sticky === 'amrap') {
    return { circuitType: sticky, sticky }
  }

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

  // emom/amrap sticky 는 위에서 이미 처리됨. loop 만 유지하면 된다.
  if (sticky === 'loop') {
    return { circuitType: sticky, sticky }
  }

  return { circuitType: resolved, sticky }
}
