function safeGetEnv(name: string): string | undefined {
  try {
    return typeof process !== 'undefined' && process?.env ? process.env[name] : undefined
  } catch {
    return undefined
  }
}

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false
  return ['1', 'true', 'yes', 'y', 'on'].includes(value.trim().toLowerCase())
}

/**
 * 운동·영상 파이프라인 정보성 로그 (메인과 동일 규칙).
 * renderer에서는 process.env가 없으므로(nodeIntegration:false) 안전하게 접근한다.
 * @see packages/electron-app/src/main/workout-dev-log.ts
 */
export function isWorkoutInfoDebugEnabled(): boolean {
  const raw = (safeGetEnv('LINKHIIT_WORKOUT_DEBUG') ?? '').trim().toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') return false
  if (isTruthyEnv(safeGetEnv('LINKHIIT_WORKOUT_DEBUG'))) return true
  if (safeGetEnv('NODE_ENV') === 'production') return false
  return true
}

export function workoutInfoDevLog(...args: unknown[]): void {
  if (!isWorkoutInfoDebugEnabled()) return
  console.log(...args)
}
