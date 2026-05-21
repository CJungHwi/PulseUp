import type { ExerciseSequence } from '../../../types'
import type { PlaybackNavigation } from '../shared/base-module'
import {
  findCdIndex,
  findDsIndex,
  findNextNavigationStop,
  findPrevNavigationStop,
} from '../shared/navigation-utils'

const isMainExercise = (s: ExerciseSequence): boolean => {
  const r = Number(s.round)
  return (
    s.exercise_type === 'exercise' &&
    s.exercise_name !== '임시운동' &&
    s.duration > 0 &&
    Number.isFinite(r) &&
    r >= 1 &&
    r < 99
  )
}

/**
 * Stress 네비게이션: SET(round) 단위 이동
 * Stress의 round 는 포지션마다 순환한다 (L1: 1→2→3, L2: 1→2→3, ...)
 * 라운드 사이의 water break 도 stop 으로 인식한다.
 */
export class StressNavigation implements PlaybackNavigation {
  findNext(
    sequences: ExerciseSequence[],
    currentIndex: number,
    currentRound: number,
  ): number | null {
    if (currentRound === 0) {
      for (let i = 0; i < sequences.length; i++) {
        if (isMainExercise(sequences[i])) return i
      }
      return null
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
      for (let i = sequences.length - 1; i >= 0; i--) {
        if (isMainExercise(sequences[i])) return i
      }
      return null
    }

    const stop = findPrevNavigationStop(sequences, currentIndex, currentRound)
    if (stop !== null) return stop

    const dsIdx = findDsIndex(sequences)
    return dsIdx !== -1 ? dsIdx : null
  }
}
