import { api } from './api';
import type { AnnouncementAttachment } from '../types/notification';

export interface PopularWorkout {
  id: string;
  name: string;
  category_id: string;
  category: string;
  description: string;
  count: number;
  thumbnail_url?: string;
  video_url?: string;
}

export interface RecentWorkout {
  workout_date: string;
  workout_time: string;
  class_name?: string;
  total_duration: string;
  total_duration_seconds?: number;
  exercise_names: string;
  exercise_count: number;
}

export interface UserAnnouncement {
  id: string;
  title: string;
  content: string;
  type: string;
  priority: string;
  created_at: string;
  is_active: boolean;
  is_pinned: boolean;
  view_count: number;
  /** 공지 `attachments` JSON (API·mysql2에 따라 배열 또는 문자열) */
  attachments?: AnnouncementAttachment[] | string | null;
}

export interface UserStats {
  workout_days: number;
  total_minutes: number;
  avg_daily_minutes: number;
  exercise_types_used: number;
}

export const userDashboardService = {
  /**
   * 인기 운동 목록 조회
   */
  getPopularWorkouts: async (params?: {
    view?: 'all' | 'branch' | 'date';
    branch_id?: string;
    date?: string;
  }): Promise<PopularWorkout[]> => {
    const response = await api.get('/user-dashboard/popular-workouts', { params });
    return response.data.data;
  },

  /**
   * 최근 5일간 운동기록 조회
   */
  getRecentWorkouts: async (): Promise<RecentWorkout[]> => {
    const response = await api.get('/user-dashboard/recent-workouts');
    return response.data.data;
  },

  /**
   * 사용자용 공지사항 조회
   */
  getAnnouncements: async (): Promise<UserAnnouncement[]> => {
    const response = await api.get('/user-dashboard/announcements');
    return response.data.data;
  },

  /**
   * 사용자 운동 통계 조회
   */
  getStats: async (): Promise<UserStats> => {
    //console.log('=== userDashboardService.getStats 호출 ===');
    //console.log('API URL: /user-dashboard/stats');
    const response = await api.get('/user-dashboard/stats');
    //console.log('API 응답:', response.data);
    return response.data.data;
  }
};
