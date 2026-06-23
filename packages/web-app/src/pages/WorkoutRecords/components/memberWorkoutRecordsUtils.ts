/**
 * 소스 요약 — 회원 운동기록 화면 유틸
 *
 * 기능: 날짜/시간/예약 상태/심박 zone 표시 문구와 CSS 클래스를 변환한다.
 *
 * 호출/연동: API 없음.
 *
 * 관련 컴포넌트: `MemberWorkoutRecords`, `MemberWorkoutHeartRateDetail`, `BookingAttendanceList`,
 *              `WorkoutDayList`, `HeartRateChartCard`, `HeartRateReadingsTable`, `InbodyOverviewCard`.
 *
 * 흐름: API 원본 값 → 사용자 표시용 라벨/스타일 변환.
 */

import type { MemberBookingStatus } from '@/types/memberWorkoutRecords'

export const getCurrentMonthValue = () => new Date().toISOString().slice(0, 7)

export const formatDate = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).format(date)
}

export const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export const formatMinute = (minutes: number) => {
  if (!minutes || minutes < 0) return '0분'
  const hours = Math.floor(minutes / 60)
  const remain = minutes % 60
  if (hours <= 0) return `${remain}분`
  if (remain <= 0) return `${hours}시간`
  return `${hours}시간 ${remain}분`
}

export const getBookingStatusLabel = (status: MemberBookingStatus) => {
  const labels: Record<MemberBookingStatus, string> = {
    reserved: '예약',
    cancelled: '취소',
    attended: '출석',
    noshow: '결석',
  }
  return labels[status] || status
}

export const getBookingStatusClassName = (status: MemberBookingStatus) => {
  const classNames: Record<MemberBookingStatus, string> = {
    reserved: 'border-blue-500/60 text-blue-600 dark:text-blue-300 bg-blue-500/10',
    cancelled: 'border-muted-foreground/50 text-muted-foreground bg-muted/30',
    attended: 'border-emerald-500/60 text-emerald-600 dark:text-emerald-300 bg-emerald-500/10',
    noshow: 'border-amber-500/60 text-amber-600 dark:text-amber-300 bg-amber-500/10',
  }
  return classNames[status] || classNames.reserved
}

export const getHeartRateZoneLabel = (zone: string) => {
  const labels: Record<string, string> = {
    rest: '휴식',
    'fat-burn': '지방연소',
    cardio: '유산소',
    peak: '최대강도',
  }
  return labels[zone] || zone
}

export const getApiErrorMessage = (error: unknown, fallback: string) => {
  const responseError = error as { response?: { data?: { error?: string; message?: string } } }
  return responseError.response?.data?.error || responseError.response?.data?.message || fallback
}
