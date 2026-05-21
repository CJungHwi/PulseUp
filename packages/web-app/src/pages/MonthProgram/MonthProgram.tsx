/**
 * 페이지 요약 — 월간 프로그램 (`/MonthProgram`)
 *
 * 기능: 월·일별 운동 마스터/상세 편집, 복사·삭제, Electron 디바이스 선택·재생·리모컨 팝업.
 *
 * 호출/연동:
 * - `api`: `workout-history-master`·`detail`·`workout-exercises`, `stats`, `check-existing-workout`, `copy-workout`, `electron/control-token`, `PUT/DELETE` 이력 등
 * - `electronHttp`: `startWorkoutPlay`/`startWorkoutPlayRelay`, `checkDeviceConnected`, 토큰·디바이스 로컬 스토리지
 * - 로컬 Electron: `GET http://{IP}:3002/info`
 * - DB/SP는 `packages/api-server` 내 `workout-categories`·`electron` 라우트 참조.
 *
 * 관련 컴포넌트: `DeviceSelectDialog`, `ExerciseSelectionModal`, shadcn Tabs/Table/Dialog.
 *
 * 흐름: 이력 로드 → 편집·저장 → Play 시 토큰·릴레이·디바이스로 재생 제어.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react'
import dayjs, { Dayjs } from 'dayjs'
import 'dayjs/locale/ko'
import updateLocale from 'dayjs/plugin/updateLocale'
import { useAppSelector } from '../../hooks/redux'
import api from '../../services/api'
import { useSearchParams } from 'react-router-dom'
import {
  startWorkoutPlay,
  getApiTokenFromStorage,
  isServerRelayMode,
  startWorkoutPlayRelay,
  getSelectedDeviceId,
  setSelectedDeviceId,
  checkDeviceConnected
} from '../../services/electronHttp'
import { DeviceSelectDialog } from '../../components/DeviceManager'
import { getRemoteControlPopupWindowFeatures } from '../RemoteControlPage'
import { cn } from '@/lib/utils'
import { useSnackbar } from '@/contexts/SnackbarContext'
import {
  Card as ShadcnCard,
  CardContent as ShadcnCardContent,
  CardHeader as ShadcnCardHeader,
  CardTitle as ShadcnCardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MonthInput } from '@/components/ui/month-input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Select as ShadcnSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePicker as ShadcnDatePicker } from '@/components/ui/date-picker'
import {
  Table as ShadcnTable,
  TableBody as ShadcnTableBody,
  TableCell as ShadcnTableCell,
  TableHead as ShadcnTableHead,
  TableHeader as ShadcnTableHeader,
  TableRow as ShadcnTableRow,
} from '@/components/ui/table'
import {
  Tabs as ShadcnTabs,
  TabsList,
  TabsTrigger,
  TabsContent
} from '@/components/ui/tabs'
import {
  Calendar,
  Dumbbell,
  Copy,
  Play,
  Trash2,
  ChevronRight,
  Info,
  Clock,
  Waves,
  Save
} from 'lucide-react'

// dayjs updateLocale 플러그인 사용
dayjs.extend(updateLocale)
import ExerciseSelectionModal from '../../components/ExerciseSelectionModal/ExerciseSelectionModal'

// 운동 기록 마스터 타입 (PowerCircuit에서 가져온 것)
interface WorkoutMaster {
  id: string
  date: string
  time: string
  workoutTime: string
  memo: string
  workoutCategory: string // 운동 구분 (Power_Circuit, Dynamic_stretching, Static_stretching 등)
  workoutCategoriesId?: string // workout_categories_id
  workoutCategoriesName?: string // major_category_name
  circuitType?: string // 서킷 구분 (stress, loop)
  created_at?: string // 생성일자
  dsSeconds?: number // Dynamic Stretching 시간 (초)
  mainSeconds?: number // Main 운동 시간 (초)
  cdSeconds?: number // Cool Down 시간 (초)
  totalSeconds?: number // 총 운동 시간 (초)
  restSeconds?: number // 휴식 시간 (초)
  is_admin?: boolean // 관리자 데이터 여부
}

// 운동 상세 기록 타입 (PowerCircuit에서 가져온 것)
interface WorkoutDetail {
  id: string
  exerciseId: string // 실제 운동 ID
  sequence: number
  exerciseName: string
  name_ko?: string // 운동명(한글)
  name_en?: string // 운동명(영문)
  targetMuscle: string
  equipment: string
  level?: string
  characteristics?: string
  purpose?: string
  video_url?: string
  thumbnail_url?: string
  video_title?: string
  video_duration?: number
  video_start_time?: number
  video_end_time?: number
  video_loop_count?: number
  major_category?: string
  major_category_name?: string
  is_active?: boolean
  time: number
  position?: string // 위치 정보 추가
  reps?: number // AMRAP/EMOM용 횟수
}

// 운동 계획 정보 타입
interface WorkoutPlan {
  id: string
  round: number
  exerciseTime: number
  restTime: number
  waterBreakTime?: number
}

// 운동 실행 순서 타입 (workout_exercises 테이블 기반)
interface ExerciseSequence {
  id: string
  workout_history_master_id: string
  sequence: number
  round: number
  exercise_type: 'exercise' | 'rest' | 'water'
  exercise_id?: string
  exercise_name: string
  duration: number
  reps?: number // 횟수 추가
  position?: string
  // exercises 테이블 JOIN 정보
  name_ko?: string
  name_en?: string
  target_muscles?: string
  equipment?: string
  level?: string
  characteristics?: string
  purpose?: string
  video_url?: string
  video_start_time?: number
  video_end_time?: number
  thumbnail_url?: string
  major_category?: string
  major_category_name?: string
  created_at?: string
  updated_at?: string
}

/**
 * workout_history_plan 데이터를 exerciseSequences에 병합하는 헬퍼 함수
 * playback과 display 모두 같은 데이터(workout_history_plan)를 사용하도록 보정
 *
 * - Stress: position별 exercise 출현 순서(set index)로 plan 매핑
 *   DB의 round 값이 부정확할 수 있으므로, 같은 position의 n번째 exercise → plans[n-1]
 *   예: L1 1번째→plan[0](60초), L1 2번째→plan[1](40초), L1 3번째→plan[2](20초)
 * - Loop: 후반전 round를 plan round로 매핑 (round 4→plan 1, round 5→plan 2, ...)
 * - DS(round 0), CD(round 99)는 plan 적용 대상이 아니므로 원본 유지
 */
const mergeSequencesWithPlans = (
  sequences: ExerciseSequence[],
  plans: WorkoutPlan[],
  circuitType: string
): ExerciseSequence[] => {
  if (!plans || plans.length === 0) return sequences

  // plans를 round 기준 오름차순 정렬
  const sortedPlans = [...plans].sort((a, b) => a.round - b.round)
  const planCount = sortedPlans.length

  // plans를 round 기준으로 Map 변환 (Loop용)
  const planMap = new Map<number, WorkoutPlan>()
  plans.forEach(plan => planMap.set(plan.round, plan))

  if (circuitType === 'stress') {
    // Stress: position별 exercise 출현 순서로 plan 매핑
    // DB round 값에 의존하지 않고, 같은 position의 n번째 exercise → sortedPlans[n-1]
    const positionSetCounter = new Map<string, number>()
    let lastExercisePlanIndex = 0

    console.log('🔧 [mergeSequencesWithPlans] Stress 병합 시작:', {
      sequenceCount: sequences.length,
      planCount,
      sortedPlans: sortedPlans.map(p => ({ round: p.round, exerciseTime: p.exerciseTime, restTime: p.restTime, waterBreakTime: p.waterBreakTime })),
      mainExercises: sequences.filter(s => s.round > 0 && s.round < 99 && s.exercise_type === 'exercise').map(s => ({
        seq: s.sequence, round: s.round, position: s.position, duration: s.duration
      }))
    })

    const result = sequences.map(seq => {
      // DS(round 0), CD(round 99)는 plan 적용 대상이 아님
      if (seq.round <= 0 || seq.round >= 99) return seq

      if (seq.exercise_type === 'exercise') {
        // position(L1, L2, R3 등)별로 몇 번째 exercise인지 카운트
        const posKey = seq.position || seq.exercise_id || 'unknown'
        const count = positionSetCounter.get(posKey) || 0
        const planIndex = count % planCount
        positionSetCounter.set(posKey, count + 1)
        lastExercisePlanIndex = planIndex

        const plan = sortedPlans[planIndex]
        if (!plan) return seq

        console.log(`🔧 [Stress] ${posKey} #${count + 1} → plan[${planIndex}] exerciseTime=${plan.exerciseTime} (원본 duration=${seq.duration})`)

        return { ...seq, duration: plan.exerciseTime }
      }

      if (seq.exercise_type === 'rest') {
        // rest는 직전 exercise와 같은 plan index 사용
        const plan = sortedPlans[lastExercisePlanIndex]
        if (!plan) return seq
        return { ...seq, duration: plan.restTime }
      }

      if (seq.exercise_type === 'water') {
        // 물보충은 마지막 plan의 waterBreakTime 사용
        const lastPlan = sortedPlans[planCount - 1]
        if (!lastPlan) return seq
        return { ...seq, duration: lastPlan.waterBreakTime ?? seq.duration }
      }

      return seq
    })

    console.log('🔧 [mergeSequencesWithPlans] Stress 병합 완료:', {
      resultSample: result.filter(s => s.round > 0 && s.round < 99 && s.exercise_type === 'exercise').slice(0, 15).map(s => ({
        position: s.position, duration: s.duration, round: s.round
      }))
    })

    return result
  }

  // Loop: round 기준 매핑 (후반전 round는 modulo로 plan round 결정)
  return sequences.map(seq => {
    // DS(round 0), CD(round 99)는 plan 적용 대상이 아님
    if (seq.round <= 0 || seq.round >= 99) return seq

    // Loop 후반전: round > planCount → ((round-1) % planCount) + 1
    let planRound = seq.round
    if (seq.round > planCount) {
      planRound = ((seq.round - 1) % planCount) + 1
    }

    const plan = planMap.get(planRound)
    if (!plan) return seq

    // exercise_type에 따라 plan 값으로 duration 덮어쓰기
    let newDuration = seq.duration
    switch (seq.exercise_type) {
      case 'exercise':
        newDuration = plan.exerciseTime
        break
      case 'rest':
        newDuration = plan.restTime
        break
      case 'water':
        newDuration = plan.waterBreakTime ?? seq.duration
        break
    }

    return { ...seq, duration: newDuration }
  })
}

const MonthProgram: React.FC = () => {
  const { showSnackbar } = useSnackbar()
  const notify = useCallback(
    (message: string, severity: 'success' | 'info' | 'warning' | 'error' = 'info') =>
      showSnackbar({ message, severity }),
    [showSnackbar]
  )
  const { user } = useAppSelector((state) => state.auth)
  const [searchParams] = useSearchParams()

  // 좌우 영역 분할 상태
  const [leftAreaWidth, setLeftAreaWidth] = useState(28) // 초기값 20% (기록영역 -10% / 상세영역 +10%)
  const [isResizingMain, setIsResizingMain] = useState(false)

  // 기록영역 상태
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(dayjs())
  const [exerciseType, setExerciseType] = useState<string>('전체') // 운동구분
  const [circuitType, setCircuitType] = useState<string>('전체') // 스트레스/루프 구분
  const [workoutCategories, setWorkoutCategories] = useState<any[]>([]) // 운동 카테고리 목록
  const [workoutMasters, setWorkoutMasters] = useState<WorkoutMaster[]>([])
  const [adminWorkoutMasters, setAdminWorkoutMasters] = useState<WorkoutMaster[]>([]) // 관리자 데이터
  const [selectedMasterId, setSelectedMasterId] = useState<string | null>(null)
  const [selectedMaster, setSelectedMaster] = useState<WorkoutMaster | null>(null)
  // URL 파라미터에서 탭 정보 확인 (admin=true면 관리자 탭)
  const initialTabValue = searchParams.get('admin') === 'true' ? 1 : 0
  const [recordTabValue, setRecordTabValue] = useState(initialTabValue) // 기록영역 탭 상태

  // 상세영역 상태
  const [workoutDetails, setWorkoutDetails] = useState<WorkoutDetail[]>([])
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([])
  const [exerciseSequences, setExerciseSequences] = useState<ExerciseSequence[]>([])

  // 상세 영역 선택 상태
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null)

  // 운동 상세 테이블 컬럼 너비 (리사이저) - %
  const [detailTableColumnWidths, setDetailTableColumnWidths] = useState<number[]>([10, 20, 20, 14, 26, 10])
  const detailTableColumnWidthsWithReps = [8, 7, 18, 18, 13, 28, 8]
  const [resizingDetailColIndex, setResizingDetailColIndex] = useState<number | null>(null)
  const detailTableContainerRef = useRef<HTMLDivElement>(null)

  // 운동 복사 확인 스낵바
  const [copyConfirmOpen, setCopyConfirmOpen] = useState(false)

  // 우측 상세영역 상태
  const [detailSelectedDate, setDetailSelectedDate] = useState<Dayjs | null>(dayjs())
  const [memo, setMemo] = useState<string>('')
  // detailSelectedTime 제거됨 - 항상 'ALL' 사용

  // dayjs 한글 locale 설정 (월을 숫자로 표시)
  useEffect(() => {
    dayjs.locale('ko')
    dayjs.updateLocale('ko', {
      monthsShort: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
    })
  }, [])

  // 초기 상태 로그
  useEffect(() => {
    // console.log('=== MonthProgram 컴포넌트 초기화 ===')
    // console.log('초기 detailSelectedDate:', detailSelectedDate)
    // console.log('초기 selectedMaster:', selectedMaster)
  }, [])

  // 운동 선택 모달 상태
  const [exerciseModalOpen, setExerciseModalOpen] = useState<boolean>(false)
  const [selectedSequenceForEdit, setSelectedSequenceForEdit] = useState<ExerciseSequence | null>(null)

  // Electron IP 설정 다이얼로그 상태 (직접 연결 모드용)
  const [electronIPDialogOpen, setElectronIPDialogOpen] = useState<boolean>(false)
  const [electronIPInput, setElectronIPInput] = useState<string>('')
  const [pendingPlayAction, setPendingPlayAction] = useState<(() => void) | null>(null)

  // 디바이스 선택 다이얼로그 상태 (서버 중계 모드용)
  const [deviceSelectDialogOpen, setDeviceSelectDialogOpen] = useState<boolean>(false)
  const [selectedDeviceId, setSelectedDeviceIdState] = useState<string | null>(getSelectedDeviceId())
  const [selectedDeviceLabel, setSelectedDeviceLabel] = useState<string>('')

  // 메인 영역 리사이저 핸들러들
  const handleMainMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizingMain(true)
  }, [])

  const handleMainMouseMove = useCallback((e: MouseEvent) => {
    if (isResizingMain) {
      const containerWidth = window.innerWidth
      const newLeftWidth = (e.clientX / containerWidth) * 100
      setLeftAreaWidth(Math.min(Math.max(newLeftWidth, 20), 60)) // 20%~60% 제한
    }
  }, [isResizingMain])

  const handleMainMouseUp = useCallback(() => {
    setIsResizingMain(false)
  }, [])

  useEffect(() => {
    if (isResizingMain) {
      document.addEventListener('mousemove', handleMainMouseMove)
      document.addEventListener('mouseup', handleMainMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      return () => {
        document.removeEventListener('mousemove', handleMainMouseMove)
        document.removeEventListener('mouseup', handleMainMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isResizingMain, handleMainMouseMove, handleMainMouseUp])

  // 운동 상세 테이블 컬럼 리사이저 핸들러
  const handleDetailColResizeStart = useCallback((colIndex: number) => (e: React.MouseEvent) => {
    e.preventDefault()
    setResizingDetailColIndex(colIndex)
  }, [])

  const handleDetailColResizeMove = useCallback((e: MouseEvent) => {
    if (resizingDetailColIndex === null) return
    const tableWidth = detailTableContainerRef.current?.offsetWidth ?? 600
    const percentDelta = tableWidth > 0 ? (e.movementX / tableWidth) * 100 : 0
    setDetailTableColumnWidths(prev => {
      const next = [...prev]
      const newWidth = Math.max(5, Math.min(50, prev[resizingDetailColIndex] + percentDelta))
      next[resizingDetailColIndex] = newWidth
      return next
    })
  }, [resizingDetailColIndex])

  const handleDetailColResizeEnd = useCallback(() => {
    setResizingDetailColIndex(null)
  }, [])

  useEffect(() => {
    if (resizingDetailColIndex !== null) {
      document.addEventListener('mousemove', handleDetailColResizeMove)
      document.addEventListener('mouseup', handleDetailColResizeEnd)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      return () => {
        document.removeEventListener('mousemove', handleDetailColResizeMove)
        document.removeEventListener('mouseup', handleDetailColResizeEnd)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [resizingDetailColIndex, handleDetailColResizeMove, handleDetailColResizeEnd])

  // 마스터 행 클릭 핸들러
  const handleMasterRowClick = async (master: WorkoutMaster) => {
    setSelectedMasterId(master.id)
    setSelectedMaster(master)
    setMemo(master.memo || '') // 메모 상태 업데이트

    // 운동 상세 정보 조회
    await handleFetchWorkoutDetail(master.id)

    // 운동 실행 순서 조회
    await handleFetchWorkoutExercises(master.id)

    // 선택 초기화
    setSelectedPlanId(null)
    setSelectedDetailId(null)

    // console.log('선택된 운동 기록:', master)
  }

  // 운동 상세 정보 조회 핸들러
  const handleFetchWorkoutDetail = async (masterId: string) => {
    try {
      // console.log('운동 상세 정보 조회 시작:', masterId)

      // PowerCircuit과 동일하게 workout_history_detail API 호출
      const response = await api.get(`/workout-categories/workout-history-detail/${masterId}`)

      // console.log('운동 상세 API 응답:', response.data)

      if (response.data.success) {
        const responseData = response.data.data
        const detailData = responseData.details || []
        const planData = responseData.plans || []

        console.log('=== API 응답 확인 ===')
        console.log('responseData:', responseData)
        console.log('조회된 운동 상세 데이터:', detailData)
        console.log('조회된 계획 데이터:', planData)
        console.log('planData.length:', planData.length)

        // 상세 데이터 검증 및 정제
        const validatedDetailData = detailData.map((item: any, index: number) => ({
          id: item.seq ? `${item.workout_history_master_id}-${item.seq}` : `detail-${index}`, // seq 기반 고유 id 생성
          exerciseId: item.exerciseId || item.exercises_id || '',
          sequence: item.seq || item.sequence || index + 1,
          exerciseName: item.exerciseName || item.exercise_name || item.name_ko || '',
          name_ko: item.name_ko || item.exerciseName || item.exercise_name || '',
          name_en: item.name_en || '',
          targetMuscle: item.targetMuscle || item.target_muscle || item.target_muscles || '',
          equipment: item.equipment || '',
          level: item.level || 'beginner',
          characteristics: item.characteristics || '',
          purpose: item.purpose || '',
          video_url: item.video_url || '',
          thumbnail_url: item.thumbnail_url || '',
          video_title: item.video_title || '',
          video_duration: item.video_duration || 0,
          video_start_time: item.video_start_time || 0,
          video_end_time: item.video_end_time || 0,
          video_loop_count: item.video_loop_count || 1,
          major_category: item.major_category || '',
          major_category_name: item.major_category_name || '',
          is_active: item.is_active !== false,
          time: item.duration || item.time || 0,
          position: item.position || '',
          reps: item.reps != null ? item.reps : undefined
        }))

        setWorkoutDetails(validatedDetailData)

        // workout_history_plan 데이터가 있으면 직접 사용 (루프 서킷 지원)
        if (planData && planData.length > 0) {
          console.log('✅ workout_history_plan 데이터 사용')
          const validatedPlans = planData.map((plan: any, index: number) => {
            console.log(`Plan ${index + 1}:`, plan)
            return {
              id: `plan-${index}`,
              round: plan.round,
              exerciseTime: plan.time,
              restTime: plan.rest,
              waterBreakTime: plan.hydration
            }
          })

          console.log('✅ 변환된 workoutPlans:', validatedPlans)
          setWorkoutPlans(validatedPlans)
        } else {
          console.log('❌ workout_history_plan 데이터 없음, workout_exercises에서 추출')
          // plan 데이터가 없으면 workout_exercises에서 추출 (기존 방식)
          await handleFetchWorkoutPlans(masterId)
        }

        if (validatedDetailData.length === 0) {
          console.warn('운동 상세 데이터가 없습니다.')
        }
      } else {
        console.error('운동 상세 조회 실패:', response.data.message)
        setWorkoutDetails([])
      }
    } catch (error: any) {
      console.error('운동 상세 조회 오류:', error)
      console.error('오류 상세:', error.response?.data)
      setWorkoutDetails([])
    }
  }

  // 운동 계획 정보 조회 (workout_exercises에서 추출)
  const handleFetchWorkoutPlans = async (masterId: string) => {
    try {
      // console.log('운동 계획 정보 조회 시작:', masterId)

      // workout_exercises에서 round별 시간 정보 추출
      const response = await api.get(`/workout-categories/workout-exercises/${masterId}`)

      // console.log('운동 실행 순서 API 응답 (계획용):', response.data)

      if (response.data.success) {
        const exerciseData = response.data.data || []
        // console.log('조회된 운동 실행 순서 데이터 (계획용):', exerciseData)
        // console.log('첫 번째 데이터 샘플:', exerciseData[0])

        // Round별로 그룹화하여 시간, 휴식, 물보충 추출
        const roundMap = new Map<number, { time: number, rest: number, water: number }>()

        exerciseData.forEach((item: any) => {
          const round = item.round

          // Dynamic(0), Static(99, 999)은 제외
          if (round === 0 || round === 99 || round === 999) return

          if (!roundMap.has(round)) {
            roundMap.set(round, { time: 0, rest: 0, water: 0 })
          }

          const roundData = roundMap.get(round)!

          if (item.exercise_type === 'exercise') {
            roundData.time = item.duration // 운동 시간 (각 라운드의 운동 시간)
          } else if (item.exercise_name === '휴식') {
            roundData.rest = item.duration // 휴식 시간
          } else if (item.exercise_name === '물보충') {
            roundData.water = item.duration // 물보충 시간
          }
        })

        // Map을 배열로 변환
        const validatedPlans = Array.from(roundMap.entries())
          .sort((a, b) => a[0] - b[0]) // Round 번호순 정렬
          .map(([round, data], index) => ({
            id: `plan-${round}`,
            round: round,
            exerciseTime: data.time,
            restTime: data.rest,
            waterBreakTime: data.water
          }))

        // console.log('추출된 운동 계획 데이터:', validatedPlans)
        setWorkoutPlans(validatedPlans)
      } else {
        console.error('운동 계획 조회 실패:', response.data.message)
        setWorkoutPlans([])
      }
    } catch (error: any) {
      console.error('운동 계획 조회 오류:', error)
      console.error('오류 상세:', error.response?.data)
      setWorkoutPlans([])
    }
  }

  // 운동 실행 순서 조회 (workout_exercises 테이블)
  const handleFetchWorkoutExercises = async (masterId: string) => {
    try {
      // console.log('운동 실행 순서 조회 시작:', masterId)

      // workout_exercises API 호출
      const response = await api.get(`/workout-categories/workout-exercises/${masterId}`)

      // console.log('운동 실행 순서 API 응답:', response.data)
      // console.log('API 응답 구조:', {
      //   success: response.data.success,
      //   dataType: typeof response.data.data,
      //   dataLength: Array.isArray(response.data.data) ? response.data.data.length : 'Not Array',
      //   message: response.data.message
      // })

      if (response.data.success) {
        const exerciseData = response.data.data || []
        console.log('조회된 운동 실행 순서:', exerciseData)
        console.log('운동 실행 순서 개수:', exerciseData.length)

        if (exerciseData.length > 0) {
          console.log('첫 번째 운동 데이터 샘플:', exerciseData[0])
          console.log('첫 번째 데이터의 video_url:', exerciseData[0].video_url)
          console.log('마지막 운동 데이터 샘플:', exerciseData[exerciseData.length - 1])
        }

        // 데이터 검증 및 정제
        const validatedSequences = exerciseData.map((item: any, index: number) => {
          // Stretching 운동의 경우 exercise_name이 카테고리명으로 저장되어 있으므로 name_ko 사용
          const isStretching = item.major_category === 'Dynamic_stretching' || item.major_category === 'Static_stretching'
          const displayName = isStretching && item.name_ko ? item.name_ko : (item.exercise_name || item.name_ko || '운동')

          // console.log(`매핑 중 - index: ${index}, reps: ${item.reps}, exercise_name: ${displayName}`)

          return {
            id: item.id || `seq-${index}`,
            workout_history_master_id: item.workout_history_master_id || masterId,
            sequence: item.sequence || index + 1,
            round: item.round !== null && item.round !== undefined ? item.round : 1,
            exercise_type: item.exercise_type || 'exercise',
            exercise_id: item.exercise_id || null,
            exercise_name: displayName,
            duration: item.duration || 0,
            reps: item.reps !== null && item.reps !== undefined ? item.reps : null, // 횟수 추가 (null 유지)
            position: item.position || null,
            // exercises 테이블 JOIN 정보
            name_ko: item.name_ko || null,
            name_en: item.name_en || null,
            target_muscles: item.target_muscles || null,
            equipment: item.equipment || null,
            level: item.level || null,
            characteristics: item.characteristics || null,
            purpose: item.purpose || null,
            video_url: item.video_url || null,
            video_start_time: item.video_start_time || 0,
            video_end_time: item.video_end_time || 0,
            thumbnail_url: item.thumbnail_url || null,
            major_category: item.major_category || null,
            major_category_name: item.major_category_name || null,
            created_at: item.created_at || null,
            updated_at: item.updated_at || null
          }
        })

        // 디버깅: 원본 데이터 확인 (DB에서 가져온 workout_exercises 원본)
        console.log('=== 운동 실행 순서 데이터 분석 (DB 원본) ===')
        console.log('총 데이터 개수:', validatedSequences.length)
        console.log('🔍 [DB원본] Main exercise 목록 (round > 0 && round < 99):', 
          validatedSequences
            .filter(s => s.round > 0 && s.round < 99 && s.exercise_type === 'exercise')
            .map(s => ({ seq: s.sequence, round: s.round, position: s.position, duration: s.duration, name: s.exercise_name?.substring(0, 10) }))
        )

        // Round별 데이터 분석
        const roundAnalysis = validatedSequences.reduce((acc, item) => {
          const round = item.round
          if (!acc[round]) {
            acc[round] = { exercise: 0, rest: 0, water: 0, total: 0 }
          }
          acc[round].total++
          if (item.exercise_type === 'exercise') acc[round].exercise++
          if (item.exercise_type === 'rest') acc[round].rest++
          if (item.exercise_type === 'water') acc[round].water++
          return acc
        }, {} as Record<number, { exercise: number, rest: number, water: number, total: number }>)

        console.log('Round별 분석:', roundAnalysis)

        // 실제 운동만 필터링하여 확인
        const exerciseOnly = validatedSequences.filter(seq =>
          seq.exercise_type === 'exercise' &&
          seq.round > 0 &&
          seq.round < 99
        )
        console.log('실제 운동 데이터 (Round 1-98):', exerciseOnly.length, '개')
        console.log('실제 운동 Round 분포:', [...new Set(exerciseOnly.map(s => s.round))])

        // 운동 순서 정렬: Dynamic(0) → main(1~98) → Static(99)
        // sequence 번호 기준으로 정렬하여 saveWorkout.ts의 원래 저장 순서를 보존
        // (Stress: L1 모든 set → L2 모든 set / Loop: Round 1 모든 운동 → Round 2 모든 운동)
        // DS(round 0)와 CD(round 99)만 앞/뒤로 분리
        const sortedSequences = validatedSequences.sort((a, b) => {
          // DS(0) → Main(1~98) → CD(99) 그룹 분리
          const groupA = a.round === 0 ? 0 : a.round >= 99 ? 2 : 1
          const groupB = b.round === 0 ? 0 : b.round >= 99 ? 2 : 1
          if (groupA !== groupB) return groupA - groupB

          // 같은 그룹 내에서는 sequence 번호 기준 정렬 (원래 저장 순서 보존)
          return a.sequence - b.sequence
        })

        console.log('정렬된 데이터 샘플 (처음 10개):', sortedSequences.slice(0, 10).map(s => ({
          round: s.round,
          exercise_type: s.exercise_type,
          exercise_name: s.exercise_name,
          sequence: s.sequence
        })))

        setExerciseSequences(sortedSequences)

        if (validatedSequences.length === 0) {
          console.warn('운동 실행 순서 데이터가 없습니다.')
        }
      } else {
        console.error('운동 실행 순서 조회 실패:', response.data.message)
        setExerciseSequences([])
      }
    } catch (error: any) {
      console.error('운동 실행 순서 조회 오류:', error)
      console.error('오류 상세:', error.response?.data)
      setExerciseSequences([])
    }
  }


  // 운동 기록 조회 핸들러
  const handleSearchWorkoutMasters = async () => {
    try {
      if (!selectedDate) return

      const params = {
        yearMonth: selectedDate.format('YYYY-MM'),
        workoutCategory: exerciseType === '전체' ? '' : exerciseType,
        circuitType: circuitType === '전체' ? '' : circuitType,
        memo: '',
        admin: '0' // 사용자 데이터만 조회 (관리자 데이터 제외)
      }

      console.log('사용자 운동 기록 조회 파라미터:', params)

      // PowerCircuit과 동일한 API 호출
      const response = await api.get('/workout-categories/workout-history-master', { params })

      if (response.data.success) {
        const masterData = response.data.data || []
        // console.log('조회된 운동 기록:', masterData)

        // 데이터 검증 및 정제
        const validatedData = masterData.map((item: any, index: number) => {
          // console.log(`Master 데이터 ${index + 1}:`, item)

          return {
            id: item.id || `temp-${index}`,
            date: item.date || '',
            time: item.time || '',
            workoutTime: item.workoutTime || item.workout_time || item.total_workout_time || '',
            memo: item.memo || '',
            workoutCategory: item.workoutCategory || item.workout_category || 'Unknown',
            workoutCategoriesId: item.workout_categories_id || 'Unknown',
            workoutCategoriesName: item.major_category_name || '-',
            circuitType: item.circuit_type || item.circuitType || null,
            created_at: item.created_at || '',
            dsSeconds: item.ds_seconds ?? item.dsSeconds ?? undefined,
            mainSeconds: item.main_seconds ?? item.mainSeconds ?? undefined,
            cdSeconds: item.cd_seconds ?? item.cdSeconds ?? undefined,
            totalSeconds: item.total_seconds ?? item.totalSeconds ?? undefined,
            restSeconds: item.rest_seconds ?? item.restSeconds ?? undefined,
            is_admin: item.is_admin ?? item.admin ?? false
          }
        })

        // 날짜(내림차순) -> 생성일자(내림차순) 정렬
        const sortedData = validatedData.sort((a, b) => {
          // 1차: 날짜 비교 (내림차순)
          const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime()
          if (dateCompare !== 0) return dateCompare

          // 2차: 생성일자 비교 (내림차순)
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })

        setWorkoutMasters(sortedData)
        setSelectedMasterId(null)
        setSelectedMaster(null)
      } else {
        console.error('조회 실패:', response.data.message)
        setWorkoutMasters([])
      }
    } catch (error: any) {
      console.error('조회 오류:', error)
      setWorkoutMasters([])
    }
  }

  // 운동 카테고리 목록 조회
  const handleLoadWorkoutCategories = async () => {
    try {
      // console.log('운동 카테고리 목록 조회 시작')

      // 먼저 stats API를 시도 (인증 불필요)
      let response
      try {
        response = await api.get('/workout-categories/stats')
        // console.log('Stats API 응답:', response.data)
      } catch (statsError) {
        // console.log('Stats API 실패, 기본 API 시도:', statsError)
        // stats API 실패 시 기본 API 시도
        response = await api.get('/workout-categories')
        // console.log('기본 API 응답:', response.data)
      }

      if (response.data.success) {
        const categories = response.data.data || []
        // console.log('조회된 운동 카테고리:', categories)
        setWorkoutCategories(categories)
      } else {
        console.error('운동 카테고리 조회 실패:', response.data.message)
        // 실패 시 기본 카테고리 설정
        setWorkoutCategories([
          { id: 'Power_Circuit', name: 'Power Circuit' },
          { id: 'Dynamic_stretching', name: 'Dynamic Stretching' },
          { id: 'Static_stretching', name: 'Static Stretching' }
        ])
      }
    } catch (error: any) {
      console.error('운동 카테고리 조회 오류:', error)
      console.error('오류 상세:', error.response?.data)

      // 오류 시 기본 카테고리 설정
      setWorkoutCategories([
        { id: 'Power_Circuit', name: 'Power Circuit' },
        { id: 'Dynamic_stretching', name: 'Dynamic Stretching' },
        { id: 'Static_stretching', name: 'Static Stretching' }
      ])
    }
  }

  // 관리자 운동 기록 조회 핸들러 (admin = 1)
  const handleSearchAdminWorkoutMasters = async () => {
    try {
      if (!selectedDate) return

      const params = {
        yearMonth: selectedDate.format('YYYY-MM'),
        workoutCategory: exerciseType === '전체' ? '' : exerciseType,
        circuitType: circuitType === '전체' ? '' : circuitType,
        memo: '',
        admin: '1' // 관리자 데이터만 조회
      }

      console.log('관리자 운동 기록 조회 파라미터:', params)

      const response = await api.get('/workout-categories/workout-history-master', { params })

      if (response.data.success) {
        const masterData = response.data.data || []
        // console.log('조회된 관리자 운동 기록:', masterData)

        // 데이터 검증 및 정제 (사용자 탭과 동일하게 처리)
        const validatedData = masterData.map((item: any, index: number) => {
          // console.log(`Admin Master 데이터 ${index + 1}:`, item)

          return {
            id: item.id || `temp-${index}`,
            date: item.date || '',
            time: item.time || '',
            workoutTime: item.workoutTime || item.workout_time || item.total_workout_time || '',
            memo: item.memo || '',
            workoutCategory: item.workoutCategory || item.workout_category || 'Unknown',
            workoutCategoriesId: item.workout_categories_id || 'Unknown',
            workoutCategoriesName: item.major_category_name || '-',
            circuitType: item.circuit_type || item.circuitType || null,
            created_at: item.created_at || '',
            dsSeconds: item.ds_seconds ?? item.dsSeconds ?? undefined,
            mainSeconds: item.main_seconds ?? item.mainSeconds ?? undefined,
            cdSeconds: item.cd_seconds ?? item.cdSeconds ?? undefined,
            totalSeconds: item.total_seconds ?? item.totalSeconds ?? undefined,
            restSeconds: item.rest_seconds ?? item.restSeconds ?? undefined,
            is_admin: item.is_admin ?? item.admin ?? true // 관리자 데이터는 기본적으로 true
          }
        })

        // 날짜(내림차순) -> 생성일자(내림차순) 정렬
        const sortedData = validatedData.sort((a, b) => {
          // 1차: 날짜 비교 (내림차순)
          const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime()
          if (dateCompare !== 0) return dateCompare

          // 2차: 생성일자 비교 (내림차순)
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })

        setAdminWorkoutMasters(sortedData)
        setSelectedMasterId(null)
        setSelectedMaster(null)
      } else {
        console.error('관리자 기록 조회 실패:', response.data.message)
        setAdminWorkoutMasters([])
      }
    } catch (error: any) {
      console.error('관리자 기록 조회 오류:', error)
      setAdminWorkoutMasters([])
    }
  }

  // 탭 변경 핸들러
  const handleRecordTabChange = (newValue: number) => {
    setRecordTabValue(newValue)

    // 선택 초기화
    setSelectedMasterId(null)
    setSelectedMaster(null)
    setWorkoutDetails([])
    setWorkoutPlans([])
    setExerciseSequences([])

    // 관리자 탭으로 전환 시 관리자 데이터 조회
    if (newValue === 1) {
      handleSearchAdminWorkoutMasters()
    }
  }

  // 컴포넌트 마운트 시 자동 조회
  useEffect(() => {
    // console.log('MonthProgram 컴포넌트 마운트됨')
    handleLoadWorkoutCategories() // 운동 카테고리 목록 로드
    if (selectedDate) {
      // URL 파라미터에 따라 적절한 조회 함수 호출
      if (initialTabValue === 1) {
        handleSearchAdminWorkoutMasters()
      } else {
        handleSearchWorkoutMasters()
      }
    }
  }, []) // 마운트 시에만 실행

  // 카테고리 데이터 변경 추적
  useEffect(() => {
    // console.log('workoutCategories 상태 변경됨:', workoutCategories)
    // console.log('카테고리 개수:', workoutCategories.length)
  }, [workoutCategories])

  // 년월 또는 운동구분 변경 시 자동 조회
  useEffect(() => {
    if (selectedDate) {
      // 현재 탭에 따라 적절한 조회 함수 호출
      if (recordTabValue === 0) {
        handleSearchWorkoutMasters()
      } else {
        handleSearchAdminWorkoutMasters()
      }
      // 선택 초기화
      setSelectedMasterId(null)
      setSelectedMaster(null)
      setWorkoutDetails([])
    }
  }, [selectedDate, exerciseType, circuitType, recordTabValue]) // recordTabValue 추가

  // 선택 버튼 클릭 핸들러
  const handleExerciseChangeClick = (detail: WorkoutDetail) => {
    // console.log('운동 변경 클릭:', detail)
    setSelectedSequenceForEdit(detail as any)
    setExerciseModalOpen(true)
  }

  // 운동 선택 모달에서 운동 선택 완료 핸들러
  const handleExerciseSelected = async (selectedExercises: any[]) => {
    if (!selectedSequenceForEdit || selectedExercises.length === 0) {
      setExerciseModalOpen(false)
      setSelectedSequenceForEdit(null)
      return
    }

    const newExercise = selectedExercises[0] // 첫 번째 운동 사용
    // console.log('선택된 운동:', newExercise)
    // console.log('변경할 상세:', selectedSequenceForEdit)

    try {
      // workoutDetails 상태 업데이트
      const updatedDetails = workoutDetails.map(detail => {
        if (detail.id === (selectedSequenceForEdit as any).id) {
          return {
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
            major_category: newExercise.major_category
          }
        }
        return detail
      })

      setWorkoutDetails(updatedDetails)

      // TODO: 여기서 백엔드 API를 호출하여 DB 업데이트
      // console.log('운동 변경 완료:', {
      //   detailId: (selectedSequenceForEdit as any).id,
      //   newExercise: newExercise
      // })

    } catch (error) {
      console.error('운동 변경 오류:', error)
    }

    // 모달 닫기
    setExerciseModalOpen(false)
    setSelectedSequenceForEdit(null)
  }

  // 운동 선택 모달 닫기 핸들러
  const handleExerciseModalClose = () => {
    setExerciseModalOpen(false)
    setSelectedSequenceForEdit(null)
  }

  // Electron IP 자동 감지 시도
  const tryAutoDetectIP = async (baseIP: string): Promise<string | null> => {
    try {
      const response = await fetch(`http://${baseIP}:3002/info`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      })
      if (response.ok) {
        const data = await response.json()
        if (data.network?.addresses && data.network.addresses.length > 0) {
          // IPv4 주소 중 첫 번째 반환
          const ipv4 = data.network.addresses.find((addr: any) => addr.family === 'IPv4')
          return ipv4?.address || null
        }
      }
    } catch {
      // 자동 감지 실패 시 null 반환
    }
    return null
  }

  // Electron IP 설정 다이얼로그 열기
  const openElectronIPDialog = async (onConfirm: () => void, suggestedIP?: string) => {
    const savedIP = localStorage.getItem('electronIP') || 'localhost'
    let initialIP = suggestedIP || savedIP

    // localhost로 저장되어 있고, 실제로 localhost에 연결할 수 있으면 자동 감지 시도
    if (savedIP === 'localhost' && !suggestedIP) {
      const detectedIP = await tryAutoDetectIP('localhost')
      if (detectedIP) {
        initialIP = detectedIP
      }
    }

    setElectronIPInput(initialIP)
    setPendingPlayAction(() => onConfirm)
    setElectronIPDialogOpen(true)
  }

  // Electron IP 설정 확인
  const handleElectronIPConfirm = () => {
    const ip = electronIPInput.trim() || 'localhost'
    localStorage.setItem('electronIP', ip)
    setElectronIPDialogOpen(false)
    if (pendingPlayAction) {
      pendingPlayAction()
      setPendingPlayAction(null)
    }
  }

  // 운동 플레이 버튼 클릭 핸들러
  const handlePlayWorkout = async () => {
    if (!selectedMaster || exerciseSequences.length === 0) {
      notify('운동 기록을 선택해주세요.', 'warning')
      return
    }

    if (user?.linkageEnabled === false) {
      notify('현재 LINKHIIT앱 사용이 중지되어 있습니다. 관리자에 문의하세요.', 'error')
      return
    }

    // 서버 중계 모드인 경우 디바이스 선택 다이얼로그 표시
    if (isServerRelayMode()) {
      // 이미 선택된 디바이스가 있더라도 DB 초기화/재등록 후 stale 값일 수 있으므로 연결 상태를 확인
      if (selectedDeviceId) {
        const isConnected = await checkDeviceConnected(selectedDeviceId)
        if (isConnected) {
          executePlayWorkoutRelay(selectedDeviceId)
          return
        }

        setSelectedDeviceId(null)
        setSelectedDeviceIdState(null)
        setSelectedDeviceLabel('')
        notify('선택된 LINKHIIT 앱 연결이 끊어졌습니다. 디바이스를 다시 등록하거나 선택해주세요.', 'warning')
        setDeviceSelectDialogOpen(true)
      } else {
        // 디바이스 선택 다이얼로그 표시
        setDeviceSelectDialogOpen(true)
      }
      return
    }

    // 직접 연결 모드 (기존 방식)
    // localStorage에서 저장된 Electron IP 가져오기 (없으면 localhost 사용)
    let electronIP = localStorage.getItem('electronIP') || 'localhost'

    // localhost인 경우 IP 입력 다이얼로그 표시
    if (electronIP === 'localhost') {
      openElectronIPDialog(() => {
        electronIP = localStorage.getItem('electronIP') || 'localhost'
        executePlayWorkout(electronIP)
      })
      return
    }

    executePlayWorkout(electronIP)
  }

  // 디바이스 선택 핸들러
  const handleDeviceSelect = (deviceId: string, displayLabel: string) => {
    setSelectedDeviceIdState(deviceId)
    setSelectedDeviceLabel(displayLabel)
    setSelectedDeviceId(deviceId)
    executePlayWorkoutRelay(deviceId)
  }

  // 서버 중계 모드로 운동 플레이 실행
  const executePlayWorkoutRelay = async (deviceId: string) => {
    if (!selectedMaster || !user) return

    const wcId = (selectedMaster.workoutCategoriesId || '').toString().toUpperCase()
    const currentCircuitType = wcId === 'EMOM' ? 'emom' : wcId === 'AMRAP' ? 'amrap' : (selectedMaster.circuitType || 'stress')

    // workout_history_plan 값을 exerciseSequences에 병합 (재생 데이터 보정)
    const mergedSequences = mergeSequencesWithPlans(exerciseSequences, workoutPlans, currentCircuitType)

    // 병합 전후 비교 로그 (exercise만 필터하여 duration 변화 확인)
    const beforeExercises = exerciseSequences.filter(s => s.round > 0 && s.round < 99 && s.exercise_type === 'exercise')
    const afterExercises = mergedSequences.filter(s => s.round > 0 && s.round < 99 && s.exercise_type === 'exercise')
    console.log('🔄 [Relay] workout_history_plan 병합 결과:', {
      circuitType: currentCircuitType,
      plans: workoutPlans.map(p => ({ round: p.round, time: p.exerciseTime, rest: p.restTime, water: p.waterBreakTime })),
      exerciseBefore: beforeExercises.slice(0, 10).map(s => ({ round: s.round, position: s.position, duration: s.duration })),
      exerciseAfter: afterExercises.slice(0, 10).map(s => ({ round: s.round, position: s.position, duration: s.duration }))
    })

    // 운동 플레이 데이터 준비
    const mainRounds = mergedSequences
      .filter(s => s.round > 0 && s.round < 99)
      .map(s => s.round)
    const uniqueRounds = [...new Set(mainRounds)]
    const maxRound = uniqueRounds.length > 0 ? Math.max(...uniqueRounds) : 1

    const firstExercisePosition = mergedSequences.find(s =>
      s.round > 0 && s.round < 99 && s.exercise_type === 'exercise'
    )?.position
    let totalSets = 1
    if (firstExercisePosition) {
      totalSets = mergedSequences.filter(s =>
        s.round > 0 &&
        s.round < 99 &&
        s.exercise_type === 'exercise' &&
        s.position === firstExercisePosition
      ).length
    }

    // 운동 개수 계산 (Main 운동만, 중복 제외)
    const mainExercises = mergedSequences.filter(s =>
      s.round > 0 && s.round < 99 && s.exercise_type === 'exercise'
    )
    const uniqueExerciseIds = new Set(mainExercises.map(s => s.exercise_id))
    const exerciseCount = uniqueExerciseIds.size || mainExercises.length

    // 전체 운동 시간 계산: 저장된 total_seconds가 있으면 우선 사용, 없으면 병합된 시퀀스 합계 사용
    const totalDuration = selectedMaster?.totalSeconds && selectedMaster.totalSeconds > 0
      ? selectedMaster.totalSeconds
      : mergedSequences.reduce((sum, s) => sum + (s.duration || 0), 0)

    const playData = {
      masterId: selectedMaster.id,
      userId: user.id,
      sequences: mergedSequences,
      metadata: {
        totalRounds: maxRound,
        totalSets: totalSets,
        workoutCategory: selectedMaster.workoutCategoriesId || '',
        circuitType: currentCircuitType,
        date: selectedMaster.date,
        time: selectedMaster.time,
        workoutPlans: workoutPlans,
        exerciseCount: exerciseCount,
        totalDuration: totalDuration
      }
    }

    try {
      notify('운동을 시작합니다...', 'info')

      const result = await startWorkoutPlayRelay(deviceId, playData)

      if (result.success) {
        notify('운동이 시작되었습니다!', 'success')
        // 리모컨 페이지로 이동 (deviceId, deviceLabel 전달)
        const remoteControlUrl = `/remote-control?deviceId=${encodeURIComponent(deviceId)}&deviceLabel=${encodeURIComponent(selectedDeviceLabel || '링크힛')}&mode=relay`
        window.open(remoteControlUrl, 'RemoteControl', getRemoteControlPopupWindowFeatures())
      } else {
        notify(result.error || '운동 시작에 실패했습니다.', 'error')
      }
    } catch (error) {
      notify(
        error instanceof Error ? error.message : '운동 시작 중 오류가 발생했습니다.',
        'error'
      )
    }
  }

  // 실제 운동 플레이 실행 함수
  const executePlayWorkout = async (electronIP: string) => {
    // 1. 팝업 선오픈 (브라우저 팝업 차단 방지)
    const popup = window.open(
      '',
      'RemoteControl',
      getRemoteControlPopupWindowFeatures()
    ) as unknown as Window

    if (popup) {
      popup.document.write(`
        <html>
          <head><title>연결 중...</title></head>
          <body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;background-color:#1a1a1a;color:white;">
            <div style="text-align:center">
              <h3>Electron 앱에 연결 중입니다...</h3>
              <p>잠시만 기다려주세요.</p>
            </div>
          </body>
        </html>
      `)
    } else {
      notify('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.', 'warning')
      return
    }

    const wcId2 = (selectedMaster.workoutCategoriesId || '').toString().toUpperCase()
    const currentCircuitType = wcId2 === 'EMOM' ? 'emom' : wcId2 === 'AMRAP' ? 'amrap' : (selectedMaster.circuitType || 'stress')

    // workout_history_plan 값을 exerciseSequences에 병합 (재생 데이터 보정)
    const mergedSequences = mergeSequencesWithPlans(exerciseSequences, workoutPlans, currentCircuitType)

    // 병합 전후 비교 로그 (exercise만 필터하여 duration 변화 확인)
    const beforeExercises = exerciseSequences.filter(s => s.round > 0 && s.round < 99 && s.exercise_type === 'exercise')
    const afterExercises = mergedSequences.filter(s => s.round > 0 && s.round < 99 && s.exercise_type === 'exercise')
    console.log('🔄 [Direct] workout_history_plan 병합 결과:', {
      circuitType: currentCircuitType,
      plans: workoutPlans.map(p => ({ round: p.round, time: p.exerciseTime, rest: p.restTime, water: p.waterBreakTime })),
      exerciseBefore: beforeExercises.slice(0, 10).map(s => ({ round: s.round, position: s.position, duration: s.duration })),
      exerciseAfter: afterExercises.slice(0, 10).map(s => ({ round: s.round, position: s.position, duration: s.duration }))
    })

    // 운동 플레이 데이터 준비
    const mainRounds = mergedSequences
      .filter(s => s.round > 0 && s.round < 99)
      .map(s => s.round)
    const uniqueRounds = [...new Set(mainRounds)]
    const maxRound = uniqueRounds.length > 0 ? Math.max(...uniqueRounds) : 1

    const firstExercisePosition2 = mergedSequences.find(s =>
      s.round > 0 && s.round < 99 && s.exercise_type === 'exercise'
    )?.position
    let totalSets = 1
    if (firstExercisePosition2) {
      totalSets = mergedSequences.filter(s =>
        s.round > 0 &&
        s.round < 99 &&
        s.exercise_type === 'exercise' &&
        s.position === firstExercisePosition2
      ).length
    }

    // 운동 개수 계산 (Main 운동만, 중복 제외)
    const mainExercises = mergedSequences.filter(s =>
      s.round > 0 && s.round < 99 && s.exercise_type === 'exercise'
    )
    const uniqueExerciseIds = new Set(mainExercises.map(s => s.exercise_id))
    const exerciseCount = uniqueExerciseIds.size || mainExercises.length

    // 전체 운동 시간 계산: 저장된 total_seconds가 있으면 우선 사용, 없으면 병합된 시퀀스 합계 사용
    const totalDuration = selectedMaster?.totalSeconds && selectedMaster.totalSeconds > 0
      ? selectedMaster.totalSeconds
      : mergedSequences.reduce((sum, s) => sum + (s.duration || 0), 0)

    const playData = {
      masterId: selectedMaster.id,
      userId: user.id,
      sequences: mergedSequences,
      metadata: {
        totalRounds: maxRound,
        totalSets: totalSets,
        workoutCategory: selectedMaster.workoutCategoriesId || '',
        major_category_name: selectedMaster.workoutCategoriesName || '',
        circuitType: currentCircuitType,
        date: selectedMaster.date,
        time: selectedMaster.time,
        workoutPlans: workoutPlans,
        exerciseCount: exerciseCount,
        totalDuration: totalDuration
      }
    }

    // Electron에 운동 데이터 전송
    try {
      // 리모컨/현장 제어용 단기 토큰 발급(서버에만 요청)
      const tokenResp = await api.post('/electron/control-token')
      const controlToken: string | undefined = tokenResp?.data?.controlToken
      const expiresIn: number | undefined = tokenResp?.data?.expiresIn

      if (!controlToken) {
        throw new Error('control token 발급 실패')
      }

      // 팝업에서도 사용할 수 있도록 임시로 저장 (짧은 수명)
      try {
        localStorage.setItem('electronControlToken', controlToken)
        if (expiresIn) localStorage.setItem('electronControlTokenExpiresAt', String(Date.now() + expiresIn * 1000))
      } catch {
        // ignore
      }

      console.log(`운동 플레이 시작 요청... (${electronIP}:3002)`)
      // Electron 심박/ API 저장은 서버 세션+JWT가 필요함. 일반 액세스 토큰(~90m) 대신
      // 방금 발급한 control-token(6h, user_sessions 등록)을 넘겨 장시간 운동 중 401을 줄임.
      const response = await startWorkoutPlay(electronIP, 3002, playData, {
        signal: AbortSignal.timeout(5000),
        authToken: controlToken
      })

      const result = await response.json()

      if (response.ok && result.success) {
        console.log('운동 준비 성공')
        // 리모컨 팝업 URL 이동
        openRemoteControlPopup(electronIP, popup)
        return
      } else {
        throw new Error(result.error || '운동 준비 실패')
      }
    } catch (error) {
      console.error('Electron 앱 연결 실패 상세:', error)

      // 실패 시에도 팝업을 즉시 닫지 않음 (사용자가 인증서 허용 등을 할 수 있도록 유지)
      // if (popup) popup.close() 

      // 세션 만료로 로그인 페이지로 리다이렉트되는 상황이면, 중간 에러 알림을 띄우지 않음
      if ((window as any).__LINKHIIT_SESSION_EXPIRED__) return

      // 연결 실패 시 IP 재설정 다이얼로그 표시
      openElectronIPDialog(() => {
        const newIP = localStorage.getItem('electronIP') || electronIP
        executePlayWorkout(newIP)
      })

      // 인증서 문제 가능성 안내
      const confirmCert = window.confirm(
        `Electron 앱에 연결할 수 없습니다.\n(IP: ${electronIP}:3002)\n\n` +
        `처음 연결하는 경우 보안 인증서 허용이 필요합니다.\n` +
        `확인을 누르면 인증 페이지가 열립니다. 페이지에서 "고급 -> 안전하지 않음으로 이동"을 클릭하여 허용해주세요.`
      )
      if (confirmCert) {
        window.open(`https://${electronIP}:3002`, '_blank')
      }
    }
  }

  // 리모컨 팝업 열기 (선오픈된 창이 있으면 URL 이동, 없으면 새로 열기 시도)
  const openRemoteControlPopup = (electronIP: string, existingPopup?: Window | null) => {
    const url = `/remote-control?electronIP=${encodeURIComponent(electronIP)}`

    if (existingPopup && !existingPopup.closed) {
      existingPopup.location.href = url
      existingPopup.focus()
      return existingPopup
    }

    const popup = window.open(
      url,
      'RemoteControl',
      getRemoteControlPopupWindowFeatures()
    )

    if (!popup) {
      notify('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.', 'warning')
    }
    return popup
  }

  // 운동복사 버튼 클릭 핸들러 (확인 후 실제 복사 실행)
  const handleCopyWorkout = async () => {
    const timeValue = '1'

    if (!selectedMaster || !detailSelectedDate) {
      notify('복사할 운동 기록과 날짜를 모두 선택해주세요.', 'warning')
      return
    }

    if (exerciseSequences.length === 0) {
      notify('복사할 운동 계획이 없습니다.', 'warning')
      return
    }

    try {
      const checkResponse = await api.get('/workout-categories/check-existing-workout', {
        params: {
          userId: user.id,
          date: detailSelectedDate.format('YYYY-MM-DD'),
          time: timeValue
        }
      })

      if (checkResponse.data.success && checkResponse.data.data.exists) {
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
    const timeValue = '1'
    if (!selectedMaster || !detailSelectedDate) return

    setCopyConfirmOpen(false)

    try {
      const copyData = {
        originalMasterId: selectedMaster.id,
        newDate: detailSelectedDate.format('YYYY-MM-DD'),
        newTime: timeValue,
        userId: user.id,
        exerciseSequences: exerciseSequences
      }

      const response = await api.post('/workout-categories/copy-workout', copyData)

      if (response.data.success) {
        notify('운동이 성공적으로 복사되었습니다.', 'success')

        if (recordTabValue === 0) {
          await handleSearchWorkoutMasters()
        } else {
          await handleSearchAdminWorkoutMasters()
        }

        setSelectedMaster(null)
        setSelectedMasterId(null)
        setWorkoutDetails([])
        setWorkoutPlans([])
        setExerciseSequences([])
      } else {
        throw new Error(response.data.error || '운동 복사에 실패했습니다.')
      }
    } catch (error) {
      console.error('운동복사 오류:', error)
      notify('운동 복사 중 오류가 발생했습니다.', 'error')
    }
  }

  // 메모 업데이트 핸들러
  const handleUpdateMemo = async () => {
    if (!selectedMaster) {
      notify('운동 기록을 선택해주세요.', 'warning')
      return
    }

    // 관리자 데이터인 경우 메모 수정 불가
    if (selectedMaster.is_admin) {
      notify('관리자 데이터는 메모를 수정할 수 없습니다.', 'warning')
      return
    }

    try {
      // 백엔드 API 호출
      const response = await api.put(`/workout-categories/workout-history-master/${selectedMaster.id}`, {
        memo: memo
      })

      if (response.data.success) {
        notify('메모가 성공적으로 저장되었습니다.', 'success')

        // 선택된 마스터의 memo 업데이트
        setSelectedMaster({
          ...selectedMaster,
          memo: memo
        })
      } else {
        throw new Error(response.data.error || '메모 저장에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('메모 저장 오류:', error)
      const errorMessage = error.response?.data?.error || error.response?.data?.message || '메모 저장 중 오류가 발생했습니다.'
      notify(errorMessage, 'error')
    }
  }

  // 운동삭제 버튼 클릭 핸들러
  const handleDeleteWorkout = async () => {
    if (!selectedMaster) {
      notify('삭제할 운동 기록을 선택해주세요.', 'warning')
      return
    }

    const confirmMessage = `${selectedMaster.date} ${selectedMaster.workoutCategoriesName} 운동을 삭제하시겠습니까?\n삭제된 기록은 복구할 수 없습니다.`
    if (!window.confirm(confirmMessage)) {
      return
    }

    try {
      // 백엔드 API 호출
      const response = await api.delete(`/workout-categories/workout-history/${selectedMaster.id}`)

      if (response.data.success) {
        notify('운동이 성공적으로 삭제되었습니다.', 'success')

        // 선택 초기화
        setSelectedMaster(null)
        setSelectedMasterId(null)
        setExerciseSequences([])
        setWorkoutPlans([])

        // 기록영역 새로고침
        await handleSearchWorkoutMasters()
      } else {
        throw new Error(response.data.error || '운동 삭제에 실패했습니다.')
      }

    } catch (error: any) {
      console.error('운동삭제 오류:', error)
      const errorMessage = error.response?.data?.error || error.response?.data?.message || '운동 삭제 중 오류가 발생했습니다.'
      notify(errorMessage, 'error')
    }
  }


  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-[3px] p-0 overflow-hidden relative bg-background">
      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex min-h-0 h-full gap-[3px]">
        {/* 좌측 기록영역 */}
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
            <div className="p-4 border-b border-[#343637] dark:border-[#6b7280] bg-muted/30">
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
                  <Label className="text-[11px] text-muted-foreground leading-none">운동구분</Label>
                  <ShadcnSelect
                    value={exerciseType}
                    onValueChange={setExerciseType}
                    labels={{
                      '전체': '전체',
                      ...Object.fromEntries(workoutCategories.map(c => [
                        c.major_category,
                        c.major_category_name
                      ]))
                    }}
                  >
                    <SelectTrigger className="w-full h-9 text-xs border-[#343637] dark:border-[#6b7280] bg-card">
                      <SelectValue placeholder="운동구분" />
                    </SelectTrigger>
                    <SelectContent className="min-w-[200px]">
                      <SelectItem value="전체" className="whitespace-nowrap">전체</SelectItem>
                      {workoutCategories.map((category) => {
                        const value = category.major_category
                        const label = category.major_category_name
                        return (
                          <SelectItem key={value} value={value} className="whitespace-nowrap">
                            {label}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </ShadcnSelect>
                </div>

                <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
                  <Label className="text-[11px] text-muted-foreground leading-none">서킷구분</Label>
                  <ShadcnSelect
                    value={circuitType}
                    onValueChange={setCircuitType}
                    labels={{ '전체': '전체', stress: '스트레스', loop: '루프' }}
                  >
                    <SelectTrigger className="w-full h-9 text-xs border-[#343637] dark:border-[#6b7280] bg-card">
                      <SelectValue placeholder="서킷구분" />
                    </SelectTrigger>
                    <SelectContent className="min-w-[150px]">
                      <SelectItem value="전체" className="whitespace-nowrap">전체</SelectItem>
                      <SelectItem value="stress" className="whitespace-nowrap">스트레스</SelectItem>
                      <SelectItem value="loop" className="whitespace-nowrap">루프</SelectItem>
                    </SelectContent>
                  </ShadcnSelect>
                </div>

                <div className="flex flex-col gap-1 flex-1 min-w-[130px]">
                  <Label className="text-[11px] text-muted-foreground leading-none">년월</Label>
                  <MonthInput
                    value={selectedDate ? selectedDate.format('YYYY-MM') : ''}
                    onChange={(e) => {
                      const value = e.target.value
                      setSelectedDate(value ? dayjs(`${value}-01`) : null)
                    }}
                    className="w-full h-9 text-xs border-[#343637] dark:border-[#6b7280] bg-card"
                  />
                </div>
              </div>
            </div>
          </ShadcnCardContent>

          <ShadcnCardContent className="flex-1 min-h-0 p-0 overflow-hidden flex flex-col">
            <ShadcnTabs
              value={recordTabValue.toString()}
              onValueChange={(val) => handleRecordTabChange(parseInt(val))}
              className="flex flex-col h-full"
            >
              <TabsList className="grid grid-cols-2 h-9 bg-muted/40 dark:bg-gray-800/60 border border-[#343637] dark:border-[#6b7280] p-1 mx-0 my-0">
                <TabsTrigger
                  value="0"
                  className="text-xs font-bold text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none hover:bg-muted/60 dark:hover:bg-gray-700/60"
                >
                  {user?.name || '사용자'}
                </TabsTrigger>
                <TabsTrigger
                  value="1"
                  className="text-xs font-bold text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none hover:bg-muted/60 dark:hover:bg-gray-700/60"
                >
                  관리자
                </TabsTrigger>
              </TabsList>

              <TabsContent value="0" className="flex-1 min-h-0 !m-0 !p-0 overflow-hidden flex flex-col">
                <div className="flex-1 min-h-0 overflow-auto relative bg-[#f9fafb] dark:bg-[#1d1d1d] border border-[#343637] dark:border-[#6b7280] border-t-0 overscroll-behavior-contain touch-pan-y">
                  <ShadcnTable className="w-full table-fixed border-separate border-spacing-0">
                    <ShadcnTableHeader className="sticky top-0 z-10 bg-[#b9adb5] dark:bg-gray-800">
                      <ShadcnTableRow className="hover:bg-transparent border-b-0 h-[45px]">
                        <ShadcnTableHead className="w-[120px] text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] text-xs text-[#27272a] dark:text-[#94a3b8]">날짜</ShadcnTableHead>
                        <ShadcnTableHead className="w-[150px] text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] text-xs text-[#27272a] dark:text-[#94a3b8]">운동구분</ShadcnTableHead>
                        <ShadcnTableHead className="w-[100px] text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] text-xs text-[#27272a] dark:text-[#94a3b8]">서킷</ShadcnTableHead>
                        <ShadcnTableHead className="w-[300px] text-center font-bold px-2 border-b-0 text-xs text-[#27272a] dark:text-[#94a3b8]">메모</ShadcnTableHead>
                      </ShadcnTableRow>
                    </ShadcnTableHeader>
                    <ShadcnTableBody>
                      {workoutMasters.map((row) => (
                        <ShadcnTableRow
                          key={row.id}
                          className={cn(
                            "group cursor-pointer h-[35px] border-b-0 transition-colors hover:bg-muted/30 hover:text-blue-600 dark:hover:text-yellow-400",
                            selectedMasterId === row.id ? "bg-primary/20" : "bg-[#f9fafb] dark:bg-[#1d1d1d]"
                          )}
                          onClick={() => handleMasterRowClick(row)}
                        >
                          <ShadcnTableCell className="h-[35px] py-0 px-2 text-center border-r border-[#343637] dark:border-[#6b7280] text-xs group-hover:text-inherit transition-colors">
                            {row.date ? dayjs(row.date).format('YYYY-MM-DD') : '-'}
                          </ShadcnTableCell>
                          <ShadcnTableCell className="h-[35px] py-0 px-2 text-center border-r border-[#343637] dark:border-[#6b7280] text-xs truncate group-hover:text-inherit transition-colors">
                            {row.workoutCategoriesName}
                          </ShadcnTableCell>
                          <ShadcnTableCell className="h-[35px] py-0 px-2 text-center border-r border-[#343637] dark:border-[#6b7280] text-xs group-hover:text-inherit transition-colors">
                            {!row.circuitType || row.circuitType === 'none' ? '-' : row.circuitType === 'stress' ? '스트레스' : '루프'}
                          </ShadcnTableCell>
                          <ShadcnTableCell className="h-[35px] py-0 px-2 text-left text-xs truncate group-hover:text-inherit transition-colors" title={row.memo}>
                            {row.memo}
                          </ShadcnTableCell>
                        </ShadcnTableRow>
                      ))}
                    </ShadcnTableBody>
                  </ShadcnTable>
                </div>
              </TabsContent>

              <TabsContent value="1" className="flex-1 min-h-0 !m-0 !p-0 overflow-hidden flex flex-col">
                <div className="flex-1 min-h-0 overflow-auto relative bg-[#f9fafb] dark:bg-[#1d1d1d] border border-[#343637] dark:border-[#6b7280] border-t-0 overscroll-behavior-contain touch-pan-y">
                  <ShadcnTable className="w-full table-fixed border-separate border-spacing-0">
                    <ShadcnTableHeader className="sticky top-0 z-10 bg-[#b9adb5] dark:bg-gray-800">
                      <ShadcnTableRow className="hover:bg-transparent border-b-0 h-[45px]">
                        <ShadcnTableHead className="w-[120px] text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] text-xs text-[#27272a] dark:text-[#94a3b8]">날짜</ShadcnTableHead>
                        <ShadcnTableHead className="w-[150px] text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] text-xs text-[#27272a] dark:text-[#94a3b8]">운동구분</ShadcnTableHead>
                        <ShadcnTableHead className="w-[100px] text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] text-xs text-[#27272a] dark:text-[#94a3b8]">서킷</ShadcnTableHead>
                        <ShadcnTableHead className="w-[300px] text-center font-bold px-2 border-b-0 text-xs text-[#27272a] dark:text-[#94a3b8]">메모</ShadcnTableHead>
                      </ShadcnTableRow>
                    </ShadcnTableHeader>
                    <ShadcnTableBody>
                      {adminWorkoutMasters.map((row) => (
                        <ShadcnTableRow
                          key={row.id}
                          className={cn(
                            "group cursor-pointer h-[35px] border-b-0 transition-colors hover:bg-muted/30 hover:text-blue-600 dark:hover:text-yellow-400",
                            selectedMasterId === row.id ? "bg-primary/20" : "bg-[#f9fafb] dark:bg-[#1d1d1d]"
                          )}
                          onClick={() => handleMasterRowClick(row)}
                        >
                          <ShadcnTableCell className="h-[35px] py-0 px-2 text-center border-r border-[#343637] dark:border-[#6b7280] text-xs group-hover:text-inherit transition-colors">
                            {row.date ? dayjs(row.date).format('YYYY-MM-DD') : '-'}
                          </ShadcnTableCell>
                          <ShadcnTableCell className="h-[35px] py-0 px-2 text-center border-r border-[#343637] dark:border-[#6b7280] text-xs truncate group-hover:text-inherit transition-colors">
                            {row.workoutCategoriesName}
                          </ShadcnTableCell>
                          <ShadcnTableCell className="h-[35px] py-0 px-2 text-center border-r border-[#343637] dark:border-[#6b7280] text-xs group-hover:text-inherit transition-colors">
                            {!row.circuitType || row.circuitType === 'none' ? '-' : row.circuitType === 'stress' ? '스트레스' : '루프'}
                          </ShadcnTableCell>
                          <ShadcnTableCell className="h-[35px] py-0 px-2 text-left text-xs truncate group-hover:text-inherit transition-colors" title={row.memo}>
                            {row.memo}
                          </ShadcnTableCell>
                        </ShadcnTableRow>
                      ))}
                    </ShadcnTableBody>
                  </ShadcnTable>
                </div>
              </TabsContent>
            </ShadcnTabs>
          </ShadcnCardContent>
        </ShadcnCard>

        {/* 메인 영역 리사이저 핸들 */}
        <div
          onMouseDown={handleMainMouseDown}
          className={cn(
            "w-1 cursor-col-resize transition-colors duration-200 flex-shrink-0 relative",
            isResizingMain ? "bg-primary" : "bg-muted hover:bg-primary/50"
          )}
        >
          <div className="absolute -left-1 -right-1 top-0 bottom-0 cursor-col-resize" />
        </div>

        {/* 우측 상세영역 */}
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
                    disabled={!selectedMaster || exerciseSequences.length === 0 || !detailSelectedDate}
                  >
                    <Save className="mr-1 h-4 w-4" />
                    저장
                  </Button>
                )}
              </div>

              <Button
                size="sm"
                className="h-8 bg-green-600 hover:bg-green-700 text-white"
                onClick={handlePlayWorkout}
                disabled={!selectedMaster || exerciseSequences.length === 0}
              >
                <Play className="mr-1 h-4 w-4" />
                Play
              </Button>
            </div>
          </ShadcnCardHeader>

          <ShadcnCardContent className="flex-1 min-h-0 p-0 overflow-hidden flex flex-col">
              {selectedMaster ? (
                /* 운동 기록 상세 보기 모드 */
                (() => {
                const mcId = (selectedMaster?.workoutCategoriesId || selectedMaster?.workoutCategory || '').toString().toUpperCase()
                const mcName = (selectedMaster?.workoutCategoriesName || '').toString().toUpperCase()
                const isAMRAPorEMOM = mcId === 'AMRAP' || mcId === 'EMOM' || mcName === 'AMRAP' || mcName === 'EMOM'
                const fmtPlanTime = (val: number, isMinute: boolean) => {
                  if (isMinute) {
                    const asMin = val >= 60 ? Math.floor(val / 60) : val
                    return `${asMin}분`
                  }
                  return `${val}s`
                }
                return (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* 요약 정보 테이블과 운동 계획 영역 */}
                <div className="flex-shrink-0 flex flex-row gap-0 border-b border-[#343637] dark:border-[#6b7280]">
                  {/* 좌측: 운동 계획 (Round/Set) - 40% */}
                  <div className="w-[40%] flex flex-col border-r border-[#343637] dark:border-[#6b7280] bg-[#f9fafb] dark:bg-[#1d1d1d]">
                    {workoutPlans.length > 0 ? (
                      <ShadcnTable className="w-full table-fixed border-separate border-spacing-0">
                        <ShadcnTableHeader className="sticky top-0 z-10 bg-[#b9adb5] dark:bg-gray-800">
                          <ShadcnTableRow className="hover:bg-transparent border-b-0 h-[45px]">
                            <ShadcnTableHead className="text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] text-[#27272a] dark:text-[#94a3b8]">
                              {selectedMaster?.circuitType === 'stress' ? 'Set' : 'Round'}
                            </ShadcnTableHead>
                            <ShadcnTableHead className="text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] text-[#27272a] dark:text-[#94a3b8]">{isAMRAPorEMOM ? '시간(분)' : '시간'}</ShadcnTableHead>
                            <ShadcnTableHead className={cn("text-center font-bold px-2 border-b-0 text-[#27272a] dark:text-[#94a3b8]", !isAMRAPorEMOM && "border-r border-[#343637] dark:border-[#6b7280]")}>{isAMRAPorEMOM ? '물보충(분)' : '휴식'}</ShadcnTableHead>
                            {!isAMRAPorEMOM && (
                              <ShadcnTableHead className="text-center font-bold px-2 border-b-0 text-[#27272a] dark:text-[#94a3b8]">물</ShadcnTableHead>
                            )}
                          </ShadcnTableRow>
                        </ShadcnTableHeader>
                        <ShadcnTableBody>
                          {workoutPlans.map((row) => (
                            <ShadcnTableRow
                              key={row.id}
                              className={cn(
                                "h-[35px] border-b-0 group cursor-pointer hover:bg-muted/30 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors",
                                selectedPlanId === row.id ? "bg-primary/20" : "bg-[#f9fafb] dark:bg-[#1d1d1d]"
                              )}
                              onClick={() => setSelectedPlanId(row.id)}
                            >
                              <ShadcnTableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors">
                                {row.round}
                              </ShadcnTableCell>
                              <ShadcnTableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-[#343637] dark:border-[#6b7280] font-medium text-blue-600 dark:text-blue-400 group-hover:text-inherit transition-colors">
                                {fmtPlanTime(row.exerciseTime, isAMRAPorEMOM)}
                              </ShadcnTableCell>
                              <ShadcnTableCell className={cn("text-center h-[35px] py-0 px-2 text-xs group-hover:text-inherit transition-colors", isAMRAPorEMOM ? "text-cyan-600 dark:text-cyan-400" : "text-orange-600 dark:text-orange-400 border-r border-[#343637] dark:border-[#6b7280]")}>
                                {isAMRAPorEMOM ? fmtPlanTime(row.waterBreakTime || 0, true) : fmtPlanTime(row.restTime, false)}
                              </ShadcnTableCell>
                              {!isAMRAPorEMOM && (
                                <ShadcnTableCell className="text-center h-[35px] py-0 px-2 text-xs text-cyan-600 dark:text-cyan-400 group-hover:text-inherit transition-colors">
                                  {`${row.waterBreakTime || 0}s`}
                                </ShadcnTableCell>
                              )}
                            </ShadcnTableRow>
                          ))}
                        </ShadcnTableBody>
                      </ShadcnTable>
                    ) : (
                      <div className="flex items-center justify-center h-[165px] text-muted-foreground text-xs italic">
                        운동 계획 데이터 없음
                      </div>
                    )}
                  </div>

                  {/* 우측: 요약 정보 테이블 - 60% */}
                  <div className="w-[60%] flex flex-col bg-[#f9fafb] dark:bg-[#1d1d1d]">
                    <ShadcnTable className="w-full table-fixed border-separate border-spacing-0">
                      <ShadcnTableHeader>
                        <ShadcnTableRow className="hover:bg-transparent border-b-0 bg-[#b9adb5] dark:bg-gray-800 h-[45px]">
                          <ShadcnTableHead className="text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] text-[#27272a] dark:text-[#94a3b8] w-[25%]">구분</ShadcnTableHead>
                          <ShadcnTableHead className="text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] text-[#27272a] dark:text-[#94a3b8] w-[25%]">값</ShadcnTableHead>
                          <ShadcnTableHead className="text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] text-[#27272a] dark:text-[#94a3b8] w-[25%]">구분</ShadcnTableHead>
                          <ShadcnTableHead className="text-center font-bold px-2 border-b-0 text-[#27272a] dark:text-[#94a3b8] w-[25%]">값</ShadcnTableHead>
                        </ShadcnTableRow>
                      </ShadcnTableHeader>
                      <ShadcnTableBody>
                        {(() => {
                          const fmt = (sec: number) =>
                            `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`

                          const isDS = (mc: string) => { const u = mc.toUpperCase(); return u === 'DS' || u === 'DYNAMIC-STRETCHING' || u === 'DYNAMIC_STRETCHING' }
                          const isCD = (mc: string) => { const u = mc.toUpperCase(); return u === 'CD' || u === 'COOL-DOWN' || u === 'COOL_DOWN' || u === 'STATIC-STRETCHING' || u === 'STATIC_STRETCHING' }

                          const dsSeconds = workoutDetails
                            .filter(d => isDS(d.major_category || ''))
                            .reduce((s, d) => s + (d.time || 0), 0)
                          const cdSeconds = workoutDetails
                            .filter(d => isCD(d.major_category || ''))
                            .reduce((s, d) => s + (d.time || 0), 0)
                          const mainExerciseCount = workoutDetails
                            .filter(d => !isDS(d.major_category || '') && !isCD(d.major_category || ''))
                            .length

                          let mainWithRest = 0
                          let restOnly = 0
                          if (workoutPlans.length > 0 && mainExerciseCount > 0) {
                            const n = mainExerciseCount
                            const numGroups = Math.ceil(n / 6)
                            if (isAMRAPorEMOM) {
                              const mcId2 = (selectedMaster?.workoutCategoriesId || selectedMaster?.workoutCategory || '').toString().toUpperCase()
                              const mcName2 = (selectedMaster?.workoutCategoriesName || '').toString().toUpperCase()
                              const isEMOM = mcId2 === 'EMOM' || mcName2 === 'EMOM'
                              workoutPlans.forEach((row, idx) => {
                                const isLast = idx === workoutPlans.length - 1
                                const exSec = row.exerciseTime >= 60 ? row.exerciseTime : row.exerciseTime * 60
                                const waterSec = (row.waterBreakTime || 0) >= 60 ? (row.waterBreakTime || 0) : (row.waterBreakTime || 0) * 60
                                if (isEMOM) {
                                  const inGroup = Math.min(6, n - idx * 6)
                                  mainWithRest += inGroup * exSec
                                } else {
                                  mainWithRest += exSec
                                }
                                if (!isLast) restOnly += waterSec
                              })
                            } else {
                              workoutPlans.forEach((row, idx) => {
                                const isLast = idx === workoutPlans.length - 1
                                mainWithRest += row.exerciseTime * n
                                if (!isLast) {
                                  restOnly += row.restTime * n
                                } else {
                                  restOnly += row.restTime * (n - numGroups)
                                  mainWithRest += (row.waterBreakTime || 0) * (numGroups - 1)
                                }
                              })
                            }
                          }

                          const mainTotal = mainWithRest + restOnly
                          const totalSeconds = dsSeconds + mainTotal + cdSeconds
                          const roundSetCount = workoutPlans.length > 0
                            ? workoutPlans.length
                            : (() => {
                                const r = exerciseSequences.filter(s => s.round > 0 && s.round < 99).map(s => s.round)
                                return r.length > 0 ? Math.max(...r) : 0
                              })()

                          return (
                            <>
                              <ShadcnTableRow className="h-[30px] border-b-0">
                                <ShadcnTableCell className="p-[8px] text-center font-bold bg-muted/30 dark:bg-gray-700/50 border-r border-[#343637] dark:border-[#6b7280]">{selectedMaster?.circuitType === 'stress' ? 'Set 수' : 'Round 수'}</ShadcnTableCell>
                                <ShadcnTableCell className="p-[8px] text-center font-bold text-orange-600 dark:text-orange-400 border-r border-[#343637] dark:border-[#6b7280]">{roundSetCount} 번</ShadcnTableCell>
                                <ShadcnTableCell className="p-[8px] text-center font-bold bg-muted/30 dark:bg-gray-700/50 border-r border-[#343637] dark:border-[#6b7280]">{selectedMaster?.workoutCategoriesName}</ShadcnTableCell>
                                <ShadcnTableCell className="p-[8px] text-center font-bold text-blue-600 dark:text-blue-400">{fmt(mainTotal)}</ShadcnTableCell>
                              </ShadcnTableRow>
                              <ShadcnTableRow className="h-[30px] border-b-0">
                                <ShadcnTableCell className="p-[8px] text-center font-bold bg-muted/30 dark:bg-gray-700/50 border-r border-[#343637] dark:border-[#6b7280]">Dynamic Stretching</ShadcnTableCell>
                                <ShadcnTableCell className="p-[8px] text-center font-bold text-green-600 dark:text-green-400 border-r border-[#343637] dark:border-[#6b7280]">{fmt(dsSeconds)}</ShadcnTableCell>
                                <ShadcnTableCell className="p-[8px] text-center font-bold bg-muted/30 dark:bg-gray-700/50 border-r border-[#343637] dark:border-[#6b7280]">Cool Down</ShadcnTableCell>
                                <ShadcnTableCell className="p-[8px] text-center font-bold text-orange-600 dark:text-orange-400">{fmt(cdSeconds)}</ShadcnTableCell>
                              </ShadcnTableRow>
                              <ShadcnTableRow className="h-[30px] border-b-0">
                                <ShadcnTableCell className="p-[8px] text-center font-bold bg-muted/30 dark:bg-gray-700/50 border-r border-[#343637] dark:border-[#6b7280]">휴식시간</ShadcnTableCell>
                                <ShadcnTableCell className="p-[8px] text-center font-bold text-green-600 dark:text-green-400 border-r border-[#343637] dark:border-[#6b7280]">{fmt(restOnly)}</ShadcnTableCell>
                                <ShadcnTableCell className="p-[8px] text-center font-bold bg-muted/30 dark:bg-gray-700/50 border-r border-[#343637] dark:border-[#6b7280]">Total</ShadcnTableCell>
                                <ShadcnTableCell className="p-[8px] text-center font-bold text-green-600 dark:text-green-400">{fmt(totalSeconds)}</ShadcnTableCell>
                              </ShadcnTableRow>
                            </>
                          )
                        })()}
                      </ShadcnTableBody>
                    </ShadcnTable>
                  </div>
                </div>

                {/* 메모 영역 */}
                <div className="flex-shrink-0 flex items-center gap-2 p-2 border-b border-[#343637] dark:border-[#6b7280] bg-muted/10">
                  <span className="text-xs font-bold min-w-[40px]">메모</span>
                  <Input
                    value={memo}
                    onChange={(e) => {
                      if (!selectedMaster?.is_admin) {
                        setMemo(e.target.value)
                      }
                    }}
                    disabled={!selectedMaster || selectedMaster?.is_admin === true}
                    readOnly={selectedMaster?.is_admin === true}
                    className="h-9 border-[#343637] dark:border-[#6b7280] bg-card"
                    onKeyDown={(e) => {
                      if (selectedMaster?.is_admin) {
                        e.preventDefault()
                        return
                      }
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleUpdateMemo()
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={handleUpdateMemo}
                    disabled={!selectedMaster || selectedMaster?.is_admin === true || memo === (selectedMaster?.memo || '')}
                    className="h-8 min-w-[60px]"
                  >
                    저장
                  </Button>
                </div>

                {/* 운동 상세 정보 표시 영역 */}
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="flex items-center gap-2 flex-shrink-0 px-3 py-2 border-b border-[#343637] dark:border-[#6b7280] bg-muted/20">
                    <Info className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold">운동 상세 정보 ({workoutDetails.length}개)</span>
                  </div>

                  <div ref={detailTableContainerRef} className="flex-1 min-h-0 overflow-auto relative scrollbar-hide bg-[#f9fafb] dark:bg-[#1d1d1d] overscroll-behavior-contain touch-pan-y">
                    {(() => {
                      const mcId = (selectedMaster?.workoutCategoriesId || selectedMaster?.workoutCategory || '').toString().toUpperCase()
                      const mcName = (selectedMaster?.workoutCategoriesName || '').toString().toUpperCase()
                      const isAMRAPorEMOM = mcId === 'AMRAP' || mcId === 'EMOM' || mcName === 'AMRAP' || mcName === 'EMOM'
                      const isDS = (m: string) => { const u = (m || '').toUpperCase(); return u === 'DS' || u === 'DYNAMIC-STRETCHING' || u === 'DYNAMIC_STRETCHING' }
                      const isCD = (m: string) => { const u = (m || '').toUpperCase(); return u === 'CD' || u === 'COOL-DOWN' || u === 'COOL_DOWN' || u === 'STATIC-STRETCHING' || u === 'STATIC_STRETCHING' }
                      const headers = isAMRAPorEMOM
                        ? (['위치', '횟수', '운동명(영문)', '운동명(한글)', '자극부위', '특징/효과', '기구'] as const)
                        : (['위치', '운동명(영문)', '운동명(한글)', '자극부위', '특징/효과', '기구'] as const)
                      const colWidths = isAMRAPorEMOM ? detailTableColumnWidthsWithReps : detailTableColumnWidths
                      return (
                    <ShadcnTable className="w-full table-fixed border-separate border-spacing-0">
                      <colgroup>
                        {colWidths.map((w, i) => (
                          <col key={i} style={{ width: `${w}%`, minWidth: 40 }} />
                        ))}
                      </colgroup>
                      <ShadcnTableHeader className="sticky top-0 z-10 bg-[#b9adb5] dark:bg-gray-800">
                        <ShadcnTableRow className="hover:bg-transparent border-b-0 h-[45px]">
                          {headers.map((label, i) => (
                            <ShadcnTableHead
                              key={label}
                              className={cn(
                                "relative text-center font-bold px-2 border-b-0 border-[#343637] dark:border-[#6b7280] text-[#27272a] dark:text-[#94a3b8]",
                                i < headers.length - 1 && "border-r"
                              )}
                            >
                              {label}
                              {i < headers.length && (
                                <div
                                  role="separator"
                                  aria-orientation="vertical"
                                  tabIndex={0}
                                  aria-label={`${label} 컬럼 너비 조절`}
                                  onMouseDown={handleDetailColResizeStart(i)}
                                  className={cn(
                                    "absolute top-0 right-0 w-1 h-full cursor-col-resize transition-colors -mr-[2px]",
                                    "hover:bg-primary/60 active:bg-primary",
                                    resizingDetailColIndex === i && "bg-primary"
                                  )}
                                />
                              )}
                            </ShadcnTableHead>
                          ))}
                        </ShadcnTableRow>
                      </ShadcnTableHeader>
                      <ShadcnTableBody>
                        {workoutDetails.length > 0 ? (
                          workoutDetails.map((row, idx) => {
                            const showReps = isAMRAPorEMOM && !isDS(row.major_category || '') && !isCD(row.major_category || '')
                            return (
                            <ShadcnTableRow
                              key={row.id}
                              className={cn(
                                "h-[35px] border-b-0 group cursor-pointer hover:bg-muted/30 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors",
                                selectedDetailId === row.id ? "bg-primary/20" : "bg-[#f9fafb] dark:bg-[#1d1d1d]"
                              )}
                              onClick={() => setSelectedDetailId(row.id)}
                            >
                              <ShadcnTableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors">{row.position ?? idx + 1}</ShadcnTableCell>
                              {isAMRAPorEMOM && (
                                <ShadcnTableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors">
                                  {showReps ? (row.reps ?? '-') : ''}
                                </ShadcnTableCell>
                              )}
                              <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs border-r border-[#343637] dark:border-[#6b7280] truncate group-hover:text-inherit transition-colors">{row.name_en || '-'}</ShadcnTableCell>
                              <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs border-r border-[#343637] dark:border-[#6b7280] truncate text-blue-600 dark:text-blue-400 font-medium group-hover:text-inherit transition-colors">{row.name_ko || row.exerciseName || '-'}</ShadcnTableCell>
                              <ShadcnTableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-[#343637] dark:border-[#6b7280] truncate group-hover:text-inherit transition-colors">{row.targetMuscle || '-'}</ShadcnTableCell>
                              <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs border-r border-[#343637] dark:border-[#6b7280] truncate group-hover:text-inherit transition-colors">{row.characteristics || '-'}</ShadcnTableCell>
                              <ShadcnTableCell className="text-center h-[35px] py-0 px-2 text-xs truncate group-hover:text-inherit transition-colors">{row.equipment || '-'}</ShadcnTableCell>
                            </ShadcnTableRow>
                            )
                          })
                        ) : (
                          <ShadcnTableRow className="border-b-0">
                            <ShadcnTableCell colSpan={headers.length} className="h-24 text-center border-b-0 text-muted-foreground italic">
                              운동 상세 데이터 없음
                            </ShadcnTableCell>
                          </ShadcnTableRow>
                        )}
                      </ShadcnTableBody>
                    </ShadcnTable>
                      )
                    })()}
                  </div>
                </div>
              </div>
                )
              })()
            ) : (
              /* 선택된 운동 기록이 없는 경우 */
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
                <Dumbbell className="w-16 h-16 opacity-20" />
                <div className="text-center">
                  <h3 className="text-lg font-semibold">운동 기록을 선택하세요</h3>
                  <p className="text-sm">좌측에서 운동 기록을 선택하면 상세 정보가 표시됩니다.</p>
                </div>
              </div>
            )}
          </ShadcnCardContent>
        </ShadcnCard >
      </div >

      {/* 운동 선택 모달 */}
      <ExerciseSelectionModal
        open={exerciseModalOpen}
        onClose={handleExerciseModalClose}
        onExercisesSelected={handleExerciseSelected}
        selectedExercises={[]}
        defaultCategory={(selectedSequenceForEdit as any)?.major_category || ''}
      />

      {/* Electron IP 설정 다이얼로그 */}
      <Dialog open={electronIPDialogOpen} onOpenChange={setElectronIPDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Electron 앱 IP 주소 설정</DialogTitle>
            <DialogDescription>
              Electron 앱이 실행 중인 PC의 IP 주소를 입력하세요.
              <br />
              <br />
              <strong>설정 방법:</strong>
              <br />
              1. 같은 PC인 경우: localhost
              <br />
              2. 다른 PC인 경우: 해당 PC의 IP 주소 (예: 192.168.0.100)
              <br />
              <br />
              <strong>참고:</strong> Electron 앱이 실행 중인 PC의 방화벽에서 포트 3002가 열려 있어야 합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="electron-ip" className="mb-2 block">
              IP 주소
            </Label>
            <Input
              id="electron-ip"
              value={electronIPInput}
              onChange={(e) => setElectronIPInput(e.target.value)}
              placeholder="localhost 또는 IP 주소"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleElectronIPConfirm()
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setElectronIPDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleElectronIPConfirm}>
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 디바이스 선택 다이얼로그 (서버 중계 모드용) */}
      <DeviceSelectDialog
        open={deviceSelectDialogOpen}
        onOpenChange={setDeviceSelectDialogOpen}
        onSelect={handleDeviceSelect}
        selectedDeviceId={selectedDeviceId}
      />

      {/* 운동 복사 확인 스낵바 (헤더 70px 아래 배치) */}
      {copyConfirmOpen && detailSelectedDate && (
        <div
          className="fixed top-[90px] left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg bg-red-600 text-white animate-in slide-in-from-top-2 fade-in duration-300"
          role="alert"
        >
          <span className="text-sm font-medium whitespace-nowrap">
            {detailSelectedDate.format('YYYY-MM-DD')} 1회에 운동을 복사하시겠습니까?
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-white hover:bg-white/20"
              onClick={() => setCopyConfirmOpen(false)}
            >
              취소
            </Button>
            <Button
              size="sm"
              className="h-8 bg-white text-red-600 hover:bg-white/90"
              onClick={executeCopyWorkout}
            >
              확인
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default MonthProgram
