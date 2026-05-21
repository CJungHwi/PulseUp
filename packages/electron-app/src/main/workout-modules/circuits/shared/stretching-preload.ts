import type { WorkoutModuleContext } from './base-module'

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

  const legacyPositionGroups = {
    L1: [] as any[],
    L2: [] as any[],
    L3: [] as any[],
    R1: [] as any[],
    R2: [] as any[],
    R3: [] as any[],
  }

  group.forEach((item, idx) => {
    const slotIndex = idx % 3
    const leftPos = `L${slotIndex + 1}` as keyof typeof legacyPositionGroups
    const rightPos = `R${slotIndex + 1}` as keyof typeof legacyPositionGroups
    legacyPositionGroups[leftPos].push(item)
    legacyPositionGroups[rightPos].push(item)
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
