import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { workoutCategoryApi } from '../../services/workoutCategoryApi';
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
  GetExercisesQuery
} from '../../types/workoutCategory';

interface WorkoutCategoryState {
  categories: WorkoutCategory[];
  exercises: Exercise[];
  minorCategories: MinorCategory[];
  majorCategories: WorkoutMajorCategory[];
  currentCategory: WorkoutCategory | null;
  currentExercise: Exercise | null;
  loading: boolean;
  error: string | null;
  exercisesLoading: boolean;
  majorCategoriesLoading: boolean;
  searchResults: {
    exercises: Exercise[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  searchLoading: boolean;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

const initialState: WorkoutCategoryState = {
  categories: [],
  exercises: [],
  minorCategories: [],
  majorCategories: [],
  currentCategory: null,
  currentExercise: null,
  loading: false,
  error: null,
  exercisesLoading: false,
  majorCategoriesLoading: false,
  searchResults: {
    exercises: [],
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0
    }
  },
  searchLoading: false,
  pagination: {
    limit: 20,
    offset: 0,
    hasMore: true
  }
};

// 운동구분 목록 조회
export const fetchWorkoutCategories = createAsyncThunk(
  'workoutCategories/fetchWorkoutCategories',
  async (params?: GetWorkoutCategoriesQuery) => {
    return await workoutCategoryApi.getWorkoutCategories(params);
  }
);

// 운동구분 상세 조회
export const fetchWorkoutCategoryById = createAsyncThunk(
  'workoutCategories/fetchWorkoutCategoryById',
  async (id: string) => {
    return await workoutCategoryApi.getWorkoutCategoryById(id);
  }
);

// 운동구분별 통계 조회
export const fetchWorkoutCategoryStats = createAsyncThunk(
  'workoutCategories/fetchWorkoutCategoryStats',
  async () => {
    return await workoutCategoryApi.getWorkoutCategoryStats();
  }
);

// 대분류별 중분류 목록 조회
export const fetchMinorCategoriesByMajor = createAsyncThunk(
  'workoutCategories/fetchMinorCategoriesByMajor',
  async (majorCategory: string) => {
    return await workoutCategoryApi.getMinorCategoriesByMajor(majorCategory);
  }
);

// 운동구분 생성
export const createWorkoutCategory = createAsyncThunk(
  'workoutCategories/createWorkoutCategory',
  async (data: CreateWorkoutCategoryRequest) => {
    const result = await workoutCategoryApi.createWorkoutCategory(data);
    return { ...data, id: result.category_id };
  }
);

// 운동구분 수정
export const updateWorkoutCategory = createAsyncThunk(
  'workoutCategories/updateWorkoutCategory',
  async ({ id, data }: { id: string; data: UpdateWorkoutCategoryRequest }) => {
    await workoutCategoryApi.updateWorkoutCategory(id, data);
    return { id, data };
  }
);

// 운동구분 삭제
export const deleteWorkoutCategory = createAsyncThunk(
  'workoutCategories/deleteWorkoutCategory',
  async (id: string) => {
    await workoutCategoryApi.deleteWorkoutCategory(id);
    return id;
  }
);

// 기본 운동구분 데이터 초기화
export const initializeDefaultWorkoutCategories = createAsyncThunk(
  'workoutCategories/initializeDefaultWorkoutCategories',
  async () => {
    await workoutCategoryApi.initializeDefaultWorkoutCategories();
  }
);

// 운동정보 목록 조회
export const fetchExercisesWithCategory = createAsyncThunk(
  'workoutCategories/fetchExercisesWithCategory',
  async (params?: GetExercisesQuery) => {
    return await workoutCategoryApi.getExercisesWithCategory(params);
  }
);

// 운동정보 생성
export const createExercise = createAsyncThunk(
  'workoutCategories/createExercise',
  async (data: CreateExerciseRequest) => {
    const result = await workoutCategoryApi.createExercise(data);
    return { ...data, id: result.exercise_id };
  }
);

// 운동정보 상세 조회
export const fetchExerciseById = createAsyncThunk(
  'workoutCategories/fetchExerciseById',
  async (id: string) => {
    return await workoutCategoryApi.getExerciseById(id);
  }
);

// 운동정보 수정
export const updateExercise = createAsyncThunk(
  'workoutCategories/updateExercise',
  async ({ id, data }: { id: string; data: UpdateExerciseRequest }) => {
    await workoutCategoryApi.updateExercise(id, data);
    return { id, data };
  }
);

// 운동정보 삭제
export const deleteExercise = createAsyncThunk(
  'workoutCategories/deleteExercise',
  async (id: string) => {
    await workoutCategoryApi.deleteExercise(id);
    return id;
  }
);

// 운동 구분 대분류 목록 조회 (관리자용)
export const fetchWorkoutMajorCategories = createAsyncThunk(
  'workoutCategories/fetchWorkoutMajorCategories',
  async () => {
    return await workoutCategoryApi.getWorkoutMajorCategories();
  }
);

// 운동 구분 대분류 목록 조회 (일반 사용자용)
export const fetchWorkoutMajorCategoriesForUser = createAsyncThunk(
  'workoutCategories/fetchWorkoutMajorCategoriesForUser',
  async () => {
    return await workoutCategoryApi.getWorkoutMajorCategoriesForUser();
  }
);

// 운동 목록 조회 및 검색 (통합)
export const getExercisesList = createAsyncThunk(
  'workoutCategories/getExercisesList',
  async (params: {
    major_category?: string;
    search_type?: string;
    search_keyword?: string;
    page?: number;
    limit?: number;
    include_inactive?: boolean;
  }) => {
    return await workoutCategoryApi.getExercisesList(params);
  }
);

const workoutCategorySlice = createSlice({
  name: 'workoutCategories',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCurrentCategory: (state) => {
      state.currentCategory = null;
    },
    clearCurrentExercise: (state) => {
      state.currentExercise = null;
    },
    setCurrentCategory: (state, action: PayloadAction<WorkoutCategory>) => {
      state.currentCategory = action.payload;
    },
    setCurrentExercise: (state, action: PayloadAction<Exercise>) => {
      state.currentExercise = action.payload;
    },
    setPagination: (state, action: PayloadAction<{ limit?: number; offset?: number }>) => {
      if (action.payload.limit !== undefined) {
        state.pagination.limit = action.payload.limit;
      }
      if (action.payload.offset !== undefined) {
        state.pagination.offset = action.payload.offset;
      }
    },
    resetPagination: (state) => {
      state.pagination.offset = 0;
      state.pagination.hasMore = true;
    },
    clearMinorCategories: (state) => {
      state.minorCategories = [];
    }
  },
  extraReducers: (builder) => {
    builder
      // 운동구분 목록 조회
      .addCase(fetchWorkoutCategories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWorkoutCategories.fulfilled, (state, action) => {
        state.loading = false;
        state.categories = action.payload;
      })
      .addCase(fetchWorkoutCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '운동구분 목록 조회에 실패했습니다';
      })

      // 운동구분 상세 조회
      .addCase(fetchWorkoutCategoryById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWorkoutCategoryById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentCategory = action.payload;
      })
      .addCase(fetchWorkoutCategoryById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '운동구분 상세 조회에 실패했습니다';
      })

      // 운동구분별 통계 조회
      .addCase(fetchWorkoutCategoryStats.fulfilled, (state, action) => {
        state.categories = action.payload;
      })

      // 대분류별 중분류 목록 조회
      .addCase(fetchMinorCategoriesByMajor.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMinorCategoriesByMajor.fulfilled, (state, action) => {
        state.loading = false;
        state.minorCategories = action.payload;
      })
      .addCase(fetchMinorCategoriesByMajor.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '대분류별 중분류 목록 조회에 실패했습니다';
      })

      // 운동구분 생성
      .addCase(createWorkoutCategory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createWorkoutCategory.fulfilled, (state) => {
        state.loading = false;
        // 목록 새로고침이 필요함을 표시
      })
      .addCase(createWorkoutCategory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '운동구분 생성에 실패했습니다';
      })

      // 운동구분 수정
      .addCase(updateWorkoutCategory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateWorkoutCategory.fulfilled, (state, action) => {
        state.loading = false;
        const { id, data } = action.payload;
        
        // 목록에서 해당 운동구분 업데이트
        const index = state.categories.findIndex(c => c.id === id);
        if (index !== -1) {
          state.categories[index] = { ...state.categories[index], ...data };
        }
        
        // 현재 운동구분 업데이트
        if (state.currentCategory?.id === id) {
          state.currentCategory = { ...state.currentCategory, ...data };
        }
      })
      .addCase(updateWorkoutCategory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '운동구분 수정에 실패했습니다';
      })

      // 운동구분 삭제
      .addCase(deleteWorkoutCategory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteWorkoutCategory.fulfilled, (state, action) => {
        state.loading = false;
        const deletedId = action.payload;
        
        // 목록에서 해당 운동구분 제거
        state.categories = state.categories.filter(c => c.id !== deletedId);
        
        // 현재 운동구분이 삭제된 경우 초기화
        if (state.currentCategory?.id === deletedId) {
          state.currentCategory = null;
        }
      })
      .addCase(deleteWorkoutCategory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '운동구분 삭제에 실패했습니다';
      })

      // 기본 운동구분 데이터 초기화
      .addCase(initializeDefaultWorkoutCategories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(initializeDefaultWorkoutCategories.fulfilled, (state) => {
        state.loading = false;
        // 목록 새로고침이 필요함을 표시
      })
      .addCase(initializeDefaultWorkoutCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '기본 운동구분 데이터 초기화에 실패했습니다';
      })

      // 운동정보 목록 조회
      .addCase(fetchExercisesWithCategory.pending, (state) => {
        state.exercisesLoading = true;
        state.error = null;
      })
      .addCase(fetchExercisesWithCategory.fulfilled, (state, action) => {
        state.exercisesLoading = false;
        if (state.pagination.offset === 0) {
          state.exercises = action.payload;
        } else {
          state.exercises.push(...action.payload);
        }
        state.pagination.hasMore = action.payload.length === state.pagination.limit;
      })
      .addCase(fetchExercisesWithCategory.rejected, (state, action) => {
        state.exercisesLoading = false;
        state.error = action.error.message || '운동정보 목록 조회에 실패했습니다';
      })

      // 운동정보 생성
      .addCase(createExercise.pending, (state) => {
        state.exercisesLoading = true;
        state.error = null;
      })
      .addCase(createExercise.fulfilled, (state) => {
        state.exercisesLoading = false;
        // 목록 새로고침이 필요함을 표시
      })
      .addCase(createExercise.rejected, (state, action) => {
        state.exercisesLoading = false;
        state.error = action.error.message || '운동정보 생성에 실패했습니다';
      })

      // 운동정보 상세 조회
      .addCase(fetchExerciseById.pending, (state) => {
        state.exercisesLoading = true;
        state.error = null;
      })
      .addCase(fetchExerciseById.fulfilled, (state, action) => {
        state.exercisesLoading = false;
        state.currentExercise = action.payload;
      })
      .addCase(fetchExerciseById.rejected, (state, action) => {
        state.exercisesLoading = false;
        state.error = action.error.message || '운동정보 상세 조회에 실패했습니다';
      })

      // 운동정보 수정
      .addCase(updateExercise.pending, (state) => {
        state.exercisesLoading = true;
        state.error = null;
      })
      .addCase(updateExercise.fulfilled, (state, action) => {
        state.exercisesLoading = false;
        const { id, data } = action.payload;
        
        // 목록에서 해당 운동정보 업데이트
        const index = state.exercises.findIndex(e => e.id === id);
        if (index !== -1) {
          state.exercises[index] = { ...state.exercises[index], ...data };
        }
        
        // 현재 운동정보 업데이트
        if (state.currentExercise?.id === id) {
          state.currentExercise = { ...state.currentExercise, ...data };
        }
      })
      .addCase(updateExercise.rejected, (state, action) => {
        state.exercisesLoading = false;
        state.error = action.error.message || '운동정보 수정에 실패했습니다';
      })

      // 운동정보 삭제
      .addCase(deleteExercise.pending, (state) => {
        state.exercisesLoading = true;
        state.error = null;
      })
      .addCase(deleteExercise.fulfilled, (state, action) => {
        state.exercisesLoading = false;
        const deletedId = action.payload;
        
        // 목록에서 해당 운동정보 제거 (또는 비활성화 표시)
        state.exercises = state.exercises.filter(e => e.id !== deletedId);
        
        // 현재 운동정보가 삭제된 경우 초기화
        if (state.currentExercise?.id === deletedId) {
          state.currentExercise = null;
        }
      })
      .addCase(deleteExercise.rejected, (state, action) => {
        state.exercisesLoading = false;
        state.error = action.error.message || '운동정보 삭제에 실패했습니다';
      })

      // 운동 구분 대분류 목록 조회
      .addCase(fetchWorkoutMajorCategories.pending, (state) => {
        state.majorCategoriesLoading = true;
        state.error = null;
      })
      .addCase(fetchWorkoutMajorCategories.fulfilled, (state, action) => {
        state.majorCategoriesLoading = false;
        state.majorCategories = action.payload;
      })
      .addCase(fetchWorkoutMajorCategories.rejected, (state, action) => {
        state.majorCategoriesLoading = false;
        state.error = action.error.message || '운동 구분 대분류 조회에 실패했습니다';
      })

      // 운동 구분 대분류 목록 조회 (일반 사용자용)
      .addCase(fetchWorkoutMajorCategoriesForUser.pending, (state) => {
        state.majorCategoriesLoading = true;
        state.error = null;
      })
      .addCase(fetchWorkoutMajorCategoriesForUser.fulfilled, (state, action) => {
        state.majorCategoriesLoading = false;
        state.majorCategories = action.payload;
      })
      .addCase(fetchWorkoutMajorCategoriesForUser.rejected, (state, action) => {
        state.majorCategoriesLoading = false;
        state.error = action.error.message || '운동 구분 대분류 조회에 실패했습니다';
      })

      // 운동 목록 조회 및 검색 (통합)
      .addCase(getExercisesList.pending, (state) => {
        state.searchLoading = true;
        state.error = null;
      })
      .addCase(getExercisesList.fulfilled, (state, action) => {
        state.searchLoading = false;
        const nextPage = action.meta.arg?.page ?? 1;
        const nextExercises = action.payload?.exercises ?? [];

        if (nextPage > 1) {
          const existing = state.searchResults?.exercises ?? [];
          const existingIds = new Set(existing.map((e) => e.id));
          const merged = [...existing, ...nextExercises.filter((e) => !existingIds.has(e.id))];
          state.searchResults = { ...action.payload, exercises: merged };
          return;
        }

        state.searchResults = action.payload;
      })
      .addCase(getExercisesList.rejected, (state, action) => {
        state.searchLoading = false;
        state.error = action.error.message || '운동 목록 조회에 실패했습니다';
      });
  }
});

export const { 
  clearError, 
  clearCurrentCategory, 
  clearCurrentExercise,
  setCurrentCategory,
  setCurrentExercise,
  setPagination, 
  resetPagination,
  clearMinorCategories
} = workoutCategorySlice.actions;

export default workoutCategorySlice.reducer;