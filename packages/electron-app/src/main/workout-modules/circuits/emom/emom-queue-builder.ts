import type { QueueBuildResult, ScreenModeKind } from '../shared/queue-builder-types'
import {
  filterPlayableExercises,
  classifyByPhase,
  splitIntoTwoGroups,
  classifyMainByPosition,
  fillStandardSlotQueues,
  fillFiveScreenSlotQueues,
} from '../shared/queue-builder-base'

/**
 * EMOM 서킷 큐 빌더
 *
 * 3-screen 슬롯별 순서 (좌측 기준):
 *   slot1: DS1 → DS4 → L1 → L4 → CD1 → CD4
 *   slot2: DS2 → DS5 → L2 → L5 → CD2 → CD5
 *   slot3: DS3 → DS6 → L3 → L6 → CD3 → CD6
 */
export function buildEmomQueue(
  sequences: any[],
  _metadata: any,
  screenMode: ScreenModeKind = 'three',
): QueueBuildResult {
  const exercises = filterPlayableExercises(sequences)
  const { dsExercises, mainExercises, cdExercises } = classifyByPhase(exercises)
  const [dsGroup1, dsGroup2] = splitIntoTwoGroups(dsExercises)
  const [cdGroup1, cdGroup2] = splitIntoTwoGroups(cdExercises)
  const mainSets = classifyMainByPosition(mainExercises)

  if (screenMode === 'five') {
    return {
      leftQueues: fillFiveScreenSlotQueues('L1', dsGroup1, dsGroup2, mainSets, [], cdGroup1, cdGroup2),
      rightQueues: fillFiveScreenSlotQueues('R1', dsGroup1, dsGroup2, mainSets, [], cdGroup1, cdGroup2),
      leftQueues2: fillFiveScreenSlotQueues('L2', dsGroup1, dsGroup2, mainSets, [], cdGroup1, cdGroup2),
      rightQueues2: fillFiveScreenSlotQueues('R2', dsGroup1, dsGroup2, mainSets, [], cdGroup1, cdGroup2),
    }
  }

  return {
    leftQueues: fillStandardSlotQueues('left', dsGroup1, dsGroup2, mainSets, [], cdGroup1, cdGroup2),
    rightQueues: fillStandardSlotQueues('right', dsGroup1, dsGroup2, mainSets, [], cdGroup1, cdGroup2),
  }
}
