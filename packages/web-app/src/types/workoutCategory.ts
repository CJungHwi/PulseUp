// 운동구분 관련 타입 정의

export type ExerciseLevel = 'beginner' | 'intermediate' | 'advanced';

// 운동 구분 대분류 요약(관리자/사용자 통계용)
export interface WorkoutMajorCategory {
  major_category: string;
  major_category_name: string;
  exercise_count: number;
}

export interface WorkoutCategory {
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
  major_category_name?: string;
  exercise_count?: number;
}

export interface Exercise {
  id: string;
  number: number;
  workout_category_id: string;
  level: ExerciseLevel;
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
  is_active: boolean;
  created_at: string;
  updated_at: string;
  major_category: string;
  minor_category: string;
  major_category_name?: string;

  // Vimeo 추가 정보 (vimeo_videos 테이블에서 제공)
  video_id?: string;
  vimeo_status?: string;
  parent_folder?: string;
  vimeo_is_active?: boolean;
  vimeo_created_at?: string;
  vimeo_updated_at?: string;
}

export interface MinorCategory {
  id: string;
  minor_category: string;
  menu_id?: string;
  description?: string;
  sort_order: number;
}

export interface CreateWorkoutCategoryRequest {
  major_category: string;
  minor_category: string;
  menu_id?: string;
  description?: string;
  sort_order?: number;
}

export interface UpdateWorkoutCategoryRequest {
  major_category?: string;
  minor_category?: string;
  menu_id?: string;
  description?: string;
  is_active?: boolean;
  sort_order?: number;
}

export interface CreateExerciseRequest {
  number: number;
  workout_category_id: string;
  level: ExerciseLevel;
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
  major_category?: string;
  is_active?: boolean;
}

export interface UpdateExerciseRequest {
  number?: number;
  workout_category_id?: string;
  level?: ExerciseLevel;
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

export interface GetWorkoutCategoriesQuery {
  major_category?: string;
  is_active?: boolean;
}

export interface GetExercisesQuery {
  workout_category_id?: string;
  major_category?: string;
  minor_category?: string;
  level?: ExerciseLevel;
  is_active?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

// 운동 레벨별 라벨
export const EXERCISE_LEVEL_LABELS: Record<ExerciseLevel, string> = {
  beginner: '초급',
  intermediate: '중급',
  advanced: '고급'
};

// 기본 대분류 목록
export const DEFAULT_MAJOR_CATEGORIES = [
  '유산소',
  '근력',
  '스트레칭',
  '요가',
  '필라테스',
  '기능성',
  '재활',
  '댄스'
];

// 대분류별 기본 중분류 목록
export const DEFAULT_MINOR_CATEGORIES: Record<string, string[]> = {
  '유산소': ['전신', '상체', '하체', '저강도', '고강도'],
  '근력': ['가슴', '등', '어깨', '팔', '복부', '하체', '전신'],
  '스트레칭': ['전신', '상체', '하체', '목/어깨', '허리'],
  '요가': ['초급', '중급', '고급', '하타', '빈야사', '아쉬탕가'],
  '필라테스': ['매트', '소도구', '기구', '초급', '중급', '고급'],
  '기능성': ['밸런스', '코어', '민첩성', '협응성', '안정성'],
  '재활': ['목/어깨', '허리', '무릎', '발목', '전신'],
  '댄스': ['K-POP', '라틴', '재즈', '힙합', '발레']
};

// 운동 목적 옵션
export const EXERCISE_PURPOSE_OPTIONS = [
  '근력 향상',
  '근지구력 향상',
  '심폐지구력 향상',
  '유연성 향상',
  '균형감각 향상',
  '체중 감량',
  '근육량 증가',
  '재활',
  '스트레스 해소',
  '자세 교정'
];

// 운동 기구 옵션
export const EXERCISE_EQUIPMENT_OPTIONS = [
  '맨몸',
  '덤벨',
  '바벨',
  '케틀벨',
  '저항밴드',
  '매트',
  '볼',
  '폼롤러',
  'TRX',
  '런닝머신',
  '사이클',
  '로잉머신',
  '기타'
];