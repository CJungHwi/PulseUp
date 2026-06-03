import type { ExerciseSequence, ActiveSet } from '../../../types'
import { computePlanRowWithinHalf } from '../shared/half-rounds-meta'
import {
  DEFAULT_GRID_POSITION,
  STRESS_LAP_ORDER,
  normalizeGridPosition,
  parseGridPosition,
} from '../../../../common/grid-position-codes.js'

/**
 * 로컬·CI 테스트용 (DB·세션 duration은 그대로, 재생만 단축).
 *
 * 1) `HIIT_EMOM_TEST_INTERVAL_SEC` — 양의 정수면 메인 구간 각 스텝(운동·휴식·물보충)을
 *    저장값과 무관하게 이 초 수로 고정.
 * 2) 그렇지 않고 `HIIT_EMOM_TEST_DURATION_SCALE` — 양의 실수면 `storedSeconds * scale`
 *    (예: 60초×(1/60)=1초). 최소 0.25초로 클램프.
 * 3) 둘 다 없거나 유효하지 않으면 저장값(초) 그대로.
 *
 * Electron 메인 프로세스 시작 전 환경변수로 설정 (PowerShell: `$env:HIIT_EMOM_TEST_INTERVAL_SEC=5`).
 */
export const resolveEmomStepDurationSec = (storedSeconds: number): number => {
  const base = Math.max(0, storedSeconds)

  const intervalRaw = process.env.HIIT_EMOM_TEST_INTERVAL_SEC
  if (intervalRaw !== undefined && intervalRaw !== '') {
    const n = parseInt(String(intervalRaw), 10)
    if (Number.isFinite(n) && n > 0) return n
  }

  const scaleRaw = process.env.HIIT_EMOM_TEST_DURATION_SCALE
  if (scaleRaw !== undefined && scaleRaw !== '') {
    const scale = parseFloat(String(scaleRaw))
    if (Number.isFinite(scale) && scale > 0) {
      const out = base * scale
      if (out <= 0) return base
      return Math.max(0.25, out)
    }
  }

  return base
}

/**
 * EMOM 메인 순서 — Loop/Stress와 동일
 * 전반전: A1→A2→A3→B3→B2→B1, 후반전: A4→A5→A6→B6→B5→B4
 */
export const EMOM_LAP_ORDER = STRESS_LAP_ORDER

/**
 * 전·후반 그룹 — Loop와 동일: 플랜 라운드 1…N → 전반, N+1…2N → 후반.
 */
export const getEmomHalfGroupIndex = (
  round: number,
  halfRounds: number,
): 0 | 1 => {
  const hr = Math.max(1, Math.floor(halfRounds))
  return round <= hr ? 0 : 1
}

export const getActiveSetForEmomRound = (
  round: number,
  halfRounds: number,
): ActiveSet => {
  const gi = getEmomHalfGroupIndex(round, halfRounds)
  const set = gi === 0 ? 'set1' : 'set2'
  return { left: set, right: set }
}

/** 라운드에 속한 운동 시퀀스를 LAP_ORDER 기준으로 정렬 (DB 순서와 무관, 고유 포지션만) */
export const sortEmomDisplaySequences = (
  round: number,
  roundExercises: ExerciseSequence[],
  halfRounds: number,
): ExerciseSequence[] => {
  const positionMap = new Map<string, ExerciseSequence>()
  for (const seq of roundExercises) {
    const pos = normalizeGridPosition(seq.position || DEFAULT_GRID_POSITION)
    if (!positionMap.has(pos)) positionMap.set(pos, seq)
  }
  const half = getEmomHalfGroupIndex(round, halfRounds)
  const order = EMOM_LAP_ORDER.slice(half * 6, half * 6 + 6)
  return order
    .map((pos) => positionMap.get(pos))
    .filter((s): s is ExerciseSequence => !!s)
}

/** Stress/Loop와 동일한 lap 표시 (후반전은 1~6 랩으로 정규화) */
export const computeEmomLapIndex = (position: string | undefined): number => {
  const normalized = normalizeGridPosition(position || '')
  const idx = EMOM_LAP_ORDER.indexOf(normalized)
  const lapIndexRaw = idx >= 0 ? idx + 1 : 1
  const parsed = parseGridPosition(normalized)
  const isSecondHalf = parsed?.prefix === 'B'
  return isSecondHalf ? ((lapIndexRaw - 1) % 6) + 1 : lapIndexRaw <= 6 ? lapIndexRaw : 1
}

/**
 * EMOM Round 번호(표시용): 6개 운동 단위로 라운드를 구분
 * 예: L1→…→R1 첫 블록 = Round 1, 다음 블록 = Round 2 …
 */
export const computeEmomRoundNumber = (
  exerciseOnlyInRound: ExerciseSequence[],
  currentSeq: ExerciseSequence,
): number => {
  const idx = exerciseOnlyInRound.indexOf(currentSeq)
  return idx >= 0 ? Math.floor(idx / 6) + 1 : 1
}

/** 타이머 RND 분자: 한 반 내 플랜 행 번호 (1…halfRounds). */
export const computeEmomPlanRowInHalf = (
  mainRound: number,
  halfRounds: number,
): number => computePlanRowWithinHalf(mainRound, halfRounds)

export const computeEmomTotalRounds = (
  exerciseOnlyInRound: ExerciseSequence[],
): number => Math.ceil(exerciseOnlyInRound.length / 6) || 1
