import type { SlotQueueEntry, SlotQueuesMap } from './queue-builder-types'
import {
  GRID_FIRST_HALF_PREFIX,
  GRID_SECOND_HALF_PREFIX,
  type GridMonitorSide,
  normalizeGridPosition,
  numOffsetForSide,
} from '../../../../common/grid-position-codes.js'

export { normalizeGridPosition } from '../../../../common/grid-position-codes.js'

export function filterPlayableExercises(sequences: any[]): any[] {
  return sequences.filter(
    (s: any) => s.exercise_type === 'exercise' && s.exercise_name !== '임시운동' && s.duration > 0,
  )
}

export interface PhaseGroups {
  dsExercises: any[]
  mainExercises: any[]
  cdExercises: any[]
}

export function classifyByPhase(exercises: any[]): PhaseGroups {
  return {
    dsExercises: exercises.filter((s: any) => Number(s.round) === 0),
    mainExercises: exercises.filter((s: any) => {
      const r = Number(s.round)
      return r > 0 && r < 99
    }),
    cdExercises: exercises.filter((s: any) => Number(s.round) === 99),
  }
}

export function splitIntoTwoGroups(exercises: any[]): [any[], any[]] {
  return [exercises.slice(0, 3), exercises.slice(3, 6)]
}

export interface MainSetsByPosition {
  set1: { [pos: string]: any }
  set2: { [pos: string]: any }
}

/** set1 = prefix A(전반), set2 = prefix B(후반) */
export function classifyMainByPosition(mainExercises: any[]): MainSetsByPosition {
  const set1: { [pos: string]: any } = {}
  const set2: { [pos: string]: any } = {}
  for (const seq of mainExercises) {
    const pos = normalizeGridPosition(seq.position || '')
    if (!pos || !/^[AB]\d+$/.test(pos)) continue
    const half = pos.charAt(0)
    if (half === GRID_FIRST_HALF_PREFIX) {
      if (!set1[pos]) set1[pos] = seq
    } else if (half === GRID_SECOND_HALF_PREFIX) {
      if (!set2[pos]) set2[pos] = seq
    }
  }
  return { set1, set2 }
}

export function emptySlotQueues(): SlotQueuesMap {
  return { 1: [], 2: [], 3: [] }
}

/**
 * DS/Main/CD 엔트리를 슬롯별로 채운다.
 * monitorSide: 좌/우 모니터 (num 1-3 vs 4-6)
 * - 좌: A1-A3(전반), B1-B3(후반)
 * - 우: A4-A6(전반), B4-B6(후반)
 */
export function fillStandardSlotQueues(
  monitorSide: GridMonitorSide,
  dsGroup1: any[],
  dsGroup2: any[],
  mainSets: MainSetsByPosition,
  extraBlocks: Array<{ [pos: string]: any }>,
  cdGroup1: any[],
  cdGroup2: any[],
): SlotQueuesMap {
  const queues = emptySlotQueues()
  const numBase = numOffsetForSide(monitorSide)

  for (let i = 0; i < 3; i++) {
    const slotNum = i + 1
    const num = numBase + slotNum
    const slotDisplayPos = `${GRID_FIRST_HALF_PREFIX}${num}`

    if (dsGroup1[i]) {
      queues[slotNum].push({ sequence: dsGroup1[i], position: slotDisplayPos, label: `DS${i + 1}` })
    }
    if (dsGroup2[i]) {
      queues[slotNum].push({ sequence: dsGroup2[i], position: slotDisplayPos, label: `DS${i + 4}` })
    }

    const mainPosA = `${GRID_FIRST_HALF_PREFIX}${num}`
    if (mainSets.set1[mainPosA]) {
      queues[slotNum].push({ sequence: mainSets.set1[mainPosA], position: mainPosA, label: mainPosA })
    }

    for (const block of extraBlocks) {
      if (block[mainPosA]) {
        queues[slotNum].push({ sequence: block[mainPosA], position: mainPosA, label: mainPosA })
      }
    }

    const mainPosB = `${GRID_SECOND_HALF_PREFIX}${num}`
    if (mainSets.set2[mainPosB]) {
      queues[slotNum].push({ sequence: mainSets.set2[mainPosB], position: slotDisplayPos, label: mainPosB })
    }

    if (cdGroup1[i]) {
      queues[slotNum].push({ sequence: cdGroup1[i], position: slotDisplayPos, label: `CD${i + 1}` })
    }
    if (cdGroup2[i]) {
      queues[slotNum].push({ sequence: cdGroup2[i], position: slotDisplayPos, label: `CD${i + 4}` })
    }
  }

  return queues
}

/**
 * 5-screen 모드용 큐 빌더 (한 패널 = 한 모니터).
 *
 * - panel='L1': DS → A1·A2·A3 (전반 좌)
 * - panel='L2': DS → A4·A5·A6 (전반 우)
 * - panel='R1': DS → B1·B2·B3 (후반 좌)
 * - panel='R2': DS → B4·B5·B6 (후반 우)
 */
export type FivePanel = 'L1' | 'L2' | 'R1' | 'R2'

export function fillFiveScreenSlotQueues(
  panel: FivePanel,
  dsGroup1: any[],
  dsGroup2: any[],
  mainSets: MainSetsByPosition,
  extraBlocks: Array<{ [pos: string]: any }>,
  cdGroup1: any[],
  cdGroup2: any[],
): SlotQueuesMap {
  const queues = emptySlotQueues()
  const halfPrefix =
    panel === 'L1' || panel === 'L2' ? GRID_FIRST_HALF_PREFIX : GRID_SECOND_HALF_PREFIX
  const numOffset = panel === 'L2' || panel === 'R2' ? 3 : 0
  const mainSet = halfPrefix === GRID_FIRST_HALF_PREFIX ? mainSets.set1 : mainSets.set2

  for (let i = 0; i < 3; i++) {
    const slotNum = i + 1
    const num = numOffset + slotNum
    const mainPos = `${halfPrefix}${num}`
    const slotDisplayPos = mainPos

    if (dsGroup1[i]) {
      queues[slotNum].push({ sequence: dsGroup1[i], position: slotDisplayPos, label: `DS${i + 1}` })
    }
    if (dsGroup2[i]) {
      queues[slotNum].push({ sequence: dsGroup2[i], position: slotDisplayPos, label: `DS${i + 4}` })
    }

    if (mainSet[mainPos]) {
      queues[slotNum].push({ sequence: mainSet[mainPos], position: mainPos, label: mainPos })
    }

    for (const block of extraBlocks) {
      if (block[mainPos]) {
        queues[slotNum].push({ sequence: block[mainPos], position: mainPos, label: mainPos })
      }
    }

    if (cdGroup1[i]) {
      queues[slotNum].push({ sequence: cdGroup1[i], position: slotDisplayPos, label: `CD${i + 1}` })
    }
    if (cdGroup2[i]) {
      queues[slotNum].push({ sequence: cdGroup2[i], position: slotDisplayPos, label: `CD${i + 4}` })
    }
  }

  return queues
}
