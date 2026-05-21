import { workoutInfoDevLog } from '../workout-dev-log.js'
import type { DisplayType } from '../renderer-display-types.js'

export const log = workoutInfoDevLog

export interface RendererContext {
  currentDisplay: DisplayType
  workoutGridDisplay: any
  workoutPlayTimerUI: any
  currentRound: number
  currentActiveSet: 'set1' | 'set2'
  hasCountdownPreview: boolean

  setCurrentRound: (round: number) => void
  setCurrentActiveSet: (set: 'set1' | 'set2') => void
  setHasCountdownPreview: (value: boolean) => void

  handleStretchingMode: (
    positionGroups: any,
    isLeftMonitor: boolean,
    syncStartAtMs?: number,
    skipPlayIfSame?: boolean,
    stretchingSlotCount?: number
  ) => void

  getMainTargetSetFromPosition: (position: string) => 'set1' | 'set2' | null
}

export interface SequenceRenderer {
  canHandle(data: any): boolean
  handle(ctx: RendererContext, data: any): void
}
