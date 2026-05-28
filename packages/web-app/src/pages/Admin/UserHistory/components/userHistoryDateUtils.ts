/**
 * UserHistory 날짜 포맷 유틸
 * - 상대 시간(예: "3분 전")
 * - 절대 시간(`DATE_FORMATS.FULL`)
 *
 * 사용처: `UserHistory.tsx`, `UserHistoryTable.tsx`, `SessionDetailDialog.tsx`
 */
import { format, formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { DATE_FORMATS } from '@/lib/constants'

export const formatSafeDate = (
  dateValue: string | Date | null | undefined,
  fallback: string = '-'
): string => {
  try {
    if (!dateValue) return fallback
    const date = new Date(dateValue)
    if (isNaN(date.getTime())) return fallback
    return formatDistanceToNow(date, { addSuffix: true, locale: ko })
  } catch {
    return fallback
  }
}

export const formatAbsoluteDate = (
  dateValue: string | Date | null | undefined,
  fallback: string = '-'
): string => {
  try {
    if (!dateValue) return fallback
    const date = new Date(dateValue)
    if (isNaN(date.getTime())) return fallback
    return format(date, DATE_FORMATS.FULL, { locale: ko })
  } catch {
    return fallback
  }
}
