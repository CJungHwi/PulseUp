import api from './api';
import { 
  Announcement, 
  CreateAnnouncementRequest, 
  UpdateAnnouncementRequest, 
  GetAnnouncementsQuery,
  UnreadAnnouncementCount 
} from '../types/announcement';

export const announcementApi = {
  // 사용자별 공지사항 목록 조회
  getAnnouncements: async (params?: GetAnnouncementsQuery): Promise<Announcement[]> => {
    const response = await api.get('/announcements', { params });
    return response.data.data;
  },

  // 공지사항 상세 조회
  getAnnouncementDetail: async (id: string): Promise<Announcement> => {
    const response = await api.get(`/announcements/${id}`);
    return response.data.data;
  },

  // 읽지 않은 공지사항 개수 조회
  getUnreadCount: async (): Promise<UnreadAnnouncementCount> => {
    const response = await api.get('/announcements/unread-count');
    return response.data.data;
  },

  // 공지사항 읽음 처리
  markAsRead: async (id: string): Promise<void> => {
    await api.post(`/announcements/${id}/read`);
  },

  // 관리자용 전체 공지사항 목록 조회
  getAllAnnouncementsAdmin: async (params?: GetAnnouncementsQuery): Promise<Announcement[]> => {
    const response = await api.get('/announcements/admin', { params });
    return response.data.data;
  },

  // 공지사항 생성 (관리자)
  createAnnouncement: async (data: CreateAnnouncementRequest): Promise<{ announcement_id: string; status: string }> => {
    const response = await api.post('/announcements', data);
    return response.data.data;
  },

  // 공지사항 수정 (관리자)
  updateAnnouncement: async (id: string, data: UpdateAnnouncementRequest): Promise<{ status: string }> => {
    const response = await api.put(`/announcements/${id}`, data);
    return response.data.data;
  },

  // 공지사항 삭제 (관리자)
  deleteAnnouncement: async (id: string): Promise<{ status: string }> => {
    const response = await api.delete(`/announcements/${id}`);
    return response.data.data;
  }
};