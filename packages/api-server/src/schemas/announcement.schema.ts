import { z } from 'zod';

// 공지사항 유형 및 우선순위 enum
export const AnnouncementType = z.enum(['general', 'maintenance', 'update', 'event', 'urgent']);
export const AnnouncementPriority = z.enum(['low', 'normal', 'high', 'urgent']);
export const TargetAudience = z.enum(['all', 'branch', 'specific_users']);

// 공지사항 생성 스키마
export const createAnnouncementSchema = z.object({
  title: z.string().min(1, '제목은 필수입니다').max(255, '제목은 255자를 초과할 수 없습니다'),
  content: z.string().min(1, '내용은 필수입니다'),
  type: AnnouncementType.default('general'),
  priority: AnnouncementPriority.default('normal'),
  target_audience: TargetAudience.default('all'),
  branch_id: z.string().uuid().optional(),
  is_pinned: z.boolean().default(false),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  target_user_ids: z.array(z.string().uuid()).optional()
});

// 공지사항 수정 스키마
export const updateAnnouncementSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).optional(),
  type: AnnouncementType.optional(),
  priority: AnnouncementPriority.optional(),
  target_audience: TargetAudience.optional(),
  branch_id: z.string().uuid().optional(),
  is_pinned: z.boolean().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  target_user_ids: z.array(z.string().uuid()).optional()
});

// 공지사항 조회 쿼리 스키마
export const getAnnouncementsQuerySchema = z.object({
  type: AnnouncementType.optional(),
  is_active: z.boolean().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0)
});

// 공지사항 응답 타입
export type CreateAnnouncementRequest = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementRequest = z.infer<typeof updateAnnouncementSchema>;
export type GetAnnouncementsQuery = z.infer<typeof getAnnouncementsQuerySchema>;

export interface AnnouncementResponse {
  id: string;
  title: string;
  content: string;
  type: string;
  priority: string;
  target_audience: string;
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