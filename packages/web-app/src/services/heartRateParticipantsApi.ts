/**
 * 소스 요약 — 심박 참가자 매핑 API 서비스
 *
 * 기능: 운동기록 마스터별 회원-심박계 배정, 해제, 참가자별 심박 요약 조회 API 호출을 캡슐화한다.
 *
 * 호출/연동: `/api/heart-rate/workouts/:workoutHistoryMasterId/participants`,
 *           `/api/heart-rate/workouts/:workoutHistoryMasterId/participants/summary`.
 *
 * 관련 컴포넌트: `HeartRateParticipantPanel`, `AttendanceDialog`.
 *
 * 흐름: 화면 입력 → API 요청 파라미터 직렬화 → 응답 `participants` 반환.
 */

import { apiClient } from './api.service'
import type {
  HeartRateParticipant,
  HeartRateParticipantInput,
} from '@/types/heartRateParticipants'

export const heartRateParticipantsApi = {
  async getParticipants(workoutHistoryMasterId: string) {
    const response = await apiClient.get(
      `/heart-rate/workouts/${workoutHistoryMasterId}/participants`
    )
    return response.data.data.participants as HeartRateParticipant[]
  },

  async upsertParticipants(workoutHistoryMasterId: string, participants: HeartRateParticipantInput[]) {
    const response = await apiClient.post(
      `/heart-rate/workouts/${workoutHistoryMasterId}/participants`,
      { participants }
    )
    return response.data.data.participants as HeartRateParticipant[]
  },

  async deactivateParticipant(workoutHistoryMasterId: string, participantId: string) {
    await apiClient.delete(
      `/heart-rate/workouts/${workoutHistoryMasterId}/participants/${participantId}`
    )
  },

  async getParticipantSummary(workoutHistoryMasterId: string) {
    const response = await apiClient.get(
      `/heart-rate/workouts/${workoutHistoryMasterId}/participants/summary`
    )
    return response.data.data.participants as HeartRateParticipant[]
  },
}
