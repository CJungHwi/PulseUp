/**
 * 페이지 요약 — 통합 메인 운동 (`/Totalexercises`)
 *
 * 기능: 이력(일반/관리자)·서킷·AMRAP·EMOM 편집, Vimeo 미리보기, 저장·삭제.
 *
 * 호출/연동:
 * - `GET` `workout-setting`, `workout-categories`, `workout-history-master`, `workout-exercises-summary`, `workout-history-detail` 등
 * - 저장: `saveCircuit` → `POST .../HyberStrengthCircuitSave`; `saveAMRAP` → `POST .../Time-StructuredAMRAP`; `saveEMOM` → `POST .../Time-StructuredEMOM`
 * - `DELETE /workout-categories/workout-history/:id`
 * - DB/SP는 `packages/api-server` 운동 저장 라우트 참조.
 *
 * 관련 컴포넌트: `WorkoutHistory`, `WorkoutEditor`, `ExerciseSelectionModal`, `saveWorkout` 모듈.
 *
 * 흐름: 이력 선택 → 에디터에서 패널 구성 → 유형별 저장 함수 → API.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { isAxiosError } from 'axios'
import dayjs, { Dayjs } from 'dayjs'
import 'dayjs/locale/ko'
import api from '../../../services/api'
import Player from '@vimeo/player'
import { useSnackbar } from '@/contexts/SnackbarContext'
import { useAppSelector } from '../../../hooks/redux'

// Components
import { WorkoutHistory } from './components/WorkoutHistory'
import { WorkoutEditor } from './components/WorkoutEditor'
import ExerciseSelectionModal from '../../../components/ExerciseSelectionModal/ExerciseSelectionModal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

// Types & Logic
import { Exercise, PanelRow, WorkoutMaster, WorkoutTimeSummary } from './types'
import { saveCircuit, saveAMRAP, saveEMOM, getMainCircuitTotalSecondsFromPanels, getEmomTimeBreakdownFromPanels } from './saveWorkout'

const resolveWorkoutSaveErrorMessage = (error: unknown): string => {
  if (isAxiosError(error)) {
    const d = error.response?.data as {
      error?: string
      message?: string
      details?: { field?: string; message?: string }[]
    }
    if (d?.details?.length) {
      const line = d.details
        .map((x) => (x.field ? `${x.field}: ${x.message ?? ''}` : x.message))
        .filter(Boolean)
        .join('; ')
      if (line) return line
    }
    if (typeof d?.error === 'string' && d.error) return d.error
    if (typeof d?.message === 'string' && d.message) return d.message
    if (error.message) return error.message
  }
  if (error instanceof Error) return error.message
  return '저장 중 오류가 발생했습니다.'
}

export default function Totalexercises() {
  const { showSnackbar } = useSnackbar()
  const { user } = useAppSelector((state) => state.auth)
  const isUserAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  
  const toast = useMemo(() => {
    return {
      success: (msg: string) => showSnackbar({ message: msg, severity: 'success' }),
      error: (msg: string) => showSnackbar({ message: msg, severity: 'error' }),
      warning: (msg: string) => showSnackbar({ message: msg, severity: 'warning' })
    }
  }, [showSnackbar])

  // --- Left Panel State (History) ---
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(dayjs())
  const [memoFilter, setMemoFilter] = useState('')
  const [workoutMasters, setWorkoutMasters] = useState<WorkoutMaster[]>([])
  const [adminWorkoutMasters, setAdminWorkoutMasters] = useState<WorkoutMaster[]>([])
  const [selectedMasterId, setSelectedMasterId] = useState<string | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [isLoadingAdminHistory, setIsLoadingAdminHistory] = useState(false)
  const [historyResetNonce, setHistoryResetNonce] = useState(0)

  // --- Right Panel State (Editor) ---
  const [rightSelectedDate, setRightSelectedDate] = useState<Dayjs | null>(dayjs())
  const [rightExerciseType, setRightExerciseType] = useState('운동선택')
  const [isAdmin, setIsAdmin] = useState(false)
  const [circuitType, setCircuitType] = useState('stress')
  const [memo, setMemo] = useState('')
  const [activeTab, setActiveTab] = useState('main')
  const [currentEditingMasterId, setCurrentEditingMasterId] = useState<string | null>(null)
  const [originalDate, setOriginalDate] = useState<string | null>(null)
  const [originalCategory, setOriginalCategory] = useState<string | null>(null)
  const [originalCircuitType, setOriginalCircuitType] = useState<string | null>(null)

  // Exercises
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [dynamicExercises, setDynamicExercises] = useState<Exercise[]>([])
  const [coolDownExercises, setCoolDownExercises] = useState<Exercise[]>([])
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)

  // Panels
  const [panelRows, setPanelRows] = useState<PanelRow[]>([])
  const [selectedPanelRowId, setSelectedPanelRowId] = useState<string | null>(null)
  const [selectedPanelRowForExercise, setSelectedPanelRowForExercise] = useState<string | null>(null)

  // Applied Info
  const [appliedDynamic, setAppliedDynamic] = useState<WorkoutMaster | null>(null)
  const [appliedCoolDown, setAppliedCoolDown] = useState<WorkoutMaster | null>(null)
  const [savedWorkoutTimeSummary, setSavedWorkoutTimeSummary] = useState<WorkoutTimeSummary | null>(null)

  // Category Info
  const [workoutCategories, setWorkoutCategories] = useState<any[]>([])

  // Workout Settings (DB에서 가져온 기본 설정값)
  const [workoutSettings, setWorkoutSettings] = useState<Record<string, any[]>>({})

  // Modal & Dialog
  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Video
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const vimeoPlayerRef = useRef<Player | null>(null)
  const vimeoIframeRef = useRef<HTMLIFrameElement | null>(null)

  // Vimeo Player 초기화 (ExerciseSelectionModal 패턴: 운동 변경 시 플레이어 재생성)
  useEffect(() => {
    const videoUrl = selectedExercise?.video_url?.trim()
    if (!videoUrl) {
      if (vimeoPlayerRef.current) {
        try { vimeoPlayerRef.current.destroy() } catch { /* ignore */ }
        vimeoPlayerRef.current = null
      }
      setIsPlayerReady(false)
      setIsPlaying(false)
      return
    }
    const vimeoMatch = videoUrl.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)?(\d+)/)
    if (!vimeoMatch) {
      setIsPlayerReady(false)
      return
    }

    if (vimeoPlayerRef.current) {
      try { vimeoPlayerRef.current.destroy() } catch { /* ignore */ }
      vimeoPlayerRef.current = null
      setIsPlayerReady(false)
      setIsPlaying(false)
    }

    let initTimer: ReturnType<typeof setTimeout> | null = null
    let retryCount = 0
    const maxRetries = 10

    const tryInitPlayer = () => {
      if (!vimeoIframeRef.current) {
        retryCount++
        if (retryCount < maxRetries) initTimer = setTimeout(tryInitPlayer, 100)
        return
      }
      try {
        const player = new Player(vimeoIframeRef.current)
        vimeoPlayerRef.current = player
        player.ready().then(() => {
          player.setMuted(true)
          setIsPlayerReady(true)
          const startTime = selectedExercise?.video_start_time || 0
          if (startTime > 0) player.setCurrentTime(startTime).catch(() => {})
          player.on('play', () => setIsPlaying(true))
          player.on('pause', () => setIsPlaying(false))
          player.on('ended', () => setIsPlaying(false))
        }).catch(() => setIsPlayerReady(false))
      } catch {
        setIsPlayerReady(false)
      }
    }
    initTimer = setTimeout(tryInitPlayer, 100)

    return () => {
      if (initTimer) clearTimeout(initTimer)
      if (vimeoPlayerRef.current) {
        try { vimeoPlayerRef.current.destroy() } catch { /* ignore */ }
        vimeoPlayerRef.current = null
      }
      setIsPlayerReady(false)
      setIsPlaying(false)
    }
  }, [selectedExercise?.video_url])

  // 구간 반복 로직
  useEffect(() => {
    if (!vimeoPlayerRef.current || !isPlayerReady || !selectedExercise) return
    const startTime = selectedExercise.video_start_time || 0
    const endTime = selectedExercise.video_end_time
    if (!endTime || endTime <= startTime) return
    const handleTimeUpdate = (data: { seconds: number }) => {
      if (data.seconds >= endTime) vimeoPlayerRef.current?.setCurrentTime(startTime).catch(() => {})
    }
    vimeoPlayerRef.current.on('timeupdate', handleTimeUpdate)
    return () => { vimeoPlayerRef.current?.off('timeupdate', handleTimeUpdate) }
  }, [selectedExercise?.video_start_time, selectedExercise?.video_end_time, isPlayerReady])

  // Layout
  const [leftWidth, setLeftWidth] = useState(25)
  const [panelWidth, setPanelWidth] = useState(25) // Middle panel width

  // Derived State
  const selectedCategory = useMemo(() => {
    return workoutCategories.find(cat =>
      cat.minor_category === rightExerciseType ||
      cat.major_category === rightExerciseType ||
      cat.major_category_name === rightExerciseType ||
      cat.id?.toString() === rightExerciseType
    )
  }, [workoutCategories, rightExerciseType])

  const majorCategory = useMemo(() => {
    if (selectedCategory?.major_category) {
      return selectedCategory.major_category
    }
    return rightExerciseType
  }, [selectedCategory, rightExerciseType])

  const isMainStressOrLoop = useMemo(
    () =>
      majorCategory === 'MAIN' &&
      (circuitType === 'stress' || circuitType === 'loop'),
    [majorCategory, circuitType],
  )

  const isWaterBreakLastRowOnly = useMemo(
    () => isMainStressOrLoop || majorCategory === 'EMOM',
    [isMainStressOrLoop, majorCategory],
  )

  // --- Initialization ---
  useEffect(() => {
    fetchCategories()
    fetchWorkoutSettings()
  }, [])

  // 관리자인 경우 자동으로 관리자 체크 활성화
  useEffect(() => {
    if (isUserAdmin && !isAdmin) {
      setIsAdmin(true)
    }
  }, [isUserAdmin, isAdmin])

  const fetchWorkoutSettings = async () => {
    try {
      const response = await api.get('/workout-categories/workout-setting')
      if (response.data.success) {
        const data = response.data.data || []
        // method_type별로 그룹화
        const grouped: Record<string, any[]> = {}
        data.forEach((item: any) => {
          const methodType = item.method_type
          if (!grouped[methodType]) {
            grouped[methodType] = []
          }
          grouped[methodType].push(item)
        })
        setWorkoutSettings(grouped)
      }
    } catch (error) {
      console.error('Fetch Workout Settings Error:', error)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await api.get('/workout-categories')
      if (response.data.success) {
        const data = response.data.data
        // 프로시저 결과인 경우 [rows, okPacket] 형태일 수 있으므로 처리
        const categories = Array.isArray(data) && data.length > 0 && Array.isArray(data[0])
          ? data[0]
          : data
        console.log('🔍 [Totalexercises] workoutCategories loaded:', categories)
        setWorkoutCategories(Array.isArray(categories) ? categories : [])
      }
    } catch (error) {
      console.error('Fetch Categories Error:', error)
    }
  }

  const mapMasterData = useCallback((data: any[]): WorkoutMaster[] => data.map((m: any) => ({
    id: m.id || m.workout_history_master_id,
    date: m.date,
    time: m.time,
    memo: m.memo,
    is_admin: m.is_admin ?? m.admin ?? m.isAdmin,
    workoutCategoriesId: m.workout_categories_id || m.workout_category_id,
    majorCategory: m.major_category,
    workoutCategoriesName: m.major_category_name || m.workout_categories_name || m.workout_category_name,
    circuitType: m.circuit_type || m.method_type,
    workoutTime: m.workout_time || m.workoutTime || m.total_workout_time
  })), [])

  const handleSearch = useCallback(async (overrideSelectedDate?: Dayjs | null) => {
    const targetDate = overrideSelectedDate ?? selectedDate
    if (!targetDate) return
    setIsLoadingHistory(true)
    try {
      const searchDate = targetDate.format('YYYY-MM')
      const response = await api.get('/workout-categories/workout-history-master', {
        params: {
          yearMonth: searchDate,
          memo: memoFilter || undefined,
          admin: '0'
        }
      })
      if (response.data.success) {
        setWorkoutMasters(mapMasterData(response.data.data || []))
      }
    } catch (error) {
      console.error('History Search Error:', error)
      toast.error('기록 조회 중 오류가 발생했습니다.')
    } finally {
      setIsLoadingHistory(false)
    }
  }, [memoFilter, selectedDate, toast, mapMasterData])

  const handleSearchAdmin = useCallback(async (overrideSelectedDate?: Dayjs | null) => {
    const targetDate = overrideSelectedDate ?? selectedDate
    if (!targetDate) return
    setIsLoadingAdminHistory(true)
    try {
      const searchDate = targetDate.format('YYYY-MM')
      const response = await api.get('/workout-categories/workout-history-master', {
        params: {
          yearMonth: searchDate,
          memo: memoFilter || undefined,
          admin: '1'
        }
      })
      if (response.data.success) {
        setAdminWorkoutMasters(mapMasterData(response.data.data || []))
      }
    } catch (error) {
      console.error('Admin History Search Error:', error)
    } finally {
      setIsLoadingAdminHistory(false)
    }
  }, [memoFilter, selectedDate, mapMasterData])

  useEffect(() => {
    handleSearch()
    handleSearchAdmin()
  }, [handleSearch, handleSearchAdmin])

  const fetchWorkoutTimeSummary = async (masterId: string) => {
    try {
      const response = await api.get(`/workout-categories/workout-exercises-summary/${masterId}`)
      if (response.data.success) {
        setSavedWorkoutTimeSummary(response.data.data)
      }
    } catch (error) {
      console.error('Time Summary Error:', error)
    }
  }

  const handleExerciseTypeChange = async (type: string) => {
    setRightExerciseType(type)
    const cat = workoutCategories.find(c =>
      c.minor_category === type ||
      c.major_category === type ||
      c.id?.toString() === type
    )
    const major = cat?.major_category || type
    const settingKey = major === 'MAIN' ? circuitType : major

    try {
      const response = await api.get(`/workout-categories/workout-setting/${settingKey}`)
      if (response.data.success) {
        const freshSettings = response.data.data || []
        if (freshSettings.length > 0) {
          setWorkoutSettings(prev => ({ ...prev, [settingKey]: freshSettings }))
          const rows: PanelRow[] = freshSettings.map((s: any, idx: number) => {
            const isAe = settingKey === 'AMRAP' || settingKey === 'EMOM'
            const wb = Number(s.water_break ?? 0)
            const r = Number(s.rest ?? 0)
            return {
              id: `${Date.now()}_${idx + 1}`,
              round: s.round,
              time: s.time,
              rest: isAe ? 0 : s.rest,
              waterBreak: isAe ? (wb > 0 ? Math.floor(wb / 60) : r) : (s.water_break ?? 0),
              type: settingKey
            }
          })
          // 기록을 불러온 상태에서도 운동선택 변경 시 DB(관리) 운동설정으로 패널 갱신
          setPanelRows(rows)
          return
        }
      }
    } catch (error) {
      console.error('Fetch workout setting for exercise type:', error)
    }
    // API 실패·빈 응답 시에도 운동선택 변경 의도에 맞게 캐시/기본값 적용 (편집 중 가드 우회)
    applyDefaults(major, circuitType, true)
  }

  const handleCircuitTypeChange = async (type: string) => {
    setCircuitType(type)
    if (majorCategory === 'MAIN') {
      try {
        const response = await api.get(`/workout-categories/workout-setting/${type}`)
        if (response.data.success) {
          const freshSettings = response.data.data || []
          if (freshSettings.length > 0) {
            setWorkoutSettings(prev => ({ ...prev, [type]: freshSettings }))
            const rows: PanelRow[] = freshSettings.map((s: any, idx: number) => ({
              id: `${Date.now()}_${idx + 1}`,
              round: s.round,
              time: s.time,
              rest: s.rest,
              waterBreak: s.water_break ?? 0,
              type
            }))
            // stress/loop DB 프리셋이 서로 다름 → 패널을 통째로 바꾸면 같은 화면에서도 요약 시간이 달라짐.
            // 이미 패널이 있으면 time/rest/waterBreak는 유지하고 type(및 round 정렬)만 맞춘다.
            setPanelRows(prev => {
              if (prev.length === 0) return rows
              return prev.map((r, i) => ({
                ...r,
                type,
                round: rows[i]?.round ?? r.round,
              }))
            })
            return
          }
        }
      } catch (error) {
        console.error('Fetch workout setting for circuit type:', error)
      }
      applyDefaults('MAIN', type, true)
    }
  }

  const applyDefaults = (major: string, methodType: string, forceApply: boolean = false) => {
    // If we are editing an existing record and it already has data, don't overwrite (unless forced)
    if (!forceApply && currentEditingMasterId && panelRows.length > 0) {
      return
    }

    // DB에서 가져온 설정값 사용
    const settingKey = major === 'MAIN' ? methodType : major
    const settings = workoutSettings[settingKey]

    if (settings && settings.length > 0) {
      // DB 설정값으로 panelRows 생성
      const rows: PanelRow[] = settings.map((s: any, idx: number) => {
        const isAe = methodType === 'AMRAP' || methodType === 'EMOM'
        const wb = Number(s.water_break ?? 0)
        const r = Number(s.rest ?? 0)
        return {
          id: `${Date.now()}_${idx + 1}`,
          round: s.round,
          time: s.time,
          rest: isAe ? 0 : s.rest,
          waterBreak: isAe ? (wb > 0 ? Math.floor(wb / 60) : r) : (s.water_break ?? 0),
          type: methodType
        }
      })
      setPanelRows(rows)
    } else {
      // DB 설정값이 없으면 기본값 사용 (fallback)
      if (major === 'MAIN') {
        if (methodType === 'stress') {
          setPanelRows([
            { id: `${Date.now()}_1`, round: 1, time: 60, rest: 20, waterBreak: 0, type: 'stress' },
            { id: `${Date.now()}_2`, round: 2, time: 40, rest: 20, waterBreak: 0, type: 'stress' },
            { id: `${Date.now()}_3`, round: 3, time: 20, rest: 20, waterBreak: 60, type: 'stress' }
          ])
        } else if (methodType === 'loop') {
          setPanelRows([
            { id: `${Date.now()}_1`, round: 1, time: 60, rest: 20, waterBreak: 60, type: 'loop' },
            { id: `${Date.now()}_2`, round: 2, time: 60, rest: 20, waterBreak: 60, type: 'loop' },
            { id: `${Date.now()}_3`, round: 3, time: 60, rest: 20, waterBreak: 0, type: 'loop' }
          ])
        }
      } else if (major === 'AMRAP') {
        setPanelRows([
          { id: `${Date.now()}_1`, round: 1, time: 12, rest: 0, waterBreak: 1, type: 'AMRAP' },
          { id: `${Date.now()}_2`, round: 2, time: 12, rest: 0, waterBreak: 0, type: 'AMRAP' }
        ])
      } else if (major === 'EMOM') {
        setPanelRows([
          { id: `${Date.now()}_1`, round: 1, time: 1, rest: 0, waterBreak: 1, type: 'EMOM' },
          { id: `${Date.now()}_2`, round: 2, time: 1, rest: 0, waterBreak: 0, type: 'EMOM' }
        ])
      } else {
        setPanelRows([])
      }
    }
  }

  // --- Handlers ---
  const handleApply = async (master: WorkoutMaster) => {
    setSelectedMasterId(master.id)
    const procedureName = 'sp_GetWorkoutHistoryDetail'
    console.log('[Totalexercises] 더블클릭 - 호출 프로시저:', procedureName, '| masterId:', master.id)
    try {
      const response = await api.get(`/workout-categories/workout-history-detail/${master.id}`)
      if (response.data.success) {
        const { master: m, details, plans } = response.data.data
        console.log('[Totalexercises] 프로시저 반환값:', {
          procedure: procedureName,
          master: m,
          details,
          plans,
          detailsCount: details?.length ?? 0,
          plansCount: plans?.length ?? 0
        })

        // Reset state before loading new data
        resetEditorState()

        setRightSelectedDate(dayjs(m.date))
        setMemo(m.memo || '')
        // workout_categories_id를 문자열로 변환하여 select value와 매칭
        const foundCat = m.workout_categories_id ? workoutCategories.find(c =>
          c.id?.toString() === String(m.workout_categories_id) ||
          c.minor_category === String(m.workout_categories_id) ||
          c.major_category === String(m.workout_categories_id)
        ) : null

        const categoryValue = foundCat ? foundCat.major_category : (m.workout_categories_id ? String(m.workout_categories_id) : '운동선택')
        setRightExerciseType(categoryValue)
        setCircuitType(m.method_type || 'stress')

        const isAdminRecord = !!(m.is_admin ?? master.is_admin)
        if (isAdminRecord && !isUserAdmin) {
          setCurrentEditingMasterId(null)
          setOriginalDate(null)
          setOriginalCategory(null)
          setOriginalCircuitType(null)
          setIsAdmin(false)
          toast.success('관리자 운동을 불러왔습니다. 저장 시 나의 운동으로 복사됩니다.')
        } else {
          setCurrentEditingMasterId(m.id)
          setOriginalDate(dayjs(m.date).format('YYYY-MM-DD'))
          setOriginalCategory(categoryValue)
          setOriginalCircuitType(m.method_type || m.circuit_type || null)
          setIsAdmin(isAdminRecord)
        }

        const loadedEx: Exercise[] = []
        const loadedDS: Exercise[] = []
        const loadedCD: Exercise[] = []

        details.forEach((d: any, index: number) => {
          // major_category를 대소문자 구분 없이 비교
          const majorCat = d.major_category ? String(d.major_category).toUpperCase() : null

          const ex: Exercise = {
            id: `applied-${m.id}-${d.exercises_id}-${index}`,
            originalExerciseId: d.exercises_id,
            name_ko: d.exercise_name || d.name_ko || d.exercise_name_ko || '',
            name_en: d.video_title || d.exercise_name_en || d.name_en || '', // 프로시저에서 video_title로 반환
            level: d.level || 'beginner',
            target_muscles: d.target_muscles || '',
            characteristics: d.characteristics || '',
            equipment: d.equipment || '',
            purpose: d.description || d.purpose || '', // 프로시저에서 description으로 반환
            duration: d.duration || 30,
            video_url: d.video_url || '',
            major_category: majorCat || '',
            major_category_name: d.major_category_name || '',
            workout_category_id: d.workout_category_id || d.workoutCategoryId || d.exercise_type || null, // exercise_type이 workout_category_id로 저장됨
            position: d.position || '',
            reps: (categoryValue === 'AMRAP' || categoryValue === 'EMOM') ? (d.reps || 10) : (d.reps || 0)
          }

          // major_category 기준으로 분류 (exercise_type은 무시하고 major_category만 사용)
          const isDynamic = majorCat === 'DS' // ||
            //majorCat === 'DYNAMIC_STRETCHING' ||
            //majorCat === 'DS'

          const isCoolDown = majorCat === 'CD' // ||
            //majorCat === 'COOL_DOWN' ||
            //majorCat === 'STATIC-STRETCHING' ||
            //majorCat === 'STATIC_STRETCHING' ||
            //majorCat === 'CD'

          if (isDynamic) {
            loadedDS.push(ex)
          } else if (isCoolDown) {
            loadedCD.push(ex)
          } else {
            // MAIN, AMRAP, EMOM 등 모든 메인 운동
            loadedEx.push(ex)
          }
        })

        setExercises(reorderPositions(sortExercisesByPosition(loadedEx), 'main'))
        setDynamicExercises(reorderPositions(sortExercisesByPosition(loadedDS), 'dynamic'))
        setCoolDownExercises(reorderPositions(sortExercisesByPosition(loadedCD), 'cooldown'))

        if (plans) {
          const cat = workoutCategories.find(c => c.id?.toString() === m.workout_categories_id)
          const major = cat?.major_category || m.major_category || String(m.workout_categories_id || '')
          const isTimeStructured = major === 'AMRAP' || major === 'EMOM'
          setPanelRows(plans.map((p: any) => {
            const hyd = Number(p.hydration ?? 0)
            const restSec = Number(p.rest ?? 0)
            return {
              id: `${Date.now()}_${p.round}_${Math.random()}`,
              round: p.round,
              time: isTimeStructured ? Math.floor(p.time / 60) : p.time,
              rest: isTimeStructured ? 0 : p.rest,
              waterBreak: isTimeStructured
                ? (hyd > 0 ? Math.floor(hyd / 60) : Math.floor(restSec / 60))
                : (p.hydration || 0)
            }
          }))
        }

        fetchWorkoutTimeSummary(master.id)
      }
    } catch (error) {
      console.error('Load Detail Error:', error)
      toast.error('기록 로드 중 오류가 발생했습니다.')
    }
  }

  const sortExercisesByPosition = (list: Exercise[]) => {
    return [...list].sort((a, b) => {
      const getVal = (pos?: string) => {
        if (!pos) return 999
        const m = pos.match(/([A-Z]+)(\d+)/)
        if (!m) {
          const n = parseInt(pos)
          return isNaN(n) ? 999 : n
        }
        const p = m[1], n = parseInt(m[2])
        if (p === 'DS' || p === 'CD') return n
        const group = Math.floor((n - 1) / 3) * 2 + (p === 'R' ? 1 : 0)
        return group * 3 + ((n - 1) % 3)
      }
      return getVal(a.position) - getVal(b.position)
    })
  }

  const reorderPositions = (list: Exercise[], type: 'main' | 'dynamic' | 'cooldown') => {
    return list.map((ex, idx) => {
      let position = ''
      if (type === 'dynamic') {
        position = `DS${idx + 1}`
      } else if (type === 'cooldown') {
        position = `CD${idx + 1}`
      } else {
        const prefix = Math.floor(idx / 3) % 2 === 0 ? 'L' : 'R'
        const num = Math.floor(idx / 6) * 3 + (idx % 3) + 1
        position = `${prefix}${num}`
      }
      return { ...ex, position }
    })
  }

  const handleSave = async () => {
    console.log('🚀 [handleSave] 저장 버튼 클릭됨!', { majorCategory, rightExerciseType })

    if (rightExerciseType === '운동선택') {
      toast.warning('운동을 선택해주세요.')
      return
    }

    if (majorCategory === 'MAIN') {
      const n = exercises.length
      if (n !== 6 && n !== 12) {
        toast.warning('MAIN 운동은 메인 운동이 정확히 6개 또는 12개일 때만 저장할 수 있습니다.')
        return
      }
    }

    const dsCategory = workoutCategories.find(c =>
      //c.major_category === 'Dynamic Stretching' ||
      //c.major_category === 'Dynamic Stretch' ||
      c.major_category === 'DS'
    )
    const cdCategory = workoutCategories.find(c =>
      //c.major_category === 'Cool Down' ||
      //c.major_category === 'Cooldown' ||
      //c.major_category === 'Static Stretching' ||
      c.major_category === 'CD'
    )

    const baseParams = {
      rightSelectedDate,
      panelRows,
      exercises,
      dynamicExercises,
      coolDownExercises,
      appliedDynamic,
      appliedCoolDown,
      memo,
      currentEditingMasterId:
        (originalDate !== rightSelectedDate?.format('YYYY-MM-DD') ||
          originalCategory !== rightExerciseType ||
          // stress/loop 변경도 신규 insert로 처리
          (majorCategory === 'MAIN' &&
            (originalCircuitType || '').toLowerCase() !== (circuitType || '').toLowerCase()))
          ? null
          : currentEditingMasterId,
      isAdmin,
      dsCategoryId: dsCategory?.id,
      cdCategoryId: cdCategory?.id,
      majorCategory, // 운동시간 요약 계산을 위해 전달
      circuitType, // 운동시간 요약 계산을 위해 전달 (MAIN일 때만 사용)
      onSuccess: (savedId: string) => {
        toast.success('기록이 저장되었습니다.')
        fetchWorkoutTimeSummary(savedId)
        if (rightSelectedDate) setSelectedDate(rightSelectedDate)
        handleSearch(rightSelectedDate)
        handleSearchAdmin(rightSelectedDate)
      }
    }

    try {
      if (majorCategory === 'AMRAP') {
        await saveAMRAP(baseParams)
      } else if (majorCategory === 'EMOM') {
        await saveEMOM(baseParams)
      } else {
        await saveCircuit({ ...baseParams, workoutCategory: rightExerciseType, originalWorkoutCategory: rightExerciseType, circuitType })
      }
    } catch (error) {
      console.error('[handleSave]', error)
      toast.error(resolveWorkoutSaveErrorMessage(error))
    }
  }

  const handleDeleteRecord = () => {
    if (currentEditingMasterId) setShowDeleteConfirm(true)
  }

  // 우측 편집 영역만 초기화(좌측 조회 조건/필터는 유지)
  const resetEditorState = () => {
    setExercises([])
    setDynamicExercises([])
    setCoolDownExercises([])
    setPanelRows([])
    setMemo('')
    setCurrentEditingMasterId(null)
    setOriginalDate(null)
    setOriginalCategory(null)
    setOriginalCircuitType(null)
    setAppliedDynamic(null)
    setAppliedCoolDown(null)
    setSavedWorkoutTimeSummary(null)
    setSelectedExercise(null)
    setSelectedPanelRowId(null)
  }

  const onConfirmDelete = async () => {
    try {
      const response = await api.delete(`/workout-categories/workout-history/${currentEditingMasterId}`)
      if (response.data.success) {
        toast.success('기록이 삭제되었습니다.')
        handleReset()
        handleSearch()
        handleSearchAdmin()
      }
    } catch (error) {
      toast.error('삭제 중 오류가 발생했습니다.')
    } finally {
      setShowDeleteConfirm(false)
    }
  }

  const handleReset = () => {
    // 우측 편집 영역 초기화
    setRightSelectedDate(dayjs())
    setRightExerciseType('운동선택')
    setCircuitType('stress')
    setActiveTab('main')
    setIsAdmin(isUserAdmin) // 관리자인 경우 true로 유지

    resetEditorState()

    // 좌측 기록 영역도 기본값으로 되돌림
    setSelectedDate(dayjs())
    setSelectedMasterId(null)
    // WorkoutHistory 내부 로컬 필터(운동구분/서킷구분)를 초기값(전체)로 되돌리기 위해 리마운트
    setHistoryResetNonce((v) => v + 1)
  }

  const handleCancel = () => {
    if (window.confirm('작업을 취소하시겠습니까?')) handleReset()
  }

  // --- Exercise Management ---
  const handleExerciseSelected = (selected: Exercise[]) => {
    const listType = activeTab

    // AMRAP/EMOM일 때 DB 설정값에서 reps 가져오기, 없으면 기본 10
    const getDefaultReps = () => {
      if (majorCategory === 'AMRAP' || majorCategory === 'EMOM') {
        const settings = workoutSettings[majorCategory]
        if (settings && settings.length > 0 && settings[0].reps) {
          return settings[0].reps
        }
        return 10 // fallback
      }
      return undefined
    }
    const defaultReps = getDefaultReps()

    const updatedSelected = selected.map(ex => ({
      ...ex,
      duration: ex.duration || 30,
      reps: (majorCategory === 'AMRAP' || majorCategory === 'EMOM') ? (ex.reps || defaultReps) : undefined
    }))

    if (selectedPanelRowForExercise) {
      // Logic for adding to panel row if needed (though UI shows adding to list)
      // Original code adds to 'exercises' but might have special logic
    }

    if (listType === 'dynamic') setDynamicExercises(prev => reorderPositions([...prev, ...updatedSelected], 'dynamic'))
    else if (listType === 'cooldown') setCoolDownExercises(prev => reorderPositions([...prev, ...updatedSelected], 'cooldown'))
    else setExercises(prev => reorderPositions([...prev, ...updatedSelected], 'main'))

    setIsExerciseModalOpen(false)
    setSelectedPanelRowForExercise(null)
  }

  const handleDeleteExercise = (id: string, listType: 'main' | 'dynamic' | 'cooldown') => {
    if (listType === 'dynamic') setDynamicExercises(prev => reorderPositions(prev.filter(ex => ex.id !== id), 'dynamic'))
    else if (listType === 'cooldown') setCoolDownExercises(prev => reorderPositions(prev.filter(ex => ex.id !== id), 'cooldown'))
    else setExercises(prev => reorderPositions(prev.filter(ex => ex.id !== id), 'main'))
  }

  const handleMoveExercise = (index: number, direction: 'up' | 'down', listType: 'main' | 'dynamic' | 'cooldown') => {
    const list = listType === 'dynamic' ? [...dynamicExercises] : listType === 'cooldown' ? [...coolDownExercises] : [...exercises]
    const nextIndex = direction === 'up' ? index - 1 : index + 1
    if (nextIndex < 0 || nextIndex >= list.length) return
    [list[index], list[nextIndex]] = [list[nextIndex], list[index]]

    if (listType === 'dynamic') setDynamicExercises(reorderPositions(list, 'dynamic'))
    else if (listType === 'cooldown') setCoolDownExercises(reorderPositions(list, 'cooldown'))
    else setExercises(reorderPositions(list, 'main'))
  }

  const handleReorderExercise = (fromIndex: number, toIndex: number, listType: 'main' | 'dynamic' | 'cooldown') => {
    if (fromIndex === toIndex) return

    const sourceList = listType === 'dynamic'
      ? [...dynamicExercises]
      : listType === 'cooldown'
        ? [...coolDownExercises]
        : [...exercises]

    if (fromIndex < 0 || toIndex < 0 || fromIndex >= sourceList.length || toIndex >= sourceList.length) return

    const [moved] = sourceList.splice(fromIndex, 1)
    sourceList.splice(toIndex, 0, moved)

    if (listType === 'dynamic') setDynamicExercises(reorderPositions(sourceList, 'dynamic'))
    else if (listType === 'cooldown') setCoolDownExercises(reorderPositions(sourceList, 'cooldown'))
    else setExercises(reorderPositions(sourceList, 'main'))
  }

  const handleDurationChange = (id: string, duration: number, listType: 'main' | 'dynamic' | 'cooldown') => {
    const setter = listType === 'dynamic' ? setDynamicExercises : listType === 'cooldown' ? setCoolDownExercises : setExercises
    setter(prev => prev.map(ex => ex.id === id ? { ...ex, duration: Math.max(0, duration) } : ex))
  }

  const handleRepsChange = (id: string, reps: number) => {
    setExercises(prev => prev.map(ex => ex.id === id ? { ...ex, reps: Math.max(1, reps) } : ex))
  }

  // --- Panel Management ---
  const handleAddPanelRow = () => {
    if (majorCategory === 'AMRAP' && panelRows.length >= 2) {
      toast.warning('AMRAP은 운동설계(Round)를 최대 2개까지 지정할 수 있습니다.')
      return
    }
    const nextRound = panelRows.length > 0 ? Math.max(...panelRows.map(r => r.round)) + 1 : 1
    const isAePanel = majorCategory === 'AMRAP' || majorCategory === 'EMOM'
    const newRow: PanelRow = {
      id: `${Date.now()}_${nextRound}`,
      round: nextRound,
      time: isAePanel ? 1 : 60,
      rest: isAePanel ? 0 : 20,
      waterBreak: 0,
      type: isAePanel ? majorCategory : 'stress'
    }
    setPanelRows([...panelRows, newRow])
  }

  const handleRemovePanelRow = () => {
    if (!selectedPanelRowId) return
    if (majorCategory === 'AMRAP' && panelRows.length <= 1) {
      toast.warning('AMRAP은 운동설계(Round)를 최소 1개 유지해야 합니다.')
      return
    }
    setPanelRows(prev => prev.filter(r => r.id !== selectedPanelRowId))
    setSelectedPanelRowId(null)
  }

  const handlePanelTimeChange = (rowId: string, field: 'time' | 'rest' | 'waterBreak', increment: boolean) => {
    const isTimeStructured = majorCategory === 'AMRAP' || majorCategory === 'EMOM'
    const step = isTimeStructured ? 1 : 5

    if (field === 'waterBreak' && isWaterBreakLastRowOnly) {
      setPanelRows(prev => {
        const lastIdx = prev.length - 1
        const idx = prev.findIndex(r => r.id === rowId)
        if (idx < 0 || idx !== lastIdx) return prev
        return prev.map((r, i) => {
          if (i !== lastIdx) return { ...r, waterBreak: 0 }
          const val = r.waterBreak
          const next = increment ? val + step : Math.max(0, val - step)
          return { ...r, waterBreak: next }
        })
      })
      return
    }

    setPanelRows(prev => prev.map(r => {
      if (r.id === rowId) {
        const val = r[field]
        return { ...r, [field]: increment ? val + step : Math.max(0, val - step) }
      }
      return r
    }))
  }

  const handlePanelTimeDirectChange = (rowId: string, field: 'time' | 'rest' | 'waterBreak', value: number) => {
    const clamped = Math.max(0, Math.floor(value))

    if (field === 'waterBreak' && isWaterBreakLastRowOnly) {
      setPanelRows(prev => {
        const lastIdx = prev.length - 1
        const idx = prev.findIndex(r => r.id === rowId)
        if (idx < 0 || idx !== lastIdx) return prev
        return prev.map((r, i) => ({
          ...r,
          waterBreak: i === lastIdx ? clamped : 0,
        }))
      })
      return
    }

    setPanelRows(prev => prev.map(r => {
      if (r.id === rowId) {
        return { ...r, [field]: clamped }
      }
      return r
    }))
  }

  /** MAIN stress/loop 및 EMOM: 물보충은 마지막 행만 유지(불러오기·이전 입력 정리) */
  useEffect(() => {
    if (!isWaterBreakLastRowOnly) return
    setPanelRows(prev => {
      if (prev.length === 0) return prev
      const lastIdx = prev.length - 1
      let changed = false
      const next = prev.map((r, i) => {
        if (i !== lastIdx && (r.waterBreak ?? 0) !== 0) {
          changed = true
          return { ...r, waterBreak: 0 }
        }
        return r
      })
      return changed ? next : prev
    })
  }, [isWaterBreakLastRowOnly, panelRows])

  const handlePanelExerciseSelect = (rowId: string) => {
    setSelectedPanelRowForExercise(rowId)
    setIsExerciseModalOpen(true)
  }

  // --- Total Time Calc ---
  const totalWorkoutTime = useMemo(() => {
    const dsSeconds = dynamicExercises.reduce((acc, ex) => acc + (ex.duration || 0), 0)
    const cdSeconds = coolDownExercises.reduce((acc, ex) => acc + (ex.duration || 0), 0)
    let mainSeconds = 0
    if (majorCategory === 'AMRAP') {
      panelRows.forEach((row, idx) => {
        mainSeconds += row.time * 60
        if (idx < panelRows.length - 1) {
          mainSeconds += (row.waterBreak || 0) * 60
        }
      })
    } else if (majorCategory === 'EMOM') {
      const br = getEmomTimeBreakdownFromPanels(panelRows, exercises)
      mainSeconds = br.mainSeconds + br.restSeconds
    } else {
      mainSeconds = getMainCircuitTotalSecondsFromPanels(panelRows, exercises)
    }

    const total = dsSeconds + mainSeconds + cdSeconds
    console.log('⏱️ [totalWorkoutTime]', {
      majorCategory, circuitType,
      exerciseCount: exercises.length,
      panelRows: panelRows.map(r => ({ time: r.time, rest: r.rest, waterBreak: r.waterBreak })),
      dsSeconds, mainSeconds, cdSeconds, total,
      savedSummary: savedWorkoutTimeSummary
    })
    return total
  }, [exercises, dynamicExercises, coolDownExercises, panelRows, majorCategory, circuitType])

  const formatDashboardTime = (s: number) => {
    const m = Math.floor(s / 60)
    const rs = s % 60
    return `${m}:${rs.toString().padStart(2, '0')}`
  }

  // --- Video Logic ---
  const onTogglePlay = async () => {
    if (!vimeoPlayerRef.current || !isPlayerReady) return
    if (isPlaying) {
      await vimeoPlayerRef.current.pause()
      setIsPlaying(false)
    } else {
      await vimeoPlayerRef.current.play()
      setIsPlaying(true)
    }
  }

  const onResetVideo = async () => {
    if (!vimeoPlayerRef.current || !isPlayerReady) return
    const startTime = selectedExercise?.video_start_time || 0
    await vimeoPlayerRef.current.setCurrentTime(startTime)
    await vimeoPlayerRef.current.play()
    setIsPlaying(true)
  }

  // --- Layout Helpers ---
  const handleDraggingLeft = (e: React.MouseEvent) => {
    const startX = e.clientX
    const startWidth = leftWidth
    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaPercent = (deltaX / window.innerWidth) * 100
      setLeftWidth(Math.max(15, Math.min(40, startWidth + deltaPercent)))
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const handleDraggingPanel = (e: React.MouseEvent) => {
    const startX = e.clientX
    const startWidth = panelWidth
    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaPercent = (deltaX / window.innerWidth) * 100
      setPanelWidth(Math.max(15, Math.min(40, startWidth + deltaPercent)))
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-[3px] p-0 overflow-hidden bg-background animate-in fade-in duration-500">
      <div className="flex flex-1 min-h-0 gap-[3px]">
        {/* Left: History */}
        <WorkoutHistory
          key={`workout-history-${historyResetNonce}`}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          memoFilter={memoFilter}
          setMemoFilter={setMemoFilter}
          workoutMasters={workoutMasters}
          adminWorkoutMasters={adminWorkoutMasters}
          categories={workoutCategories}
          selectedMasterId={selectedMasterId}
          onSearch={handleSearch}
          onApply={handleApply}
          isLoading={isLoadingHistory}
          isLoadingAdmin={isLoadingAdminHistory}
          width={leftWidth}
        />

        {/* Splitter */}
        <div onMouseDown={handleDraggingLeft} className="w-1 cursor-col-resize hover:bg-primary/50 transition-colors shrink-0" />

        {/* Right: Editor */}
        <WorkoutEditor
          rightSelectedDate={rightSelectedDate}
          setRightSelectedDate={setRightSelectedDate}
          rightExerciseType={rightExerciseType}
          setRightExerciseType={handleExerciseTypeChange}
          workoutCategories={workoutCategories}
          majorCategory={majorCategory}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          exercises={exercises}
          selectedExercise={selectedExercise}
          setSelectedExercise={setSelectedExercise}
          onDeleteExercise={handleDeleteExercise}
          onMoveExercise={handleMoveExercise}
          onReorderExercise={handleReorderExercise}
          onDurationChange={handleDurationChange}
          onRepsChange={handleRepsChange}
          panelRows={panelRows}
          selectedPanelRowId={selectedPanelRowId}
          setSelectedPanelRowId={setSelectedPanelRowId}
          circuitType={circuitType}
          onCircuitTypeChange={handleCircuitTypeChange}
          onAddPanelRow={handleAddPanelRow}
          onRemovePanelRow={handleRemovePanelRow}
          onPanelTimeChange={handlePanelTimeChange}
          onPanelTimeDirectChange={handlePanelTimeDirectChange}
          onPanelExerciseSelect={handlePanelExerciseSelect}
          panelWidth={panelWidth}
          onDraggingPanel={handleDraggingPanel}
          dynamicExercises={dynamicExercises}
          appliedDynamic={appliedDynamic}
          onClearAppliedDynamic={() => setAppliedDynamic(null)}
          coolDownExercises={coolDownExercises}
          appliedCoolDown={appliedCoolDown}
          onClearAppliedCoolDown={() => setAppliedCoolDown(null)}
          totalWorkoutTime={totalWorkoutTime}
          savedWorkoutTimeSummary={savedWorkoutTimeSummary}
          formatDashboardTime={formatDashboardTime}
          memo={memo}
          setMemo={setMemo}
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          onResetVideo={onResetVideo}
          vimeoIframeRef={vimeoIframeRef}
          onExerciseSelection={() => {
            if (!rightExerciseType || rightExerciseType === '운동선택') {
              toast.warning('운동선택을 먼저 선택해주세요.')
              return
            }
            setIsExerciseModalOpen(true)
          }}
          onSave={handleSave}
          onDeleteRecord={handleDeleteRecord}
          handleCancel={handleCancel}
          handleReset={handleReset}
          isAdmin={isAdmin}
          setIsAdmin={setIsAdmin}
          currentEditingMasterId={currentEditingMasterId}
          originalCircuitType={originalCircuitType}
        />
      </div>

      <ExerciseSelectionModal
        open={isExerciseModalOpen}
        onClose={() => setIsExerciseModalOpen(false)}
        onExercisesSelected={handleExerciseSelected}
        defaultCategory={
          activeTab === 'dynamic' 
            ? 'DS' 
            : activeTab === 'cooldown' 
            ? 'CD' 
            : (majorCategory === 'MAIN' || majorCategory === 'AMRAP' || majorCategory === 'EMOM')
            ? 'MAIN'
            : (selectedCategory?.major_category || '')
        }
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={onConfirmDelete}
        title="기록 삭제"
        description="정말로 이 기록을 삭제하시겠습니까?"
        variant="destructive"
      />
    </div>
  )
}
