/**
 * 페이지 요약 — 월간 프로그램 (`/MonthProgram`)
 *
 * 기능: 월·일별 운동 마스터/상세 편집, 복사·삭제, Electron 디바이스 선택·재생·리모컨 팝업.
 *
 * 호출/연동:
 * - `monthProgramApi`: workout-history-master/detail/exercises, copy-workout, control-token 등
 * - `electronHttp`: startWorkoutPlay/Relay, checkDeviceConnected, 디바이스 로컬 스토리지
 *
 * 관련 컴포넌트(`./components/`):
 * - `MonthProgramFilterBar`: 운동구분/서킷구분/년월 필터
 * - `MonthProgramMasterTabs`: 사용자/관리자 마스터 테이블 탭
 * - `WorkoutPlanTable`, `WorkoutSummaryTable`: 좌(라운드/세트)·우(요약) 테이블
 * - `WorkoutMemoBar`: 메모 입력
 * - `WorkoutDetailTable`: 운동 상세 정보(AMRAP/EMOM·stress/loop 횟수) + 컬럼 리사이즈
 * - `ElectronIPDialog`, `CopyConfirmToast`
 * - `useMainSplitter`, `useDetailColumnResize`: 분할/컬럼 리사이즈 훅
 * - `useWorkoutPlay`: Play / 디바이스 선택 / Electron IP 다이얼로그 훅
 * - `monthProgramApi`, `monthProgramTypes`, `monthProgramUtils`
 *
 * 외부 컴포넌트: `DeviceSelectDialog`, `ExerciseSelectionModal`
 *
 * 흐름: 이력 로드 → 편집·저장 → Play 시 토큰·릴레이·디바이스로 재생 제어.
 */

import React, { useCallback, useEffect, useState } from 'react'
import dayjs, { Dayjs } from 'dayjs'
import 'dayjs/locale/ko'
import updateLocale from 'dayjs/plugin/updateLocale'
import { useSearchParams } from 'react-router-dom'
import { Calendar, Dumbbell, Play, Save } from 'lucide-react'

import { useAppSelector } from '@/hooks/redux'
import { useSnackbar } from '@/contexts/SnackbarContext'
import { DeviceSelectDialog } from '@/components/DeviceManager'
import ExerciseSelectionModal from '@/components/ExerciseSelectionModal/ExerciseSelectionModal'
import {
  Card as ShadcnCard,
  CardContent as ShadcnCardContent,
  CardHeader as ShadcnCardHeader,
  CardTitle as ShadcnCardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DatePicker as ShadcnDatePicker } from '@/components/ui/date-picker'
import { cn } from '@/lib/utils'

import type {
  ExerciseSequence,
  WorkoutCategoryItem,
  WorkoutDetail,
  WorkoutMaster,
  WorkoutPlan,
} from './components/monthProgramTypes'
import { isAMRAPorEMOMCategory } from './components/monthProgramUtils'
import { useDetailColumnResize, useMainSplitter } from './components/useResizers'
import { useWorkoutPlay } from './components/useWorkoutPlay'
import {
  checkExistingWorkout,
  copyWorkout as copyWorkoutApi,
  fetchWorkoutCategories,
  fetchWorkoutDetail,
  fetchWorkoutExercises,
  fetchWorkoutMasters,
  updateMasterMemo,
} from './components/monthProgramApi'
import { MonthProgramFilterBar } from './components/MonthProgramFilterBar'
import { MonthProgramMasterTabs } from './components/MonthProgramMasterTabs'
import { WorkoutPlanTable } from './components/WorkoutPlanTable'
import { WorkoutSummaryTable } from './components/WorkoutSummaryTable'
import { WorkoutMemoBar } from './components/WorkoutMemoBar'
import { WorkoutDetailTable } from './components/WorkoutDetailTable'
import { ElectronIPDialog } from './components/ElectronIPDialog'
import { CopyConfirmToast } from './components/CopyConfirmToast'

dayjs.extend(updateLocale)

const DETAIL_COL_WIDTHS = [10, 20, 20, 14, 26, 10]
const DETAIL_COL_WIDTHS_WITH_REPS = [8, 7, 18, 18, 13, 28, 8]

const MonthProgram: React.FC = () => {
  const { showSnackbar } = useSnackbar()
  const notify = useCallback(
    (message: string, severity: 'success' | 'info' | 'warning' | 'error' = 'info') =>
      showSnackbar({ message, severity }),
    [showSnackbar],
  )
  const { user } = useAppSelector((state) => state.auth)
  const [searchParams] = useSearchParams()
  const initialTabValue = searchParams.get('admin') === 'true' ? 1 : 0

  const { leftAreaWidth, isResizingMain, handleMainMouseDown } = useMainSplitter(28)
  const {
    detailTableColumnWidths,
    resizingDetailColIndex,
    detailTableContainerRef,
    handleDetailColResizeStart,
  } = useDetailColumnResize(DETAIL_COL_WIDTHS)

  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(dayjs())
  const [exerciseType, setExerciseType] = useState<string>('전체')
  const [circuitType, setCircuitType] = useState<string>('전체')
  const [workoutCategories, setWorkoutCategories] = useState<WorkoutCategoryItem[]>([])
  const [workoutMasters, setWorkoutMasters] = useState<WorkoutMaster[]>([])
  const [adminWorkoutMasters, setAdminWorkoutMasters] = useState<WorkoutMaster[]>([])
  const [selectedMasterId, setSelectedMasterId] = useState<string | null>(null)
  const [selectedMaster, setSelectedMaster] = useState<WorkoutMaster | null>(null)
  const [recordTabValue, setRecordTabValue] = useState(initialTabValue)

  const [workoutDetails, setWorkoutDetails] = useState<WorkoutDetail[]>([])
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([])
  const [exerciseSequences, setExerciseSequences] = useState<ExerciseSequence[]>([])

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null)

  const [copyConfirmOpen, setCopyConfirmOpen] = useState(false)
  const [detailSelectedDate, setDetailSelectedDate] = useState<Dayjs | null>(dayjs())
  const [memo, setMemo] = useState<string>('')

  const [exerciseModalOpen, setExerciseModalOpen] = useState(false)
  const [selectedSequenceForEdit, setSelectedSequenceForEdit] = useState<WorkoutDetail | null>(null)

  const play = useWorkoutPlay({
    selectedMaster,
    exerciseSequences,
    workoutPlans,
    user: user ?? null,
    notify,
  })

  useEffect(() => {
    dayjs.locale('ko')
    dayjs.updateLocale('ko', {
      monthsShort: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
    })
  }, [])

  const loadCategories = async () => {
    const cats = await fetchWorkoutCategories()
    setWorkoutCategories(cats)
  }

  const loadMasters = async (admin: '0' | '1') => {
    if (!selectedDate) return
    const masters = await fetchWorkoutMasters({
      yearMonth: selectedDate.format('YYYY-MM'),
      workoutCategory: exerciseType === '전체' ? '' : exerciseType,
      circuitType: circuitType === '전체' ? '' : circuitType,
      admin,
    })
    if (admin === '0') setWorkoutMasters(masters)
    else setAdminWorkoutMasters(masters)
    setSelectedMasterId(null)
    setSelectedMaster(null)
  }

  const handleMasterRowClick = async (master: WorkoutMaster) => {
    setSelectedMasterId(master.id)
    setSelectedMaster(master)
    setMemo(master.memo || '')

    try {
      const { details, plans } = await fetchWorkoutDetail(master.id)
      setWorkoutDetails(details)
      setWorkoutPlans(plans)

      const sequences = await fetchWorkoutExercises(master.id)
      setExerciseSequences(sequences)
    } catch (error) {
      console.error('[MonthProgram] 기록 상세 조회 실패:', error)
      notify('운동 기록 상세 조회에 실패했습니다.', 'error')
      setWorkoutDetails([])
      setWorkoutPlans([])
      setExerciseSequences([])
    }

    setSelectedPlanId(null)
    setSelectedDetailId(null)
  }

  const handleRecordTabChange = (newValue: number) => {
    setRecordTabValue(newValue)
    setSelectedMasterId(null)
    setSelectedMaster(null)
    setWorkoutDetails([])
    setWorkoutPlans([])
    setExerciseSequences([])
    if (newValue === 1) loadMasters('1')
  }

  useEffect(() => {
    loadCategories()
    if (selectedDate) loadMasters(initialTabValue === 1 ? '1' : '0')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedDate) return
    loadMasters(recordTabValue === 0 ? '0' : '1')
    setSelectedMasterId(null)
    setSelectedMaster(null)
    setWorkoutDetails([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, exerciseType, circuitType, recordTabValue])

  const handleExerciseSelected = async (selectedExercises: any[]) => {
    if (!selectedSequenceForEdit || selectedExercises.length === 0) {
      setExerciseModalOpen(false)
      setSelectedSequenceForEdit(null)
      return
    }
    const newExercise = selectedExercises[0]
    const updated = workoutDetails.map((detail) =>
      detail.id === selectedSequenceForEdit.id
        ? {
            ...detail,
            exerciseId: newExercise.originalExerciseId || newExercise.id,
            exerciseName: newExercise.name_ko,
            targetMuscle: newExercise.target_muscles,
            equipment: newExercise.equipment,
            level: newExercise.level,
            characteristics: newExercise.characteristics,
            purpose: newExercise.purpose,
            video_url: newExercise.video_url,
            thumbnail_url: newExercise.thumbnail_url,
            major_category: newExercise.major_category,
          }
        : detail,
    )
    setWorkoutDetails(updated)
    setExerciseModalOpen(false)
    setSelectedSequenceForEdit(null)
  }

  const handleCopyWorkout = async () => {
    if (!selectedMaster || !detailSelectedDate || !user) {
      notify('복사할 운동 기록과 날짜를 모두 선택해주세요.', 'warning')
      return
    }
    if (exerciseSequences.length === 0) {
      notify('복사할 운동 계획이 없습니다.', 'warning')
      return
    }
    try {
      const exists = await checkExistingWorkout({
        userId: user.id,
        date: detailSelectedDate.format('YYYY-MM-DD'),
        time: '1',
      })
      if (exists) {
        notify('해당 일시에 운동계획이 등록되어 있습니다. 다른 일시를 선택하세요.', 'warning')
        return
      }
    } catch (error) {
      console.error('기존 운동 기록 확인 오류:', error)
      notify('기존 기록 확인에 실패했습니다. 다시 시도해주세요.', 'error')
      return
    }
    setCopyConfirmOpen(true)
  }

  const executeCopyWorkout = async () => {
    if (!selectedMaster || !detailSelectedDate || !user) return
    setCopyConfirmOpen(false)
    try {
      const data = await copyWorkoutApi({
        originalMasterId: selectedMaster.id,
        newDate: detailSelectedDate.format('YYYY-MM-DD'),
        newTime: '1',
        userId: user.id,
        exerciseSequences,
      })
      if (data.success) {
        notify('운동이 성공적으로 복사되었습니다.', 'success')
        await loadMasters(recordTabValue === 0 ? '0' : '1')
        setSelectedMaster(null)
        setSelectedMasterId(null)
        setWorkoutDetails([])
        setWorkoutPlans([])
        setExerciseSequences([])
      } else {
        throw new Error(data.error || '운동 복사에 실패했습니다.')
      }
    } catch (error) {
      console.error('운동복사 오류:', error)
      notify('운동 복사 중 오류가 발생했습니다.', 'error')
    }
  }

  const handleUpdateMemo = async () => {
    if (!selectedMaster) {
      notify('운동 기록을 선택해주세요.', 'warning')
      return
    }
    if (selectedMaster.is_admin) {
      notify('관리자 데이터는 메모를 수정할 수 없습니다.', 'warning')
      return
    }
    try {
      const data = await updateMasterMemo(selectedMaster.id, memo)
      if (data.success) {
        notify('메모가 성공적으로 저장되었습니다.', 'success')
        setSelectedMaster({ ...selectedMaster, memo })
      } else {
        throw new Error(data.error || '메모 저장에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('메모 저장 오류:', error)
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        '메모 저장 중 오류가 발생했습니다.'
      notify(errorMessage, 'error')
    }
  }

  const isAMRAPorEMOM = isAMRAPorEMOMCategory(
    selectedMaster?.workoutCategoriesId,
    selectedMaster?.workoutCategory,
    selectedMaster?.workoutCategoriesName,
  )

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-[3px] p-0 overflow-hidden relative bg-background">
      <div className="flex-1 flex min-h-0 h-full gap-[3px]">
        <ShadcnCard
          className="flex flex-col min-h-0 h-full overflow-hidden shadow-md"
          style={{ width: `${leftAreaWidth}%` }}
        >
          <ShadcnCardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
            <ShadcnCardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
              <Calendar className="w-5 h-5 text-primary" />
              월간프로그램 기록
            </ShadcnCardTitle>
          </ShadcnCardHeader>

          <ShadcnCardContent className="p-0">
            <MonthProgramFilterBar
              exerciseType={exerciseType}
              onExerciseTypeChange={setExerciseType}
              circuitType={circuitType}
              onCircuitTypeChange={setCircuitType}
              selectedDate={selectedDate}
              onSelectedDateChange={setSelectedDate}
              workoutCategories={workoutCategories}
            />
          </ShadcnCardContent>

          <ShadcnCardContent className="flex-1 min-h-0 p-0 overflow-hidden flex flex-col">
            <MonthProgramMasterTabs
              recordTabValue={recordTabValue}
              onTabChange={handleRecordTabChange}
              userName={user?.name || '사용자'}
              workoutMasters={workoutMasters}
              adminWorkoutMasters={adminWorkoutMasters}
              selectedMasterId={selectedMasterId}
              onRowClick={handleMasterRowClick}
            />
          </ShadcnCardContent>
        </ShadcnCard>

        <div
          onMouseDown={handleMainMouseDown}
          className={cn(
            'w-1 cursor-col-resize transition-colors duration-200 flex-shrink-0 relative',
            isResizingMain ? 'bg-primary' : 'bg-muted hover:bg-primary/50',
          )}
        >
          <div className="absolute -left-1 -right-1 top-0 bottom-0 cursor-col-resize" />
        </div>

        <ShadcnCard
          className="flex flex-col min-h-0 h-full overflow-hidden shadow-md"
          style={{ width: `${100 - leftAreaWidth}%` }}
        >
          <ShadcnCardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center justify-between w-full gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Dumbbell className="w-5 h-5 text-primary" />
                <ShadcnCardTitle className="text-lg font-bold text-nowrap">
                  운동기록 상세
                </ShadcnCardTitle>
                <div className="min-w-[140px]">
                  <ShadcnDatePicker
                    date={detailSelectedDate?.toDate() ?? new Date()}
                    setDate={(date) => date && setDetailSelectedDate(dayjs(date))}
                    displayFormat="yyyy년MM월dd일"
                    className="w-[160px]"
                  />
                </div>
                {recordTabValue === 1 && (
                  <Button
                    size="sm"
                    variant="default"
                    className="h-8"
                    onClick={handleCopyWorkout}
                    disabled={
                      !selectedMaster || exerciseSequences.length === 0 || !detailSelectedDate
                    }
                  >
                    <Save className="mr-1 h-4 w-4" />
                    저장
                  </Button>
                )}
              </div>

              <Button
                size="sm"
                className="h-8 bg-green-600 hover:bg-green-700 text-white"
                onClick={play.handlePlayWorkout}
                disabled={!selectedMaster || exerciseSequences.length === 0}
              >
                <Play className="mr-1 h-4 w-4" />
                Play
              </Button>
            </div>
          </ShadcnCardHeader>

          <ShadcnCardContent className="flex-1 min-h-0 p-0 overflow-hidden flex flex-col">
            {selectedMaster ? (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-shrink-0 flex flex-row gap-0 border-b border-[#343637] dark:border-[#6b7280]">
                  <WorkoutPlanTable
                    plans={workoutPlans}
                    selectedPlanId={selectedPlanId}
                    onSelectPlan={setSelectedPlanId}
                    selectedMaster={selectedMaster}
                    isAMRAPorEMOM={isAMRAPorEMOM}
                  />
                  <WorkoutSummaryTable
                    selectedMaster={selectedMaster}
                    workoutDetails={workoutDetails}
                    workoutPlans={workoutPlans}
                    exerciseSequences={exerciseSequences}
                  />
                </div>

                <WorkoutMemoBar
                  selectedMaster={selectedMaster}
                  memo={memo}
                  onMemoChange={setMemo}
                  onSave={handleUpdateMemo}
                />

                <WorkoutDetailTable
                  selectedMaster={selectedMaster}
                  workoutDetails={workoutDetails}
                  selectedDetailId={selectedDetailId}
                  onSelectDetail={setSelectedDetailId}
                  detailTableContainerRef={detailTableContainerRef}
                  detailTableColumnWidths={detailTableColumnWidths}
                  detailTableColumnWidthsWithReps={DETAIL_COL_WIDTHS_WITH_REPS}
                  resizingDetailColIndex={resizingDetailColIndex}
                  onColResizeStart={handleDetailColResizeStart}
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
                <Dumbbell className="w-16 h-16 opacity-20" />
                <div className="text-center">
                  <h3 className="text-lg font-semibold">운동 기록을 선택하세요</h3>
                  <p className="text-sm">좌측에서 운동 기록을 선택하면 상세 정보가 표시됩니다.</p>
                </div>
              </div>
            )}
          </ShadcnCardContent>
        </ShadcnCard>
      </div>

      <ExerciseSelectionModal
        open={exerciseModalOpen}
        onClose={() => {
          setExerciseModalOpen(false)
          setSelectedSequenceForEdit(null)
        }}
        onExercisesSelected={handleExerciseSelected}
        selectedExercises={[]}
        defaultCategory={selectedSequenceForEdit?.major_category || ''}
      />

      <ElectronIPDialog
        open={play.electronIPDialogOpen}
        onOpenChange={play.setElectronIPDialogOpen}
        electronIPInput={play.electronIPInput}
        onIPChange={play.setElectronIPInput}
        onConfirm={play.handleElectronIPConfirm}
      />

      <DeviceSelectDialog
        open={play.deviceSelectDialogOpen}
        onOpenChange={play.setDeviceSelectDialogOpen}
        onSelect={play.handleDeviceSelect}
        selectedDeviceId={play.selectedDeviceId}
      />

      <CopyConfirmToast
        open={copyConfirmOpen}
        detailSelectedDate={detailSelectedDate}
        onCancel={() => setCopyConfirmOpen(false)}
        onConfirm={executeCopyWorkout}
      />
    </div>
  )
}

export default MonthProgram
