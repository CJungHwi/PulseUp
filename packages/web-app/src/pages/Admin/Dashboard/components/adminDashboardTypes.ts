/**
 * 관리자 대시보드 — 공통 타입 정의
 *
 * - `SimpleWorkout`: 인기 운동 리스트 항목
 * - `SimpleAnnouncement`: 대시보드 공지 카드 항목
 * - `SimpleUser`: 승인 대기 사용자 항목
 * - `SimpleStats`: 사용자 통계 카드 데이터
 */

import type { AnnouncementAttachment } from '@/types/notification'

export interface SimpleWorkout {
  id: string
  name: string
  name_en?: string
  count: number
  category: string
  description: string
  target_muscles?: string
  equipment?: string
  purpose?: string
  video_url?: string
}

export interface SimpleAnnouncement {
  id: string
  title: string
  content: string
  type: string
  priority?: string
  view_count: number
  created_at: string
  is_active?: boolean
  is_pinned?: boolean
  attachments?: AnnouncementAttachment[]
}

export interface SimpleUser {
  id: string
  userid: string
  name: string
  email: string
  role: string
  branch_name: string
  is_approved: boolean
  created_at: string
}

export interface SimpleStats {
  total_users: number
  approved_users: number
  pending_users: number
  inactive_users: number
}

export type PopularView = '전체' | '지점별' | '날짜별' | '자극부위'
