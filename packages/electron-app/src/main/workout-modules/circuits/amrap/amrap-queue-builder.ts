import type { QueueBuildResult, ScreenModeKind } from '../shared/queue-builder-types'
import {
  filterPlayableExercises,
  classifyByPhase,
  splitIntoTwoGroups,
  classifyMainByPosition,
  normalizeLrGridPosition,
  fillStandardSlotQueues,
  fillFiveScreenSlotQueues,
} from '../shared/queue-builder-base'

/**
 * AMRAP 서킷 큐 빌더
 *
 * 기본 구조는 Stress/EMOM/Loop과 동일하되,
 * 후반(set2)이 없고 메인 라운드가 2+인 경우 각 라운드를
 * 별도 블록으로 추가하여 같은 슬롯이 라운드별로 advance된다.
 */
export function buildAmrapQueue(
  sequences: any[],
  _metadata: any,
  screenMode: ScreenModeKind = 'three',
): QueueBuildResult {
  const exercises = filterPlayableExercises(sequences)
  const { dsExercises, mainExercises, cdExercises } = classifyByPhase(exercises)
  const [dsGroup1, dsGroup2] = splitIntoTwoGroups(dsExercises)
  const [cdGroup1, cdGroup2] = splitIntoTwoGroups(cdExercises)
  const mainSets = classifyMainByPosition(mainExercises)

  const extraBlocks = buildAmrapExtraBlocks(mainExercises, mainSets)

  if (screenMode === 'five') {
    return {
      leftQueues: fillFiveScreenSlotQueues('L1', dsGroup1, dsGroup2, mainSets, extraBlocks, cdGroup1, cdGroup2),
      rightQueues: fillFiveScreenSlotQueues('R1', dsGroup1, dsGroup2, mainSets, extraBlocks, cdGroup1, cdGroup2),
      leftQueues2: fillFiveScreenSlotQueues('L2', dsGroup1, dsGroup2, mainSets, extraBlocks, cdGroup1, cdGroup2),
      rightQueues2: fillFiveScreenSlotQueues('R2', dsGroup1, dsGroup2, mainSets, extraBlocks, cdGroup1, cdGroup2),
    }
  }

  return {
    leftQueues: fillStandardSlotQueues('L', dsGroup1, dsGroup2, mainSets, extraBlocks, cdGroup1, cdGroup2),
    rightQueues: fillStandardSlotQueues('R', dsGroup1, dsGroup2, mainSets, extraBlocks, cdGroup1, cdGroup2),
  }
}

function buildAmrapExtraBlocks(
  mainExercises: any[],
  mainSets: { set1: { [pos: string]: any }; set2: { [pos: string]: any } },
): Array<{ [pos: string]: any }> {
  const blocks: Array<{ [pos: string]: any }> = []

  const mainRoundsSorted = Array.from(new Set(mainExercises.map((s: any) => Number(s.round))))
    .filter((r) => r > 0 && r < 99)
    .sort((a, b) => a - b)

  const hasBackHalf = Object.keys(mainSets.set2).length > 0
  if (!hasBackHalf && mainRoundsSorted.length > 1) {
    for (let ri = 1; ri < mainRoundsSorted.length; ri++) {
      const block: { [pos: string]: any } = {}
      for (const seq of mainExercises) {
        if (Number(seq.round) !== mainRoundsSorted[ri]) continue
        const pos = normalizeLrGridPosition(seq.position || '')
        if (pos && /^[LR]\d+$/.test(pos) && !block[pos]) block[pos] = seq
      }
      if (Object.keys(block).length > 0) blocks.push(block)
    }
  }

  return blocks
}
