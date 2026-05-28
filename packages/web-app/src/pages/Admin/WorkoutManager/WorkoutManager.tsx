/**
 * 페이지 요약 — 운동(콘텐츠) 관리 (`/admin/workoutmanager`)
 *
 * 기능: 운동 카테고리·대분류 로드, 운동 검색·등록·수정, Vimeo 미리보기.
 *
 * 호출/연동:
 * - Redux `workoutCategorySlice`: `fetchWorkoutCategories`, `fetchWorkoutMajorCategories`, `getExercisesList`, `createExercise`, `updateExercise`
 * - DB/SP는 `packages/api-server` `workout-categories` 관련 라우트 참조.
 *
 * 관련 컴포넌트(`./components/`): `ExerciseList`, `ExerciseForm`, `VimeoPlayerSection`.
 *
 * 흐름: 카테고리 로드 → 검색·페이지네이션으로 목록 → 폼에서 생성/수정 dispatch.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '../../../hooks/redux'
import { useSnackbar } from '@/contexts/SnackbarContext'
import {
  fetchWorkoutCategories,
  fetchWorkoutMajorCategories,
  getExercisesList,
  createExercise,
  updateExercise,
} from '../../../store/slices/workoutCategorySlice'
import { Exercise, CreateExerciseRequest, ExerciseLevel, UpdateExerciseRequest } from '../../../types/workoutCategory'
import { ExerciseList } from './components/ExerciseList'
import { ExerciseForm } from './components/ExerciseForm'
import { VimeoPlayerSection } from './components/VimeoPlayerSection'

interface VideoInfo {
  url: string
  thumbnail?: string
  title?: string
  duration?: string
}

const WorkoutManager: React.FC = () => {
  const dispatch = useAppDispatch()
  const { showSnackbar } = useSnackbar()

  // Redux 상태
  const workoutCategoriesState = useAppSelector(state => state.workoutCategories)
  const {
    exercises = [],
    categories = [],
    majorCategories = [],
    majorCategoriesLoading = false,
    searchResults = { exercises: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } },
    searchLoading = false,
  } = workoutCategoriesState || {}

  // 지역 상태
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [searchType, setSearchType] = useState<string>('')
  const [searchKeyword, setSearchKeyword] = useState<string>('')
  const [appliedSearchKeyword, setAppliedSearchKeyword] = useState<string>('')
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [videoInfo, setVideoInfo] = useState<VideoInfo>({ url: '' })

  // 운동 정보 입력 폼 상태
  const [exerciseForm, setExerciseForm] = useState({
    name_ko: '',
    name_en: '',
    level: 'beginner' as ExerciseLevel,
    target_muscles: '',
    characteristics: '',
    equipment: '',
    purpose: '',
    video_url: '',
    thumbnail_url: '',
    video_title: '',
    video_duration: undefined as number | undefined,
    video_start_time: undefined as number | undefined,
    video_end_time: undefined as number | undefined,
    video_loop_count: undefined as number | undefined,
    is_active: true,
    workout_category_id: '',
    major_category: ''
  })

  // 컴포넌트 마운트 시 카테고리 데이터 로드
  useEffect(() => {
    try {
      dispatch(fetchWorkoutCategories({ is_active: true }))
      dispatch(fetchWorkoutMajorCategories())
    } catch (error) {
      console.error('카테고리 로드 실패:', error)
    }
  }, [dispatch])

  // 운동 목록 로드 함수
  const loadExercises = useCallback((page = 1) => {
    try {
      const params: any = {
        page,
        limit: 100,
        include_inactive: false,
      }

      if (selectedCategory && selectedCategory !== 'all') {
        params.major_category = selectedCategory
      }

      if (searchType && searchType !== 'all' && appliedSearchKeyword) {
        params.search_type = searchType
        params.search_keyword = appliedSearchKeyword
      } else if (appliedSearchKeyword) {
        params.search_keyword = appliedSearchKeyword
      }

      dispatch(getExercisesList(params))
    } catch (error) {
      console.error('운동 목록 로드 실패:', error)
    }
  }, [dispatch, selectedCategory, searchType, appliedSearchKeyword])

  const resolveWorkoutCategoryId = useCallback((params: { workoutCategoryId?: string; majorCategory?: string }) => {
    const workoutCategoryId = String(params.workoutCategoryId || '')
    if (workoutCategoryId && categories.some((c) => String(c.id) === workoutCategoryId)) return workoutCategoryId

    const majorCategory = params.majorCategory
    if (!majorCategory) return ''

    const candidates = categories
      .filter((c) => c.major_category === majorCategory)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

    return String(candidates[0]?.id || '')
  }, [categories])

  // 필터 변경 시 운동 목록 재로드
  useEffect(() => {
    loadExercises(1)
  }, [selectedCategory, searchType, appliedSearchKeyword, loadExercises])

  const resetSelection = () => {
    setSelectedExercise(null)
    setExerciseForm({
      name_ko: '', name_en: '', level: 'beginner', target_muscles: '',
      characteristics: '', equipment: '', purpose: '', video_url: '',
      thumbnail_url: '', video_title: '', video_duration: undefined,
      video_start_time: undefined, video_end_time: undefined,
      video_loop_count: undefined, is_active: true, workout_category_id: '', major_category: ''
    })
    setVideoInfo({ url: '' })
    setIsEditing(false)
  }

  // 검색 핸들러
  const handleSearch = () => {
    setAppliedSearchKeyword(searchKeyword)
    resetSelection()
  }

  const handleClearSearch = () => {
    setSearchKeyword('')
    setAppliedSearchKeyword('')
    resetSelection()
  }

  // 운동 선택 핸들러
  const applyExerciseToForm = (exercise: Exercise) => {
    const resolvedWorkoutCategoryId = resolveWorkoutCategoryId({
      workoutCategoryId: exercise.workout_category_id,
      majorCategory: exercise.major_category
    })

    setExerciseForm({
      name_ko: exercise.name_ko || '',
      name_en: exercise.name_en || '',
      level: exercise.level || 'beginner',
      target_muscles: exercise.target_muscles || '',
      characteristics: exercise.characteristics || '',
      equipment: exercise.equipment || '',
      purpose: exercise.purpose || '',
      video_url: exercise.video_url || '',
      thumbnail_url: exercise.thumbnail_url || '',
      video_title: exercise.video_title || '',
      video_duration: exercise.video_duration,
      video_start_time: exercise.video_start_time,
      video_end_time: exercise.video_end_time,
      video_loop_count: exercise.video_loop_count,
      is_active: exercise.is_active,
      workout_category_id: resolvedWorkoutCategoryId,
      major_category: exercise.major_category || ''
    })

    if (exercise.video_url) {
      setVideoInfo({
        url: exercise.video_url,
        thumbnail: exercise.thumbnail_url,
        title: exercise.video_title,
        duration: exercise.video_duration ? `${Math.floor(exercise.video_duration / 60)}:${(exercise.video_duration % 60).toString().padStart(2, '0')}` : undefined
      })
    } else {
      setVideoInfo({ url: '' })
    }
  }

  const handleSelectExercise = (exercise: Exercise) => {
    setSelectedExercise(exercise)
    applyExerciseToForm(exercise)
    setIsEditing(false) // 선택 시 조회 모드로 시작
  }

  // 카테고리 목록이 늦게 로드되는 경우(또는 기존 데이터가 잘못 저장된 경우) 선택된 운동의 workout_category_id를 보정
  useEffect(() => {
    if (!selectedExercise) return
    if (!categories.length) return

    const resolvedWorkoutCategoryId = resolveWorkoutCategoryId({
      workoutCategoryId: selectedExercise.workout_category_id,
      majorCategory: selectedExercise.major_category
    })

    if (!resolvedWorkoutCategoryId) return
    if (String(exerciseForm.workout_category_id || '') === String(resolvedWorkoutCategoryId)) return

    setExerciseForm((prev) => ({
      ...prev,
      workout_category_id: resolvedWorkoutCategoryId
    }))
  }, [selectedExercise, categories.length, resolveWorkoutCategoryId, exerciseForm.workout_category_id])

  // 새 운동 추가 핸들러
  const handleAddExercise = () => {
    setSelectedExercise(null)
    setExerciseForm({
      name_ko: '',
      name_en: '',
      level: 'beginner',
      target_muscles: '',
      characteristics: '',
      equipment: '',
      purpose: '',
      video_url: '',
      thumbnail_url: '',
      video_title: '',
      video_duration: undefined,
      video_start_time: undefined,
      video_end_time: undefined,
      video_loop_count: undefined,
      is_active: true,
      workout_category_id: '',
      major_category: ''
    })
    setVideoInfo({ url: '' })
    setIsEditing(true)
  }

  const handleEditExercise = () => {
    if (!selectedExercise) return
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    if (selectedExercise) applyExerciseToForm(selectedExercise)
    setIsEditing(false)
  }

  // 폼 변경 핸들러
  const handleFormChange = (field: string, value: any) => {
    setExerciseForm(prev => ({
      ...prev,
      [field]: value
    }))

    // 비디오 URL 변경 시 정보 추출 로직 (간소화)
    if (field === 'video_url') {
      setVideoInfo(prev => ({ ...prev, url: value }))
    }
  }

  // 시간 설정 변경 핸들러 (VimeoPlayerSection에서 호출)
  const handleTimeChange = (field: 'video_start_time' | 'video_end_time' | 'video_loop_count', value: number | undefined) => {
    setExerciseForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // 저장 핸들러
  const handleSaveExercise = async () => {
    try {
      const selectedWorkoutCategoryId =
        exerciseForm.workout_category_id ||
        selectedExercise?.workout_category_id ||
        ''

      let workoutCategoryIdToSave = selectedWorkoutCategoryId

      // 신규 생성 시: 상단 필터(대분류)만 선택된 경우, 해당 대분류의 첫 카테고리 ID로 매핑
      if (!workoutCategoryIdToSave) {
        if (!selectedCategory || selectedCategory === 'all') {
          showSnackbar({ message: '운동구분을 선택해주세요.', severity: 'warning' })
          return
        }
        const candidates = categories
          .filter((c) => c.major_category === selectedCategory)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        workoutCategoryIdToSave = candidates[0]?.id || ''
      }

      if (!workoutCategoryIdToSave) {
        showSnackbar({ message: '운동구분(category_id)을 찾을 수 없습니다. 운동구분을 다시 선택해주세요.', severity: 'error' })
        return
      }

      // API payload 구성
      // - 수정(UPDATE): number는 건드리지 않음(유니크 키 충돌 방지)
      // - 생성(CREATE): number는 현재 로드된 목록 기준으로 다음 값을 부여
      const { major_category, ...exerciseFormForApi } = exerciseForm

      if (selectedExercise) {
        const updatePayload: UpdateExerciseRequest = {
          ...exerciseFormForApi,
          workout_category_id: workoutCategoryIdToSave,
        }
        await dispatch(updateExercise({ id: selectedExercise.id, data: updatePayload }))
      } else {
        const currentMaxNumber = Math.max(
          0,
          ...(Array.isArray(searchResults.exercises) ? searchResults.exercises : []).map((e) => Number(e.number) || 0)
        )
        const createPayload: CreateExerciseRequest = {
          number: currentMaxNumber + 1,
          ...exerciseFormForApi,
          workout_category_id: workoutCategoryIdToSave,
          major_category: major_category || selectedCategory || undefined,
        }
        await dispatch(createExercise(createPayload))
      }

      setIsEditing(false)
      loadExercises(1)
    } catch (error) {
      console.error('운동 정보 저장 실패:', error)
    }
  }

  // 상태 토글 핸들러
  // 목록에서는 상태를 변경하지 않습니다. 상태 변경은 운동 정보 상세(폼)에서만 처리합니다.

  const handleLoadMoreExercises = async () => {
    const currentPage = searchResults.pagination?.page ?? 1
    const totalPages = searchResults.pagination?.totalPages ?? 1
    if (searchLoading) return
    if (currentPage >= totalPages) return
    await dispatch(getExercisesList({
      page: currentPage + 1,
      limit: 100,
      include_inactive: false,
      ...(selectedCategory && selectedCategory !== 'all' ? { major_category: selectedCategory } : {}),
      ...(searchType && searchType !== 'all' && appliedSearchKeyword ? { search_type: searchType } : {}),
      ...(appliedSearchKeyword ? { search_keyword: appliedSearchKeyword } : {}),
    }))
  }

  return (
    <div className="h-[calc(100vh-140px)] p-0 flex flex-col gap-[3px] overflow-hidden bg-background">
      {/* 상단: 운동 목록 (60%) */}
      <div className="flex-[6] min-h-0">
        <ExerciseList
          exercises={Array.isArray(searchResults.exercises) ? searchResults.exercises : []}
          majorCategories={majorCategories}
          selectedCategory={selectedCategory}
          searchType={searchType}
          searchKeyword={searchKeyword}
          loading={searchLoading}
          hasMore={(searchResults.pagination?.page ?? 1) < (searchResults.pagination?.totalPages ?? 1)}
          onLoadMore={handleLoadMoreExercises}
          onCategoryChange={(value: string) => { setSelectedCategory(value); resetSelection() }}
          onSearchTypeChange={setSearchType}
          onSearchKeywordChange={setSearchKeyword}
          onSearch={handleSearch}
          onClearSearch={handleClearSearch}
          onAddExercise={handleAddExercise}
          onSelectExercise={handleSelectExercise}
          selectedExerciseId={selectedExercise?.id}
        />
      </div>

      {/* 하단: 상세 정보 및 플레이어 (40%) */}
      <div className="flex-[4] min-h-0 flex gap-[3px]">
        {/* 좌측: 운동 정보 폼 */}
        <div className="flex-[2] h-full overflow-hidden">
          <ExerciseForm
            formData={exerciseForm}
            majorCategories={majorCategories}
            categories={categories}
            isEditing={isEditing}
            onEdit={handleEditExercise}
            onFormChange={handleFormChange}
            onSave={handleSaveExercise}
            onCancel={handleCancelEdit}
          />
        </div>

        {/* 우측: 비디오 플레이어 */}
        <div className="flex-[1] h-full overflow-hidden">
          <VimeoPlayerSection
            videoUrl={exerciseForm.video_url}
            startTime={exerciseForm.video_start_time}
            endTime={exerciseForm.video_end_time}
            loopCount={exerciseForm.video_loop_count}
            onTimeChange={handleTimeChange}
          />
        </div>
      </div>
    </div>
  )
}

export default WorkoutManager
