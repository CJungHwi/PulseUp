export interface SlotQueueEntry {
  sequence: any
  position: string
  label: string
}

export type SlotQueuesMap = { [slotNum: number]: SlotQueueEntry[] }

export type ScreenModeKind = 'three' | 'five'

/**
 * 3-screen 모드: leftQueues / rightQueues 두 개만 사용.
 * 5-screen 모드: 추가로 leftQueues2 (L4~L6 패널) / rightQueues2 (R4~R6 패널) 사용.
 */
export interface QueueBuildResult {
  leftQueues: SlotQueuesMap
  rightQueues: SlotQueuesMap
  leftQueues2?: SlotQueuesMap
  rightQueues2?: SlotQueuesMap
}

export type QueueBuilderFn = (
  sequences: any[],
  metadata: any,
  screenMode?: ScreenModeKind,
) => QueueBuildResult
