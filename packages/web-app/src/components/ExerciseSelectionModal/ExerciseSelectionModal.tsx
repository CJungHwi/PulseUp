/**
 * ExerciseSelectionModal
 * - 기능: 운동 검색/선택 팝업, 영상 미리보기, 선택 운동 추가
 * - API: getExercisesList, exerciseFavoriteApi (sp_GetUserExerciseFavorites, sp_ToggleUserExerciseFavorite)
 * - Components: ExerciseFavoriteStar, VimeoFitIframe
 * - 흐름: 카테고리/검색 → 목록 표시 → 체크 선택 + 즐겨찾기 → 선택추가 → 확인
 * - 선택된 운동 목록: 순서를 위치 라벨(Main A1~A6/B1~B6, DS DS1~, CD CD1~)로 표시,
 *   WorkoutEditor 와 동일한 행 드래그 앤 드롭으로 순서 변경(드롭 시 위치 재할당)
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Play,
  Pause,
  RotateCcw,
  X,
  Plus as AddIcon,
  Video as VideoIcon,
  Trash,
  Trash2,
  ArrowUp,
  ArrowDown,
  RefreshCcw,
  List,
  ListChecks,
} from 'lucide-react';
import Player from '@vimeo/player';
import {
  Dialog as ShadcnDialog,
  DialogContent as ShadcnDialogContent,
  DialogHeader as ShadcnDialogHeader,
  DialogTitle as ShadcnDialogTitle,
  DialogFooter as ShadcnDialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table as ShadcnTable,
  TableBody as ShadcnTableBody,
  TableCell as ShadcnTableCell,
  TableHead as ShadcnTableHead,
  TableHeader as ShadcnTableHeader,
  TableRow as ShadcnTableRow,
} from '@/components/ui/table';
import {
  Select as ShadcnSelect,
  SelectContent as ShadcnSelectContent,
  SelectItem as ShadcnSelectItem,
  SelectTrigger as ShadcnSelectTrigger,
  SelectValue as ShadcnSelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '../../hooks/redux'
import {
  fetchWorkoutCategories,
  fetchWorkoutMajorCategoriesForUser,
  getExercisesList
} from '../../store/slices/workoutCategorySlice'
import { EXERCISE_LEVEL_LABELS, ExerciseLevel } from '../../types/workoutCategory'
import { VimeoFitIframe } from '../VimeoFitIframe/VimeoFitIframe';
import { ExerciseFavoriteStar } from './ExerciseFavoriteStar';
import { useExerciseFavorites } from './useExerciseFavorites';
import { positionFromMainIndex } from '@/utils/gridPositionCodes';

// 공통으로 사용하는 Exercise 타입 정의
interface Exercise {
  id: string
  originalExerciseId?: string // 실제 운동 ID (저장시 사용)
  uniqueKey?: string // React key 전용 (화면 렌더링용, DB 저장 안됨)
  name_ko: string
  name_en: string
  level: 'beginner' | 'intermediate' | 'advanced'
  target_muscles: string
  characteristics: string
  equipment: string
  purpose: string
  duration: number // 초 단위
  video_url?: string
  thumbnail_url?: string
  video_title?: string
  video_duration?: number
  video_start_time?: number
  video_end_time?: number
  video_loop_count?: number
  is_active: boolean
  major_category: string
  updated_at?: string
}

interface ExerciseSelectionModalProps {
  open: boolean
  onClose: () => void
  onExercisesSelected: (exercises: Exercise[]) => void
  selectedExercises?: Exercise[]
  defaultCategory?: string // 기본 운동구분 파라미터 추가
}

interface SelectedExerciseWithTime extends Exercise {
  selectedTime: number // 초 단위
  position?: string // 운동 위치 (A1~A6, B1~B6)
}

const MAIN_POSITION_OPTIONS = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6',
  'B1', 'B2', 'B3', 'B4', 'B5', 'B6',
]

const ExerciseSelectionModal: React.FC<ExerciseSelectionModalProps> = ({
  open,
  onClose,
  onExercisesSelected,
  selectedExercises = [],
  defaultCategory = ''
}) => {
  const dispatch = useAppDispatch()

  // Redux 상태
  const workoutCategoriesState = useAppSelector(state => state.workoutCategories)
  const {
    exercises = [],
    categories = [],
    minorCategories = [],
    majorCategories = [],
    exercisesLoading = false,
    majorCategoriesLoading = false,
    searchResults = { exercises: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } },
    searchLoading = false,
  } = workoutCategoriesState || {}
  const {
    favoritesLoading,
    favoriteToggleLoadingId,
    isFavorite,
    toggleFavorite,
  } = useExerciseFavorites({ enabled: open })

  const isModalLoading = open && (majorCategoriesLoading || exercisesLoading || searchLoading || favoritesLoading)

  // 지역 상태
  const [selectedCategory, setSelectedCategory] = useState<string>(defaultCategory)
  const [searchType, setSearchType] = useState<string>('')
  const [searchKeyword, setSearchKeyword] = useState<string>('')
  const [appliedSearchKeyword, setAppliedSearchKeyword] = useState<string>('') // 실제로 검색에 적용할 키워드
  const [filterKeyword1, setFilterKeyword1] = useState<string>('') // 1차 결과 내 필터링 키워드
  const [filterKeyword2, setFilterKeyword2] = useState<string>('') // 2차 결과 내 필터링 키워드
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(false) // 즐겨찾기만 보기
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)
  const [tempSelectedExercises, setTempSelectedExercises] = useState<SelectedExerciseWithTime[]>([]) // 팝업 내에서 새로 선택한 운동들만 포함
  const [parentSelectedExercises, setParentSelectedExercises] = useState<SelectedExerciseWithTime[]>([]) // 부모창에서 전달된 운동들 (hidden, 중복체크용)
  const [selectedRows, setSelectedRows] = useState<string[]>([]) // 체크박스 선택된 행들
  /** 검색/필터가 바뀌어도 체크한 행을 추가할 수 있도록 id → 당시 운동 스냅샷 */
  const [selectedRowSnapshots, setSelectedRowSnapshots] = useState<Record<string, Exercise>>({})
  const [rightSelectedExercise, setRightSelectedExercise] = useState<Exercise | null>(null) // 우측 영역에서 선택된 운동
  const [categorySelectDisabled, setCategorySelectDisabled] = useState<boolean>(false) // 카테고리 select 비활성화 상태
  const [duplicateConfirmOpen, setDuplicateConfirmOpen] = useState(false) // 중복 확인 다이얼로그
  const [pendingExercises, setPendingExercises] = useState<SelectedExerciseWithTime[]>([]) // 중복 확인 대기 중인 운동들
  const [pendingRowId, setPendingRowId] = useState<string | null>(null) // 중복 확인 대기 중인 체크박스 ID
  const [pendingRowIds, setPendingRowIds] = useState<string[]>([]) // 전체 선택 시 중복 확인 대기 중인 체크박스 ID들

  // Vimeo Player 상태
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const vimeoPlayerRef = useRef<Player | null>(null)
  const vimeoIframeRef = useRef<HTMLIFrameElement | null>(null)
  const isInitializedRef = useRef(false)

  // Stretching 카테고리인지 확인하는 함수
  const isStretchingCategory = (category: string) => {
    return category === 'DS' || category === 'CD'
  }

  // 카테고리에 따른 위치 옵션 반환
  const getPositionOptions = (category: string): string[] => {
    if (category === 'DS') {
      return ['DS1', 'DS2', 'DS3', 'DS4', 'DS5', 'DS6']
    } else if (category === 'CD') {
      return ['CD1', 'CD2', 'CD3', 'CD4', 'CD5', 'CD6']
    }
    return MAIN_POSITION_OPTIONS
  }

  // 카테고리에 따른 기본 위치값 반환
  const getDefaultPosition = (category: string): string => {
    if (category === 'DS') {
      return 'DS1'
    } else if (category === 'CD') {
      return 'CD1'
    }
    return 'A1'
  }

  // Snackbar 상태
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('')
  const [snackbarSeverity, setSnackbarSeverity] = useState<'error' | 'warning' | 'info' | 'success'>('error')

  // 전체 데이터 로드를 위한 상태 (페이징 제거)
  const [allExercises, setAllExercises] = useState<Exercise[]>([])

  // DataGrid 페이징 상태
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 100 })

  // 운동 목록 테이블 컬럼 너비 (리사이징 가능, 운동명영문 30% 증가: 180→234, 특징및효과 50% 감소: 200→100)
  const [exerciseTableColWidths, setExerciseTableColWidths] = useState({
    select: 50,
    favorite: 50,
    badge: 60,
    name_en: 180,
    name_ko: 180,
    target_muscles: 100,
    characteristics: 100,
    equipment: 100,
  })
  const [resizingCol, setResizingCol] = useState<string | null>(null)
  const resizeStartXRef = useRef<number>(0)
  const resizeStartWidthRef = useRef<number>(0)

  // 선택된 운동 목록 행 드래그 앤 드롭 순서 변경 상태
  const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null)
  /** 행 사이 삽입 위치 (0 = 맨 위, list.length = 맨 아래) */
  const [dropInsertIndex, setDropInsertIndex] = useState<number | null>(null)

  // 테이블 컬럼 리사이즈 핸들러
  const handleResizeStart = useCallback((colKey: keyof typeof exerciseTableColWidths, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingCol(colKey)
    resizeStartXRef.current = e.clientX
    resizeStartWidthRef.current = exerciseTableColWidths[colKey]
  }, [exerciseTableColWidths])

  useEffect(() => {
    if (!resizingCol) return
    const handleMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartXRef.current
      const newWidth = Math.max(40, resizeStartWidthRef.current + delta)
      setExerciseTableColWidths(prev => ({ ...prev, [resizingCol]: newWidth }))
      resizeStartXRef.current = e.clientX
      resizeStartWidthRef.current = newWidth
    }
    const handleUp = () => setResizingCol(null)
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [resizingCol])

  // 컴포넌트 마운트 시 카테고리 데이터 로드 (운동 목록은 selectedCategory 설정 후 로드)
  useEffect(() => {
    if (open) {
      try {
        console.log('팝업 열림 - 카테고리 데이터 로드 시작')
        dispatch(fetchWorkoutCategories({})).then((result) => {
          console.log('fetchWorkoutCategories 결과:', result)
        }).catch((error) => {
          console.error('fetchWorkoutCategories 실패:', error)
        })

        dispatch(fetchWorkoutMajorCategoriesForUser()).then((result) => {
          console.log('fetchWorkoutMajorCategoriesForUser 결과:', result)
          console.log('받은 majorCategories 데이터:', result.payload)
          if (result.payload && Array.isArray(result.payload)) {
            console.log('사용 가능한 카테고리들:', result.payload.map(cat => cat.major_category))
            const powerCircuitExists = result.payload.find(cat => cat.major_category === 'Power_circuit')
            console.log('Power_circuit 카테고리 존재 여부:', powerCircuitExists)
          }
        }).catch((error) => {
          console.error('fetchWorkoutMajorCategoriesForUser 실패:', error)
        })

        // 초기 운동 목록 로드는 제거 - selectedCategory가 설정된 후 자동으로 로드됨
      } catch (error) {
        console.error('데이터 로드 실패:', error)
      }
    }
  }, [dispatch, open])

  // 기존 선택된 운동들을 임시 선택 목록에 추가 및 defaultCategory 설정
  useEffect(() => {
    if (open && !isInitializedRef.current) {
      // 팝업이 열리자마자 즉시 운동 리스트 초기화 (이전 데이터가 보이지 않도록)
      setAllExercises([])
      setSearchKeyword('')
      setAppliedSearchKeyword('')
      setFilterKeyword1('')
      setFilterKeyword2('')
      setSearchType('')
      setShowFavoritesOnly(false)

      // 디버깅: 카테고리 데이터 확인
      console.log('defaultCategory:', defaultCategory)
      console.log('majorCategories:', majorCategories)
      console.log('majorCategoriesLoading:', majorCategoriesLoading)
      console.log('workoutCategoriesState:', workoutCategoriesState)

      // 기본 카테고리 설정
      console.log('Setting selectedCategory to:', defaultCategory)

      setSelectedCategory(defaultCategory)

      // defaultCategory가 있으면 select를 비활성화
      if (defaultCategory) {
        setCategorySelectDisabled(true)
        console.log('defaultCategory가 설정되어 select를 비활성화합니다:', defaultCategory)
      } else {
        setCategorySelectDisabled(false)
        console.log('defaultCategory가 없어 select를 활성화합니다')
      }

      // majorCategories에서 defaultCategory가 존재하는지 확인
      const categoryExists = majorCategories.find(cat => cat.major_category === defaultCategory)
      console.log('Category exists in majorCategories:', categoryExists)

      // 부모창에서 전달된 운동들을 초기 선택 목록으로 설정
      if (selectedExercises && selectedExercises.length > 0) {
        // selectedExercises를 SelectedExerciseWithTime 형식으로 변환
        const initialExercises: SelectedExerciseWithTime[] = selectedExercises.map(ex => ({
          ...ex,
          selectedTime: ex.duration || (isStretchingCategory(defaultCategory) ? 20 : 0),
          position: (ex as any).position || getDefaultPosition(defaultCategory),
          // originalExerciseId가 없으면 id를 originalExerciseId로 설정 (id가 실제 운동 ID인 경우)
          originalExerciseId: ex.originalExerciseId || ex.id
        }))

        setParentSelectedExercises(initialExercises)
        // setTempSelectedExercises(initialExercises) // 제거: 팝업 내 선택 목록에는 표시하지 않음

        console.log('부모창에서 전달된 운동들을 parentSelectedExercises에 저장:', initialExercises.map(ex => ({
          id: ex.id,
          originalId: ex.originalExerciseId,
          name: ex.name_ko
        })))
      } else {
        setParentSelectedExercises([])
      }

      // 팝업 내에서 새로 선택한 운동 목록은 항상 빈 배열로 초기화
      setTempSelectedExercises([])

      // 체크박스 선택 초기화
      setSelectedRows([])
      setSelectedRowSnapshots({})
      isInitializedRef.current = true
    } else if (!open) {
      isInitializedRef.current = false
    }
  }, [open, selectedExercises, defaultCategory])

  // majorCategories가 로드된 후 defaultCategory 재설정 및 자동 검색
  useEffect(() => {
    if (majorCategories.length > 0 && defaultCategory && !majorCategoriesLoading) {
      console.log('majorCategories loaded, re-setting defaultCategory:', defaultCategory)
      const categoryExists = majorCategories.find(cat => cat.major_category === defaultCategory)
      if (categoryExists) {
        setSelectedCategory(defaultCategory)
        setCategorySelectDisabled(true) // defaultCategory가 있으면 비활성화
        console.log('defaultCategory found and set:', categoryExists)
        console.log('Select box disabled for defaultCategory:', defaultCategory)
      } else {
        console.log('defaultCategory not found in majorCategories:', defaultCategory)
        console.log('Available categories:', majorCategories.map(cat => cat.major_category))
        setCategorySelectDisabled(false) // 카테고리를 찾지 못하면 활성화
      }
    }
  }, [majorCategories, defaultCategory, majorCategoriesLoading])

  const loadExercises = useCallback(async () => {
    try {
      // 전체 데이터를 가져오기 위해 큰 limit 설정
      const params: any = {
        page: 1,
        limit: 10000 // 충분히 큰 값으로 전체 데이터 가져오기
      }

      if (selectedCategory) {
        params.major_category = selectedCategory
      }

      // 검색구분이 "전체"이거나 빈 문자열일 때는 모든 컬럼에 대해 검색
      // 서버 프로시저는 search_type이 없을 때 name_en과 name_ko만 검색하므로,
      // 클라이언트 사이드에서 추가 필터링을 수행함
      if (appliedSearchKeyword) {
        if (searchType && searchType !== '') {
          // 특정 컬럼으로 검색
          params.search_type = searchType
          params.search_keyword = appliedSearchKeyword
        } else {
          // 전체 검색: 서버에서는 name_en과 name_ko만 검색하고,
          // 클라이언트에서 나머지 컬럼(target_muscles, characteristics, equipment, purpose)도 필터링
          // 서버에 search_type을 전달하지 않으면 name_en과 name_ko로 검색됨
          params.search_keyword = appliedSearchKeyword
        }
      }

      console.log('loadExercises called with params:', params)
      console.log('selectedCategory:', selectedCategory)

      const result = await dispatch(getExercisesList(params))
      if (result.payload && typeof result.payload === 'object' && 'exercises' in result.payload) {
        const payload = result.payload as { exercises: any[] }
        const exercises = payload.exercises.map((exercise: any) => ({
          id: exercise.id,
          name_ko: exercise.name_ko,
          name_en: exercise.name_en,
          level: exercise.level,
          target_muscles: exercise.target_muscles,
          characteristics: exercise.characteristics,
          equipment: exercise.equipment,
          purpose: exercise.purpose,
          duration: exercise.duration || 1,
          video_url: exercise.video_url,
          thumbnail_url: exercise.thumbnail_url,
          video_title: exercise.video_title,
          video_duration: exercise.video_duration,
          video_start_time: exercise.video_start_time,
          video_end_time: exercise.video_end_time,
          video_loop_count: exercise.video_loop_count,
          is_active: exercise.is_active,
          major_category: exercise.major_category,
          updated_at: exercise.updated_at
        }))
        // video_url(영상 ID)가 있는 운동만 표시
        const videoOnlyExercises = exercises.filter(ex => String(ex.video_url || '').trim() !== '')
        setAllExercises(videoOnlyExercises)
      }
    } catch (error) {
      console.error('운동 목록 로드 실패:', error)
      setAllExercises([])
    }
  }, [dispatch, selectedCategory, searchType, appliedSearchKeyword])

  const clearSearchTableSelection = useCallback(() => {
    setSelectedRows([])
    setSelectedRowSnapshots({})
  }, [])

  // 검색 기능 (검색 적용 시 목록 체크 선택 초기화)
  const handleSearch = () => {
    clearSearchTableSelection()
    setAppliedSearchKeyword(searchKeyword)
  }

  // selectedCategory, 검색 조건 변경 시 운동 목록 재로드
  useEffect(() => {
    if (open) {
      if (defaultCategory && !selectedCategory) {
        console.log('defaultCategory 대기 중, 로드 스킵:', { defaultCategory, selectedCategory })
        return
      }
      console.log('운동 목록 로드:', { selectedCategory, searchType, appliedSearchKeyword })
      loadExercises()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedCategory, defaultCategory, appliedSearchKeyword])

  // Vimeo Player 초기화
  useEffect(() => {
    console.log('🎬 Vimeo Player useEffect 실행:', {
      hasIframe: !!vimeoIframeRef.current,
      videoUrl: rightSelectedExercise?.video_url
    })

    const videoUrl = rightSelectedExercise?.video_url?.trim()
    if (!videoUrl) {
      console.log('🎬 비디오 URL 또는 ID 없음')
      setIsPlayerReady(false)
      return
    }
    const vimeoMatch = videoUrl.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)?(\d+)/)
    const videoId = vimeoMatch ? vimeoMatch[1] : null

    console.log('🎬 Vimeo ID 매칭 결과:', { videoUrl, videoId })

    if (!videoId) {
      console.log('🎬 유효하지 않은 Vimeo URL 또는 ID')
      setIsPlayerReady(false)
      return
    }

    // 이전 플레이어 정리
    if (vimeoPlayerRef.current) {
      console.log('🎬 기존 플레이어 정리')
      try {
        vimeoPlayerRef.current.destroy()
      } catch (error) {
        console.error('🎬 플레이어 제거 실패:', error)
      }
      vimeoPlayerRef.current = null
      setIsPlayerReady(false)
      setIsPlaying(false)
    }

    let initTimer: NodeJS.Timeout | null = null
    let retryCount = 0
    const maxRetries = 10

    // iframe이 DOM에 마운트될 때까지 재시도
    const tryInitPlayer = () => {
      if (!vimeoIframeRef.current) {
        console.log(`🎬 iframe 대기 중... (${retryCount + 1}/${maxRetries})`)
        retryCount++
        if (retryCount < maxRetries) {
          initTimer = setTimeout(tryInitPlayer, 100)
        } else {
          console.error('🎬 iframe 로드 타임아웃')
        }
        return
      }

      console.log('🎬 Vimeo Player 초기화 시작')
      try {
        // Vimeo Player 초기화
        const player = new Player(vimeoIframeRef.current)
        vimeoPlayerRef.current = player

        console.log('🎬 Vimeo Player 객체 생성 완료')

        // 플레이어 준비 완료
        player.ready().then(() => {
          console.log('🎬 플레이어 준비 완료')
          player.setMuted(true) // 기본 음소거 설정
          setIsPlayerReady(true)

          const startTime = rightSelectedExercise.video_start_time || 0
          if (startTime > 0) {
            player.setCurrentTime(startTime).then(() => {
              console.log('🎬 시작 시간 설정 완료:', startTime)
            }).catch((error) => {
              console.error('🎬 시작 시간 설정 실패:', error)
            })
          }

          // 재생 상태 이벤트 리스너
          player.on('play', () => setIsPlaying(true))
          player.on('pause', () => setIsPlaying(false))
          player.on('ended', () => setIsPlaying(false))
        }).catch((error) => {
          console.error('🎬 플레이어 준비 실패:', error)
          setIsPlayerReady(false)
        })
      } catch (error) {
        console.error('🎬 Player 객체 생성 실패:', error)
        setIsPlayerReady(false)
      }
    }

    // 초기화 시작
    initTimer = setTimeout(tryInitPlayer, 100)

    // 클린업 함수
    return () => {
      if (initTimer) {
        clearTimeout(initTimer)
      }
      if (vimeoPlayerRef.current) {
        try {
          vimeoPlayerRef.current.destroy()
        } catch (error) {
          console.error('🎬 클린업 중 플레이어 제거 실패:', error)
        }
        vimeoPlayerRef.current = null
        setIsPlayerReady(false)
        setIsPlaying(false)
      }
    }
  }, [rightSelectedExercise?.video_url])

  // 구간 반복 로직
  useEffect(() => {
    if (!vimeoPlayerRef.current || !isPlayerReady || !rightSelectedExercise) return
    const startTime = rightSelectedExercise.video_start_time || 0
    const endTime = rightSelectedExercise.video_end_time
    vimeoPlayerRef.current.off('timeupdate')
    if (endTime && endTime > startTime) {
      const handleTimeUpdate = (data: { seconds: number }) => {
        if (data.seconds >= endTime) {
          vimeoPlayerRef.current?.setCurrentTime(startTime).catch((error) => {
            console.error('시간 이동 실패:', error)
          })
        }
      }
      vimeoPlayerRef.current.on('timeupdate', handleTimeUpdate)
      return () => {
        vimeoPlayerRef.current?.off('timeupdate', handleTimeUpdate)
      }
    }
  }, [rightSelectedExercise?.video_start_time, rightSelectedExercise?.video_end_time, isPlayerReady])

  // 테이블 행 선택 핸들러 (상단 운동목록)
  const handleRowSelection = (exercise: Exercise) => {
    setSelectedExercise(exercise)
    setRightSelectedExercise(exercise) // 우측 영역과 연동
  }

  // 선택된 운동목록 행 선택 핸들러
  const handleSelectedExerciseRowSelection = (exercise: SelectedExerciseWithTime) => {
    setRightSelectedExercise(exercise) // 우측 영역과 연동
  }

  // 운동 정보 툴팁 생성 함수
  const createExerciseTooltipContent = (exercise: Exercise | SelectedExerciseWithTime) => {
    return (
      <div className="p-2 space-y-2 max-w-[300px]">
        <div className="font-bold text-red-600 dark:text-red-400 border-b pb-1 mb-1">
          {exercise.name_ko} ({exercise.name_en})
        </div>
        <div className="text-sm space-y-1">
          <div><span className="font-semibold text-blue-600">자극부위:</span> {exercise.target_muscles}</div>
          <div><span className="font-semibold text-blue-600">필요기구:</span> {exercise.equipment || '없음'}</div>
          <div><span className="font-semibold text-blue-600">운동특징:</span> {exercise.characteristics}</div>
          <div><span className="font-semibold text-blue-600">운동목적:</span> {exercise.purpose}</div>
          {'selectedTime' in exercise && isStretchingCategory(selectedCategory) && exercise.selectedTime > 0 && (
            <div><span className="font-semibold text-blue-600">설정시간:</span> {exercise.selectedTime}초</div>
          )}
        </div>
      </div>
    )
  }

  // 운동 추가 핸들러 (체크박스로 선택된 운동들 추가)
  const handleAddExercise = () => {
    console.log('선택 추가 클릭됨')
    console.log('선택된 행들:', selectedRows)
    console.log('표시된 운동들:', displayExercises)

    if (selectedRows.length > 0) {
      const selectedExercisesToAdd = selectedRows
        .map((idStr) => {
          const fromDisplay = displayExercises.find(ex => String(ex.id) === idStr)
          return fromDisplay || selectedRowSnapshots[idStr]
        })
        .filter((ex): ex is Exercise => Boolean(ex))

      const positions = getPositionOptions(selectedCategory)
      const defaultPosition = getDefaultPosition(selectedCategory)
      const usedPositions = new Set([
        ...tempSelectedExercises.map(ex => (ex as any).position).filter(Boolean),
        ...parentSelectedExercises.map(ex => (ex as any).position).filter(Boolean)
      ])

      const exercisesWithTime: SelectedExerciseWithTime[] = selectedExercisesToAdd.map((exercise) => {
        let nextPosition = defaultPosition
        for (const pos of positions) {
          if (!usedPositions.has(pos)) {
            nextPosition = pos
            usedPositions.add(pos)
            break
          }
        }

        const uniqueKeyForReact = `${exercise.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        // purpose 필드가 비어있으면 카테고리에 맞는 기본값 설정
        let purposeValue = exercise.purpose && exercise.purpose.trim() !== '' ? exercise.purpose : ''
        if (!purposeValue) {
          if (selectedCategory === 'DS') {
            purposeValue = 'Dynamic Stretching'
          } else if (selectedCategory === 'CD') {
            purposeValue = 'Cool Down'
          } else {
            purposeValue = 'Workout'
          }
        }

        return {
          ...exercise,
          uniqueKey: uniqueKeyForReact,
          originalExerciseId: exercise.originalExerciseId || exercise.id,
          purpose: purposeValue,
          selectedTime: isStretchingCategory(selectedCategory) ? 20 : 0,
          position: nextPosition
        }
      })

      if (exercisesWithTime.length > 0) {
        setTempSelectedExercises(prev => [...prev, ...exercisesWithTime])
      }
      setSelectedRowSnapshots(prev => {
        const next = { ...prev }
        selectedRows.forEach(id => {
          delete next[id]
        })
        return next
      })
      setSelectedRows([])
    }
  }

  // 중복 확인 다이얼로그 확인 핸들러
  const handleDuplicateConfirm = () => {
    if (pendingRowId) {
      setSelectedRows(prev => [...prev, pendingRowId])
      setPendingRowId(null)
    }
    else if (pendingRowIds.length > 0) {
      setSelectedRows(prev => [...prev, ...pendingRowIds])
      setPendingRowIds([])
    }
    else if (pendingExercises.length > 0) {
      const exercisesWithNewIds = pendingExercises.map(exercise => ({
        ...exercise,
        uniqueKey: `${exercise.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }))

      setTempSelectedExercises(prev => [...prev, ...exercisesWithNewIds])
      setSelectedRows([])
      setSelectedRowSnapshots({})
    }
    setDuplicateConfirmOpen(false)
    setPendingExercises([])
  }

  // 중복 확인 다이얼로그 취소 핸들러
  const handleDuplicateCancel = () => {
    if (pendingRowId) {
      const rid = pendingRowId
      setSelectedRowSnapshots(prev => {
        if (!(rid in prev)) {
          return prev
        }
        const next = { ...prev }
        delete next[rid]
        return next
      })
      setPendingRowId(null)
    }
    else if (pendingRowIds.length > 0) {
      setSelectedRowSnapshots(prev => {
        const next = { ...prev }
        pendingRowIds.forEach(id => {
          delete next[id]
        })
        return next
      })
      setPendingRowIds([])
    }
    else if (pendingExercises.length > 0) {
      const nonDuplicateExercises = pendingExercises.filter(newEx => {
        const newExerciseId = newEx.originalExerciseId || newEx.id
        const isDuplicateInTemp = tempSelectedExercises.some(existingEx => {
          const existingExerciseId = existingEx.originalExerciseId || existingEx.id
          return existingExerciseId === newExerciseId || existingEx.id === newExerciseId || newExerciseId === existingEx.id
        })
        const isDuplicateInParent = parentSelectedExercises.some(existingEx => {
          const existingExerciseId = existingEx.originalExerciseId || existingEx.id
          return existingExerciseId === newExerciseId || existingEx.id === newExerciseId || newExerciseId === existingEx.id
        })
        return !isDuplicateInTemp && !isDuplicateInParent
      })

      const exercisesWithNewIds = nonDuplicateExercises.map(exercise => ({
        ...exercise,
        uniqueKey: `${exercise.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }))

      if (exercisesWithNewIds.length > 0) {
        setTempSelectedExercises(prev => [...prev, ...exercisesWithNewIds])
      }
      setSelectedRows([])
      setSelectedRowSnapshots({})
    }
    setDuplicateConfirmOpen(false)
    setPendingExercises([])
  }

  // 선택된 운동 삭제
  const handleRemoveExercise = (exerciseId: string) => {
    setTempSelectedExercises(prev => prev.filter(ex => ex.id !== exerciseId))
  }

  // 확인 버튼 핸들러
  const handleConfirm = () => {
    const exercisesToReturn = tempSelectedExercises.map((ex, index) => ({
      ...ex,
      id: ex.uniqueKey || ex.id, // 각 인스턴스별 고유 id (동일 운동 중복 추가 시 삭제가 해당 항목만 제거되도록)
      originalExerciseId: ex.originalExerciseId || ex.id, // 저장 시 사용할 실제 운동 ID
      position: getSelectedPositionLabel(index), // 표시 순서와 동일한 위치 라벨로 반환
      duration: ex.selectedTime
    }))
    onExercisesSelected(exercisesToReturn)
    onClose()
  }

  // 취소 버튼 핸들러
  const handleCancel = () => {
    setTempSelectedExercises([])
    setParentSelectedExercises([])
    setSelectedExercise(null)
    setSelectedRows([])
    setSelectedRowSnapshots({})
    setRightSelectedExercise(null)
    setAllExercises([])
    setDuplicateConfirmOpen(false)
    setPendingExercises([])
    setPendingRowId(null)
    setPendingRowIds([])
    // 검색/필터 상태 초기화 (다음 팝업 오픈 시 깨끗한 상태로)
    setSearchKeyword('')
    setAppliedSearchKeyword('')
    setFilterKeyword1('')
    setFilterKeyword2('')
    setSearchType('')
    onClose()
  }

  // 선택된 운동 목록 순서 라벨 (Main A1~A6/B1~B6, DS DS1~, CD CD1~)
  const getSelectedPositionLabel = (index: number): string => {
    if (selectedCategory === 'DS') return `DS${index + 1}`
    if (selectedCategory === 'CD') return `CD${index + 1}`
    return positionFromMainIndex(index)
  }

  // 순서 변경 후 각 운동의 position 을 순서대로 재할당 (부모 저장 시 위치 일관성 유지)
  const reassignSelectedPositions = (
    list: SelectedExerciseWithTime[]
  ): SelectedExerciseWithTime[] =>
    list.map((ex, idx) => ({ ...ex, position: getSelectedPositionLabel(idx) }))

  // 드래그 앤 드롭 순서 변경 (WorkoutEditor 와 동일한 방식)
  const handleReorderSelectedExercise = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    setTempSelectedExercises((prev) => {
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= prev.length || toIndex >= prev.length) {
        return prev
      }
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return reassignSelectedPositions(next)
    })
  }

  const resolveReorderTargetIndex = (fromIndex: number, insertIndex: number): number => {
    let targetIndex = insertIndex
    if (fromIndex < insertIndex) targetIndex -= 1
    return targetIndex
  }

  const handleSelectedRowDragStart = (
    event: React.DragEvent<HTMLTableRowElement>,
    index: number
  ) => {
    const target = event.target as HTMLElement | null
    if (target?.closest('[data-row-drag-disabled]')) {
      event.preventDefault()
      return
    }
    setDraggedRowIndex(index)
    setDropInsertIndex(null)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }

  const handleSelectedRowDragOverInsert = (
    event: React.DragEvent<HTMLTableRowElement>,
    insertIndex: number
  ) => {
    if (draggedRowIndex === null) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropInsertIndex(insertIndex)
  }

  const handleSelectedRowDropAtInsert = (
    event: React.DragEvent<HTMLTableRowElement>,
    insertIndex: number
  ) => {
    event.preventDefault()
    if (draggedRowIndex === null) {
      setDropInsertIndex(null)
      return
    }
    const targetIndex = resolveReorderTargetIndex(draggedRowIndex, insertIndex)
    if (draggedRowIndex !== targetIndex) {
      handleReorderSelectedExercise(draggedRowIndex, targetIndex)
    }
    setDraggedRowIndex(null)
    setDropInsertIndex(null)
  }

  const handleSelectedRowDragEnd = () => {
    setDraggedRowIndex(null)
    setDropInsertIndex(null)
  }

  const renderSelectedDropSlot = (insertIndex: number) => (
    <ShadcnTableRow
      key={`selected-drop-slot-${insertIndex}`}
      className="border-b-0 hover:bg-transparent"
      onDragOver={(event) => handleSelectedRowDragOverInsert(event, insertIndex)}
      onDrop={(event) => handleSelectedRowDropAtInsert(event, insertIndex)}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return
        setDropInsertIndex((prev) => (prev === insertIndex ? null : prev))
      }}
    >
      <ShadcnTableCell
        colSpan={3}
        className={cn(
          'p-0 border-b-0 transition-all',
          dropInsertIndex === insertIndex && draggedRowIndex !== null
            ? 'h-3 bg-primary/80'
            : draggedRowIndex !== null
              ? 'h-2 bg-primary/15'
              : 'h-0'
        )}
      />
    </ShadcnTableRow>
  )

  // 위치 변경 핸들러
  const handlePositionChange = (exerciseId: string, newPosition: string) => {
    setTempSelectedExercises(prev =>
      prev.map(ex =>
        ex.id === exerciseId
          ? { ...ex, position: newPosition }
          : ex
      )
    )
  }

  // DataGrid에서 사용할 운동 목록
  // 표시할 운동 목록 (검색 결과 또는 전체 목록) - 타입 매핑, 이미 선택된 운동도 표시
  const displayExercises: Exercise[] = useMemo(() => {
    // allExercises가 있으면 사용, 없으면 searchResults 사용
    const exercisesToUse = allExercises.length > 0 ? allExercises :
      (Array.isArray(searchResults?.exercises)
        ? searchResults.exercises.map((exercise: any) => ({
          id: exercise.id,
          originalExerciseId: exercise.id, // displayExercises의 id는 실제 운동 ID이므로 originalExerciseId로도 설정
          name_ko: exercise.name_ko,
          name_en: exercise.name_en,
          level: exercise.level,
          target_muscles: exercise.target_muscles,
          characteristics: exercise.characteristics,
          equipment: exercise.equipment,
          purpose: exercise.purpose,
          duration: exercise.duration || 1,
          video_url: exercise.video_url,
          thumbnail_url: exercise.thumbnail_url,
          video_title: exercise.video_title,
          video_duration: exercise.video_duration,
          video_start_time: exercise.video_start_time,
          video_end_time: exercise.video_end_time,
          video_loop_count: exercise.video_loop_count,
          is_active: exercise.is_active,
          major_category: exercise.major_category,
          updated_at: exercise.updated_at
        }))
        : [])

    // allExercises도 originalExerciseId 설정 (없으면 id를 사용)
    const mappedExercises = exercisesToUse.map(ex => ({
      ...ex,
      originalExerciseId: ex.originalExerciseId || ex.id // originalExerciseId가 없으면 id를 사용
    }))

    // video_url(영상 ID)가 있는 운동만 표시
    const videoOnlyExercises = mappedExercises.filter(ex => String(ex.video_url || '').trim() !== '')

    // 1단계: 검색 조건(appliedSearchKeyword)에 따른 필터링
    let filteredResults = videoOnlyExercises

    if (appliedSearchKeyword) {
      const keyword = appliedSearchKeyword.toLowerCase().trim()
      if (keyword) {
        if (!searchType || searchType === '') {
          // 전체 검색
          filteredResults = filteredResults.filter(ex => {
            const levelLabel = ex.level === 'beginner' ? '초급' : ex.level === 'intermediate' ? '중급' : '고급'
            return (
              ex.name_ko?.toLowerCase().includes(keyword) ||
              ex.name_en?.toLowerCase().includes(keyword) ||
              ex.level?.toLowerCase().includes(keyword) ||
              levelLabel?.toLowerCase().includes(keyword) ||
              ex.target_muscles?.toLowerCase().includes(keyword) ||
              ex.characteristics?.toLowerCase().includes(keyword) ||
              ex.equipment?.toLowerCase().includes(keyword) ||
              ex.purpose?.toLowerCase().includes(keyword)
            )
          })
        } else {
          // 특정 컬럼 검색
          filteredResults = filteredResults.filter(ex => {
            switch (searchType) {
              case 'name_ko': return ex.name_ko?.toLowerCase().includes(keyword)
              case 'name_en': return ex.name_en?.toLowerCase().includes(keyword)
              case 'target_muscles': return ex.target_muscles?.toLowerCase().includes(keyword)
              case 'characteristics': return ex.characteristics?.toLowerCase().includes(keyword)
              case 'equipment': return ex.equipment?.toLowerCase().includes(keyword)
              case 'purpose': return ex.purpose?.toLowerCase().includes(keyword)
              default: return true
            }
          })
        }
      }
    }

    // 2단계: 1차 결과 내 필터링 (Client-side real-time filter 1)
    if (filterKeyword1.trim()) {
      const filterLower = filterKeyword1.toLowerCase().trim()
      filteredResults = filteredResults.filter(ex => {
        const levelLabel = ex.level === 'beginner' ? '초급' : ex.level === 'intermediate' ? '중급' : '고급'
        return (
          ex.name_ko?.toLowerCase().includes(filterLower) ||
          ex.name_en?.toLowerCase().includes(filterLower) ||
          ex.target_muscles?.toLowerCase().includes(filterLower) ||
          ex.characteristics?.toLowerCase().includes(filterLower) ||
          ex.equipment?.toLowerCase().includes(filterLower) ||
          ex.purpose?.toLowerCase().includes(filterLower) ||
          levelLabel.includes(filterLower)
        )
      })
    }

    // 3단계: 2차 결과 내 필터링 (Client-side real-time filter 2)
    if (filterKeyword2.trim()) {
      const filterLower = filterKeyword2.toLowerCase().trim()
      filteredResults = filteredResults.filter(ex => {
        const levelLabel = ex.level === 'beginner' ? '초급' : ex.level === 'intermediate' ? '중급' : '고급'
        return (
          ex.name_ko?.toLowerCase().includes(filterLower) ||
          ex.name_en?.toLowerCase().includes(filterLower) ||
          ex.target_muscles?.toLowerCase().includes(filterLower) ||
          ex.characteristics?.toLowerCase().includes(filterLower) ||
          ex.equipment?.toLowerCase().includes(filterLower) ||
          ex.purpose?.toLowerCase().includes(filterLower) ||
          levelLabel.includes(filterLower)
        )
      })
    }

    if (showFavoritesOnly) {
      filteredResults = filteredResults.filter(ex => isFavorite(String(ex.id)))
    }

    return filteredResults
  }, [allExercises, searchResults?.exercises, appliedSearchKeyword, searchType, filterKeyword1, filterKeyword2, showFavoritesOnly, isFavorite])

  // 중복 데이터 체크 함수
  const isDuplicate = (exercise: Exercise) => {
    if (!exercise) return false
    const newExerciseId = String(exercise.originalExerciseId || exercise.id)
    return tempSelectedExercises.some(existingEx => {
      const existingExerciseId = String(existingEx.originalExerciseId || existingEx.id)
      return newExerciseId === existingExerciseId || String(existingEx.id) === newExerciseId || newExerciseId === String(existingEx.id)
    }) || parentSelectedExercises.some(existingEx => {
      const existingExerciseId = String(existingEx.originalExerciseId || existingEx.id)
      return newExerciseId === existingExerciseId || String(exercise.id) === existingExerciseId || newExerciseId === String(existingEx.id)
    })
  }

  const handleCheckboxChange = (exerciseId: string, checked: boolean) => {
    const idStr = String(exerciseId)
    const exercise = displayExercises.find(ex => String(ex.id) === idStr)
    if (checked) {
      if (exercise && isDuplicate(exercise)) {
        setPendingRowId(idStr)
        if (exercise) {
          setSelectedRowSnapshots(prev => ({ ...prev, [idStr]: exercise }))
        }
        setDuplicateConfirmOpen(true)
      } else {
        if (exercise) {
          setSelectedRowSnapshots(prev => ({ ...prev, [idStr]: exercise }))
        }
        setSelectedRows(prev => [...prev, idStr])
      }
    } else {
      setSelectedRows(prev => prev.filter(id => String(id) !== idStr))
      setSelectedRowSnapshots(prev => {
        if (!(idStr in prev)) {
          return prev
        }
        const next = { ...prev }
        delete next[idStr]
        return next
      })
    }
  }

  const isSelected = (exerciseId: string) => selectedExercise?.id === exerciseId
  return (
    <TooltipProvider>
      <ShadcnDialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
        <ShadcnDialogContent className="max-w-[80vw] w-[1200px] h-[85vh] max-h-[calc(100vh-80px)] p-0 flex flex-col gap-0 overflow-hidden bg-background">
          <ShadcnDialogHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 shrink-0 border-[#343637] dark:border-[#6b7280]">
            <ShadcnDialogTitle className="text-lg font-bold flex items-center gap-2 leading-none">
              <Plus className="h-5 w-5 text-primary" />
              운동 선택
            </ShadcnDialogTitle>
          </ShadcnDialogHeader>

          {isModalLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-2 text-muted-foreground">
                <RefreshCcw className="h-6 w-6 animate-spin" aria-hidden="true" />
                <span className="text-sm" role="status" aria-live="polite">데이터 로딩 중...</span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* 좌측 영역 - 72% */}
            <div className="w-[72%] p-4 flex flex-col min-h-0 overflow-hidden border-r border-[#343637] dark:border-[#6b7280] bg-muted/30">
              <Card className="h-full flex flex-col shadow-md overflow-hidden">
                <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 shrink-0 border-[#343637] dark:border-[#6b7280]">
                  <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
                    <List className="h-5 w-5 text-primary" />
                    운동 목록 ({displayExercises.length}개)
                  </CardTitle>
                </CardHeader>

                <CardContent className="flex-1 min-h-0 flex flex-col gap-[3px] p-4 overflow-hidden">
                  {/* 필터링 영역 */}
                  <div className="flex flex-nowrap items-center gap-1.5 mb-4 shrink-0">
                    <div className="w-[140px] shrink-0">
                      <ShadcnSelect
                        value={selectedCategory || "all"}
                        onValueChange={(val) => setSelectedCategory(val === "all" ? "" : val)}
                        disabled={categorySelectDisabled}
                        labels={Object.fromEntries([
                          ['all', '전체'],
                          ...majorCategories.map(c => [c.major_category, c.major_category_name || c.major_category])
                        ])}
                      >
                        <ShadcnSelectTrigger className="h-9">
                          <ShadcnSelectValue placeholder="운동구분" />
                        </ShadcnSelectTrigger>
                        <ShadcnSelectContent>
                          <ShadcnSelectItem value="all">전체</ShadcnSelectItem>
                          {majorCategories
                            .filter(category => category.major_category !== 'all')
                            .map((category) => (
                              <ShadcnSelectItem key={category.major_category} value={category.major_category}>
                                {category.major_category_name}
                              </ShadcnSelectItem>
                            ))}
                        </ShadcnSelectContent>
                      </ShadcnSelect>
                    </div>

                    <div className="w-[115px] shrink-0">
                      <ShadcnSelect
                        value={searchType || "all"}
                        onValueChange={(val) => setSearchType(val === "all" ? "" : val)}
                        labels={{
                          all: '전체',
                          name_en: '운동명 (영문)',
                          name_ko: '운동명 (한글)',
                          target_muscles: '자극 부위',
                          characteristics: '특징 및 효과',
                          equipment: '필요 기구',
                          purpose: '운동목적'
                        }}
                      >
                        <ShadcnSelectTrigger className="h-9">
                          <ShadcnSelectValue placeholder="검색구분" />
                        </ShadcnSelectTrigger>
                        <ShadcnSelectContent>
                          <ShadcnSelectItem value="all">전체</ShadcnSelectItem>
                          <ShadcnSelectItem value="name_en">운동명 (영문)</ShadcnSelectItem>
                          <ShadcnSelectItem value="name_ko">운동명 (한글)</ShadcnSelectItem>
                          <ShadcnSelectItem value="target_muscles">자극 부위</ShadcnSelectItem>
                          <ShadcnSelectItem value="characteristics">특징 및 효과</ShadcnSelectItem>
                          <ShadcnSelectItem value="equipment">필요 기구</ShadcnSelectItem>
                          <ShadcnSelectItem value="purpose">운동목적</ShadcnSelectItem>
                        </ShadcnSelectContent>
                      </ShadcnSelect>
                    </div>

                    <div className="relative flex-1 min-w-[72px]">
                      <Input
                        placeholder="검색어"
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="bg-card pr-8 h-9"
                      />
                      {searchKeyword && (
                        <button
                          onClick={() => {
                            clearSearchTableSelection()
                            setSearchKeyword('')
                            setAppliedSearchKeyword('')
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <Button onClick={handleSearch} disabled={searchLoading} className="h-9 gap-1.5 px-2.5 shrink-0">
                      <Search className="w-4 h-4" />
                      검색
                    </Button>

                    <div className="flex items-center gap-1.5 h-9 px-1.5 border rounded-md bg-card shrink-0">
                      <Checkbox
                        id="favorite-filter"
                        checked={showFavoritesOnly}
                        onCheckedChange={(checked) => setShowFavoritesOnly(!!checked)}
                      />
                      <Label htmlFor="favorite-filter" className="text-xs cursor-pointer whitespace-nowrap">
                        즐겨찾기
                      </Label>
                    </div>

                    <div className="w-px h-6 bg-border shrink-0" />

                    <div className="relative w-[100px] shrink-0">
                      <Input
                        placeholder="1차 검색"
                        value={filterKeyword1}
                        onChange={(e) => setFilterKeyword1(e.target.value)}
                        className="bg-card pr-8 h-9 text-xs"
                        disabled={!appliedSearchKeyword}
                      />
                      {filterKeyword1 && (
                        <button
                          onClick={() => setFilterKeyword1('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="relative w-[100px] shrink-0">
                      <Input
                        placeholder="2차 검색"
                        value={filterKeyword2}
                        onChange={(e) => setFilterKeyword2(e.target.value)}
                        className="bg-card pr-8 h-9 text-xs"
                        disabled={!filterKeyword1}
                      />
                      {filterKeyword2 && (
                        <button
                          onClick={() => setFilterKeyword2('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() => {
                        clearSearchTableSelection()
                        setSearchKeyword('')
                        setAppliedSearchKeyword('')
                        setFilterKeyword1('')
                        setFilterKeyword2('')
                        setSearchType('')
                        setShowFavoritesOnly(false)
                      }}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* 운동 목록 Table Area */}
                  <div className="flex-1 min-h-0 border rounded-md overflow-hidden flex flex-col bg-card">
                    <div className="flex-1 overflow-auto relative">
                      <ShadcnTable className="w-full table-fixed border-separate border-spacing-0">
                        <ShadcnTableHeader className="sticky top-0 z-20">
                          <ShadcnTableRow className="hover:bg-transparent">
                            <ShadcnTableHead className="h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] relative select-none" style={{ width: exerciseTableColWidths.select }}>
                              선택
                              <div
                                role="separator"
                                aria-orientation="vertical"
                                aria-label="컬럼 넓이 조절"
                                tabIndex={0}
                                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
                                onMouseDown={(e) => handleResizeStart('select', e)}
                              />
                            </ShadcnTableHead>
                            <ShadcnTableHead className="h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] relative select-none" style={{ width: exerciseTableColWidths.favorite }}>
                              즐겨찾기
                              <div
                                role="separator"
                                aria-orientation="vertical"
                                aria-label="컬럼 넓이 조절"
                                tabIndex={0}
                                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
                                onMouseDown={(e) => handleResizeStart('favorite', e)}
                              />
                            </ShadcnTableHead>
                            <ShadcnTableHead className="h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] relative select-none" style={{ width: exerciseTableColWidths.badge }}>
                              <div
                                role="separator"
                                aria-orientation="vertical"
                                aria-label="컬럼 넓이 조절"
                                tabIndex={0}
                                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
                                onMouseDown={(e) => handleResizeStart('badge', e)}
                              />
                            </ShadcnTableHead>
                            <ShadcnTableHead className="h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] relative select-none" style={{ width: exerciseTableColWidths.name_en }}>
                              운동명(영문)
                              <div
                                role="separator"
                                aria-orientation="vertical"
                                aria-label="컬럼 넓이 조절"
                                tabIndex={0}
                                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
                                onMouseDown={(e) => handleResizeStart('name_en', e)}
                              />
                            </ShadcnTableHead>
                            <ShadcnTableHead className="h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] relative select-none" style={{ width: exerciseTableColWidths.name_ko }}>
                              운동명(한글)
                              <div
                                role="separator"
                                aria-orientation="vertical"
                                aria-label="컬럼 넓이 조절"
                                tabIndex={0}
                                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
                                onMouseDown={(e) => handleResizeStart('name_ko', e)}
                              />
                            </ShadcnTableHead>
                            <ShadcnTableHead className="h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] relative select-none" style={{ width: exerciseTableColWidths.target_muscles }}>
                              자극부위
                              <div
                                role="separator"
                                aria-orientation="vertical"
                                aria-label="컬럼 넓이 조절"
                                tabIndex={0}
                                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
                                onMouseDown={(e) => handleResizeStart('target_muscles', e)}
                              />
                            </ShadcnTableHead>
                            <ShadcnTableHead className="h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] relative select-none" style={{ width: exerciseTableColWidths.characteristics }}>
                              특징 및 효과
                              <div
                                role="separator"
                                aria-orientation="vertical"
                                aria-label="컬럼 넓이 조절"
                                tabIndex={0}
                                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
                                onMouseDown={(e) => handleResizeStart('characteristics', e)}
                              />
                            </ShadcnTableHead>
                            <ShadcnTableHead className="h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] relative select-none" style={{ width: exerciseTableColWidths.equipment, minWidth: 40 }}>
                              필요기구
                              <div
                                role="separator"
                                aria-orientation="vertical"
                                aria-label="컬럼 넓이 조절"
                                tabIndex={0}
                                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
                                onMouseDown={(e) => handleResizeStart('equipment', e)}
                              />
                            </ShadcnTableHead>
                          </ShadcnTableRow>
                        </ShadcnTableHeader>
                        <ShadcnTableBody>
                          {displayExercises.length > 0 ? (
                            displayExercises.map((exercise) => {
                              const isChecked = selectedRows.includes(String(exercise.id));
                              const isItemSelected = selectedExercise?.id === exercise.id;

                              // NEW 뱃지 판단
                              const isNew = (() => {
                                if (!exercise.updated_at) return false;
                                const updatedDate = new Date(exercise.updated_at);
                                const today = new Date();
                                return (today.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24) <= 7;
                              })();

                              return (
                                <ShadcnTableRow
                                  key={exercise.id}
                                  className={cn(
                                    "h-[35px] group cursor-pointer transition-colors bg-[#f9fafb] dark:bg-[#1d1d1d]",
                                    "hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30",
                                    isItemSelected && "!bg-primary/20"
                                  )}
                                  onClick={() => handleRowSelection(exercise)}
                                >
                                  <ShadcnTableCell className={cn(
                                    "p-0 text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors",
                                    isItemSelected && "bg-primary/20"
                                  )}>
                                    <div className="flex items-center justify-center h-full" onClick={(e) => e.stopPropagation()}>
                                      <Checkbox
                                        checked={isChecked}
                                        onCheckedChange={(checked) => handleCheckboxChange(exercise.id, !!checked)}
                                      />
                                    </div>
                                  </ShadcnTableCell>
                                  <ShadcnTableCell className={cn(
                                    "p-0 text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors",
                                    isItemSelected && "bg-primary/20"
                                  )}>
                                    <div className="flex items-center justify-center h-full" onClick={(e) => e.stopPropagation()}>
                                      <ExerciseFavoriteStar
                                        isFavorite={isFavorite(String(exercise.id))}
                                        disabled={favoriteToggleLoadingId === String(exercise.id)}
                                        onToggle={() => toggleFavorite(String(exercise.id))}
                                      />
                                    </div>
                                  </ShadcnTableCell>
                                  <ShadcnTableCell className={cn(
                                    "p-0 text-center border-r border-[#343637] dark:border-[#6b7280] whitespace-nowrap group-hover:text-inherit transition-colors",
                                    isItemSelected && "bg-primary/20"
                                  )}>
                                    {isNew && (
                                      <Badge variant="destructive" className="h-5 rounded-sm px-1 text-[10px] animate-pulse">NEW</Badge>
                                    )}
                                  </ShadcnTableCell>
                                  <ShadcnTableCell className={cn(
                                    "p-2 border-r border-[#343637] dark:border-[#6b7280] text-xs font-medium group-hover:text-inherit transition-colors",
                                    isItemSelected && "bg-primary/20"
                                  )}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="truncate">{exercise.name_en}</div>
                                      </TooltipTrigger>
                                      <TooltipContent side="right" className="bg-popover p-0 border-none shadow-xl">
                                        {createExerciseTooltipContent(exercise)}
                                      </TooltipContent>
                                    </Tooltip>
                                  </ShadcnTableCell>
                                  <ShadcnTableCell className={cn(
                                    "p-2 border-r border-[#343637] dark:border-[#6b7280] text-xs font-medium group-hover:text-inherit transition-colors",
                                    isItemSelected && "bg-primary/20"
                                  )}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="truncate">{exercise.name_ko}</div>
                                      </TooltipTrigger>
                                      <TooltipContent side="right" className="bg-popover p-0 border-none shadow-xl">
                                        {createExerciseTooltipContent(exercise)}
                                      </TooltipContent>
                                    </Tooltip>
                                  </ShadcnTableCell>
                                  <ShadcnTableCell className={cn(
                                    "p-2 border-r border-[#343637] dark:border-[#6b7280] text-center text-xs truncate group-hover:text-inherit transition-colors",
                                    isItemSelected && "bg-primary/20"
                                  )}>{exercise.target_muscles}</ShadcnTableCell>
                                  <ShadcnTableCell className={cn(
                                    "p-2 border-r border-[#343637] dark:border-[#6b7280] text-xs truncate group-hover:text-inherit transition-colors",
                                    isItemSelected && "bg-primary/20"
                                  )}>{exercise.characteristics || '-'}</ShadcnTableCell>
                                  <ShadcnTableCell className={cn(
                                    "p-2 border-r border-[#343637] dark:border-[#6b7280] text-center text-xs truncate group-hover:text-inherit transition-colors",
                                    isItemSelected && "bg-primary/20"
                                  )}>{exercise.equipment || '없음'}</ShadcnTableCell>

                                </ShadcnTableRow>
                              );
                            })
                          ) : (
                            <ShadcnTableRow>
                              <ShadcnTableCell colSpan={9} className="h-24 text-center text-muted-foreground text-xs">
                                {searchLoading ? "데이터를 로딩 중입니다..." : "검색 결과가 없습니다."}
                              </ShadcnTableCell>
                            </ShadcnTableRow>
                          )}
                        </ShadcnTableBody>
                      </ShadcnTable>
                    </div>
                  </div>

                  {/* 하단: 선택추가 버튼 */}
                  <div className="shrink-0 pt-4">
                    <Button
                      variant="default"
                      onClick={handleAddExercise}
                      disabled={selectedRows.length === 0}
                      className="w-full h-12 text-lg font-bold gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      선택추가 ({selectedRows.length}개)
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 우측 영역 - 28% */}
            <div className="w-[28%] p-4 flex flex-col min-h-0 overflow-hidden bg-muted/30">
              {/* 영상 미리보기 (45%) */}
              <Card className="h-[45%] mb-4 flex flex-col min-h-0 shadow-md border-[#343637] dark:border-[#6b7280]">
                <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 shrink-0 border-[#343637] dark:border-[#6b7280]">
                  <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
                    <VideoIcon className="w-5 h-5" />
                    영상 미리보기
                  </CardTitle>
                  {rightSelectedExercise?.video_url && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 text-primary"
                        onClick={() => {
                          if (vimeoPlayerRef.current && isPlayerReady) {
                            if (isPlaying) {
                              vimeoPlayerRef.current.pause()
                            } else {
                              vimeoPlayerRef.current.play()
                            }
                          }
                        }}
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 text-primary"
                        onClick={async () => {
                          if (vimeoPlayerRef.current && isPlayerReady) {
                            const startTime = rightSelectedExercise?.video_start_time || 0
                            await vimeoPlayerRef.current.setCurrentTime(startTime)
                            vimeoPlayerRef.current.play()
                          }
                        }}
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="flex-1 bg-black overflow-hidden flex flex-col items-center justify-center p-0">
                  {rightSelectedExercise?.video_url ? (
                    (() => {
                      const videoUrl = rightSelectedExercise?.video_url?.trim() || ''
                      const vimeoMatch = videoUrl.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)?(\d+)/)
                      const videoId = vimeoMatch ? vimeoMatch[1] : null

                      if (videoId) {
                        return <VimeoFitIframe videoId={videoId} iframeRef={vimeoIframeRef} className="w-full h-full" />
                      }

                      return (
                        <div className="flex flex-col items-center text-white/50 gap-2">
                          <VideoIcon className="w-12 h-12" />
                          <p className="text-sm">유효한 Vimeo URL이 아닙니다</p>
                        </div>
                      )
                    })()
                  ) : (
                    <div className="flex flex-col items-center text-white/50 gap-2">
                      <VideoIcon className="w-12 h-12" />
                      <p className="text-sm text-center px-4">목록에서 운동을 선택하면<br />영상이 여기에 표시됩니다</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 선택된 운동 목록 (60%) */}
              <Card className="flex-1 flex flex-col min-h-0 shadow-md border-[#343637] dark:border-[#6b7280]">
                <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 shrink-0 border-[#343637] dark:border-[#6b7280]">
                  <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
                    <ListChecks className="h-5 w-5 text-primary" />
                    선택된 운동 목록 ({tempSelectedExercises.length}개)
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 flex flex-col p-0 overflow-hidden">
                  <div className="flex-1 overflow-auto scrollbar-hide bg-[#f9fafb] dark:bg-[#1d1d1d]">
                    <ShadcnTable className="w-full table-fixed border-separate border-spacing-0">
                      <ShadcnTableHeader className="sticky top-0 z-20">
                        <ShadcnTableRow className="hover:bg-transparent">
                          <ShadcnTableHead className="w-[60px] h-[45px] px-0 text-xs font-bold text-center border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">순서</ShadcnTableHead>
                          <ShadcnTableHead className="h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">운동명</ShadcnTableHead>
                          <ShadcnTableHead className="w-[50px] h-[45px] px-0 text-xs font-bold text-center border-b-0 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">삭제</ShadcnTableHead>
                        </ShadcnTableRow>
                      </ShadcnTableHeader>
                      <ShadcnTableBody>
                        {tempSelectedExercises.length > 0 ? (
                          <>
                            {renderSelectedDropSlot(0)}
                            {tempSelectedExercises.map((exercise, index) => {
                              const isItemSelected = rightSelectedExercise?.id === exercise.id;
                              return (
                                <React.Fragment key={exercise.uniqueKey || exercise.id}>
                                <ShadcnTableRow
                                  draggable
                                  onDragStart={(event) => handleSelectedRowDragStart(event, index)}
                                  onDragEnd={handleSelectedRowDragEnd}
                                  className={cn(
                                    "h-[35px] group transition-colors bg-[#f9fafb] dark:bg-[#1d1d1d] cursor-grab active:cursor-grabbing",
                                    isItemSelected
                                      ? "bg-primary/10 text-blue-600 dark:text-yellow-400"
                                      : "hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30",
                                    draggedRowIndex === index && "opacity-40"
                                  )}
                                  onClick={() => handleSelectedExerciseRowSelection(exercise)}
                                >
                                  <ShadcnTableCell className="p-0 text-center border-r border-[#343637] dark:border-[#6b7280] text-xs group-hover:text-inherit transition-colors">
                                    <span className="tabular-nums">{getSelectedPositionLabel(index)}</span>
                                  </ShadcnTableCell>
                                  <ShadcnTableCell className="p-2 border-r border-[#343637] dark:border-[#6b7280]">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="truncate text-xs font-medium">
                                          {exercise.name_ko}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="left" className="bg-popover p-0 border-none shadow-xl">
                                        {createExerciseTooltipContent(exercise)}
                                      </TooltipContent>
                                    </Tooltip>
                                  </ShadcnTableCell>
                                  <ShadcnTableCell data-row-drag-disabled className="p-0 text-center">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveExercise(exercise.id);
                                      }}
                                    >
                                      <Trash className="w-4 h-4" />
                                    </Button>
                                  </ShadcnTableCell>
                                </ShadcnTableRow>
                                {renderSelectedDropSlot(index + 1)}
                                </React.Fragment>
                              );
                            })}
                          </>
                        ) : (
                          <ShadcnTableRow className="bg-[#f9fafb] dark:bg-[#1d1d1d]">
                            <ShadcnTableCell colSpan={3} className="h-24 text-center text-muted-foreground text-xs">
                              선택된 운동이 없습니다
                            </ShadcnTableCell>
                          </ShadcnTableRow>
                        )}
                      </ShadcnTableBody>
                    </ShadcnTable>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          )}

          <ShadcnDialogFooter className="p-4 border-t flex flex-row items-center justify-end gap-3 bg-muted/20 shrink-0">
            <Button variant="outline" size="lg" onClick={handleCancel} className="px-10 h-11">
              취소
            </Button>
            <Button
              variant="default"
              size="lg"
              onClick={handleConfirm}
              disabled={tempSelectedExercises.length === 0}
              className="px-10 h-11 bg-primary text-primary-foreground font-bold"
            >
              확인 ({tempSelectedExercises.length}개 선택)
            </Button>
          </ShadcnDialogFooter>
        </ShadcnDialogContent >
      </ShadcnDialog >

      {/* 중복 확인 다이얼로그 */}
      < ShadcnDialog open={duplicateConfirmOpen} onOpenChange={setDuplicateConfirmOpen} >
        <ShadcnDialogContent className="max-w-md">
          <ShadcnDialogHeader>
            <ShadcnDialogTitle>중복된 운동 확인</ShadcnDialogTitle>
          </ShadcnDialogHeader>
          <div className="py-2">
            <p className="text-sm mb-4">
              {pendingRowId
                ? '중복된 운동이 있습니다. 그래도 선택하시겠습니까?'
                : pendingRowIds.length > 0
                  ? '중복된 운동이 있습니다. 그래도 선택하시겠습니까?'
                  : '중복된 운동이 있습니다. 그래도 추가하시겠습니까?'}
            </p>
            <div className="max-h-40 overflow-auto border rounded-md p-2 bg-muted/30">
              {pendingRowId ? (
                (() => {
                  const exercise = displayExercises.find(ex => ex.id === pendingRowId)
                  return exercise ? (
                    <div className="text-sm py-1 border-b last:border-0">• {exercise.name_ko} ({exercise.name_en})</div>
                  ) : null
                })()
              ) : pendingRowIds.length > 0 ? (
                pendingRowIds.map((id, index) => {
                  const exercise = displayExercises.find(ex => ex.id === id)
                  return exercise ? (
                    <div key={index} className="text-sm py-1 border-b last:border-0">• {exercise.name_ko} ({exercise.name_en})</div>
                  ) : null
                })
              ) : (
                pendingExercises.filter(ex => {
                  const newExerciseId = ex.originalExerciseId || ex.id
                  const isDuplicateInTemp = tempSelectedExercises.some(existingEx => {
                    const existingExerciseId = existingEx.originalExerciseId || existingEx.id
                    return existingExerciseId === newExerciseId || existingEx.id === newExerciseId || newExerciseId === existingEx.id
                  })
                  const isDuplicateInParent = parentSelectedExercises.some(existingEx => {
                    const existingExerciseId = existingEx.originalExerciseId || existingEx.id
                    return existingExerciseId === newExerciseId || existingEx.id === newExerciseId || newExerciseId === existingEx.id
                  })
                  return isDuplicateInTemp || isDuplicateInParent
                }).map((ex, index) => (
                  <div key={index} className="text-sm py-1 border-b last:border-0">• {ex.name_ko} ({ex.name_en})</div>
                ))
              )}
            </div>
          </div>
          <ShadcnDialogFooter className="gap-2">
            <Button variant="outline" onClick={handleDuplicateCancel}>취소</Button>
            <Button variant="default" onClick={handleDuplicateConfirm}>
              {pendingRowId || pendingRowIds.length > 0 ? '선택' : '추가'}
            </Button>
          </ShadcnDialogFooter>
        </ShadcnDialogContent>
      </ShadcnDialog >
    </TooltipProvider >
  )
}

export default ExerciseSelectionModal