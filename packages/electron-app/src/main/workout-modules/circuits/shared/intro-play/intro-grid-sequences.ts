/**
 * 인트로 영상 그리드: 좌측 모니터 A1–A6, 우측 모니터 B1–B6 (각 2열: num 1–3 / 4–6)
 */
import type { IntroCircuitKind, IntroSequenceCollectContext } from '../intro-circuit'
import { sortEmomDisplaySequences } from '../../emom/emom-constants'
import { sortLoopDisplaySequences } from '../../loop/loop-constants'
import {
  collectIntroSequencesFirstMainRound,
  positionInMainLrGrid,
  resolveIntroCompanionMainRound,
  sortIntroMainPreviewSequences,
} from '../intro-shared'

type HalfRoundSortFn = (
  round: number,
  roundExercises: any[],
  halfRounds: number,
) => any[]

export const collectHalfLapIntroGridSequences = <T extends { round: number | string; position?: string }>(
  allExercises: T[],
  rounds: number[],
  mainRound: number,
  isStretchingOrCoolDownRound: (r: number) => boolean,
  halfRoundsCount: number,
  sortRound: HalfRoundSortFn,
): T[] => {
  const mainRoundsSorted = rounds
    .filter((r) => !isStretchingOrCoolDownRound(r))
    .sort((a, b) => a - b)
  const rFirst = mainRoundsSorted[0] ?? mainRound
  const rSecond = resolveIntroCompanionMainRound(mainRoundsSorted, halfRoundsCount, rFirst)
  const pick = (r: number) =>
    sortRound(
      r,
      allExercises.filter((s) => Number(s.round) === r && positionInMainLrGrid(s)),
      halfRoundsCount,
    ) as unknown as T[]
  return [...pick(rFirst), ...(rSecond != null ? pick(rSecond) : [])]
}

export const composeHalfLapMainPreviewOrdered = (
  exercises: any[],
  isStretchingOrCoolDownRound: (r: number) => boolean,
  halfRoundsCount: number,
  sortRound: HalfRoundSortFn,
): any[] => {
  const mainRoundNums = Array.from(new Set(exercises.map((s) => Number(s.round ?? 0))))
    .filter((r) => !isStretchingOrCoolDownRound(r))
    .sort((a, b) => a - b)
  const r0 = mainRoundNums[0]
  const r1 = resolveIntroCompanionMainRound(mainRoundNums, halfRoundsCount, r0)
  const half0 = sortRound(
    r0,
    exercises.filter((s) => Number(s.round ?? 0) === r0 && positionInMainLrGrid(s)),
    halfRoundsCount,
  )
  const half1 =
    r1 != null
      ? sortRound(
          r1,
          exercises.filter((s) => Number(s.round ?? 0) === r1 && positionInMainLrGrid(s)),
          halfRoundsCount,
        )
      : []
  return [...half0, ...half1]
}

/** 첫 메인 라운드 L1–R6를 랩 순으로 정렬해 인트로 IPC에 넘길 목록 (Stress / AMRAP) */
export const collectFirstMainSortedIntroGridSequences = <
  T extends { round: number | string; position?: string },
>(
  allExercises: T[],
  mainRound: number,
): T[] => {
  const raw = collectIntroSequencesFirstMainRound(allExercises, mainRound)
  return sortIntroMainPreviewSequences(raw) as T[]
}

export const collectIntroPlayGridSequences = (
  circuit: IntroCircuitKind,
  ctx: IntroSequenceCollectContext,
): any[] => {
  const half = ctx.halfRoundsCount ?? 3
  if (circuit === 'loop') {
    return collectHalfLapIntroGridSequences(
      ctx.allExercises,
      ctx.rounds,
      ctx.mainRound,
      ctx.isStretchingOrCoolDownRound,
      half,
      sortLoopDisplaySequences,
    )
  }
  if (circuit === 'emom') {
    return collectHalfLapIntroGridSequences(
      ctx.allExercises,
      ctx.rounds,
      ctx.mainRound,
      ctx.isStretchingOrCoolDownRound,
      half,
      sortEmomDisplaySequences,
    )
  }
  return collectFirstMainSortedIntroGridSequences(ctx.allExercises, ctx.mainRound)
}
