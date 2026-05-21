import type { DisplayType } from './renderer-display-types.js'

/**
 * 메인 라운드(1–98)에서 `workout-seek-queue` 가 오는 position(보통 다음 구간 첫 운동: L1 등)을
 * 현재 그리드 창의 슬롯 큐 label 과 맞춘다.
 *
 * 5화면 L2/R2 패널은 메인이 L4–L6 / R4–R6 이므로, 열 번호 1–3 은 각각 +3 이 필요하다.
 * seek 는 다음 구간 **첫** 운동만 보내서 `L1` 만 오는 경우가 많은데, 우측 패널도 같은 열이면 R4 로 맞춰야 한다(L/R 접두어와 무관).
 */
export function resolveMainPhaseSeekLabel(display: DisplayType, position: string): string | null {
  const m = String(position ?? '')
    .trim()
    .match(/^([LR])(\d+)$/i)
  if (!m) return null
  const num = Number(m[2])
  if (!Number.isFinite(num) || num < 1) return null

  if (display === 'workout-left-2' && num <= 3) {
    return `L${num + 3}`
  }
  if (display === 'workout-right-2' && num <= 3) {
    return `R${num + 3}`
  }

  const screenIsLeft = display === 'workout-left' || display === 'workout-left-2'
  const prefix = screenIsLeft ? 'L' : 'R'
  return `${prefix}${num}`
}
