/**
 * 소스 요약 — 회원 운동기록 API 서비스
 *
 * 기능: 회원 본인의 예약/출석, 운동일, 심박 그래프, 인바디 현황 API 호출을 캡슐화한다.
 *
 * 호출/연동: `/api/member-workout-records/overview`,
 *           `/api/member-workout-records/workouts/:workoutHistoryMasterId/heart-rate`.
 *
 * 관련 컴포넌트: `MemberWorkoutRecords`, 운동기록 종합 화면 컴포넌트.
 *
 * 흐름: 화면 요청 → API 파라미터 직렬화 → 응답 `data` 반환.
 */

import { apiClient } from './api.service'
import type {
  MemberWorkoutRecordsOverview,
  WorkoutHeartRateDetail,
} from '@/types/memberWorkoutRecords'

export const memberWorkoutRecordsApi = {
  async getOverview(month: string) {
    const response = await apiClient.get('/member-workout-records/overview', {
      params: { month },
    })
    return response.data.data as MemberWorkoutRecordsOverview
  },

  async getWorkoutHeartRate(workoutHistoryMasterId: string) {
    const response = await apiClient.get(
      `/member-workout-records/workouts/${workoutHistoryMasterId}/heart-rate`
    )
    return response.data.data as WorkoutHeartRateDetail
  },
}
