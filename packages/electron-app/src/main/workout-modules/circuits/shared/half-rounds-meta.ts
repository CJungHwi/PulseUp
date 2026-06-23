import type { WorkoutPlaySession } from '../../../types'
import {
  parseGridPosition,
  normalizeGridPosition,
} from '../../../../common/grid-position-codes.js'

const clampHalfRounds = (n: number): number => {
  if (!Number.isFinite(n) || n < 1) return 3
  return Math.min(Math.floor(n), 99)
}

/**
 * 전·후반 각각의 플랜 라운드 수(workout_history_plan 행 수).
 * 웹에서 metadata.totalSets·workoutPlans로 내려오며, Loop/EMOM의 슬롯 전환·SET 분자 경계에 사용한다.
 */
export const getHalfRoundsCountFromSession = (
  session: WorkoutPlaySession | null | undefined,
): number => {
  if (!session) return 3
  const meta = session.metadata as
    | { totalSets?: number; workoutPlans?: unknown[] }
    | undefined

  /** 플랜 행 수 = 반당 라운드 수(workout_exercises_logic.md). totalSets는 같은 슬롯(L1 등) 재생 횟수라 EMOM에선 totalRounds와 같아질 수 있어, 시퀀스·plans를 우선한다. */
  const plans = meta?.workoutPlans
  if (Array.isArray(plans) && plans.length > 0) {
    return clampHalfRounds(plans.length)
  }

  const sequences = session.sequences || []
  const mainEx = sequences.filter(
    (s) =>
      Number(s.round) > 0 &&
      Number(s.round) < 99 &&
      s.exercise_type === 'exercise',
  )
  if (mainEx.length > 0) {
    const maxR = Math.max(...mainEx.map((s) => Number(s.round)))
    const hasBackHalfSlots = mainEx.some((s) => {
      const parsed = parseGridPosition(normalizeGridPosition(s.position))
      return parsed ? parsed.set === 'set2' : false
    })
    if (hasBackHalfSlots && maxR >= 4) {
      const inferred = Math.floor(maxR / 2)
      if (inferred >= 1) return clampHalfRounds(inferred)
    }
    if (!hasBackHalfSlots && maxR >= 1) {
      return clampHalfRounds(maxR)
    }
  }

  const fromSets = Number(meta?.totalSets)
  if (Number.isFinite(fromSets) && fromSets > 0) {
    return clampHalfRounds(fromSets)
  }

  const tr = Number(session.totalRounds)
  if (Number.isFinite(tr) && tr > 0) {
    const guess = tr <= 3 ? tr : Math.max(1, Math.floor(tr / 2))
    return clampHalfRounds(guess)
  }

  return 3
}

/** 현재 메인 라운드가 속한 반에서의 플랜 행 번호(1…halfRounds). */
export const computePlanRowWithinHalf = (
  mainRound: number,
  halfRounds: number,
): number => {
  if (mainRound <= 0 || mainRound >= 99) return 1
  const hr = Math.max(1, Math.floor(halfRounds))
  return ((mainRound - 1) % hr) + 1
}
