import {
  DEFAULT_GRID_POSITION,
  STRESS_LAP_ORDER,
  normalizeGridPosition,
  parseGridPosition,
} from '../../../../common/grid-position-codes.js'

export const positionInMainLrGrid = (s: { position?: string }): boolean => {
  if (typeof s?.position !== 'string') return false
  const normalized = normalizeGridPosition(s.position)
  return parseGridPosition(normalized) !== null
}

const INTRO_MAIN_PREVIEW_ORDER = STRESS_LAP_ORDER

export const sortIntroMainPreviewSequences = <T extends { position?: string }>(
  sequences: T[],
): T[] => {
  const orderMap = new Map<string, number>(
    INTRO_MAIN_PREVIEW_ORDER.map((pos, index) => [pos, index]),
  )
  return [...sequences].sort((a, b) => {
    const aKey = normalizeGridPosition(a.position || '')
    const bKey = normalizeGridPosition(b.position || '')
    const aIdx = orderMap.get(String(aKey).toUpperCase()) ?? Number.MAX_SAFE_INTEGER
    const bIdx = orderMap.get(String(bKey).toUpperCase()) ?? Number.MAX_SAFE_INTEGER
    return aIdx - bIdx
  })
}

/** 첫 메인 라운드의 A1–D3 포지션만 (Stress / Loop / AMRAP 인트로 공통) */
export const collectIntroSequencesFirstMainRound = <T extends { round: number | string; position?: string }>(
  allExercises: T[],
  mainRound: number,
): T[] =>
  allExercises.filter((s) => Number(s.round) === mainRound && positionInMainLrGrid(s))

/**
 * 인트로·프리뷰에서 두 번째 랩으로 붙일 메인 라운드 번호.
 * 후반이 있으면 rFirst+halfRounds(전반 첫 라운드 기준 후반 시작) 우선 → C/D 영상.
 * 전반만 있으면 같은 반의 다음 플랜 라운드(예: round 2).
 */
export const resolveIntroCompanionMainRound = (
  mainRoundsSorted: number[],
  halfRoundsCount: number,
  rFirst: number,
): number | null => {
  if (mainRoundsSorted.length < 2) return null
  const hr = Math.max(1, Math.floor(halfRoundsCount))
  const maxR = mainRoundsSorted[mainRoundsSorted.length - 1]
  if (maxR >= rFirst + hr) {
    const fromSecondHalf = mainRoundsSorted.find((r) => r >= rFirst + hr)
    if (fromSecondHalf !== undefined) return fromSecondHalf
  }
  const sameHalfNext = mainRoundsSorted.find((r) => r !== rFirst)
  return sameHalfNext ?? null
}
