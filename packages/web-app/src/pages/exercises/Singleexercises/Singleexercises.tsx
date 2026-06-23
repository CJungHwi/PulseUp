/**
 * 페이지 요약 - 단일 순서 메인 운동 (`/Singleexercises`)
 *
 * 기능: Totalexercises와 유사하나 메인 운동 개수 제한 없음, position은 1,2,3… 순서(linear).
 *
 * 호출/연동:
 * - `GET /workout-categories/workout-setting/:methodType`
 * - `useWorkoutScope(WORKOUT_SCOPE_SINGLE)` → DB scope 사용 여부 확인
 * - `GET /workout-categories/workout-history-master` (workoutScope)
 * - 저장: shared/saveWorkout → `POST .../HyberStrengthCircuitSave` 등 + DB scope
 * - `DELETE /workout-categories/workout-history/:id`
 *
 * 관련 컴포넌트: `WorkoutHistory`, `WorkoutEditor`, `ExerciseSelectionModal`, `shared/saveWorkout`.
 *
 * 흐름: 이력 선택 → 에디터 구성 → 저장 시 workout_scope=SINGLE, sequenceMode=linear.
 * position: 메인 1, 2, 3… (A/B 구분 없음)
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
import { Exercise, PanelRow, WorkoutMaster, WorkoutTimeSummary } from './components/types'
import { saveCircuit, saveAMRAP, saveEMOM, getMainCircuitTotalSecondsFromPanels, getEmomTimeBreakdownFromPanels } from './components/saveWorkout'
import {
  emptyMonitorProfile,
  fetchWorkoutMonitorDisplayProfile,
  saveWorkoutMonitorDisplayProfile
} from '@/services/monitorDisplayApi'
import type { MonitorDisplayProfileState } from '@/pages/WorkoutSettings/components/MonitorDisplayTabs'
import { SEQUENCE_MODE_LINEAR } from '../shared/sequenceMode'
import {
  getSequentialPositionSortValue,
  reorderPositionsLinear,
} from '../shared/sequencePositions'
import { WORKOUT_SCOPE_SINGLE } from '../shared/workoutScope'
import { useWorkoutScope } from '../shared/useWorkoutScope'
import {
  fetchWorkoutSettingPanelRows,
  getDefaultPanelRowsForMethod,
  mapWorkoutSettingToPanelRows,
  normalizeCircuitTypeForCategory,
  resolvePanelRowType,
  resolveWorkoutSettingKey,
} from './components/workoutSettingBridge'
import type { WorkoutSettingApiRow } from '@/pages/WorkoutSettings/components/workoutSettingsModel'

/** WorkoutSettings(`/workout-settings`)에 등록된 방법별 기본 횟수 - MAIN/EMOM은 circuitType(stress|loop) 키 사용 */
const resolveDefaultRepsFromSettings = (
  majorCategory: string,
  circuitType: string,
  workoutSettings: Record<string, { reps?: number }[]>,
  fallback = 10,
): number => {
  const settingKey = resolveWorkoutSettingKey(majorCategory, circuitType)
  const settings = workoutSettings[settingKey]
  if (Array.isArray(settings) && settings.length > 0) {
    const reps = Number(settings[0].reps ?? 0)
    if (reps > 0) return reps
  }
  if (majorCategory === 'AMRAP' || majorCategory === 'EMOM' || majorCategory === 'MAIN') {
    return fallback
  }
  return fallback
}

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

export default function Singleexercises() {
  const { showSnackbar } = useSnackbar()
  const { user } = useAppSelector((state) => state.auth)
  const isSystemAdmin = user?.role === 'super_admin'
  const { scopeCode: workoutScopeCode, isActive: isScopeActive, loading: scopeLoading } =
    useWorkoutScope(WORKOUT_SCOPE_SINGLE)

  const toast = useMemo(() => {
    return {
      success: (msg: string) => showSnackbar({ message: msg, severity: 'success' }),
      error: (msg: string) => showSnackbar({ message: msg, severity: 'error' }),
      warning: (msg: string) => showSnackbar({ message: msg, severity: 'warning' })
    }
  }, [showSnackbar])

  useEffect(() => {
    if (scopeLoading || isScopeActive) return
    toast.warning(`${workoutScopeCode} 운동저장구분이 비활성화되어 있습니다. 저장이 제한될 수 있습니다.`)
  }, [scopeLoading, isScopeActive, workoutScopeCode, toast])

  // --- Left Panel State (History) ---
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(dayjs())
  const [memoFilter, setMemoFilter] = useState('')
  const [historyExerciseType, setHistoryExerciseType] = useState('전체')
  const [historyCircuitType, setHistoryCircuitType] = useState('전체')
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
  const [workoutMonitorDisplay, setWorkoutMonitorDisplay] =
    useState<MonitorDisplayProfileState>(emptyMonitorProfile())

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

  const defaultRepsFromSettings = useMemo(
    () => resolveDefaultRepsFromSettings(majorCategory, circuitType, workoutSettings),
    [majorCategory, circuitType, workoutSettings],
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
        console.log('🔍 [Singleexercises] workoutCategories loaded:', categories)
        setWorkoutCategories(Array.isArray(categories) ? categories : [])
      }
    } catch (error) {
      console.error('Fetch Categories Error:', error)
    }
  }

  const mapMasterData = useCallback((data: any[], defaultIsAdmin = false): WorkoutMaster[] => {
    const mapped = data.map((m: any) => ({
      id: m.id || m.workout_history_master_id,
      date: m.date,
      time: m.time,
      memo: m.memo,
      is_admin: m.is_admin ?? m.admin ?? m.isAdmin ?? defaultIsAdmin,
      workoutCategoriesId: m.workout_categories_id || m.workout_category_id,
      majorCategory: m.major_category,
      workoutCategoriesName: m.major_category_name || m.workout_categories_name || m.workout_category_name,
      circuitType: m.circuit_type || m.method_type,
      workoutTime: m.workout_time || m.workoutTime || m.total_workout_time,
      created_at: m.created_at || '',
    }))
    return mapped.sort((a, b) => {
      const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime()
      if (dateCompare !== 0) return dateCompare
      return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
    })
  }, [])

  const buildHistorySearchParams = useCallback(
    (targetDate: Dayjs, admin: '0' | '1') => ({
      yearMonth: targetDate.format('YYYY-MM'),
      memo: memoFilter || '',
      workoutCategory: historyExerciseType === '전체' ? '' : historyExerciseType,
      circuitType: historyCircuitType === '전체' ? '' : historyCircuitType,
      workoutScope: workoutScopeCode,
      admin,
    }),
    [memoFilter, historyExerciseType, historyCircuitType, workoutScopeCode],
  )

  const handleSearch = useCallback(async (overrideSelectedDate?: Dayjs | null) => {
    const targetDate = overrideSelectedDate ?? selectedDate
    if (!targetDate) return
    setIsLoadingHistory(true)
    try {
      const response = await api.get('/workout-categories/workout-history-master', {
        params: buildHistorySearchParams(targetDate, '0'),
      })
      if (response.data.success) {
        setWorkoutMasters(mapMasterData(response.data.data || [], false))
      }
    } catch (error) {
      console.error('History Search Error:', error)
      toast.error('기록 조회 중 오류가 발생했습니다.')
    } finally {
      setIsLoadingHistory(false)
    }
  }, [selectedDate, toast, mapMasterData, buildHistorySearchParams])

  const handleSearchAdmin = useCallback(async (overrideSelectedDate?: Dayjs | null) => {
    const targetDate = overrideSelectedDate ?? selectedDate
    if (!targetDate) return
    setIsLoadingAdminHistory(true)
    try {
      const response = await api.get('/workout-categories/workout-history-master', {
        params: buildHistorySearchParams(targetDate, '1'),
      })
      if (response.data.success) {
        setAdminWorkoutMasters(mapMasterData(response.data.data || [], true))
      }
    } catch (error) {
      console.error('Admin History Search Error:', error)
    } finally {
      setIsLoadingAdminHistory(false)
    }
  }, [selectedDate, mapMasterData, buildHistorySearchParams])

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
    const nextCircuitType = normalizeCircuitTypeForCategory(major, circuitType)
    setCircuitType(nextCircuitType)
    if (major === 'MAIN' || major === 'EMOM' || major === 'AMRAP') {
      try {
        const rows = await fetchWorkoutSettingPanelRows(major, nextCircuitType)
        setPanelRows(rows)
        return
      } catch (error) {
        console.error('Fetch workout setting for exercise type:', error)
        toast.error('운동설정 값을 불러오지 못했습니다.')
      }
    }
    applyDefaults(major, nextCircuitType, true)
  }

  const handleCircuitTypeChange = async (type: string) => {
    const nextCircuitType = normalizeCircuitTypeForCategory(majorCategory, type)
    setCircuitType(nextCircuitType)
    if (majorCategory !== 'MAIN' && majorCategory !== 'EMOM') return

    try {
      const rows = await fetchWorkoutSettingPanelRows(majorCategory, nextCircuitType)
      if (majorCategory === 'EMOM') {
        setPanelRows(rows)
        return
      }
      setPanelRows(prev => {
        if (prev.length === 0) return rows
        return prev.map((r, i) => ({
          ...r,
          type: nextCircuitType,
          round: rows[i]?.round ?? r.round,
        }))
      })
    } catch (error) {
      console.error('Fetch workout setting for circuit type:', error)
      toast.error('운동설정 값을 불러오지 못했습니다.')
      applyDefaults(majorCategory, nextCircuitType, true)
    }
  }

  const applyDefaults = (major: string, methodType: string, forceApply: boolean = false) => {
    if (!forceApply && currentEditingMasterId && panelRows.length > 0) {
      return
    }

    const panelType = resolvePanelRowType(major, methodType)
    const circuitForKey = normalizeCircuitTypeForCategory(major, methodType)
    const settingKey = resolveWorkoutSettingKey(major, circuitForKey)
    const cached = workoutSettings[settingKey]

    if (Array.isArray(cached) && cached.length > 0) {
      setPanelRows(
        mapWorkoutSettingToPanelRows(
          cached as WorkoutSettingApiRow[],
          settingKey,
          panelType,
        ),
      )
      return
    }

    setPanelRows(getDefaultPanelRowsForMethod(major, methodType))
  }

  /** 신규 작성 시 EMOM/MAIN/AMRAP 선택·stress-loop 전환 후 WorkoutSettings 값 동기화 */
  useEffect(() => {
    if (currentEditingMasterId) return
    if (rightExerciseType === '운동선택') return
    const major = majorCategory
    if (major !== 'MAIN' && major !== 'EMOM' && major !== 'AMRAP') return

    let cancelled = false
    void fetchWorkoutSettingPanelRows(major, circuitType).then((rows) => {
      if (!cancelled) setPanelRows(rows)
    })
    return () => {
      cancelled = true
    }
  }, [majorCategory, circuitType, rightExerciseType, currentEditingMasterId])

  // --- Handlers ---
  const handleApply = async (master: WorkoutMaster) => {
    setSelectedMasterId(master.id)
    const procedureName = 'sp_GetWorkoutHistoryDetail'
    console.log('[Singleexercises] 더블클릭 - 호출 프로시저:', procedureName, '| masterId:', master.id)
    try {
      const response = await api.get(`/workout-categories/workout-history-detail/${master.id}`)
      if (!response.data.success) {
        toast.error('기록 상세 조회에 실패했습니다.')
        return
      }

      const { master: m, details, plans } = response.data.data
      if (!m?.id) {
        toast.error('운동 기록 정보를 찾을 수 없습니다.')
        return
      }

      const detailRows = Array.isArray(details) ? details : []
      console.log('[Singleexercises] 프로시저 반환값:', {
        procedure: procedureName,
        master: m,
        detailsCount: detailRows.length,
        plansCount: Array.isArray(plans) ? plans.length : 0
      })

      // Reset state before loading new data (검증 통과 후에만 초기화)
      resetEditorState()
      setActiveTab('main')

      setRightSelectedDate(dayjs(m.date))
      setMemo(m.memo || '')
      // workout_categories_id를 문자열로 변환하여 select value와 매칭
      const foundCat = m.workout_categories_id ? workoutCategories.find(c =>
        c.id?.toString() === String(m.workout_categories_id) ||
        c.minor_category === String(m.workout_categories_id) ||
        c.major_category === String(m.workout_categories_id)
      ) : null

      const categoryValue = foundCat ? foundCat.major_category : (m.workout_categories_id ? String(m.workout_categories_id) : '운동선택')
      const loadedCircuitType = normalizeCircuitTypeForCategory(
        categoryValue,
        m.method_type || m.circuit_type || 'stress',
      )
      setRightExerciseType(categoryValue)
      setCircuitType(loadedCircuitType)

      const isAdminRecord = !!(m.is_admin ?? master.is_admin)
      if (isAdminRecord && !isSystemAdmin) {
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
        setOriginalCircuitType(loadedCircuitType)
        setIsAdmin(isSystemAdmin ? isAdminRecord : false)
      }

      const loadedEx: Exercise[] = []
      const loadedDS: Exercise[] = []
      const loadedCD: Exercise[] = []

      const defaultRepsForLoad = resolveDefaultRepsFromSettings(
        categoryValue,
        loadedCircuitType,
        workoutSettings,
      )

      detailRows.forEach((d: any, index: number) => {
        // major_category를 대소문자 구분 없이 비교
        const majorCat = d.major_category ? String(d.major_category).toUpperCase() : null

        const ex: Exercise = {
          id: `applied-${m.id}-${d.exercises_id}-${index}`,
          originalExerciseId: d.exercises_id,
          name_ko: d.exercise_name || d.name_ko || d.exercise_name_ko || '',
          name_en: d.video_title || d.exercise_name_en || d.name_en || '',
          level: d.level || 'beginner',
          target_muscles: d.target_muscles || '',
          characteristics: d.characteristics || '',
          equipment: d.equipment || '',
          purpose: d.description || d.purpose || '',
          duration: d.duration || 30,
          video_url: d.video_url || '',
          major_category: majorCat || '',
          major_category_name: d.major_category_name || '',
          workout_category_id: d.workout_category_id || d.workoutCategoryId || d.exercise_type || null,
          position: d.position || '',
          reps:
            categoryValue === 'AMRAP' || categoryValue === 'EMOM' || categoryValue === 'MAIN'
              ? (d.reps || defaultRepsForLoad)
              : (d.reps || 0)
        }

        const isDynamic = majorCat === 'DS'
        const isCoolDown = majorCat === 'CD'

        if (isDynamic) {
          loadedDS.push(ex)
        } else if (isCoolDown) {
          loadedCD.push(ex)
        } else {
          loadedEx.push(ex)
        }
      })

      setExercises(reorderPositions(sortExercisesByPosition(loadedEx), 'main'))
      setDynamicExercises(reorderPositions(sortExercisesByPosition(loadedDS), 'dynamic'))
      setCoolDownExercises(reorderPositions(sortExercisesByPosition(loadedCD), 'cooldown'))

      try {
        const profile = await fetchWorkoutMonitorDisplayProfile(String(m.id))
        setWorkoutMonitorDisplay(profile)
      } catch (err) {
        console.warn('[Singleexercises] monitor display load failed', err)
        setWorkoutMonitorDisplay(emptyMonitorProfile())
      }

      if (Array.isArray(plans) && plans.length > 0) {
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
              : (p.hydration || 0),
            type: loadedCircuitType
          }
        }))
      }

      fetchWorkoutTimeSummary(String(m.id))
    } catch (error) {
      console.error('Load Detail Error:', error)
      toast.error('기록 로드 중 오류가 발생했습니다.')
    }
  }

  const sortExercisesByPosition = (list: Exercise[]) => {
    return [...list].sort(
      (a, b) => getSequentialPositionSortValue(a.position) - getSequentialPositionSortValue(b.position),
    )
  }

  const reorderPositions = (list: Exercise[], type: 'main' | 'dynamic' | 'cooldown') =>
    reorderPositionsLinear(list, type)

  const handleSave = async () => {
    console.log('🚀 [handleSave] 저장 버튼 클릭됨!', { majorCategory, rightExerciseType })

    if (rightExerciseType === '운동선택') {
      toast.warning('운동을 선택해주세요.')
      return
    }

    if (exercises.length === 0 && dynamicExercises.length === 0 && coolDownExercises.length === 0) {
      toast.warning('저장할 운동이 없습니다.')
      return
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
          ((majorCategory === 'MAIN' || majorCategory === 'EMOM') &&
            (originalCircuitType || '').toLowerCase() !== (circuitType || '').toLowerCase()))
          ? null
          : currentEditingMasterId,
      isAdmin: isSystemAdmin && isAdmin,
      dsCategoryId: dsCategory?.id,
      cdCategoryId: cdCategory?.id,
      majorCategory,
      circuitType,
      sequenceMode: SEQUENCE_MODE_LINEAR,
      workoutScope: workoutScopeCode,
      onSuccess: async (savedId: string) => {
        const targetMasterId = savedId || currentEditingMasterId
        if (!targetMasterId) {
          toast.error('저장 ID를 확인할 수 없어 이미지 설정을 저장하지 못했습니다.')
        } else {
          try {
            await saveWorkoutMonitorDisplayProfile(targetMasterId, workoutMonitorDisplay)
            const profile = await fetchWorkoutMonitorDisplayProfile(targetMasterId)
            setWorkoutMonitorDisplay(profile)
          } catch (err) {
            console.error('[handleSave] workout monitor display save failed', err)
            toast.error('운동 기록은 저장되었으나 이미지 설정 저장에 실패했습니다.')
          }
        }
        toast.success('기록이 저장되었습니다.')
        setCurrentEditingMasterId(savedId)
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
    setWorkoutMonitorDisplay(emptyMonitorProfile())
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
    setIsAdmin(false)

    resetEditorState()

    // 좌측 기록 영역도 기본값으로 되돌림
    setSelectedDate(dayjs())
    setSelectedMasterId(null)
    setHistoryExerciseType('전체')
    setHistoryCircuitType('전체')
    setMemoFilter('')
    // WorkoutHistory 내부 탭 상태를 초기값으로 되돌리기 위해 리마운트
    setHistoryResetNonce((v) => v + 1)
  }

  const handleCancel = () => {
    if (window.confirm('작업을 취소하시겠습니까?')) handleReset()
  }

  // --- Exercise Management ---
  const handleExerciseSelected = (selected: Exercise[]) => {
    const listType = activeTab

    const defaultReps = resolveDefaultRepsFromSettings(
      majorCategory,
      circuitType,
      workoutSettings,
    )

    const updatedSelected = selected.map(ex => ({
      ...ex,
      duration: ex.duration || 30,
      reps:
        majorCategory === 'AMRAP' || majorCategory === 'EMOM' || majorCategory === 'MAIN'
          ? (ex.reps || defaultReps)
          : undefined
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
      type: majorCategory === 'EMOM' ? circuitType : isAePanel ? majorCategory : 'stress'
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

  /** MAIN stress/loop 및 EMOM: 물보충은 마지막 행만 유지(불러오기/이전 입력 정리) */
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
  }, [isWaterBreakLastRowOnly])

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
      const br = getEmomTimeBreakdownFromPanels(panelRows, exercises, SEQUENCE_MODE_LINEAR)
      mainSeconds = br.mainSeconds + br.restSeconds
    } else {
      mainSeconds = getMainCircuitTotalSecondsFromPanels(panelRows, exercises, SEQUENCE_MODE_LINEAR)
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
          exerciseType={historyExerciseType}
          setExerciseType={setHistoryExerciseType}
          searchCircuitType={historyCircuitType}
          setSearchCircuitType={setHistoryCircuitType}
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
          isAdmin={isSystemAdmin && isAdmin}
          setIsAdmin={setIsAdmin}
          currentEditingMasterId={currentEditingMasterId}
          originalCircuitType={originalCircuitType}
          workoutMonitorDisplay={workoutMonitorDisplay}
          onWorkoutMonitorDisplayChange={setWorkoutMonitorDisplay}
          defaultRepsFromSettings={defaultRepsFromSettings}
        />
      </div>

      <ExerciseSelectionModal
        open={isExerciseModalOpen}
        onClose={() => setIsExerciseModalOpen(false)}
        onExercisesSelected={handleExerciseSelected}
        sequenceMode={SEQUENCE_MODE_LINEAR}
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
