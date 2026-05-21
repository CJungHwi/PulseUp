import { api } from './api';

export interface DashboardStats {
  userStats: {
    total_users: number;
    approved_users: number;
    pending_users: number;
    approved_admins: number;
    approved_regular_users: number;
  };
  workoutStats: Array<{
    id: string;
    major_category: string;
    minor_category: string;
    exercise_count: number;
  }>;
  announcementCount: {
    total_announcements: number;
  };
  activityStats?: any;
}

export interface PopularWorkout {
  id: string;
  name: string;
  name_en?: string;
  count: number;
  category: string;
  description: string;
  target_muscles?: string;
  equipment?: string;
  purpose?: string;
  video_url?: string;
}

export interface RecentAnnouncement {
  id: string;
  title: string;
  type: string;
  priority: string;
  created_at: string;
  is_active: boolean;
  is_pinned: boolean;
}

export interface PendingUser {
  id: string;
  userid: string;
  name: string;
  email: string;
  role: string;
  branch_id: string;
  is_approved: boolean;
  created_at: string;
  branch_name?: string;
  branch_region?: string;
}

export interface AdminSummary {
  adminInfo: {
    id: string;
    userid: string;
    name: string;
    email: string;
    role: string;
    branch_name?: string;
    branch_region?: string;
  };
  recentApprovals: {
    recent_approvals: number;
  };
}

class DashboardService {
  /**
   * 대시보드 통계 데이터 조회
   */
  async getDashboardStats(startDate?: string, endDate?: string): Promise<DashboardStats> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const response = await api.get(`/dashboard/stats?${params.toString()}`);
    return response.data.data;
  }

  /**
   * 인기 운동 리스트 조회
   */
  async getPopularWorkouts(filters?: {
    branch_id?: string;
    start_date?: string;
    end_date?: string;
    target_muscle?: string;
    limit?: number;
  }): Promise<PopularWorkout[]> {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.branch_id) params.append('branch_id', filters.branch_id);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.target_muscle) params.append('target_muscle', filters.target_muscle);
      if (filters.limit) params.append('limit', filters.limit.toString());
    }

    const response = await api.get(`/dashboard/popular-workouts?${params.toString()}`);
    return response.data.data;
  }

  /**
   * 최근 공지사항 조회
   */
  async getRecentAnnouncements(): Promise<RecentAnnouncement[]> {
    const response = await api.get('/dashboard/recent-announcements');
    return response.data.data;
  }

  /**
   * 승인 대기 사용자 목록 조회 (대시보드용)
   */
  async getPendingUsers(): Promise<PendingUser[]> {
    const response = await api.get('/dashboard/pending-users');
    return response.data.data;
  }

  /**
   * 관리자 요약 정보 조회
   */
  async getAdminSummary(): Promise<AdminSummary> {
    const response = await api.get('/dashboard/admin-summary');
    return response.data.data;
  }

  /**
   * 사용자 승인 처리
   */
  async approveUser(userId: string): Promise<void> {
    const response = await api.post(`/dashboard/approve-user/${userId}`);
    return response.data.data;
  }
}

export const dashboardService = new DashboardService();

