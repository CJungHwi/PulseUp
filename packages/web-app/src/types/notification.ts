export interface AnnouncementAttachment {
  url: string
  originalName: string
}

export interface Notification {
  id: number
  title: string
  content: string
  type: 'general' | 'important' | 'urgent' | 'maintenance' | 'update' | 'event'
  status: 'active' | 'inactive'
  priority: string
  target_audience: string
  branch_id?: number
  branch_name?: string
  author_id: number
  author_name: string
  is_active: boolean
  is_pinned: boolean
  start_date?: string
  end_date?: string
  view_count: number
  created_at: string
  updated_at: string
  /** 서버 `attachments` JSON — mysql2는 배열로, 문자열이면 parseNotificationAttachments 사용 */
  attachments?: AnnouncementAttachment[] | string | null
}

export interface CreateNotificationRequest {
  title: string
  content: string
  type: 'general' | 'important' | 'urgent' | 'maintenance' | 'update' | 'event'
  status?: 'active' | 'inactive'
  priority?: string
  targetAudience?: string
  branchId?: number
  isPinned?: boolean
  startDate?: string
  endDate?: string
  attachments?: AnnouncementAttachment[]
}

export interface UpdateNotificationRequest extends CreateNotificationRequest {
  id: number
}

export const NOTIFICATION_TYPE_LABELS = {
  general: '일반',
  important: '중요',
  urgent: '긴급',
  maintenance: '점검',
  update: '업데이트',
  event: '이벤트'
} as const

// 데이터베이스 ENUM과 프론트엔드 타입 매핑
export const DB_TYPE_MAPPING = {
  general: 'general',
  important: 'urgent',  // important -> urgent로 매핑
  urgent: 'urgent'
} as const

export const NOTIFICATION_STATUS_LABELS = {
  active: '활성',
  inactive: '비활성'
} as const

export type NotificationType = keyof typeof NOTIFICATION_TYPE_LABELS
export type NotificationStatus = keyof typeof NOTIFICATION_STATUS_LABELS

/** 공지 `attachments` 컬럼(JSON)을 UI용 배열로 정규화 */
export const parseNotificationAttachments = (raw: unknown): AnnouncementAttachment[] => {
  if (raw == null) return []
  let value: unknown = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map((item) => ({
      url: typeof item.url === 'string' ? item.url : '',
      originalName:
        typeof item.originalName === 'string'
          ? item.originalName
          : typeof item.originalname === 'string'
            ? item.originalname
            : 'file',
    }))
    .filter((a) => a.url.length > 0)
}
