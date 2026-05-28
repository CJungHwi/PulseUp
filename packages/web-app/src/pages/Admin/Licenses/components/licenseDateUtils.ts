/**
 * 소스 요약 — 라이선스 기간 옵션과 날짜 계산 유틸
 *
 * 기능: 발급/갱신에서 사용하는 기간 옵션과 시작일+년수 → 종료일 계산 함수를 제공한다.
 *
 * 호출/연동: `LicenseGrantForm`, `LicenseRenewDialog`, `LicenseManagement`.
 *
 * 흐름: 시작일 + 1/2/3/5년 → `validTo = startDate + N년 - 1일` 형태로 종료일을 산정한다.
 */

import dayjs from 'dayjs'

export const LICENSE_TERM_OPTIONS = [1, 2, 3, 5] as const

export type LicenseTermYears = typeof LICENSE_TERM_OPTIONS[number]

const DATE_FORMAT = 'YYYY-MM-DD'

export const toDateInputValue = (date: dayjs.Dayjs | Date | string) => (
  dayjs(date).format(DATE_FORMAT)
)

export const getTodayDateValue = () => dayjs().format(DATE_FORMAT)

export const calculateValidTo = (startDate: string, years: LicenseTermYears) => {
  if (!startDate) return ''
  const start = dayjs(startDate)
  if (!start.isValid()) return ''
  return start.add(years, 'year').subtract(1, 'day').format(DATE_FORMAT)
}

export const getRenewalStartDate = (validTo?: string | null) => {
  const today = dayjs().startOf('day')
  if (!validTo) return today.format(DATE_FORMAT)

  const next = dayjs(validTo).add(1, 'day').startOf('day')
  if (!next.isValid()) return today.format(DATE_FORMAT)

  return next.isBefore(today) ? today.format(DATE_FORMAT) : next.format(DATE_FORMAT)
}

export const formatDateDisplay = (value?: string | null) => {
  if (!value) return '무기한'
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format(DATE_FORMAT) : value
}
