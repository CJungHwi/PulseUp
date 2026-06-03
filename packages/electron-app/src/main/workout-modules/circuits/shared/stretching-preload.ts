import type { WorkoutModuleContext } from './base-module'
import { GRID_FIRST_HALF_PREFIX } from '../../../../common/grid-position-codes.js'

/**
 * DS/CD 등 스트레칭 라운드 영상을 `stretchingMode` + positionGroups와 함께 프리로드.
 * (Cool Down 선로드, 스트레칭 구간 내 다음 그룹 등)
 */
export const preloadStretchingRoundGroup = (
  ctx: WorkoutModuleContext,
  round: number,
  groupIndex: number,
): void => {
  if (!ctx.activePlaySession) return

  const stretchingExercises = ctx.activePlaySession.sequences.filter(
    (s) =>
      s.round === round &&
      s.exercise_type === 'exercise' &&
      s.exercise_name !== '임시운동' &&
      s.duration > 0,
  )

  if (stretchingExercises.length === 0) return

  const groupStart = groupIndex * 3
  const groupEnd = Math.min(groupStart + 3, stretchingExercises.length)
  const group = stretchingExercises.slice(groupStart, groupEnd)
  if (group.length === 0) return

  const key = `stretch:${round}:${groupIndex}`
  if (ctx.preloadedGroupKeys.has(key)) return
  ctx.preloadedGroupKeys.add(key)

  const legacyPositionGroups: Record<string, any[]> = {}

  group.forEach((item, idx) => {
    const num = groupStart + idx + 1
    const pos = `${GRID_FIRST_HALF_PREFIX}${num}`
    if (!legacyPositionGroups[pos]) legacyPositionGroups[pos] = []
    legacyPositionGroups[pos].push(item)
  })

  ctx.broadcastToAllWindows('workout-play-preload', {
    round,
    groupIndex,
    sequences: group,
    positionGroups: legacyPositionGroups,
    syncStartAtMs: Date.now(),
    metadata: ctx.activePlaySession.metadata,
    stretchingMode: true,
  })
}
