import type { ExerciseSequence } from '../../../types'
import type { PlaybackNavigation } from '../shared/base-module'
import {
  collectPlayableMainRounds,
  findFirstIndexOfRound,
  findCdIndex,
  findDsIndex,
  findNextSequentialStop,
  findPrevSequentialStop,
} from '../shared/navigation-utils'

/**
 * Loop 네비게이션: 운동 단위 순차 이동
 * 같은 라운드 안에서 다음 운동(LAP) 으로, 라운드 끝에서는 다음 라운드 첫 운동으로 진행한다.
 * 라운드 사이의 water break 도 stop 으로 인식한다.
 */
export class LoopNavigation implements PlaybackNavigation {
  findNext(
    sequences: ExerciseSequence[],
    currentIndex: number,
    currentRound: number,
  ): number | null {
    if (currentRound === 0) {
      const rounds = collectPlayableMainRounds(sequences)
      if (rounds.length === 0) return null
      const idx = findFirstIndexOfRound(sequences, rounds[0])
      return idx !== -1 ? idx : null
    }

    if (currentRound === 99) return null

    const stop = findNextSequentialStop(sequences, currentIndex)
    if (stop !== null) return stop

    const cdIdx = findCdIndex(sequences)
    return cdIdx !== -1 ? cdIdx : null
  }

  findPrevious(
    sequences: ExerciseSequence[],
    currentIndex: number,
    currentRound: number,
  ): number | null {
    if (currentRound === 0) return null

    if (currentRound === 99) {
      const rounds = collectPlayableMainRounds(sequences)
      if (rounds.length === 0) return null
      const lastRound = rounds[rounds.length - 1]
      const idx = findFirstIndexOfRound(sequences, lastRound)
      return idx !== -1 ? idx : null
    }

    const stop = findPrevSequentialStop(sequences, currentIndex)
    if (stop !== null) return stop

    const dsIdx = findDsIndex(sequences)
    return dsIdx !== -1 ? dsIdx : null
  }
}
