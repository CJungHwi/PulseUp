import type { ExerciseSequence } from '../../../types'

const isPlayableMainExercise = (s: ExerciseSequence): boolean => {
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

export const collectPlayableMainRounds = (sequences: ExerciseSequence[]): number[] =>
  Array.from(new Set(sequences.filter(isPlayableMainExercise).map((s) => Number(s.round))))
    .sort((a, b) => a - b)

export const findFirstIndexOfRound = (sequences: ExerciseSequence[], round: number): number =>
  sequences.findIndex((s) => Number(s.round) === round)

export const findDsIndex = (sequences: ExerciseSequence[]): number =>
  sequences.findIndex((s) => Number(s.round) === 0)

export const findCdIndex = (sequences: ExerciseSequence[]): number =>
  sequences.findIndex((s) => Number(s.round) === 99)

export const resolveCurrentPosition = (
  sequences: ExerciseSequence[],
  currentIndex: number,
): string | null => {
  const seq = sequences[currentIndex]
  if (seq?.exercise_type === 'exercise' && seq.position) return seq.position
  for (let i = currentIndex - 1; i >= 0; i--) {
    const prev = sequences[i]
    if (prev.exercise_type === 'exercise' && prev.position) return prev.position
  }
  return null
}

/**
 * 다음 네비게이션 stop 인덱스.
 *
 * 규칙:
 * - 현재가 water 이면: 앞으로 가면서 첫 main exercise 반환 (한 단계 진행)
 * - 그 외: 앞으로 가면서 water 또는 round 가 다른 main exercise 를 만나면 반환
 *
 * round/CD/DS 경계를 벗어나는 fallback 은 호출부에서 처리한다.
 */
export const findNextNavigationStop = (
  sequences: ExerciseSequence[],
  currentIndex: number,
  currentRound: number,
): number | null => {
  const cur = sequences[currentIndex]
  if (cur?.exercise_type === 'water') {
    for (let i = currentIndex + 1; i < sequences.length; i++) {
      if (isPlayableMainExercise(sequences[i])) return i
    }
    return null
  }

  for (let i = currentIndex + 1; i < sequences.length; i++) {
    const s = sequences[i]
    if (s.exercise_type === 'water') return i
    if (isPlayableMainExercise(s) && Number(s.round) !== currentRound) return i
  }
  return null
}

/** 이전 네비게이션 stop 인덱스. findNextNavigationStop 와 거울 동작. */
export const findPrevNavigationStop = (
  sequences: ExerciseSequence[],
  currentIndex: number,
  currentRound: number,
): number | null => {
  const cur = sequences[currentIndex]
  if (cur?.exercise_type === 'water') {
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (isPlayableMainExercise(sequences[i])) return i
    }
    return null
  }

  for (let i = currentIndex - 1; i >= 0; i--) {
    const s = sequences[i]
    if (s.exercise_type === 'water') return i
    if (isPlayableMainExercise(s) && Number(s.round) !== currentRound) return i
  }
  return null
}

/**
 * 순차(sequential) 네비게이션 stop. Loop/EMOM 처럼 같은 round 안에서 운동 단위로 진행하는 서킷용.
 * rest 만 스킵하고, water 또는 main exercise 를 만나면 즉시 stop 한다.
 */
export const findNextSequentialStop = (
  sequences: ExerciseSequence[],
  currentIndex: number,
): number | null => {
  for (let i = currentIndex + 1; i < sequences.length; i++) {
    const s = sequences[i]
    if (s.exercise_type === 'water') return i
    if (isPlayableMainExercise(s)) return i
  }
  return null
}

export const findPrevSequentialStop = (
  sequences: ExerciseSequence[],
  currentIndex: number,
): number | null => {
  for (let i = currentIndex - 1; i >= 0; i--) {
    const s = sequences[i]
    if (s.exercise_type === 'water') return i
    if (isPlayableMainExercise(s)) return i
  }
  return null
}
