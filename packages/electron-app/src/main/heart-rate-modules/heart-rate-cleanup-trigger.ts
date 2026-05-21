/**
 * 운동 단계 전환 시점에 끊긴 심박 슬롯을 일괄 정리하기 위한 트리거 판정기.
 *
 * 다음 시점 1회씩 'heart-rate-cleanup-disconnected' 발행을 권장한다.
 *  - DS → Main (stretching → main)
 *  - Main 내부 water break (sequence.exercise_type === 'water')
 *  - Main → CD (main → cool_down)
 *
 * `reason`은 디버깅·로그 용도이며 renderer에는 그대로 전달된다.
 */

export type RoundCategoryKind = 'stretching' | 'main' | 'cool_down'

export type HeartRateCleanupReason =
  | 'ds-to-main'
  | 'water-break'
  | 'main-to-cd'

export type HeartRateCleanupTriggerDeps = {
  isStretchingCategory: (category: string) => boolean
  isCoolDownCategory: (category: string) => boolean
  getRoundMajorCategory: (round: number) => string
}

const classifyRound = (
  round: number | null | undefined,
  deps: HeartRateCleanupTriggerDeps,
): RoundCategoryKind | null => {
  if (round === null || round === undefined || !Number.isFinite(round)) return null
  const cat = (deps.getRoundMajorCategory(round) || '').toString().trim().toLowerCase()
  if (deps.isStretchingCategory(cat)) return 'stretching'
  if (deps.isCoolDownCategory(cat)) return 'cool_down'
  return 'main'
}

export class HeartRateCleanupTrigger {
  private lastCategory: RoundCategoryKind | null = null
  private waterBreakFired = false

  constructor(private readonly deps: HeartRateCleanupTriggerDeps) {}

  /** 새 운동 세션을 시작할 때 호출하여 직전 상태를 비운다. */
  reset(): void {
    this.lastCategory = null
    this.waterBreakFired = false
  }

  /**
   * 'workout-play-sequence' broadcast 직전에 호출. 트리거 사유가 발생하면 reason을 반환,
   * 아니면 null을 반환한다.
   */
  evaluate(sequence: { exercise_type?: string } | null | undefined, round: number | null | undefined): HeartRateCleanupReason | null {
    const currentCategory = classifyRound(round, this.deps)
    let reason: HeartRateCleanupReason | null = null

    // 1) 라운드 카테고리 전환 (직전 카테고리가 있어야 의미 있음)
    if (currentCategory && this.lastCategory && currentCategory !== this.lastCategory) {
      if (this.lastCategory === 'stretching' && currentCategory === 'main') {
        reason = 'ds-to-main'
      } else if (this.lastCategory === 'main' && currentCategory === 'cool_down') {
        reason = 'main-to-cd'
      }
    }

    // 2) Main 내부 water break — 세션당 1회
    if (!reason && currentCategory === 'main' && sequence?.exercise_type === 'water' && !this.waterBreakFired) {
      reason = 'water-break'
      this.waterBreakFired = true
    }

    if (currentCategory) this.lastCategory = currentCategory
    return reason
  }
}
