/**
 * 소스 요약 — 회원 운동기록 타입
 *
 * 기능: 회원 운동기록 종합 화면과 API 서비스가 공유하는 응답 타입을 정의한다.
 *
 * 호출/연동: `/api/member-workout-records/overview`,
 *           `/api/member-workout-records/workouts/:id/heart-rate`.
 *
 * 관련 컴포넌트: `MemberWorkoutRecords`, `SummaryCards`, `BookingAttendanceList`, `HeartRateChartCard`,
 *              `WorkoutDayList`, `InbodyOverviewCard`.
 *
 * 흐름: API 응답 → 서비스 타입 정규화 → 화면 컴포넌트 props로 전달.
 */

export type MemberBookingStatus = 'reserved' | 'cancelled' | 'attended' | 'noshow'

export interface MemberWorkoutSummary {
  workout_days: number
  total_workout_minutes: number
  booked_classes: number
  attended_classes: number
  noshow_classes: number
  cancelled_classes: number
  reserved_classes: number
  attendance_rate: number
  avg_heart_rate: number
  max_heart_rate: number
}

export interface MemberClassBookingRecord {
  id: string
  slot_id: string
  status: MemberBookingStatus
  reserved_at: string
  cancelled_at?: string | null
  title: string
  start_at: string
  end_at: string
  major_category: string
  major_category_name: string
}

export interface MemberWorkoutDay {
  id: string
  workout_date: string
  workout_time: string
  method_type: string
  method_name: string
  memo: string
  workout_categories_id: string
  category_name: string
  total_seconds: number
  total_minutes: number
  exercise_count: number
  exercise_names: string
  avg_heart_rate: number
  max_heart_rate: number
  min_heart_rate: number
  heart_rate_readings: number
}

export interface InbodyLatestRecord {
  id: string
  measured_at: string
  height_cm: number | null
  weight_kg: number | null
  skeletal_muscle_mass: number | null
  body_fat_percentage: number | null
  bmi: number | null
  memo: string
}

export interface InbodyOverview {
  status: 'ready' | 'empty' | 'pending_schema'
  latest: InbodyLatestRecord | null
}

export interface MemberWorkoutRecordsOverview {
  month: string
  summary: MemberWorkoutSummary
  bookings: MemberClassBookingRecord[]
  workoutDays: MemberWorkoutDay[]
  inbody: InbodyOverview
}

export interface HeartRatePoint {
  id: string
  device_id: string
  device_name: string
  timestamp: string
  elapsed_seconds: number
  elapsed_label: string
  heart_rate: number
  zone: string
}

export interface WorkoutHeartRateDetail {
  workout: {
    id: string
    workout_date: string
    method_name: string
  }
  stats: {
    readings: number
    avg_heart_rate: number
    max_heart_rate: number
    min_heart_rate: number
    zone_counts: Record<string, number>
  }
  series: HeartRatePoint[]
}
