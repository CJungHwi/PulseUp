function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false
  return ['1', 'true', 'yes', 'y', 'on'].includes(value.trim().toLowerCase())
}

/**
 * 운동·영상 파이프라인 정보성 로그.
 * - 운영(패키지 빌드 등 NODE_ENV=production): 기본 off
 * - 강제 on: LINKHIIT_WORKOUT_DEBUG=1
 * - 비프로덕션에서도 끄기: LINKHIIT_WORKOUT_DEBUG=0
 */
export function isWorkoutInfoDebugEnabled(): boolean {
  const raw = (process.env.LINKHIIT_WORKOUT_DEBUG ?? '').trim().toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') return false
  if (isTruthyEnv(process.env.LINKHIIT_WORKOUT_DEBUG)) return true
  if (process.env.NODE_ENV === 'production') return false
  return true
}

export function workoutInfoDevLog(...args: unknown[]): void {
  if (!isWorkoutInfoDebugEnabled()) return
  console.log(...args)
}
