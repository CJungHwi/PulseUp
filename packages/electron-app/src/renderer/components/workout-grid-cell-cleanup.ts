export type WorkoutGridCellSide = 'left' | 'left-2' | 'right' | 'right-2'

function cellSidePrefix(side: WorkoutGridCellSide): 'L' | 'R' {
  return side === 'left' || side === 'left-2' ? 'L' : 'R'
}

export type WorkoutGridCellCleanupCtx = {
  side: WorkoutGridCellSide
  players: Map<string, any>
  loopIntervals: Map<string, NodeJS.Timeout>
  resetPositionLabel: (slot: number, defaultLabel: string) => void
  resetExerciseNameLabel: (slot: number) => void
  updateCategoryLabel: (positionOrLabel: string) => void
}

export const clearAllWorkoutGridVideoCells = (ctx: WorkoutGridCellCleanupCtx, keepLabels: boolean) => {
  const prefix = cellSidePrefix(ctx.side)
  const maxSlots = document.querySelectorAll(`[id^="video-slot-${prefix}"]`).length || 3

  for (let i = 1; i <= maxSlots; i++) {
    const slotId = `video-slot-${prefix}${i}`
    const videoCell = document.getElementById(slotId)
    if (!videoCell) continue

    const playerId = `${slotId}-player`
    if (ctx.players.has(playerId)) {
      const player = ctx.players.get(playerId)
      try {
        player?.pause()
        player?.destroy()
      } catch (e) {
        console.error('Player destroy error:', e)
      }
      ctx.players.delete(playerId)
    }

    if (ctx.loopIntervals.has(playerId)) {
      clearInterval(ctx.loopIntervals.get(playerId))
      ctx.loopIntervals.delete(playerId)
    }

    const videoContainer = videoCell.querySelector('.video-container') as HTMLElement
    if (videoContainer) {
      videoContainer.style.display = 'none'
      videoContainer.innerHTML = ''
    }

    const placeholder = videoCell.querySelector('.placeholder') as HTMLElement
    if (placeholder) placeholder.style.display = 'block'

    const badgeId = `reps-badge-${prefix}${i}`
    const badge = document.getElementById(badgeId)
    if (badge) badge.style.display = 'none'

    if (!keepLabels) {
      ctx.resetPositionLabel(i, `${prefix}${i}`)
      ctx.resetExerciseNameLabel(i)
    }
  }

  if (!keepLabels) {
    ctx.updateCategoryLabel('')
  }
}

export type WorkoutGridClearByPositionCtx = Pick<
  WorkoutGridCellCleanupCtx,
  'side' | 'players' | 'loopIntervals'
> & {
  mapPositionToSlot: (position: string) => number
  resetPositionLabel: (slot: number, defaultLabel: string) => void
  resetExerciseNameLabel: (slot: number) => void
}

export const clearWorkoutGridVideoByPosition = (ctx: WorkoutGridClearByPositionCtx, position: string) => {
  const slot = ctx.mapPositionToSlot(position)
  const prefix = cellSidePrefix(ctx.side)
  const slotId = `video-slot-${prefix}${slot}`
  const videoCell = document.getElementById(slotId)
  if (!videoCell) return

  if (videoCell.getAttribute('data-position') !== position) return

  const playerId = `${slotId}-player`
  if (ctx.players.has(playerId)) {
    const player = ctx.players.get(playerId)
    try {
      player?.destroy()
    } catch (error) {
      console.error('플레이어 제거 실패:', error)
    }
    ctx.players.delete(playerId)
  }

  if (ctx.loopIntervals.has(playerId)) {
    clearInterval(ctx.loopIntervals.get(playerId))
    ctx.loopIntervals.delete(playerId)
  }

  const videoContainer = videoCell.querySelector('.video-container') as HTMLElement
  if (videoContainer) {
    videoContainer.style.display = 'none'
    videoContainer.innerHTML = ''
  }

  const placeholder = videoCell.querySelector('.placeholder') as HTMLElement
  if (placeholder) placeholder.style.display = 'block'

  videoCell.setAttribute('data-position', '')
  ctx.resetPositionLabel(slot, `${prefix}${slot}`)
  ctx.resetExerciseNameLabel(slot)
}
