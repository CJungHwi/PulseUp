/**
 * 타임라인 유틸 - 영상 재생 구간 사전 계산
 * DS/CD 포함, Stress/Loop/AMRAP/EMOM 방식별로 함수 분리
 */

import type { ExerciseSequence } from '../../../types'
import { resolveEmomStepDurationSec } from '../emom/emom-constants'

export interface TimelineEntry {
  startMs: number
  endMs: number
  sequence: ExerciseSequence
  position: string
  sequenceIndex: number
}

export type TimelineByPosition = Map<string, TimelineEntry[]>

export interface TimelineResult {
  byPosition: TimelineByPosition
  flat: TimelineEntry[]
}

export type CircuitType = 'stress' | 'loop' | 'amrap' | 'emom'

const isStretchingOrCoolDownRound = (round: number) => round === 0 || round === 99

function isValidExercise(seq: ExerciseSequence): boolean {
  return (
    seq.exercise_type === 'exercise' &&
    seq.exercise_name !== '임시운동' &&
    seq.duration > 0
  )
}

/**
 * DS (Dynamic Stretching) - round=0
 * 3개씩 그룹(DS1-3, DS4-6), 그룹 내 L1→L2→L3 순차
 */
export function buildTimelineForDS(sequences: ExerciseSequence[]): TimelineResult {
  const flat: TimelineEntry[] = []
  const byPosition = new Map<string, TimelineEntry[]>()
  const dsSequences = sequences.filter(
    (s) => s.round === 0 && isValidExercise(s)
  ) as ExerciseSequence[]

  const groups: ExerciseSequence[][] = []
  for (let i = 0; i < dsSequences.length; i += 3) {
    groups.push(dsSequences.slice(i, i + 3))
  }

  const prefix = 'DS'
  let currentMs = 0

  groups.forEach((group, gi) => {
    const slotBase = gi * 3 + 1
    const positions = [`L${slotBase}`, `L${slotBase + 1}`, `L${slotBase + 2}`] as const
    group.forEach((seq, idx) => {
      const position = `${prefix}${gi * 3 + idx + 1}`
      const slotPos = positions[idx]
      const startMs = currentMs
      const endMs = currentMs + seq.duration * 1000
      currentMs = endMs

      const entry: TimelineEntry = {
        startMs,
        endMs,
        sequence: seq,
        position: slotPos,
        sequenceIndex: sequences.indexOf(seq),
      }
      flat.push(entry)

      const arr = byPosition.get(slotPos) || []
      arr.push(entry)
      byPosition.set(slotPos, arr)

      const rightPos = slotPos.replace('L', 'R')
      const arrR = byPosition.get(rightPos) || []
      arrR.push(entry)
      byPosition.set(rightPos, arrR)
    })
  })

  return { byPosition, flat }
}

/**
 * CD (Cool Down) - round=99
 * DS와 동일 구조, CD1-6
 */
export function buildTimelineForCD(sequences: ExerciseSequence[]): TimelineResult {
  const flat: TimelineEntry[] = []
  const byPosition = new Map<string, TimelineEntry[]>()
  const cdSequences = sequences.filter(
    (s) => s.round === 99 && isValidExercise(s)
  ) as ExerciseSequence[]

  const groups: ExerciseSequence[][] = []
  for (let i = 0; i < cdSequences.length; i += 3) {
    groups.push(cdSequences.slice(i, i + 3))
  }

  const prefix = 'CD'
  let currentMs = 0

  groups.forEach((group, gi) => {
    const slotBase = gi * 3 + 1
    const positions = [`L${slotBase}`, `L${slotBase + 1}`, `L${slotBase + 2}`] as const
    group.forEach((seq, idx) => {
      const position = `${prefix}${gi * 3 + idx + 1}`
      const slotPos = positions[idx]
      const startMs = currentMs
      const endMs = currentMs + seq.duration * 1000
      currentMs = endMs

      const entry: TimelineEntry = {
        startMs,
        endMs,
        sequence: seq,
        position: slotPos,
        sequenceIndex: sequences.indexOf(seq),
      }
      flat.push(entry)

      const arr = byPosition.get(slotPos) || []
      arr.push(entry)
      byPosition.set(slotPos, arr)

      const rightPos = slotPos.replace('L', 'R')
      const arrR = byPosition.get(rightPos) || []
      arrR.push(entry)
      byPosition.set(rightPos, arrR)
    })
  })

  return { byPosition, flat }
}

/**
 * Stress - L1→L2→L3→R3→R2→R1, 운동별 모든 라운드 반복, rest/water 포함
 * sequences는 이미 실행 순서대로 저장됨
 */
export function buildTimelineForStress(
  sequences: ExerciseSequence[]
): TimelineResult {
  const flat: TimelineEntry[] = []
  const byPosition = new Map<string, TimelineEntry[]>()
  const mainSequences = sequences.filter(
    (s) => s.round > 0 && s.round < 99 && !isStretchingOrCoolDownRound(s.round)
  )
  let currentMs = 0

  mainSequences.forEach((seq, idx) => {
    const seqIndex = sequences.indexOf(seq)
    const durationMs = seq.duration * 1000

    if (seq.exercise_type === 'exercise' && isValidExercise(seq)) {
      const pos = seq.position || 'L1'
      const entry: TimelineEntry = {
        startMs: currentMs,
        endMs: currentMs + durationMs,
        sequence: seq,
        position: pos,
        sequenceIndex: seqIndex,
      }
      flat.push(entry)

      const arr = byPosition.get(pos) || []
      arr.push(entry)
      byPosition.set(pos, arr)
    }

    currentMs += durationMs
  })

  return { byPosition, flat }
}

/**
 * Loop - 라운드별 L1→L2→L3→R3→R2→R1 순차, rest/water 포함
 */
export function buildTimelineForLoop(
  sequences: ExerciseSequence[]
): TimelineResult {
  const flat: TimelineEntry[] = []
  const byPosition = new Map<string, TimelineEntry[]>()
  const mainSequences = sequences.filter(
    (s) => s.round > 0 && s.round < 99 && !isStretchingOrCoolDownRound(s.round)
  )
  let currentMs = 0

  mainSequences.forEach((seq) => {
    const seqIndex = sequences.indexOf(seq)
    const durationMs = seq.duration * 1000

    if (seq.exercise_type === 'exercise' && isValidExercise(seq)) {
      const pos = seq.position || 'L1'
      const entry: TimelineEntry = {
        startMs: currentMs,
        endMs: currentMs + durationMs,
        sequence: seq,
        position: pos,
        sequenceIndex: seqIndex,
      }
      flat.push(entry)

      const arr = byPosition.get(pos) || []
      arr.push(entry)
      byPosition.set(pos, arr)
    }

    currentMs += durationMs
  })

  return { byPosition, flat }
}

/**
 * AMRAP - 전반전/후반전 각각 그룹 전체 시간, 6개 동시 재생 후 휴식
 * sequences: Round 1 운동 6개 → rest → Round 2 운동 6개 순서
 */
export function buildTimelineForAMRAP(
  sequences: ExerciseSequence[]
): TimelineResult {
  const flat: TimelineEntry[] = []
  const byPosition = new Map<string, TimelineEntry[]>()
  let currentMs = 0
  let i = 0

  while (i < sequences.length) {
    const seq = sequences[i]
    if (seq.round === 0 || seq.round === 99) {
      i++
      continue
    }
    if (seq.exercise_type === 'rest' || seq.exercise_type === 'water') {
      currentMs += seq.duration * 1000
      i++
      continue
    }
    if (seq.exercise_type === 'exercise' && isValidExercise(seq)) {
      const roundSeqs = sequences.filter(
        (s) =>
          s.round === seq.round &&
          s.exercise_type === 'exercise' &&
          isValidExercise(s)
      )
      const maxDuration = Math.max(...roundSeqs.map((s) => s.duration), 0)
      const startMs = currentMs
      const endMs = currentMs + maxDuration * 1000

      roundSeqs.forEach((s) => {
        const pos = s.position || 'L1'
        const entry: TimelineEntry = {
          startMs,
          endMs,
          sequence: s,
          position: pos,
          sequenceIndex: sequences.indexOf(s),
        }
        flat.push(entry)
        const arr = byPosition.get(pos) || []
        arr.push(entry)
        byPosition.set(pos, arr)
      })

      currentMs = endMs
      i += roundSeqs.length
    } else {
      i++
    }
  }

  return { byPosition, flat }
}

/**
 * EMOM - L1→L2→L3→R3→R2→R1 순차(운동당 duration), 휴식 포함
 */
export function buildTimelineForEMOM(
  sequences: ExerciseSequence[]
): TimelineResult {
  const flat: TimelineEntry[] = []
  const byPosition = new Map<string, TimelineEntry[]>()
  const mainSequences = sequences.filter(
    (s) => s.round > 0 && s.round < 99 && !isStretchingOrCoolDownRound(s.round)
  )
  let currentMs = 0

  mainSequences.forEach((seq) => {
    const seqIndex = sequences.indexOf(seq)
    const durationMs = resolveEmomStepDurationSec(seq.duration) * 1000

    if (seq.exercise_type === 'exercise' && isValidExercise(seq)) {
      const pos = seq.position || 'L1'
      const entry: TimelineEntry = {
        startMs: currentMs,
        endMs: currentMs + durationMs,
        sequence: seq,
        position: pos,
        sequenceIndex: seqIndex,
      }
      flat.push(entry)

      const arr = byPosition.get(pos) || []
      arr.push(entry)
      byPosition.set(pos, arr)
    }

    currentMs += durationMs
  })

  return { byPosition, flat }
}

/**
 * 통합 진입점 - round와 circuitType에 따라 적절한 함수 호출
 */
export function buildTimeline(
  sequences: ExerciseSequence[],
  circuitType: CircuitType,
  round: number
): TimelineResult {
  if (round === 0) return buildTimelineForDS(sequences)
  if (round === 99) return buildTimelineForCD(sequences)

  switch (circuitType) {
    case 'stress':
      return buildTimelineForStress(sequences)
    case 'loop':
      return buildTimelineForLoop(sequences)
    case 'amrap':
      return buildTimelineForAMRAP(sequences)
    case 'emom':
      return buildTimelineForEMOM(sequences)
    default:
      return buildTimelineForStress(sequences)
  }
}

/**
 * 전체 운동 타임라인 통합 (DS + Main + CD)
 */
export function buildFullTimeline(
  sequences: ExerciseSequence[],
  circuitType: CircuitType
): { flat: TimelineEntry[]; byPosition: TimelineByPosition } {
  const allFlat: TimelineEntry[] = []
  const allByPosition = new Map<string, TimelineEntry[]>()
  let offsetMs = 0

  const merge = (result: TimelineResult) => {
    let maxEnd = 0
    result.flat.forEach((e) => {
      const entry: TimelineEntry = {
        ...e,
        startMs: e.startMs + offsetMs,
        endMs: e.endMs + offsetMs,
      }
      maxEnd = Math.max(maxEnd, entry.endMs)
      allFlat.push(entry)
      const arr = allByPosition.get(e.position) || []
      arr.push(entry)
      allByPosition.set(e.position, arr)
    })
    offsetMs = maxEnd
  }

  const dsResult = buildTimelineForDS(sequences)
  if (dsResult.flat.length > 0) merge(dsResult)

  const mainResult = buildTimeline(sequences, circuitType, 1)
  if (mainResult.flat.length > 0) merge(mainResult)

  const cdResult = buildTimelineForCD(sequences)
  if (cdResult.flat.length > 0) merge(cdResult)

  return { flat: allFlat, byPosition: allByPosition }
}

/**
 * 슬라이딩 윈도우: 현재 sequenceIndex 기준 다음 N개 비디오 시퀀스 반환
 * (이미 재생 중인 시퀀스 제외, 다음 재생될 영상들)
 */
export function getPreloadWindow(
  flat: TimelineEntry[],
  currentSequenceIndex: number,
  windowSize: number = 12
): TimelineEntry[] {
  return flat
    .filter((e) => e.sequenceIndex > currentSequenceIndex)
    .slice(0, windowSize)
}
