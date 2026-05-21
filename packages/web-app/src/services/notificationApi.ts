import type { AxiosHeaders } from 'axios'
import { api } from './api'
import {
  Notification,
  CreateNotificationRequest,
  UpdateNotificationRequest,
  AnnouncementAttachment,
} from '../types/notification'
import { ApiResponse } from '../types/api'

export const notificationApi = {
  // 공지사항 목록 조회 (권한별 엔드포인트)
  getNotifications: async (params?: {
    page?: number
    limit?: number
    type?: string
    status?: string
    search?: string
    isAdmin?: boolean
  }) => {
    const endpoint = params?.isAdmin ? '/admin/announcements' : '/user-dashboard/announcements'

    if (params?.isAdmin) {
      // 관리자용 API - 페이지네이션 구조
      const response = await api.get<ApiResponse<{
        items: Notification[]
        total: number
        page: number
        limit: number
      }>>(endpoint, { params })
      return response.data
    } else {
      // 사용자용 API - 단순 배열
      const response = await api.get<ApiResponse<Notification[]>>(endpoint, { params })
      return response.data
    }
  },

  // 공지사항 상세 조회
  getNotification: async (id: number) => {
    const response = await api.get<ApiResponse<Notification>>(`/admin/announcements/${id}`)
    return response.data
  },

  /** 첨부파일만 multipart로 업로드 (등록·저장 직전 호출) — axios로 baseURL·인터셉터·갱신 토큰과 동일 경로 유지 */
  uploadAnnouncementAttachments: async (files: File[]): Promise<AnnouncementAttachment[]> => {
    if (!files.length) return []
    const formData = new FormData()
    formData.append('originalNames', JSON.stringify(files.map((f) => f.name)))
    files.forEach((f) => formData.append('files', f))

    try {
      /**
       * axios 기본 헤더가 `Content-Type: application/json` 이라면,
       * 기본 transformRequest가 FormData를 JSON으로 바꿔 multer가 파일을 못 받습니다.
       * 이 요청만 Content-Type을 제거해 브라우저가 multipart boundary를 붙이게 합니다.
       */
      const response = await api.post<ApiResponse<{ files: AnnouncementAttachment[] }>>(
        '/admin/announcements/attachments',
        formData,
        {
          timeout: 120_000,
          transformRequest: [
            (data, headers) => {
              if (data instanceof FormData) {
                const h = headers as AxiosHeaders
                if (typeof h.delete === 'function') {
                  h.delete('Content-Type')
                }
              }
              return data
            },
          ],
        }
      )

      const json = response.data
      if (!json.success) {
        throw new Error(json.error || json.message || '첨부파일 업로드에 실패했습니다.')
      }
      const list = json.data?.files
      if (!Array.isArray(list)) return []
      return list.filter((a) => a && typeof a.url === 'string')
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string; message?: string } }; message?: string }
      const serverMsg = ax.response?.data?.error || ax.response?.data?.message
      throw new Error(serverMsg || ax.message || '첨부파일 업로드에 실패했습니다.')
    }
  },

  // 공지사항 생성
  createNotification: async (data: CreateNotificationRequest) => {
    const response = await api.post<ApiResponse<Notification>>('/admin/announcements', data)
    return response.data
  },

  // 공지사항 수정
  updateNotification: async (id: number, data: UpdateNotificationRequest) => {
    const response = await api.put<ApiResponse<Notification>>(`/admin/announcements/${id}`, data)
    return response.data
  },

  // 공지사항 삭제
  deleteNotification: async (id: number) => {
    const response = await api.delete<ApiResponse<void>>(`/admin/announcements/${id}`)
    return response.data
  },

  // 공지사항 상태 변경 (수정 API를 통해 처리)
  updateNotificationStatus: async (id: number, status: 'active' | 'inactive') => {
    const response = await api.put<ApiResponse<Notification>>(`/admin/announcements/${id}`, {
      is_active: status === 'active'
    })
    return response.data
  },

  // 공지사항 우선순위 변경 (수정 API를 통해 처리)
  updateNotificationPriority: async (id: number, priority: number) => {
    const response = await api.put<ApiResponse<Notification>>(`/admin/announcements/${id}`, {
      priority
    })
    return response.data
  },

  // 공지사항 읽음 처리 (조회수 증가)
  markAsRead: async (id: number) => {
    const response = await api.post<ApiResponse<void>>(`/announcements/${id}/read`)
    return response.data
  }
}
