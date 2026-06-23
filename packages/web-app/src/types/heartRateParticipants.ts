/**
 * 소스 요약 — 심박 참가자 매핑 타입
 *
 * 기능: 그룹 수업에서 운동기록 마스터별 회원-심박계 배정 및 참가자별 심박 요약 응답 타입을 정의한다.
 *
 * 호출/연동: `heartRateParticipantsApi`, `HeartRateParticipantPanel`, `/api/heart-rate/workouts/:id/participants`.
 *
 * 관련 컴포넌트: `AttendanceDialog`, `HeartRateParticipantPanel`.
 *
 * 흐름: 예약자 목록 → 심박계 배정 입력 → API 응답 타입 정규화 → 수업 운영 화면 표시.
 */

export interface HeartRateParticipantInput {
  userId: string
  deviceId: string
  deviceName?: string | null
  slotNumber?: number | null
}

export interface HeartRateParticipant {
  id: string
  workout_history_master_id?: string
  user_id: string
  userid: string
  name: string
  email: string
  device_id: string
  device_name?: string | null
  slot_number?: number | null
  assigned_at?: string
  unassigned_at?: string | null
  is_active?: boolean | number
  heart_rate_readings?: number | string | null
  readings?: number | string | null
  avg_heart_rate?: number | string | null
  max_heart_rate?: number | string | null
  min_heart_rate?: number | string | null
  current_heart_rate?: number | string | null
  current_zone?: string | null
  last_heart_rate_at?: string | null
}
