import type { ExerciseSequence } from '../../../types'
import type { PlaybackNavigation } from '../shared/base-module'
import {
  collectPlayableMainRounds,
  findFirstIndexOfRound,
  findCdIndex,
  findDsIndex,
  findNextNavigationStop,
  findPrevNavigationStop,
} from '../shared/navigation-utils'

/**
 * AMRAP 네비게이션: 라운드 단위 이동
 * Round 1(전반 AMRAP 전체) -> Round 2(후반 AMRAP 전체) -> ... -> CD
 * 라운드 사이의 water break 도 stop 으로 인식한다.
 */
export class AmrapNavigation implements PlaybackNavigation {
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

    const stop = findNextNavigationStop(sequences, currentIndex, currentRound)
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

    const stop = findPrevNavigationStop(sequences, currentIndex, currentRound)
    if (stop !== null) return stop

    const dsIdx = findDsIndex(sequences)
    return dsIdx !== -1 ? dsIdx : null
  }
}
