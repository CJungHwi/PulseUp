import { api } from './api';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: string;
  priority: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  is_pinned: boolean;
  author_id?: string;
  author_name?: string;
}

export interface CreateAnnouncementData {
  title: string;
  content: string;
  type: 'general' | 'maintenance' | 'update' | 'event';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  is_active: boolean;
  is_pinned: boolean;
}

export interface UpdateAnnouncementData extends CreateAnnouncementData {}

export const announcementService = {
  /**
   * 공지사항 목록 조회
   */
  getAnnouncements: async (): Promise<Announcement[]> => {
    const response = await api.get('/announcements');
    return response.data.data;
  },

  /**
   * 공지사항 상세 조회
   */
  getAnnouncement: async (id: string): Promise<Announcement> => {
    const response = await api.get(`/announcements/${id}`);
    return response.data.data;
  },

  /**
   * 공지사항 생성 (관리자 전용)
   */
  createAnnouncement: async (data: CreateAnnouncementData): Promise<Announcement> => {
    const response = await api.post('/announcements', data);
    return response.data.data;
  },

  /**
   * 공지사항 수정 (관리자 전용)
   */
  updateAnnouncement: async (id: string, data: UpdateAnnouncementData): Promise<Announcement> => {
    const response = await api.put(`/announcements/${id}`, data);
    return response.data.data;
  },

  /**
   * 공지사항 삭제 (관리자 전용)
   */
  deleteAnnouncement: async (id: string): Promise<void> => {
    await api.delete(`/announcements/${id}`);
  },

  /**
   * 사용자용 공지사항 목록 (활성화된 것만)
   */
  getUserAnnouncements: async (): Promise<Announcement[]> => {
    const response = await api.get('/announcements/user');
    return response.data.data;
  }
};
