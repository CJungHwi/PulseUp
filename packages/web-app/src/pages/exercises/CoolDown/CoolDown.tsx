/**
 * 페이지 요약 — 쿨다운 (`/CoolDown`)
 *
 * 기능: 쿨다운 운동 편집·Vimeo 재생·이력 조회·저장·삭제(동적 스트레칭과 동일 API 패턴).
 *
 * 호출/연동:
 * - `GET /workout-categories/workout-history-master`, `GET .../workout-history-detail/:id`
 * - `POST /workout-categories/HyberStrengthCircuitSave`
 * - `DELETE /workout-categories/workout-history/:id`
 * - DB/SP는 `packages/api-server` 해당 핸들러 참조.
 *
 * 관련 컴포넌트: `ExerciseSelectionModal`, `VimeoFitIframe`, `ConfirmDialog`, shadcn 폼·테이블.
 *
 * 흐름: 마스터 선택 → 상세 편집 → 저장 → 삭제 선택 시 API.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { DATE_FORMATS } from '@/lib/constants'
import {
  Calendar as CalendarIcon,
  Search,
  ClipboardList,
  Trash2,
  X,
  Save,
  Video as VideoIcon,
  ChevronUp,
  ChevronDown,
  Plus,
  Minus,
  Trash,
  Play,
  Pause,
  RotateCcw,
  Info,
  MessageCircle,
  Activity
} from 'lucide-react'
import Player from '@vimeo/player'
import { VimeoFitIframe } from '../../../components/VimeoFitIframe/VimeoFitIframe'
import dayjs, { Dayjs } from 'dayjs'
import 'dayjs/locale/ko'
import ExerciseSelectionModal from '../../../components/ExerciseSelectionModal/ExerciseSelectionModal'
import api from '../../../services/api'
import { cn } from '@/lib/utils'

// Shadcn UI Imports
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MonthInput } from '@/components/ui/month-input'
import {
  Table as ShadcnTable,
  TableBody as ShadcnTableBody,
  TableCell as ShadcnTableCell,
  TableHead as ShadcnTableHead,
  TableHeader as ShadcnTableHeader,
  TableRow as ShadcnTableRow,
} from '@/components/ui/table'
import {
  Select as ShadcnSelect,
  SelectContent as ShadcnSelectContent,
  SelectItem as ShadcnSelectItem,
  SelectTrigger as ShadcnSelectTrigger,
  SelectValue as ShadcnSelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface WorkoutMaster {
  id: string
  date: string
  time: string
  workoutTime: string
  memo: string
}

interface WorkoutDetail {
  id: string
  exerciseId: string
  sequence: number
  exerciseName: string
  name_en: string
  targetMuscle: string
  equipment: string
  characteristics: string
  purpose: string
  position: string
  video_url: string
  time: number
  video_start_time: number
  video_end_time: number
}

interface Exercise {
  id: string
  originalExerciseId?: string
  name_ko: string
  name_en: string
  level: 'beginner' | 'intermediate' | 'advanced'
  target_muscles: string
  characteristics: string
  equipment: string
  purpose: string
  duration: number
  position?: string
  video_url?: string
  video_start_time?: number
  video_end_time?: number
  is_active: boolean
  major_category: string
}

export const CoolDown: React.FC = () => {
  // 상태 관리
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(dayjs())
  const [memoFilter, setMemoFilter] = useState('')
  const [exerciseType, setExerciseType] = useState('CD')
  const [searchCircuitType, setSearchCircuitType] = useState('전체')
  const [workoutMasters, setWorkoutMasters] = useState<WorkoutMaster[]>([])
  const [workoutDetails, setWorkoutDetails] = useState<WorkoutDetail[]>([])
  const [selectedMasterId, setSelectedMasterId] = useState<string | null>(null)

  // 우측 영역 상태 관리
  const [rightSelectedDate, setRightSelectedDate] = useState<Dayjs | null>(dayjs())
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)
  const [memo, setMemo] = useState<string>('')

  // 운동 선택 모달 상태
  const [exerciseModalOpen, setExerciseModalOpen] = useState<boolean>(false)

  // 알림 상태
  const [toastConfig, setToastConfig] = useState<{ open: boolean, message: string, type: 'success' | 'destructive' }>({
    open: false,
    message: '',
    type: 'success'
  })

  // 삭제 확인 상태
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // 현재 편집 중인 기록의 master ID (수정 모드인지 확인용)
  const [currentEditingMasterId, setCurrentEditingMasterId] = useState<string | null>(null)

  // Vimeo Player 상태
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const vimeoPlayerRef = useRef<Player | null>(null)
  const vimeoIframeRef = useRef<HTMLIFrameElement | null>(null)

  // 적용된 운동의 원본 날짜와 시간 (날짜/시간 변경 감지용)
  const [originalDate, setOriginalDate] = useState<string | null>(null)
  const [originalTime, setOriginalTime] = useState<string | null>(null)

  // Split 관련 상태
  const [leftWidth, setLeftWidth] = useState(25)
  const [topHeight, setTopHeight] = useState(40)
  const [isDraggingHorizontal, setIsDraggingHorizontal] = useState(false)
  const [isDraggingVertical, setIsDraggingVertical] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Vimeo Player 컨트롤 함수
  const handlePlayPause = () => {
    if (!vimeoPlayerRef.current || !isPlayerReady) return
    if (isPlaying) {
      vimeoPlayerRef.current.pause().catch(() => { })
      return
    }
    vimeoPlayerRef.current.play().catch(() => { })
  }

  const handleReplay = () => {
    if (!vimeoPlayerRef.current || !isPlayerReady) return
    const startTime = selectedExercise?.video_start_time || 0
    vimeoPlayerRef.current.setCurrentTime(startTime).catch(() => { })
    vimeoPlayerRef.current.play().catch(() => { })
  }

  // dayjs 한글 locale 설정
  useEffect(() => {
    dayjs.locale('ko')
  }, [])

  // 토스트 표시 함수
  const showToast = (message: string, type: 'success' | 'destructive' = 'success') => {
    setToastConfig({ open: true, message, type })
    setTimeout(() => setToastConfig(prev => ({ ...prev, open: false })), 3000)
  }

  // 검색 핸들러
  const handleSearch = async (dateOverride?: Dayjs | null) => {
    try {
      const targetDate = dateOverride ?? selectedDate
      if (!targetDate) return
      const params = {
        yearMonth: targetDate.format('YYYY-MM'),
        memo: memoFilter || '',
        workoutCategory: 'CD',
        circuitType: searchCircuitType === '전체' ? '' : searchCircuitType
      }
      const response = await api.get('/workout-categories/workout-history-master', { params })
      if (response.data.success) {
        const masterData = response.data.data || []
        setWorkoutMasters(masterData.map((item: any, index: number) => ({
          id: item.id || `temp-${index}`,
          date: item.date || '',
          time: item.time || '',
          workoutTime: item.workoutTime || item.workout_time || item.total_workout_time || '',
          memo: item.memo || ''
        })))
        setWorkoutDetails([])
        setSelectedMasterId(null)
      } else {
        setWorkoutMasters([])
      }
    } catch (error) {
      setWorkoutMasters([])
    }
  }

  // 마스터 선택 시 상세 데이터 로드
  const handleMasterRowClick = async (master: WorkoutMaster) => {
    setSelectedMasterId(master.id)
    try {
      const response = await api.get(`/workout-categories/workout-history-detail/${master.id}`)
      if (response.data.success) {
        const detailData = response.data.data?.details || []
        setWorkoutDetails(detailData.map((item: any, index: number) => ({
          id: item.seq ? `${item.workout_history_master_id}-${item.seq}` : `detail-${index}`,
          exerciseId: item.exerciseId || item.exercises_id || '',
          sequence: item.seq || item.sequence || index + 1,
          exerciseName: item.exerciseName || item.exercise_name || item.name_ko || '',
          name_en: item.name_en || '',
          targetMuscle: item.targetMuscle || item.target_muscle || item.target_muscles || '',
          equipment: item.equipment || '',
          characteristics: item.characteristics || '',
          purpose: item.purpose || '',
          position: convertServerPositionToCD(item.position || 'L1'),
          video_url: item.video_url || '',
          time: item.duration || item.time || 30,
          video_start_time: item.video_start_time || 0,
          video_end_time: item.video_end_time || 0,
        })))
      } else {
        setWorkoutDetails([])
      }
    } catch (error) {
      setWorkoutDetails([])
    }
  }

  const convertServerPositionToCD = (serverPosition: string): string => {
    const mapping: { [key: string]: string } = { 'L1': 'CD1', 'L2': 'CD2', 'L3': 'CD3', 'R1': 'CD4', 'R2': 'CD5', 'R3': 'CD6' }
    return mapping[serverPosition] || serverPosition
  }

  const convertCDPositionToServer = (cdPosition: string): string => {
    const mapping: { [key: string]: string } = { 'CD1': 'L1', 'CD2': 'L2', 'CD3': 'L3', 'CD4': 'R1', 'CD5': 'R2', 'CD6': 'R3' }
    return mapping[cdPosition] || cdPosition
  }

  const getPositionByIndex = (index: number): string => `CD${index + 1}`

  const reassignPositions = (exercisesList: Exercise[]): Exercise[] =>
    exercisesList.map((exercise, index) => ({ ...exercise, position: getPositionByIndex(index) }))

  const handleApply = async (master?: WorkoutMaster) => {
    const targetMaster = master || workoutMasters.find(m => m.id === selectedMasterId)
    if (!targetMaster) {
      showToast('기록을 먼저 선택해주세요.', 'destructive')
      return
    }

    let details = workoutDetails
    if (master || targetMaster.id !== selectedMasterId) {
      // 명시적으로 master가 주어졌거나 선택된 master와 다르면 새로 가져옴
      try {
        const response = await api.get(`/workout-categories/workout-history-detail/${targetMaster.id}`)
        if (response.data.success) {
          const detailData = response.data.data?.details || []
          details = detailData.map((item: any, index: number) => ({
            id: item.seq ? `${item.workout_history_master_id}-${item.seq}` : `detail-${index}`,
            exerciseId: item.exerciseId || item.exercises_id || '',
            sequence: item.seq || item.sequence || index + 1,
            exerciseName: item.exerciseName || item.exercise_name || item.name_ko || '',
            name_en: item.name_en || '',
            targetMuscle: item.targetMuscle || item.target_muscle || item.target_muscles || '',
            equipment: item.equipment || '',
            characteristics: item.characteristics || '',
            purpose: item.purpose || '',
            position: convertServerPositionToCD(item.position || 'L1'),
            video_url: item.video_url || '',
            time: item.duration || item.time || 30,
            video_start_time: item.video_start_time || 0,
            video_end_time: item.video_end_time || 0,
          }))
        } else {
          showToast('상세 데이터를 불러오지 못했습니다.', 'destructive')
          return
        }
      } catch (error) {
        showToast('상세 데이터 로드 오류', 'destructive')
        return
      }
    }

    if (details.length === 0) {
      showToast('적용할 데이터가 없습니다.', 'destructive')
      return
    }

    setExercises(details.map((detail, index) => ({
      id: `applied-${targetMaster.id}-${detail.exerciseId}-${index}`,
      originalExerciseId: detail.exerciseId,
      name_ko: detail.exerciseName,
      name_en: detail.name_en || detail.exerciseName,
      level: 'beginner' as const,
      target_muscles: detail.targetMuscle,
      characteristics: detail.characteristics,
      equipment: detail.equipment,
      purpose: detail.purpose || 'Cool Down',
      duration: Math.max(10, detail.time || 30),
      position: getPositionByIndex(index),
      video_url: detail.video_url,
      video_start_time: detail.video_start_time || 0,
      video_end_time: detail.video_end_time || 0,
      is_active: true,
      major_category: 'CD'
    } as Exercise)))

    setRightSelectedDate(dayjs(targetMaster.date))
    setMemo(targetMaster.memo || '')
    setCurrentEditingMasterId(targetMaster.id)
    setOriginalDate(dayjs(targetMaster.date).format('YYYY-MM-DD'))
    setOriginalTime(targetMaster.time)
    showToast('기록이 적용되었습니다.')
  }

  const handleSave = async () => {
    if (!rightSelectedDate) { showToast('날짜를 선택해주세요.', 'destructive'); return }
    if (exercises.length === 0) { showToast('저장할 운동이 없습니다.', 'destructive'); return }

    try {
      const currentDate = rightSelectedDate.format('YYYY-MM-DD')
      const currentTime = '00:00'
      const existingMaster = workoutMasters.find(m => dayjs(m.date).format('YYYY-MM-DD') === currentDate && m.time === currentTime)
      const finalMasterId = existingMaster ? existingMaster.id : (currentDate === originalDate ? currentEditingMasterId : null)

      const saveData = {
        date: currentDate,
        time: currentTime,
        memo: memo || '',
        workoutCategory: 'CD',
        method_type: '',
        dynamicMasterId: 'none',
        staticMasterId: 'self',
        plans: [],
        exercises: exercises.map((ex, index) => ({
          originalExerciseId: ex.originalExerciseId || ex.id,
          sequence: index + 1,
          duration: ex.duration,
          position: convertCDPositionToServer(ex.position || getPositionByIndex(index)),
          exercise_type: 'CD'
        })),
        workoutExercises: [],
        masterId: finalMasterId
      }

      const response = await api.post('/workout-categories/HyberStrengthCircuitSave', saveData)
      if (response.data.success) {
        showToast('저장되었습니다.')
        handleCancel()
        await handleSearch()
      } else {
        showToast('저장 실패: ' + response.data.message, 'destructive')
      }
    } catch (error) {
      showToast('저장 중 오류 발생', 'destructive')
    }
  }

  const handleCancel = () => {
    setExercises([])
    setSelectedExercise(null)
    setMemo('')
    setCurrentEditingMasterId(null)
    setOriginalDate(null)
    setOriginalTime(null)
  }

  const handleDelete = () => {
    if (!selectedMasterId) { showToast('기록을 선택해주세요.', 'destructive'); return }
    setShowDeleteConfirm(true)
  }

  const handleConfirmDelete = async () => {
    try {
      const response = await api.delete(`/workout-categories/workout-history/${selectedMasterId}`)
      if (response.data.success) {
        showToast('삭제되었습니다.')
        setSelectedMasterId(null)
        setWorkoutDetails([])
        handleCancel()
        await handleSearch()
      }
    } catch (error) {
      showToast('삭제 실패', 'destructive')
    } finally {
      setShowDeleteConfirm(false)
    }
  }

  const handleExercisesSelected = (selectedExercises: Exercise[]) => {
    const updatedExercises = [...exercises, ...selectedExercises]
    setExercises(reassignPositions(updatedExercises))
  }

  const handleDeleteSingleExercise = (id: string) => {
    const updated = exercises.filter(ex => ex.id !== id)
    setExercises(reassignPositions(updated))
    if (selectedExercise?.id === id) setSelectedExercise(null)
  }

  const handleDurationChange = (id: string, duration: number) => {
    setExercises(exercises.map(ex => ex.id === id ? { ...ex, duration: Math.max(1, duration) } : ex))
  }

  const moveExercise = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1
    if (newIdx < 0 || newIdx >= exercises.length) return
    const newExercises = [...exercises]
    const temp = newExercises[index]
    newExercises[index] = newExercises[newIdx]
    newExercises[newIdx] = temp
    setExercises(reassignPositions(newExercises))
  }

  // Split Logic
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    if (isDraggingHorizontal) {
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100
      setLeftWidth(Math.min(Math.max(newWidth, 10), 90))
    } else if (isDraggingVertical) {
      const leftPanel = containerRef.current.querySelector('.left-panel')
      if (leftPanel) {
        const lpRect = leftPanel.getBoundingClientRect()
        const newHeight = ((e.clientY - lpRect.top) / lpRect.height) * 100
        setTopHeight(Math.min(Math.max(newHeight, 10), 90))
      }
    }
  }, [isDraggingHorizontal, isDraggingVertical])

  const handleMouseUp = useCallback(() => {
    setIsDraggingHorizontal(false)
    setIsDraggingVertical(false)
  }, [])

  useEffect(() => {
    if (isDraggingHorizontal || isDraggingVertical) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDraggingHorizontal, isDraggingVertical, handleMouseMove, handleMouseUp])

  // Vimeo Player Effect (ExerciseSelectionModal 패턴: 운동 변경 시 플레이어 재생성)
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

  useEffect(() => {
    handleSearch()
  }, [])

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] w-full overflow-hidden p-0 gap-[3px] bg-background" ref={containerRef}>
      {/* Toast Alert */}
      {toastConfig.open && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md animate-in fade-in slide-in-from-top-4">
          <Alert variant={toastConfig.type === 'destructive' ? 'destructive' : 'default'}>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm font-bold">{toastConfig.message}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="flex flex-1 min-h-0 min-w-0">
        {/* Left Panel */}
        <div
          className="left-panel flex flex-col bg-card border border-[#343637] dark:border-[#6b7280] rounded-lg overflow-hidden shadow-md"
          style={{ width: `${leftWidth}%` }}
        >
          {/* Left Top: Master List */}
          <div className="flex flex-col min-h-0 overflow-hidden" style={{ height: `${topHeight}%` }}>
            <Card className="flex-shrink-0 rounded-none border-0 border-b border-[#343637] dark:border-[#6b7280] shadow-none">
              <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Cool Down 기록
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-4 border-b border-[#343637] dark:border-[#6b7280] bg-muted/30">
                  <div className="flex flex-wrap items-end gap-2">

                    <div className="flex flex-col gap-1 flex-1 min-w-[130px]">
                      <Label className="text-[11px] text-muted-foreground leading-none">년월</Label>
                      <MonthInput
                        value={selectedDate ? selectedDate.format('YYYY-MM') : ''}
                        onChange={(e) => {
                          const value = e.target.value
                          const nextDate = value ? dayjs(`${value}-01`) : null
                          setSelectedDate(nextDate)
                          if (nextDate) handleSearch(nextDate)
                        }}
                        className="w-full border-[#343637] dark:border-[#6b7280] bg-card h-9 text-xs"
                      />
                    </div>

                    <div className="flex flex-col gap-1 flex-[2] min-w-[180px]">
                      <Label className="text-[11px] text-muted-foreground leading-none">메모</Label>
                      <div className="relative w-full min-w-0">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="메모 검색..."
                          className="w-full pl-8 border-[#343637] dark:border-[#6b7280] bg-card h-9 text-xs"
                          value={memoFilter}
                          onChange={(e) => setMemoFilter(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex-1 min-h-0 p-0 overflow-hidden">
              <div className="h-full border-t-0 border border-[#343637] dark:border-[#6b7280] bg-[#f9fafb] dark:bg-[#1d1d1d] overflow-hidden">
                <div className="h-full overflow-auto scrollbar-hide">
                  <ShadcnTable className="w-full table-fixed border-separate border-spacing-0">
                    <ShadcnTableHeader className="sticky top-0 z-10">
                      <ShadcnTableRow className="hover:bg-transparent border-b-0">
                        <ShadcnTableHead className="w-[110px] h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">
                          날짜
                        </ShadcnTableHead>
                        <ShadcnTableHead className="w-[90px] h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">
                          시간
                        </ShadcnTableHead>
                        <ShadcnTableHead className="h-[45px] px-2 text-xs font-bold text-center border-b-0 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">
                          메모
                        </ShadcnTableHead>
                      </ShadcnTableRow>
                    </ShadcnTableHeader>
                    <ShadcnTableBody className="bg-[#f9fafb] dark:bg-[#1d1d1d]">
                      {workoutMasters.length === 0 ? (
                        <ShadcnTableRow className="border-b-0">
                          <ShadcnTableCell colSpan={3} className="h-24 text-center border-b-0 text-muted-foreground text-xs">
                            조회된 기록이 없습니다.
                          </ShadcnTableCell>
                        </ShadcnTableRow>
                      ) : (
                        workoutMasters.map((m) => (
                          <ShadcnTableRow
                            key={m.id}
                            className={cn(
                              "cursor-pointer h-[35px] border-b-0 group transition-colors",
                              "hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30",
                              selectedMasterId === m.id && "bg-primary/20"
                            )}
                            onClick={() => handleMasterRowClick(m)}
                            onDoubleClick={() => { handleMasterRowClick(m); handleApply(m); }}
                          >
                            <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors">
                              {dayjs(m.date).format('YYYY-MM-DD')}
                            </ShadcnTableCell>
                            <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors">
                              {m.workoutTime}
                            </ShadcnTableCell>
                            <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-left truncate group-hover:text-inherit transition-colors">
                              {m.memo}
                            </ShadcnTableCell>
                          </ShadcnTableRow>
                        ))
                      )}
                    </ShadcnTableBody>
                  </ShadcnTable>
                </div>
              </div>
            </div>
          </div>

          {/* Vertical Splitter */}
          <div onMouseDown={() => setIsDraggingVertical(true)} className="h-2 cursor-row-resize bg-[#9e9e9e] hover:bg-primary flex items-center justify-center shrink-0">
            <div className="w-8 h-0.5 bg-card rounded-full" />
          </div>

          {/* Left Bottom: Detail List */}
          <div className="flex flex-col min-h-0 overflow-hidden p-0" style={{ height: `${100 - topHeight}%` }}>
            <div className="h-full border border-[#343637] dark:border-[#6b7280] bg-[#f9fafb] dark:bg-[#1d1d1d] overflow-hidden">
              <div className="h-full overflow-auto scrollbar-hide">
                <ShadcnTable className="w-full table-fixed border-separate border-spacing-0">
                  <ShadcnTableHeader className="sticky top-0 z-10 bg-[#b9adb5] dark:bg-gray-800">
                    <ShadcnTableRow className="h-[45px] hover:bg-transparent border-b-0 text-[#27272a] dark:text-[#94a3b8]">
                      <ShadcnTableHead className="w-[44px] h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">
                        #
                      </ShadcnTableHead>
                      <ShadcnTableHead className="h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">
                        운동명
                      </ShadcnTableHead>
                      <ShadcnTableHead className="w-[80px] h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">
                        부위
                      </ShadcnTableHead>
                      <ShadcnTableHead className="w-[64px] h-[45px] px-2 text-xs font-bold text-center border-b-0 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">
                        시간
                      </ShadcnTableHead>
                    </ShadcnTableRow>
                  </ShadcnTableHeader>
                  <ShadcnTableBody>
                    {workoutDetails.length === 0 ? (
                      <ShadcnTableRow className="border-b-0">
                        <ShadcnTableCell colSpan={4} className="h-24 text-center border-b-0 text-muted-foreground text-xs">
                          조회된 기록이 없습니다.
                        </ShadcnTableCell>
                      </ShadcnTableRow>
                    ) : (
                      workoutDetails.map((d) => (
                        <ShadcnTableRow
                          key={d.id}
                          className="h-[35px] border-b-0 group transition-colors bg-[#f9fafb] dark:bg-[#1d1d1d] hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30"
                        >
                          <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit group-hover:font-inherit transition-colors">
                            {d.sequence}
                          </ShadcnTableCell>
                          <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-left truncate border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit group-hover:font-inherit transition-colors">
                            {d.exerciseName}
                          </ShadcnTableCell>
                          <ShadcnTableCell className="h-[35px] py-0 px-2 text-[10px] text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit group-hover:font-inherit transition-colors">
                            {d.targetMuscle}
                          </ShadcnTableCell>
                          <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center group-hover:text-inherit group-hover:font-inherit transition-colors">
                            {d.time}
                          </ShadcnTableCell>
                        </ShadcnTableRow>
                      ))
                    )}
                  </ShadcnTableBody>
                </ShadcnTable>
              </div>
            </div>
          </div>
        </div>

        {/* Horizontal Splitter */}
        <div onMouseDown={() => setIsDraggingHorizontal(true)} className="w-2 cursor-col-resize hover:bg-primary flex items-center justify-center shrink-0">
          <div className="h-8 w-0.5 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Right Panel */}
        <div className="flex-1 flex flex-col min-w-0 gap-[3px]">
          <div className="flex-[1.0] min-h-0">
            <Card className="h-full flex flex-col bg-card shadow-md">
              <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  일자-시간별 Cool Down 등록
                </CardTitle>
              </CardHeader>

              <CardContent className="flex-1 min-h-0 overflow-hidden p-0 flex flex-col">
                <div className="p-4 border-b border-[#343637] dark:border-[#6b7280] bg-[#f9fafb]/50 dark:bg-muted/20 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex flex-col gap-1 flex-1 min-w-[130px]">
                      <Label className="text-[11px] text-muted-foreground leading-none">운동일자</Label>
                      <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="min-w-[150px] justify-between text-left border-[#343637] dark:border-[#6b7280] h-9 text-xs">
                            {rightSelectedDate ? rightSelectedDate.format(DATE_FORMATS.DAYJS_DISPLAY) : '날짜 선택'}
                            <CalendarIcon className="ml-2 h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={rightSelectedDate?.toDate()}
                            onSelect={(d) => {
                              setRightSelectedDate(d ? dayjs(d) : null)
                              if (d) setIsDatePickerOpen(false)
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" onClick={() => setExerciseModalOpen(true)} className="h-9">
                      <Plus className="h-4 w-4 mr-2" /> 운동선택
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete()}
                      className="h-9"
                      disabled={!selectedMasterId}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> 삭제
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleCancel()} className="h-9">
                      <X className="h-4 w-4 mr-2" /> 취소
                    </Button>
                    <Button size="sm" onClick={() => handleSave()} className="h-9" disabled={exercises.length === 0}>
                      <Save className="h-4 w-4 mr-2" /> 저장
                    </Button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 border border-t-0 border-[#343637] dark:border-[#6b7280] bg-[#f9fafb] dark:bg-[#1d1d1d] overflow-hidden">
                  <div className="h-full overflow-auto scrollbar-hide">
                    <ShadcnTable className="w-full table-fixed border-separate border-spacing-0">
                      <ShadcnTableHeader className="sticky top-0 z-10">
                        <ShadcnTableRow className="hover:bg-transparent border-b-0">
                          <ShadcnTableHead className="w-[70px] h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">위치</ShadcnTableHead>
                          <ShadcnTableHead className="w-[90px] h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">순차변경</ShadcnTableHead>
                          <ShadcnTableHead className="w-[90px] h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">시간(초)</ShadcnTableHead>
                          <ShadcnTableHead className="w-[150px] h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">운동명(영문)</ShadcnTableHead>
                          <ShadcnTableHead className="w-[150px] h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">운동명(한글)</ShadcnTableHead>
                          <ShadcnTableHead className="w-[110px] h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">자극부위</ShadcnTableHead>
                          <ShadcnTableHead className="min-w-[200px] h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">특징 및 효과</ShadcnTableHead>
                          <ShadcnTableHead className="w-[120px] h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">필요기구</ShadcnTableHead>

                          <ShadcnTableHead className="w-[70px] h-[45px] px-2 text-xs font-bold text-center border-b-0 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">삭제</ShadcnTableHead>
                        </ShadcnTableRow>
                      </ShadcnTableHeader>
                      <ShadcnTableBody className="bg-[#f9fafb] dark:bg-[#1d1d1d]">
                        {exercises.length === 0 ? (
                          <ShadcnTableRow className="border-b-0">
                          <ShadcnTableCell colSpan={9} className="h-24 text-center border-b-0 text-muted-foreground">
                              조회된 기록이 없습니다.
                            </ShadcnTableCell>
                          </ShadcnTableRow>
                        ) : (
                          exercises.map((ex, idx) => (
                            <ShadcnTableRow
                              key={ex.id}
                              className={cn(
                                "cursor-pointer h-[35px] border-b-0 group transition-colors",
                                "hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30",
                                selectedExercise?.id === ex.id && "bg-primary/20"
                              )}
                              onClick={() => setSelectedExercise(ex)}
                            >
                              <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors">
                                {ex.position || `CD${idx + 1}`}
                              </ShadcnTableCell>
                              <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors">
                                <div className="flex items-center justify-center gap-1">
                                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); moveExercise(idx, 'up'); }} disabled={idx === 0}>
                                    <ChevronUp className="h-4 w-4" />
                                  </Button>
                                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); moveExercise(idx, 'down'); }} disabled={idx === exercises.length - 1}>
                                    <ChevronDown className="h-4 w-4" />
                                  </Button>
                                </div>
                              </ShadcnTableCell>
                              <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDurationChange(ex.id, Math.max(10, ex.duration - 5));
                                    }}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <Input
                                    type="number"
                                    min={10}
                                    value={ex.duration}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      const raw = e.target.value;
                                      const val = raw === '' ? 10 : parseInt(raw, 10);
                                      if (!Number.isNaN(val) && val >= 10) handleDurationChange(ex.id, val);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    onFocus={(e) => { e.stopPropagation(); e.target.select(); }}
                                    className="h-7 w-12 text-xs text-center p-1 font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    aria-label="시간(초) 입력"
                                  />
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDurationChange(ex.id, ex.duration + 5);
                                    }}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              </ShadcnTableCell>
                              <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] truncate group-hover:text-inherit transition-colors">
                                {ex.name_en || '-'}
                              </ShadcnTableCell>
                              <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] truncate font-medium group-hover:text-inherit transition-colors">
                                {ex.name_ko || '-'}
                              </ShadcnTableCell>
                              <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] truncate text-muted-foreground group-hover:text-inherit transition-colors">
                                {ex.target_muscles || '-'}
                              </ShadcnTableCell>
                              <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-left border-r border-[#343637] dark:border-[#6b7280] truncate text-muted-foreground group-hover:text-inherit transition-colors">
                                {ex.characteristics || '-'}
                              </ShadcnTableCell>
                              <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] truncate text-muted-foreground group-hover:text-inherit transition-colors">
                                {ex.equipment || '-'}
                              </ShadcnTableCell>

                              <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center group-hover:text-inherit transition-colors">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteSingleExercise(ex.id); }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </ShadcnTableCell>
                            </ShadcnTableRow>
                          ))
                        )}
                      </ShadcnTableBody>
                    </ShadcnTable>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col lg:flex-row gap-[3px] flex-[1.0] min-h-0">
            <div className="flex-[2] order-2 lg:order-1">
              <Card className="h-full flex flex-col bg-card shadow-md">
                <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
                      <VideoIcon className="h-5 w-5 text-orange-500" />
                      영상 미리보기
                    </CardTitle>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handlePlayPause}
                      disabled={!isPlayerReady}
                      title={isPlaying ? '일시정지' : '재생'}
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleReplay}
                      disabled={!isPlayerReady}
                      title="구간 반복 확인"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>

                  <div />
                </CardHeader>
                <CardContent className="flex-1 min-h-0 flex flex-col gap-[3px] p-4">
                  <div className="flex-1 min-h-0 flex items-center justify-center">
                    {/* 16:9 비율을 유지하면서, 가능한 최대 크기로 표시(짤림 방지) */}
                    <div className="w-full max-w-full max-h-full aspect-video rounded-lg border border-[#343637] dark:border-[#6b7280] overflow-hidden relative bg-black">
                      {!selectedExercise?.video_url ? (
                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                          <div className="flex flex-col items-center">
                            <VideoIcon className="h-10 w-10 mb-2 opacity-30" />
                            <p className="text-sm">운동을 선택하면 영상이 표시됩니다</p>
                          </div>
                        </div>
                      ) : (
                        <div className="absolute inset-0">
                          <VimeoFitIframe videoId={selectedExercise.video_url} iframeRef={vimeoIframeRef} />
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex-1 order-1 lg:order-2">
              <Card className="h-full flex flex-col bg-card shadow-md">
                <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-orange-500" />
                    메모
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 overflow-auto p-0">
                  <Input
                    placeholder="운동에 대한 메모를 입력하세요..."
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    className="h-12 bg-card border-[#343637] dark:border-[#6b7280]"
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <ExerciseSelectionModal
        open={exerciseModalOpen}
        onClose={() => setExerciseModalOpen(false)}
        onExercisesSelected={handleExercisesSelected}
        selectedExercises={exercises}
        defaultCategory="CD"
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        variant="destructive"
        title="기록 삭제 확인"
        description="이 운동 기록을 영구적으로 삭제하시겠습니까?"
      />
    </div>
  )
}

export default CoolDown
