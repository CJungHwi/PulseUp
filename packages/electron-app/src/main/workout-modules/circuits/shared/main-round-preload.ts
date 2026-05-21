import type { WorkoutModuleContext } from './base-module'

/** 메인 라운드 운동을 6개 단위 그룹으로 `workout-play-preload` 브로드캐스트 (DS 종료 후 Main 진입 등) */
export const preloadMainRoundGroup = (
  ctx: WorkoutModuleContext,
  round: number,
  groupIndex: number,
): void => {
  if (!ctx.activePlaySession) return
  const exercises = ctx.getPlayableMainExercisesByRound(round)
  if (exercises.length === 0) return

  const groupStart = groupIndex * 6
  const groupEnd = Math.min(groupStart + 6, exercises.length)
  const group = exercises.slice(groupStart, groupEnd)
  if (group.length === 0) return

  const key = `main:${round}:${groupIndex}`
  if (ctx.preloadedGroupKeys.has(key)) return
  ctx.preloadedGroupKeys.add(key)

  ctx.broadcastToAllWindows('workout-play-preload', {
    round,
    groupIndex,
    sequences: group,
    syncStartAtMs: Date.now(),
    metadata: ctx.activePlaySession.metadata,
  })
}
