/**
 * 페이지 요약 — 쿨다운 (`/CoolDown`)
 *
 * 기능: 쿨다운 운동 편집·Vimeo 재생·이력 조회·저장·삭제(동적 스트레칭과 동일 API 패턴).
 *
 * 호출/연동:
 * - `GET /workout-categories/workout-history-master`
 * - `GET /workout-categories/workout-history-detail/:id`
 * - `POST /workout-categories/HyberStrengthCircuitSave`
 * - `DELETE /workout-categories/workout-history/:id`
 *
 * 관련 컴포넌트(`./components/`):
 * - `CoolDownMasterPanel`: 좌측(검색 + 마스터/상세 + 수직 스플리터)
 * - `CoolDownEditorPanel`: 우측 상단(편집 테이블 + 액션)
 * - `CoolDownPreviewPanel`: 우측 하단(영상 미리보기 + 메모)
 * - `useCoolDownVimeoPlayer`: Vimeo 플레이어 훅
 * - `useSplitLayout`: 좌우/상하 스플리터 훅
 * - `coolDownPositionUtils.ts`, `coolDownTypes.ts`
 *
 * 외부 컴포넌트: `ExerciseSelectionModal`, `ConfirmDialog`
 *
 * 흐름: 마스터 선택 → 상세 편집 → 저장 → 삭제 선택 시 API.
 */

import React, { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import dayjs, { Dayjs } from 'dayjs'
import 'dayjs/locale/ko'
import { Alert, AlertDescription } from '@/components/ui/alert'
import api from '@/services/api'
import ExerciseSelectionModal from '@/components/ExerciseSelectionModal/ExerciseSelectionModal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Exercise,
  ToastConfig,
  WorkoutDetail,
  WorkoutMaster,
} from './components/coolDownTypes'
import {
  convertCDPositionToServer,
  convertServerPositionToCD,
  getPositionByIndex,
  reassignPositions,
} from './components/coolDownPositionUtils'
import { useCoolDownVimeoPlayer } from './components/useCoolDownVimeoPlayer'
import { useSplitLayout } from './components/useSplitLayout'
import { CoolDownMasterPanel } from './components/CoolDownMasterPanel'
import { CoolDownEditorPanel } from './components/CoolDownEditorPanel'
import { CoolDownPreviewPanel } from './components/CoolDownPreviewPanel'

const mapDetailFromApi = (item: any, index: number): WorkoutDetail => ({
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
})

export const CoolDown: React.FC = () => {
  // 좌측 검색/목록
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(dayjs())
  const [memoFilter, setMemoFilter] = useState('')
  const [searchCircuitType] = useState('전체')
  const [workoutMasters, setWorkoutMasters] = useState<WorkoutMaster[]>([])
  const [workoutDetails, setWorkoutDetails] = useState<WorkoutDetail[]>([])
  const [selectedMasterId, setSelectedMasterId] = useState<string | null>(null)

  // 우측 편집
  const [rightSelectedDate, setRightSelectedDate] = useState<Dayjs | null>(dayjs())
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)
  const [memo, setMemo] = useState<string>('')

  // 모달/알림/확인
  const [exerciseModalOpen, setExerciseModalOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [toastConfig, setToastConfig] = useState<ToastConfig>({
    open: false,
    message: '',
    type: 'success',
  })

  // 편집 중 master ID
  const [currentEditingMasterId, setCurrentEditingMasterId] = useState<string | null>(null)
  const [originalDate, setOriginalDate] = useState<string | null>(null)

  // Vimeo 플레이어
  const { iframeRef, isPlayerReady, isPlaying, handlePlayPause, handleReplay } =
    useCoolDownVimeoPlayer({
      videoUrl: selectedExercise?.video_url,
      videoStartTime: selectedExercise?.video_start_time || 0,
      videoEndTime: selectedExercise?.video_end_time || 0,
    })

  // 스플리터 레이아웃
  const { containerRef, leftWidth, topHeight, startHorizontalDrag, startVerticalDrag } =
    useSplitLayout({ initialLeftWidth: 25, initialTopHeight: 40 })

  useEffect(() => {
    dayjs.locale('ko')
  }, [])

  const showToast = (message: string, type: 'success' | 'destructive' = 'success') => {
    setToastConfig({ open: true, message, type })
    setTimeout(() => setToastConfig((prev) => ({ ...prev, open: false })), 3000)
  }

  const handleSearch = async (dateOverride?: Dayjs | null) => {
    try {
      const targetDate = dateOverride ?? selectedDate
      if (!targetDate) return
      const params = {
        yearMonth: targetDate.format('YYYY-MM'),
        memo: memoFilter || '',
        workoutCategory: 'CD',
        circuitType: searchCircuitType === '전체' ? '' : searchCircuitType,
      }
      const response = await api.get('/workout-categories/workout-history-master', { params })
      if (response.data.success) {
        const masterData = response.data.data || []
        setWorkoutMasters(
          masterData.map((item: any, index: number) => ({
            id: item.id || `temp-${index}`,
            date: item.date || '',
            time: item.time || '',
            workoutTime: item.workoutTime || item.workout_time || item.total_workout_time || '',
            memo: item.memo || '',
          }))
        )
        setWorkoutDetails([])
        setSelectedMasterId(null)
      } else {
        setWorkoutMasters([])
      }
    } catch {
      setWorkoutMasters([])
    }
  }

  const handleMasterRowClick = async (master: WorkoutMaster) => {
    setSelectedMasterId(master.id)
    try {
      const response = await api.get(
        `/workout-categories/workout-history-detail/${master.id}`
      )
      if (response.data.success) {
        const detailData = response.data.data?.details || []
        setWorkoutDetails(detailData.map(mapDetailFromApi))
      } else {
        setWorkoutDetails([])
      }
    } catch {
      setWorkoutDetails([])
    }
  }

  const handleApply = async (master?: WorkoutMaster) => {
    const targetMaster = master || workoutMasters.find((m) => m.id === selectedMasterId)
    if (!targetMaster) {
      showToast('기록을 먼저 선택해주세요.', 'destructive')
      return
    }

    let details = workoutDetails
    if (master || targetMaster.id !== selectedMasterId) {
      try {
        const response = await api.get(
          `/workout-categories/workout-history-detail/${targetMaster.id}`
        )
        if (response.data.success) {
          const detailData = response.data.data?.details || []
          details = detailData.map(mapDetailFromApi)
        } else {
          showToast('상세 데이터를 불러오지 못했습니다.', 'destructive')
          return
        }
      } catch {
        showToast('상세 데이터 로드 오류', 'destructive')
        return
      }
    }

    if (details.length === 0) {
      showToast('적용할 데이터가 없습니다.', 'destructive')
      return
    }

    setExercises(
      details.map(
        (detail, index) =>
          ({
            id: `applied-${targetMaster.id}-${detail.exerciseId}-${index}`,
            originalExerciseId: detail.exerciseId,
            name_ko: detail.exerciseName,
            name_en: detail.name_en || detail.exerciseName,
            level: 'beginner',
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
            major_category: 'CD',
          }) as Exercise
      )
    )

    setRightSelectedDate(dayjs(targetMaster.date))
    setMemo(targetMaster.memo || '')
    setCurrentEditingMasterId(targetMaster.id)
    setOriginalDate(dayjs(targetMaster.date).format('YYYY-MM-DD'))
    showToast('기록이 적용되었습니다.')
  }

  const handleSave = async () => {
    if (!rightSelectedDate) {
      showToast('날짜를 선택해주세요.', 'destructive')
      return
    }
    if (exercises.length === 0) {
      showToast('저장할 운동이 없습니다.', 'destructive')
      return
    }

    try {
      const currentDate = rightSelectedDate.format('YYYY-MM-DD')
      const currentTime = '00:00'
      const existingMaster = workoutMasters.find(
        (m) => dayjs(m.date).format('YYYY-MM-DD') === currentDate && m.time === currentTime
      )
      const finalMasterId = existingMaster
        ? existingMaster.id
        : currentDate === originalDate
          ? currentEditingMasterId
          : null

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
          exercise_type: 'CD',
        })),
        workoutExercises: [],
        masterId: finalMasterId,
      }

      const response = await api.post(
        '/workout-categories/HyberStrengthCircuitSave',
        saveData
      )
      if (response.data.success) {
        showToast('저장되었습니다.')
        handleCancel()
        await handleSearch()
      } else {
        showToast('저장 실패: ' + response.data.message, 'destructive')
      }
    } catch {
      showToast('저장 중 오류 발생', 'destructive')
    }
  }

  const handleCancel = () => {
    setExercises([])
    setSelectedExercise(null)
    setMemo('')
    setCurrentEditingMasterId(null)
    setOriginalDate(null)
  }

  const handleDelete = () => {
    if (!selectedMasterId) {
      showToast('기록을 선택해주세요.', 'destructive')
      return
    }
    setShowDeleteConfirm(true)
  }

  const handleConfirmDelete = async () => {
    try {
      const response = await api.delete(
        `/workout-categories/workout-history/${selectedMasterId}`
      )
      if (response.data.success) {
        showToast('삭제되었습니다.')
        setSelectedMasterId(null)
        setWorkoutDetails([])
        handleCancel()
        await handleSearch()
      }
    } catch {
      showToast('삭제 실패', 'destructive')
    } finally {
      setShowDeleteConfirm(false)
    }
  }

  const handleExercisesSelected = (selectedExercises: Exercise[]) => {
    setExercises((prev) => reassignPositions([...prev, ...selectedExercises]))
  }

  const handleDeleteSingleExercise = (id: string) => {
    setExercises((prev) => reassignPositions(prev.filter((ex) => ex.id !== id)))
    if (selectedExercise?.id === id) setSelectedExercise(null)
  }

  const handleDurationChange = (id: string, duration: number) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, duration: Math.max(1, duration) } : ex))
    )
  }

  const moveExercise = (index: number, direction: 'up' | 'down') => {
    setExercises((prev) => {
      const newIdx = direction === 'up' ? index - 1 : index + 1
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const next = [...prev]
      const temp = next[index]
      next[index] = next[newIdx]
      next[newIdx] = temp
      return reassignPositions(next)
    })
  }

  useEffect(() => {
    handleSearch()
  }, [])

  return (
    <div
      className="flex flex-col h-[calc(100vh-140px)] w-full overflow-hidden p-0 gap-[3px] bg-background"
      ref={containerRef}
    >
      {toastConfig.open && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md animate-in fade-in slide-in-from-top-4">
          <Alert variant={toastConfig.type === 'destructive' ? 'destructive' : 'default'}>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm font-bold">{toastConfig.message}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="flex flex-1 min-h-0 min-w-0">
        <CoolDownMasterPanel
          leftWidth={leftWidth}
          topHeight={topHeight}
          selectedDate={selectedDate}
          memoFilter={memoFilter}
          workoutMasters={workoutMasters}
          workoutDetails={workoutDetails}
          selectedMasterId={selectedMasterId}
          onChangeYearMonth={(next) => {
            setSelectedDate(next)
            if (next) handleSearch(next)
          }}
          onChangeMemoFilter={setMemoFilter}
          onSearch={() => handleSearch()}
          onSelectMaster={handleMasterRowClick}
          onApplyMaster={handleApply}
          onStartVerticalDrag={startVerticalDrag}
        />

        {/* Horizontal Splitter */}
        <div
          onMouseDown={startHorizontalDrag}
          className="w-2 cursor-col-resize hover:bg-primary flex items-center justify-center shrink-0"
        >
          <div className="h-8 w-0.5 bg-muted-foreground/30 rounded-full" />
        </div>

        <div className="flex-1 flex flex-col min-w-0 gap-[3px]">
          <div className="flex-[1.0] min-h-0">
            <CoolDownEditorPanel
              rightSelectedDate={rightSelectedDate}
              onChangeDate={setRightSelectedDate}
              isDatePickerOpen={isDatePickerOpen}
              onChangeDatePickerOpen={setIsDatePickerOpen}
              exercises={exercises}
              selectedExerciseId={selectedExercise?.id ?? null}
              selectedMasterId={selectedMasterId}
              onSelectExercise={setSelectedExercise}
              onMoveExercise={moveExercise}
              onDurationChange={handleDurationChange}
              onDeleteSingle={handleDeleteSingleExercise}
              onOpenExerciseModal={() => setExerciseModalOpen(true)}
              onDelete={handleDelete}
              onCancel={handleCancel}
              onSave={handleSave}
            />
          </div>

          <CoolDownPreviewPanel
            videoUrl={selectedExercise?.video_url}
            iframeRef={iframeRef}
            isPlayerReady={isPlayerReady}
            isPlaying={isPlaying}
            memo={memo}
            onChangeMemo={setMemo}
            onPlayPause={handlePlayPause}
            onReplay={handleReplay}
          />
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
