// 공지사항 관련 타입 정의

export type AnnouncementType = 'general' | 'maintenance' | 'update' | 'event' | 'urgent';
export type AnnouncementPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TargetAudience = 'all' | 'branch' | 'specific_users';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: AnnouncementType;
  priority: AnnouncementPriority;
  target_audience: TargetAudience;
  branch_id?: string;
  author_id: string;
  is_active: boolean;
  is_pinned: boolean;
  start_date?: string;
  end_date?: string;
  view_count: number;
  created_at: string;
  updated_at: string;
  author_name?: string;
  branch_name?: string;
  is_read?: boolean;
}

export interface CreateAnnouncementRequest {
  title: string;
  content: string;
  type?: AnnouncementType;
  priority?: AnnouncementPriority;
  target_audience?: TargetAudience;
  branch_id?: string;
  is_pinned?: boolean;
  start_date?: string;
  end_date?: string;
  target_user_ids?: string[];
}

export interface UpdateAnnouncementRequest {
  title?: string;
  content?: string;
  type?: AnnouncementType;
  priority?: AnnouncementPriority;
  target_audience?: TargetAudience;
  branch_id?: string;
  is_pinned?: boolean;
  start_date?: string;
  end_date?: string;
  target_user_ids?: string[];
}

export interface GetAnnouncementsQuery {
  type?: AnnouncementType;
  is_active?: boolean;
  limit?: number;
  offset?: number;
}

export interface UnreadAnnouncementCount {
  unread_count: number;
}

// 공지사항 유형별 라벨
export const ANNOUNCEMENT_TYPE_LABELS: Record<AnnouncementType, string> = {
  general: '일반',
  maintenance: '점검',
  update: '업데이트',
  event: '이벤트',
  urgent: '긴급'
};

// 우선순위별 라벨
export const ANNOUNCEMENT_PRIORITY_LABELS: Record<AnnouncementPriority, string> = {
  low: '낮음',
  normal: '보통',
  high: '높음',
  urgent: '긴급'
};

// 대상 범위별 라벨
export const TARGET_AUDIENCE_LABELS: Record<TargetAudience, string> = {
  all: '전체',
  branch: '지점별',
  specific_users: '특정 사용자'
};