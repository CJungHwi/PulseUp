import type { SlotQueueEntry, SlotQueuesMap } from './queue-builder-types'

export const normalizeLrGridPosition = (raw: unknown): string => {
  const s = String(raw ?? '').trim()
  const m = s.match(/^([lLrR])(\d+)$/)
  if (!m) return s
  const side = m[1].toUpperCase() === 'L' ? 'L' : 'R'
  return `${side}${m[2]}`
}

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

export function classifyMainByPosition(mainExercises: any[]): MainSetsByPosition {
  const set1: { [pos: string]: any } = {}
  const set2: { [pos: string]: any } = {}
  for (const seq of mainExercises) {
    const pos = normalizeLrGridPosition(seq.position || '')
    if (!pos || !/^[LR]\d+$/.test(pos)) continue
    const posNum = parseInt(pos.substring(1), 10)
    if (posNum <= 3) {
      if (!set1[pos]) set1[pos] = seq
    } else {
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
 * prefix: 'L' 또는 'R' (좌/우 모니터)
 */
export function fillStandardSlotQueues(
  prefix: 'L' | 'R',
  dsGroup1: any[],
  dsGroup2: any[],
  mainSets: MainSetsByPosition,
  extraBlocks: Array<{ [pos: string]: any }>,
  cdGroup1: any[],
  cdGroup2: any[],
): SlotQueuesMap {
  const queues = emptySlotQueues()

  for (let i = 0; i < 3; i++) {
    const slotNum = i + 1
    const slotPos = `${prefix}${slotNum}`

    if (dsGroup1[i]) {
      queues[slotNum].push({ sequence: dsGroup1[i], position: slotPos, label: `DS${i + 1}` })
    }
    if (dsGroup2[i]) {
      queues[slotNum].push({ sequence: dsGroup2[i], position: slotPos, label: `DS${i + 4}` })
    }

    const mainPos1 = `${prefix}${slotNum}`
    if (mainSets.set1[mainPos1]) {
      queues[slotNum].push({ sequence: mainSets.set1[mainPos1], position: mainPos1, label: mainPos1 })
    }

    for (const block of extraBlocks) {
      if (block[mainPos1]) {
        queues[slotNum].push({ sequence: block[mainPos1], position: mainPos1, label: mainPos1 })
      }
    }

    const mainPos2 = `${prefix}${slotNum + 3}`
    if (mainSets.set2[mainPos2]) {
      queues[slotNum].push({ sequence: mainSets.set2[mainPos2], position: slotPos, label: mainPos2 })
    }

    if (cdGroup1[i]) {
      queues[slotNum].push({ sequence: cdGroup1[i], position: slotPos, label: `CD${i + 1}` })
    }
    if (cdGroup2[i]) {
      queues[slotNum].push({ sequence: cdGroup2[i], position: slotPos, label: `CD${i + 4}` })
    }
  }

  return queues
}

/**
 * 5-screen 모드용 큐 빌더 (한 패널 = 한 모니터).
 *
 * - panel='L1': DS1·2·3 → DS4·5·6 → L1·L2·L3 → CD1·2·3 → CD4·5·6
 * - panel='L2': DS1·2·3 → DS4·5·6 → L4·L5·L6 → CD1·2·3 → CD4·5·6
 * - panel='R1': DS1·2·3 → DS4·5·6 → R1·R2·R3 → CD1·2·3 → CD4·5·6
 * - panel='R2': DS1·2·3 → DS4·5·6 → R4·R5·R6 → CD1·2·3 → CD4·5·6
 *
 * DS/CD 단계는 모든 패널이 동일하게 표시(현재 3-screen DS와 동일 동작).
 * Main 단계는 각 패널이 자기 그룹의 동일 슬롯 위치만 advance.
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
  const sideChar: 'L' | 'R' = panel === 'L1' || panel === 'L2' ? 'L' : 'R'
  const isSecondHalf = panel === 'L2' || panel === 'R2'

  for (let i = 0; i < 3; i++) {
    const slotNum = i + 1
    const baseSlotPos = `${sideChar}${slotNum}`

    if (dsGroup1[i]) {
      queues[slotNum].push({ sequence: dsGroup1[i], position: baseSlotPos, label: `DS${i + 1}` })
    }
    if (dsGroup2[i]) {
      queues[slotNum].push({ sequence: dsGroup2[i], position: baseSlotPos, label: `DS${i + 4}` })
    }

    // Main: 패널에 따라 set1(1~3) 또는 set2(4~6) 사용
    const mainPos = isSecondHalf ? `${sideChar}${slotNum + 3}` : `${sideChar}${slotNum}`
    const mainSet = isSecondHalf ? mainSets.set2 : mainSets.set1
    if (mainSet[mainPos]) {
      queues[slotNum].push({ sequence: mainSet[mainPos], position: mainPos, label: mainPos })
    }

    for (const block of extraBlocks) {
      if (block[mainPos]) {
        queues[slotNum].push({ sequence: block[mainPos], position: mainPos, label: mainPos })
      }
    }

    if (cdGroup1[i]) {
      queues[slotNum].push({ sequence: cdGroup1[i], position: baseSlotPos, label: `CD${i + 1}` })
    }
    if (cdGroup2[i]) {
      queues[slotNum].push({ sequence: cdGroup2[i], position: baseSlotPos, label: `CD${i + 4}` })
    }
  }

  return queues
}
