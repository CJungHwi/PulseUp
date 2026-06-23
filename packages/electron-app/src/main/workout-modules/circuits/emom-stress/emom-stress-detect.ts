/**
 * 소스 요약 — EMOM-Stress 판별
 *
 * 기능: 세션 metadata / 시퀀스 구조를 보고 EMOM 운동이 stress 방식인지 판별한다.
 * 호출 프로시저: 없음(Electron 모듈 선택용 헬퍼).
 * 관련 components/modules: `circuit-registry.ts`(모듈/네비 선택), `emom-stress-module.ts`.
 * 흐름: metadata에 stress 신호가 있으면 stress, 없으면 저장 시퀀스가 같은 position을 연속으로
 *       가지는지(A1,A1,A1,A2...)로 stress 여부를 추론한다(EMOM-Loop는 라운드별 A1,A2,A3...).
 */
import { normalizeGridPosition } from '../../../../common/grid-position-codes.js'

type EmomStressDetectSequence = {
  round: number | string
  exercise_type?: string
  exercise_name?: string
  duration?: number
  position?: string
}

const isEmomStressMetadata = (metadata?: Record<string, unknown> | null): boolean => {
  const candidates = [
    metadata?.emomCircuitType,
    metadata?.method_type,
    metadata?.methodType,
    metadata?.circuit_type,
  ].map((value) => String(value || '').trim().toLowerCase())

  return candidates.some((value) => value === 'stress' || value.includes('stress'))
}

export const isEmomStressPlayback = (
  metadata: Record<string, unknown> | null | undefined,
  sequences: EmomStressDetectSequence[],
): boolean => {
  if (isEmomStressMetadata(metadata)) return true

  const mainExercises = sequences.filter((seq) => {
    const round = Number(seq.round)
    return (
      Number.isFinite(round) &&
      round > 0 &&
      round < 99 &&
      seq.exercise_type === 'exercise' &&
      seq.exercise_name !== '임시운동' &&
      (seq.duration ?? 0) > 0
    )
  })

  if (mainExercises.length < 2) return false

  const firstPosition = normalizeGridPosition(mainExercises[0].position || '')
  const secondPosition = normalizeGridPosition(mainExercises[1].position || '')
  if (!firstPosition || !secondPosition) return false

  // EMOM-Stress 저장 순서: A1 SET1 → A1 SET2 → A1 SET3 → A2...
  // EMOM-Loop 저장 순서: Round1 안에서 A1 → A2 → A3...
  return firstPosition === secondPosition
}
