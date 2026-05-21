import { callProcedure } from '../lib/database.js';

function parseBoolean(val: any): boolean | null {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    if (val.toLowerCase() === 'true' || val === '1') return true;
    if (val.toLowerCase() === 'false' || val === '0') return false;
  }
  return !!val;
}

// 임시로 타입 정의를 직접 작성 (스키마 import 오류 해결을 위해)
interface CreateWorkoutCategoryRequest {
  major_category: string;
  minor_category: string;
  menu_id?: string;
  description?: string;
  sort_order?: number;
}

interface UpdateWorkoutCategoryRequest {
  major_category?: string;
  minor_category?: string;
  menu_id?: string;
  description?: string;
  is_active?: boolean;
  sort_order?: number;
}

interface GetWorkoutCategoriesQuery {
  major_category?: string;
  is_active?: boolean;
}

interface CreateExerciseRequest {
  number: number;
  workout_category_id: string;
  level: string;
  name_en: string;
  name_ko: string;
  target_muscles: string;
  characteristics?: string;
  equipment?: string;
  purpose: string;
  video_url?: string;
  thumbnail_url?: string;
  video_title?: string;
  video_duration?: number;
  video_start_time?: number;
  video_end_time?: number;
  video_loop_count?: number;
  is_active?: boolean;
}

interface UpdateExerciseRequest {
  number?: number;
  workout_category_id?: string;
  level?: string;
  name_en?: string;
  name_ko?: string;
  target_muscles?: string;
  characteristics?: string;
  equipment?: string;
  purpose?: string;
  video_url?: string;
  thumbnail_url?: string;
  video_title?: string;
  video_duration?: number;
  video_start_time?: number;
  video_end_time?: number;
  video_loop_count?: number;
  is_active?: boolean;
}

interface GetExercisesQuery {
  workout_category_id?: string;
  major_category?: string;
  minor_category?: string;
  level?: string;
  is_active?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

interface WorkoutCategoryResponse {
  id: string;
  major_category: string;
  minor_category: string;
  menu_id?: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  menu_name?: string;
  menu_url?: string;
  exercise_count?: number;
  gubun?: string; // 추가됨
}

interface ExerciseResponse {
  id: string;
  number: number;
  workout_category_id: string;
  level: string;
  name_en: string;
  name_ko: string;
  target_muscles: string;
  characteristics?: string;
  equipment?: string;
  purpose: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  major_category: string;
  minor_category: string;
}

interface MinorCategoryResponse {
  id: string;
  minor_category: string;
  menu_id?: string;
  description?: string;
  sort_order: number;
}

export class WorkoutCategoryService {
  constructor() {
    // DatabaseService 대신 callProcedure 직접 사용
  }

  /**
   * 운동구분 생성
   */
  async createWorkoutCategory(data: CreateWorkoutCategoryRequest): Promise<{ category_id: string; status: string }> {
    try {
      const result = await callProcedure('sp_create_workout_category', [
        data.major_category,
        data.minor_category,
        data.menu_id || null,
        data.description || null,
        data.sort_order
      ]);

      return result[0] as { category_id: string; status: string };
    } catch (error) {
      console.error('운동구분 생성 중 오류:', error);
      throw new Error('운동구분 생성에 실패했습니다');
    }
  }

  /**
   * 운동구분 목록 조회
   */
  async getWorkoutCategories(query: GetWorkoutCategoriesQuery): Promise<WorkoutCategoryResponse[]> {
    try {
      const result = await callProcedure('sp_get_workout_categories', [
        query.major_category || null,
        parseBoolean(query.is_active)
      ]);

      return result as WorkoutCategoryResponse[];
    } catch (error) {
      console.error('운동구분 목록 조회 중 오류:', error);
      throw new Error('운동구분 목록 조회에 실패했습니다');
    }
  }

  /**
   * 운동구분 상세 조회
   */
  async getWorkoutCategoryById(categoryId: string): Promise<WorkoutCategoryResponse | null> {
    try {
      const result = await callProcedure('sp_get_workout_category_by_id', [categoryId]);
      return result.length > 0 ? result[0] as WorkoutCategoryResponse : null;
    } catch (error) {
      console.error('운동구분 상세 조회 중 오류:', error);
      throw new Error('운동구분 상세 조회에 실패했습니다');
    }
  }

  /**
   * 운동구분 수정
   */
  async updateWorkoutCategory(
    categoryId: string,
    data: UpdateWorkoutCategoryRequest
  ): Promise<{ status: string }> {
    try {
      const result = await callProcedure('sp_update_workout_category', [
        categoryId,
        data.major_category,
        data.minor_category,
        data.menu_id || null,
        data.description || null,
        data.is_active ?? true,
        data.sort_order
      ]);

      return result[0] as { status: string };
    } catch (error) {
      console.error('운동구분 수정 중 오류:', error);
      throw new Error('운동구분 수정에 실패했습니다');
    }
  }

  /**
   * 운동구분 삭제
   */
  async deleteWorkoutCategory(categoryId: string): Promise<{ status: string }> {
    try {
      const result = await callProcedure('sp_delete_workout_category', [categoryId]);
      return result[0] as { status: string };
    } catch (error) {
      console.error('운동구분 삭제 중 오류:', error);
      if (error instanceof Error && error.message.includes('해당 운동구분을 사용하는 운동이 있어')) {
        throw new Error('해당 운동구분을 사용하는 운동이 있어 삭제할 수 없습니다');
      }
      throw new Error('운동구분 삭제에 실패했습니다');
    }
  }

  /**
   * 대분류별 중분류 목록 조회
   */
  async getMinorCategoriesByMajor(majorCategory: string): Promise<MinorCategoryResponse[]> {
    try {
      const result = await callProcedure('sp_get_minor_categories_by_major', [majorCategory]);
      return result as MinorCategoryResponse[];
    } catch (error) {
      console.error('대분류별 중분류 목록 조회 중 오류:', error);
      throw new Error('대분류별 중분류 목록 조회에 실패했습니다');
    }
  }

  /**
   * 운동구분별 운동 개수 조회
   */
  async getWorkoutCategoryStats(): Promise<WorkoutCategoryResponse[]> {
    try {
      const result = await callProcedure('sp_get_workout_category_stats', []);
      return result as WorkoutCategoryResponse[];
    } catch (error) {
      console.error('운동구분별 운동 개수 조회 중 오류:', error);
      throw new Error('운동구분별 운동 개수 조회에 실패했습니다');
    }
  }

  /**
   * 운동정보 생성 (운동구분 포함)
   */
  async createExercise(data: CreateExerciseRequest): Promise<{ exercise_id: string; status: string }> {
    try {
      const result = await callProcedure('sp_create_exercise', [
        data.number,
        data.workout_category_id,
        data.level,
        data.name_en,
        data.name_ko,
        data.target_muscles,
        data.characteristics || null,
        data.equipment || null,
        data.purpose,
        data.video_url || null,
        data.thumbnail_url || null,
        data.video_title || null,
        data.video_duration || null,
        data.video_start_time || null,
        data.video_end_time || null,
        data.video_loop_count || null,
        data.is_active ?? true
      ]);

      return result[0] as { exercise_id: string; status: string };
    } catch (error) {
      console.error('운동정보 생성 중 오류:', error);
      throw new Error('운동정보 생성에 실패했습니다');
    }
  }

  /**
   * 운동정보 목록 조회 (운동구분 포함)
   */
  async getExercisesWithCategory(query: GetExercisesQuery): Promise<ExerciseResponse[]> {
    try {
      const result = await callProcedure('sp_get_exercises_with_category', [
        query.workout_category_id || null,
        query.major_category || null,
        query.minor_category || null,
        query.level || null,
        parseBoolean(query.is_active),
        query.search || null,
        query.limit,
        query.offset
      ]);

      return result as ExerciseResponse[];
    } catch (error) {
      console.error('운동정보 목록 조회 중 오류:', error);
      throw new Error('운동정보 목록 조회에 실패했습니다');
    }
  }

  /**
   * 운동정보 상세 조회
   */
  async getExerciseById(exerciseId: string): Promise<ExerciseResponse | null> {
    try {
      const result = await callProcedure('sp_get_exercise_by_id', [exerciseId]);
      return result.length > 0 ? result[0] as ExerciseResponse : null;
    } catch (error) {
      console.error('운동정보 상세 조회 중 오류:', error);
      throw new Error('운동정보 상세 조회에 실패했습니다');
    }
  }

  /**
   * 운동정보 수정
   */
  async updateExercise(
    exerciseId: string,
    data: UpdateExerciseRequest
  ): Promise<{ status: string }> {
    try {
      const result = await callProcedure('sp_update_exercise', [
        exerciseId,
        data.number || null,
        data.workout_category_id || null,
        data.level || null,
        data.name_en || null,
        data.name_ko || null,
        data.target_muscles || null,
        data.characteristics || null,
        data.equipment || null,
        data.purpose || null,
        data.video_url || null,
        data.thumbnail_url || null,
        data.video_title || null,
        data.video_duration || null,
        data.video_start_time || null,
        data.video_end_time || null,
        data.video_loop_count || null,
        data.is_active !== undefined ? data.is_active : null
      ]);

      return result[0] as { status: string };
    } catch (error) {
      console.error('운동정보 수정 중 오류:', error);
      throw new Error('운동정보 수정에 실패했습니다');
    }
  }

  /**
   * 운동정보 삭제 (비활성화)
   */
  async deleteExercise(exerciseId: string): Promise<{ status: string }> {
    try {
      const result = await callProcedure('sp_delete_exercise', [exerciseId]);
      return result[0] as { status: string };
    } catch (error) {
      console.error('운동정보 삭제 중 오류:', error);
      throw new Error('운동정보 삭제에 실패했습니다');
    }
  }

  /**
   * 기본 운동구분 데이터 초기화
   */
  async initializeDefaultWorkoutCategories(): Promise<void> {
    try {
      const defaultCategories = [
        // 유산소 운동
        { major_category: '유산소', minor_category: '전신', sort_order: 1 },
        { major_category: '유산소', minor_category: '상체', sort_order: 2 },
        { major_category: '유산소', minor_category: '하체', sort_order: 3 },

        // 근력 운동
        { major_category: '근력', minor_category: '가슴', sort_order: 1 },
        { major_category: '근력', minor_category: '등', sort_order: 2 },
        { major_category: '근력', minor_category: '어깨', sort_order: 3 },
        { major_category: '근력', minor_category: '팔', sort_order: 4 },
        { major_category: '근력', minor_category: '복부', sort_order: 5 },
        { major_category: '근력', minor_category: '하체', sort_order: 6 },

        // 스트레칭
        { major_category: '스트레칭', minor_category: '전신', sort_order: 1 },
        { major_category: '스트레칭', minor_category: '상체', sort_order: 2 },
        { major_category: '스트레칭', minor_category: '하체', sort_order: 3 },

        // 요가
        { major_category: '요가', minor_category: '초급', sort_order: 1 },
        { major_category: '요가', minor_category: '중급', sort_order: 2 },
        { major_category: '요가', minor_category: '고급', sort_order: 3 },

        // 필라테스
        { major_category: '필라테스', minor_category: '매트', sort_order: 1 },
        { major_category: '필라테스', minor_category: '소도구', sort_order: 2 },
        { major_category: '필라테스', minor_category: '기구', sort_order: 3 }
      ];

      for (const category of defaultCategories) {
        await this.createWorkoutCategory({
          major_category: category.major_category,
          minor_category: category.minor_category,
          sort_order: category.sort_order,
          description: `${category.major_category} - ${category.minor_category} 운동`
        });
      }

      //console.log('기본 운동구분 데이터 초기화 완료');
    } catch (error) {
      console.error('기본 운동구분 데이터 초기화 중 오류:', error);
      throw new Error('기본 운동구분 데이터 초기화에 실패했습니다');
    }
  }
}