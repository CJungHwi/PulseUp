/**
 * 심박계 기기명 표시 포맷터 — 화면 표시 전용.
 *
 * 서버로 전송되는 deviceName(`HR-{deviceId}` 등)은 추적성 보존을 위해 변경하지 않고,
 * UI에서만 마지막 연속된 숫자 그룹의 끝 3자리만 노출한다.
 *
 * 예: 'HR-12345' → '345', 'HR-7' → '7', 'Garmin-HRM-987' → '987',
 *     '센서A' → '센서A' (숫자 없음 → 원본 유지)
 */

const TRAILING_DIGITS_RE = /(\d+)(?!.*\d)/

export const formatHeartRateDeviceShortName = (
  name: string | null | undefined,
  digits: number = 3,
): string => {
  const raw = (name ?? '').toString().trim()
  if (!raw) return ''

  const match = raw.match(TRAILING_DIGITS_RE)
  if (!match) return raw

  const lastDigits = match[1]
  return lastDigits.length <= digits ? lastDigits : lastDigits.slice(-digits)
}
