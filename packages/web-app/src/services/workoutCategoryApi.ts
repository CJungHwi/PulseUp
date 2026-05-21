import api from './api';
import {
  WorkoutCategory,
  WorkoutMajorCategory,
  Exercise,
  MinorCategory,
  CreateWorkoutCategoryRequest,
  UpdateWorkoutCategoryRequest,
  CreateExerciseRequest,
  UpdateExerciseRequest,
  GetWorkoutCategoriesQuery,
  GetExercisesQuery,
} from '../types/workoutCategory';

function unwrapProcedureRows<T>(data: unknown): T {
  // 일부 API가 stored procedure CALL 결과를 그대로 내려줘서
  // data가 [rows, okPacket] 형태(배열 안 배열)로 오는 케이스가 있음
  if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) return data[0] as T
  return data as T
}

function unwrapProcedureFirstRow<T>(data: unknown): T | null {
  const rows = unwrapProcedureRows<unknown[]>(data)
  if (!Array.isArray(rows) || rows.length === 0) return null
  return rows[0] as T
}

export const workoutCategoryApi = {
  // 운동구분 목록 조회
  getWorkoutCategories: async (params?: GetWorkoutCategoriesQuery): Promise<WorkoutCategory[]> => {
    const response = await api.get('/workout-categories', { params });
    return unwrapProcedureRows<WorkoutCategory[]>(response.data.data);
  },

  // 운동구분 상세 조회
  getWorkoutCategoryById: async (id: string): Promise<WorkoutCategory> => {
    const response = await api.get(`/workout-categories/${id}`);
    const item = unwrapProcedureFirstRow<WorkoutCategory>(response.data.data)
    // 백엔드가 단일 객체로 내려주는 경우도 있어서 fallback
    return (item ?? response.data.data) as WorkoutCategory
  },

  // 운동구분별 통계 조회
  getWorkoutCategoryStats: async (): Promise<WorkoutCategory[]> => {
    const response = await api.get('/workout-categories/stats');
    return response.data.data;
  },

  // 대분류별 중분류 목록 조회
  getMinorCategoriesByMajor: async (majorCategory: string): Promise<MinorCategory[]> => {
    const response = await api.get(`/workout-categories/${encodeURIComponent(majorCategory)}/minor`);
    return unwrapProcedureRows<MinorCategory[]>(response.data.data);
  },

  // 운동구분 생성 (관리자)
  createWorkoutCategory: async (data: CreateWorkoutCategoryRequest): Promise<{ category_id: string; status: string }> => {
    const response = await api.post('/workout-categories', data);
    return response.data.data;
  },

  // 운동구분 수정 (관리자)
  updateWorkoutCategory: async (id: string, data: UpdateWorkoutCategoryRequest): Promise<{ status: string }> => {
    const response = await api.put(`/workout-categories/${id}`, data);
    return response.data.data;
  },

  // 운동구분 삭제 (관리자)
  deleteWorkoutCategory: async (id: string): Promise<{ status: string }> => {
    const response = await api.delete(`/workout-categories/${id}`);
    return response.data.data;
  },

  // 기본 운동구분 데이터 초기화 (관리자)
  initializeDefaultWorkoutCategories: async (): Promise<void> => {
    await api.post('/workout-categories/initialize');
  },

  // === 운동정보 관련 API ===

  // 운동정보 목록 조회 (운동구분 포함)
  getExercisesWithCategory: async (params?: GetExercisesQuery): Promise<Exercise[]> => {
    const response = await api.get('/workout-categories/exercises/list', { params });
    return response.data.data;
  },

  // 운동정보 생성 (관리자)
  createExercise: async (data: CreateExerciseRequest): Promise<{ exercise_id: string; status: string }> => {
    const response = await api.post('/workout-categories/exercises', data);
    return response.data.data;
  },

  // 운동정보 상세 조회
  getExerciseById: async (id: string): Promise<Exercise> => {
    const response = await api.get(`/workout-categories/exercises/${id}`);
    return response.data.data;
  },

  // 운동정보 수정 (관리자)
  updateExercise: async (id: string, data: UpdateExerciseRequest): Promise<{ status: string }> => {
    const response = await api.put(`/workout-categories/exercises/${id}`, data);
    return response.data.data;
  },

  // 운동정보 삭제 (관리자)
  deleteExercise: async (id: string): Promise<{ status: string }> => {
    const response = await api.delete(`/workout-categories/exercises/${id}`);
    return response.data.data;
  },

  // 운동 구분 대분류 목록 조회 (관리자용)
  getWorkoutMajorCategories: async (): Promise<WorkoutMajorCategory[]> => {
    const response = await api.get('/admin/content/workout-major-categories');
    return response.data.data;
  },

  // 운동 구분 대분류 목록 조회 (일반 사용자용)
  getWorkoutMajorCategoriesForUser: async (): Promise<WorkoutMajorCategory[]> => {
    const response = await api.get('/workout-categories/stats');
    return response.data.data;
  },

  // 운동 목록 조회 및 검색 (통합)
  getExercisesList: async (params: {
    major_category?: string;
    search_type?: string;
    search_keyword?: string;
    page?: number;
    limit?: number;
    include_inactive?: boolean;
  }): Promise<{
    exercises: Exercise[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> => {
    const response = await api.get('/workout-categories/exercises/list', { params });
    return response.data.data;
  }
};