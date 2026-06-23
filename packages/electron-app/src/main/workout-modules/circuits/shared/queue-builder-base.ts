import type { SlotQueueEntry, SlotQueuesMap } from './queue-builder-types'
import {
  type GridMonitorSide,
  type GridGroupPrefix,
  isLegacyMainGridFormat,
  migrateOldMainGridPosition,
  normalizeGridPosition,
  parseGridPosition,
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

/** set1 = A/B(전반), set2 = C/D(후반) */
export function classifyMainByPosition(mainExercises: any[]): MainSetsByPosition {
  const set1: { [pos: string]: any } = {}
  const set2: { [pos: string]: any } = {}
  const usesLegacyMainGrid = isLegacyMainGridFormat(
    mainExercises.map((seq: any) => (typeof seq?.position === 'string' ? seq.position : undefined)),
  )
  for (const seq of mainExercises) {
    const pos = usesLegacyMainGrid
      ? migrateOldMainGridPosition(seq.position || '')
      : normalizeGridPosition(seq.position || '')
    const parsed = parseGridPosition(pos)
    if (!parsed) continue
    const normalizedSeq = { ...seq, position: pos }
    if (parsed.set === 'set1') {
      if (!set1[pos]) set1[pos] = normalizedSeq
    } else {
      if (!set2[pos]) set2[pos] = normalizedSeq
    }
  }
  return { set1, set2 }
}

export function emptySlotQueues(): SlotQueuesMap {
  return { 1: [], 2: [], 3: [] }
}

/**
 * DS/Main/CD 엔트리를 슬롯별로 채운다.
 * monitorSide: 3-screen 좌/우 모니터
 * - 좌: A1-A3(전반), C1-C3(후반)
 * - 우: B1-B3(전반), D1-D3(후반)
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
  const set1Prefix: GridGroupPrefix = monitorSide === 'left' ? 'A' : 'B'
  const set2Prefix: GridGroupPrefix = monitorSide === 'left' ? 'C' : 'D'

  for (let i = 0; i < 3; i++) {
    const slotNum = i + 1
    const slotDisplayPos = `${set1Prefix}${slotNum}`

    if (dsGroup1[i]) {
      queues[slotNum].push({ sequence: dsGroup1[i], position: slotDisplayPos, label: `DS${i + 1}` })
    }
    if (dsGroup2[i]) {
      queues[slotNum].push({ sequence: dsGroup2[i], position: slotDisplayPos, label: `DS${i + 4}` })
    }

    const mainPosSet1 = `${set1Prefix}${slotNum}`
    if (mainSets.set1[mainPosSet1]) {
      queues[slotNum].push({ sequence: mainSets.set1[mainPosSet1], position: mainPosSet1, label: mainPosSet1 })
    }

    for (const block of extraBlocks) {
      if (block[mainPosSet1]) {
        queues[slotNum].push({ sequence: block[mainPosSet1], position: mainPosSet1, label: mainPosSet1 })
      }
    }

    const mainPosSet2 = `${set2Prefix}${slotNum}`
    if (mainSets.set2[mainPosSet2]) {
      queues[slotNum].push({ sequence: mainSets.set2[mainPosSet2], position: mainPosSet2, label: mainPosSet2 })
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
 * - panel='L1': A1·A2·A3
 * - panel='L2': B1·B2·B3
 * - panel='R1': C1·C2·C3
 * - panel='R2': D1·D2·D3
 */
export type FivePanel = 'L1' | 'L2' | 'R1' | 'R2'

const groupPrefixForFivePanel = (panel: FivePanel): GridGroupPrefix => {
  if (panel === 'L1') return 'A'
  if (panel === 'L2') return 'B'
  if (panel === 'R1') return 'C'
  return 'D'
}

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
  const groupPrefix = groupPrefixForFivePanel(panel)
  const mainSet = groupPrefix === 'A' || groupPrefix === 'B' ? mainSets.set1 : mainSets.set2

  for (let i = 0; i < 3; i++) {
    const slotNum = i + 1
    const mainPos = `${groupPrefix}${slotNum}`
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
