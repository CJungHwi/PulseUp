/**
 * 페이지 요약 — 사용자 대시보드 (`/dashboard`)
 *
 * 기능: 운동 통계·최근 기록·공지(첨부 표시·팝업 링크)·인기 운동·이력/테스트 데이터 조회 및 Vimeo 툴팁 미리보기.
 *
 * 호출/연동:
 * - `userDashboardService`: `getStats`, `getRecentWorkouts`, `getAnnouncements`
 * - `api`: `GET /workout-categories/workout-history-master`, `/workout-categories/test-user-exercises`
 * - `notificationApi.markAsRead`
 *
 * 관련 컴포넌트(`./components/`):
 * - `UserStatsCards`: 사용자 운동 통계 4종 카드
 * - `UserPopularWorkoutsCard`: 자주 하는 운동 + 필터
 * - `UserAnnouncementsCard`: 공지사항 카드
 * - `AdminRecommendedCard`: 관리자 추천 운동 카드
 * - `UserAnnouncementDialog`: 공지 상세 모달
 * - `VideoTooltip`: Vimeo 호버 툴팁
 * - `userDashboardTypes`, `userDashboardUtils`
 *
 * 흐름: 병렬 데이터 로드 → 필터·날짜로 이력 조회 → 공지 읽음 처리·첨부 링크 표시.
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs, { Dayjs } from 'dayjs'
import 'dayjs/locale/ko'
import updateLocale from 'dayjs/plugin/updateLocale'

import { TooltipProvider } from '@/components/ui/tooltip'
import api from '@/services/api'
import { notificationApi } from '@/services/notificationApi'
import {
  userDashboardService,
  type UserAnnouncement,
} from '@/services/userDashboard.service'

import type {
  AdminWorkoutGridRow,
  AdminWorkoutMaster,
  ExtendedRecentWorkout,
  ExtendedUserStats,
  UserPopularGridRow,
  UserPopularView,
  UserTopExercise,
} from './components/userDashboardTypes'
import { UserStatsCards } from './components/UserStatsCards'
import { UserPopularWorkoutsCard } from './components/UserPopularWorkoutsCard'
import { UserAnnouncementsCard } from './components/UserAnnouncementsCard'
import { AdminRecommendedCard } from './components/AdminRecommendedCard'
import { UserAnnouncementDialog } from './components/UserAnnouncementDialog'

dayjs.extend(updateLocale)

const UserDashboard: React.FC = () => {
  const navigate = useNavigate()

  const [workoutList, setWorkoutList] = useState<UserTopExercise[]>([])
  const [announcements, setAnnouncements] = useState<UserAnnouncement[]>([])
  const [, setRecentWorkouts] = useState<ExtendedRecentWorkout[]>([])
  const [userStats, setUserStats] = useState<ExtendedUserStats | null>(null)
  const [adminWorkoutMasters, setAdminWorkoutMasters] = useState<AdminWorkoutMaster[]>([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<UserAnnouncement | null>(null)

  const [selectedView, setSelectedView] = useState<UserPopularView>('전체')
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs())
  const [targetMuscleFilter, setTargetMuscleFilter] = useState<string>('')
  const [appliedTargetMuscleFilter, setAppliedTargetMuscleFilter] = useState<string>('')

  const loadAdminWorkoutMasters = async () => {
    try {
      const response = await api.get('/workout-categories/workout-history-master', {
        params: { admin: '1' },
      })
      if (response.data.success) {
        const masterData = response.data.data || []
        const validatedData: AdminWorkoutMaster[] = masterData.map(
          (item: any, index: number) => ({
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
          }),
        )
        const sortedData = validatedData
          .sort((a, b) => {
            const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime()
            if (dateCompare !== 0) return dateCompare
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          })
          .slice(0, 5)
        setAdminWorkoutMasters(sortedData)
      } else {
        setAdminWorkoutMasters([])
      }
    } catch (error) {
      console.error('관리자 추천 운동 조회 오류:', error)
      setAdminWorkoutMasters([])
    }
  }

  const loadUserTopExercises = async () => {
    try {
      const token = sessionStorage.getItem('token')
      if (!token) return
      const response = await api.get('/workout-categories/test-user-exercises')
      if (response.data.success) {
        setWorkoutList(response.data.data || [])
      } else {
        setWorkoutList([])
      }
    } catch (error) {
      console.error('사용자별 많이 하는 운동 로드 실패:', error)
      setWorkoutList([])
    }
  }

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const [userAnnouncements, recent] = await Promise.all([
        userDashboardService.getAnnouncements().catch(() => []),
        userDashboardService.getRecentWorkouts().catch(() => []),
      ])

      let stats: ExtendedUserStats | null = null
      try {
        stats = (await userDashboardService.getStats()) as ExtendedUserStats
      } catch (statsError) {
        console.error('통계 API 호출 실패:', statsError)
      }

      await loadUserTopExercises()
      await loadAdminWorkoutMasters()

      setAnnouncements(userAnnouncements)

      if (recent && Array.isArray(recent) && recent.length > 0) {
        setRecentWorkouts(recent as ExtendedRecentWorkout[])
      } else {
        setRecentWorkouts([])
      }

      if (stats && typeof stats === 'object') {
        setUserStats(stats)
      } else {
        setUserStats({
          workout_days: 0,
          total_minutes: 0,
          avg_daily_minutes: 0,
          exercise_types_used: 0,
        })
      }

      if (userAnnouncements.length === 0) {
        setAnnouncements([
          { id: '1', title: '오늘 AA 운동이 추가 되었습니다.', content: '', type: 'update', priority: 'normal', created_at: '2024-01-18', is_active: true, is_pinned: false, view_count: 0 },
          { id: '2', title: '오늘 BB 운동이 추가 되었습니다.', content: '', type: 'update', priority: 'normal', created_at: '2024-01-18', is_active: true, is_pinned: false, view_count: 0 },
          { id: '3', title: '시스템이 업데이트되었습니다.', content: '', type: 'maintenance', priority: 'high', created_at: '2024-01-17', is_active: true, is_pinned: true, view_count: 0 },
        ] as unknown as UserAnnouncement[])
      }
    } catch (error) {
      console.error('대시보드 데이터 로딩 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAnnouncementClick = async (announcement: UserAnnouncement) => {
    setSelectedAnnouncement(announcement)
    setModalOpen(true)
    try {
      await notificationApi.markAsRead(Number(announcement.id))
      setAnnouncements((prev) =>
        prev.map((item) =>
          item.id === announcement.id
            ? { ...item, view_count: (item.view_count || 0) + 1 }
            : item,
        ),
      )
    } catch (error) {
      console.error('조회수 증가 실패:', error)
    }
  }

  const handleDialogClose = () => {
    setModalOpen(false)
    setSelectedAnnouncement(null)
  }

  useEffect(() => {
    dayjs.locale('ko')
    dayjs.updateLocale('ko', {
      months: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
      monthsShort: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
    })
    loadDashboardData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const allGridRows: UserPopularGridRow[] = useMemo(
    () =>
      workoutList.map((workout, index) => ({
        id: workout.exercise_id,
        rank: index + 1,
        exercise_count: workout.exercise_count,
        exercise_name: workout.exercise_name,
        exercise_name_en: workout.exercise_name_en,
        frequency_level: workout.frequency_level,
        total_duration: workout.total_duration,
        avg_duration: workout.avg_duration,
        avg_duration_rounded: workout.avg_duration_rounded,
        target_muscles: workout.target_muscles || '전신',
        equipment: workout.equipment || '맨몸',
        level: workout.level,
        level_ko: workout.level_ko,
        category_name: workout.category_name,
        first_workout_date: workout.first_workout_date,
        last_workout_date: workout.last_workout_date,
        characteristics: workout.characteristics,
        purpose: workout.purpose,
        video_url: workout.video_url,
        thumbnail_url: workout.thumbnail_url,
      })),
    [workoutList],
  )

  const gridRows = useMemo(() => {
    let filtered = allGridRows
    if (selectedView === '자극부위' && appliedTargetMuscleFilter.trim()) {
      filtered = filtered.filter((row) =>
        row.target_muscles?.toLowerCase().includes(appliedTargetMuscleFilter.toLowerCase().trim()),
      )
    }
    if (selectedView === '날짜별' && selectedDate) {
      const selectedDateStr = selectedDate.format('YYYY-MM-DD')
      filtered = filtered.filter((row) => {
        if (row.last_workout_date) {
          return dayjs(row.last_workout_date).format('YYYY-MM-DD') === selectedDateStr
        }
        return false
      })
    }
    return filtered.map((row, index) => ({ ...row, rank: index + 1 }))
  }, [allGridRows, selectedView, selectedDate, appliedTargetMuscleFilter])

  const adminWorkoutGridRows: AdminWorkoutGridRow[] = useMemo(
    () =>
      adminWorkoutMasters.map((workout) => ({
        id: workout.id,
        date: workout.date,
        workoutCategoriesName: workout.workoutCategoriesName,
        circuitType: workout.circuitType,
        workoutTime: workout.workoutTime,
        memo: workout.memo,
      })),
    [adminWorkoutMasters],
  )

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p>대시보드 데이터를 불러오는 중...</p>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div
        data-testid="user-dashboard-main"
        className="p-0 h-[calc(100vh-140px)] overflow-hidden flex flex-col bg-background"
      >
        <UserStatsCards stats={userStats} />

        <UserPopularWorkoutsCard
          rows={gridRows}
          selectedView={selectedView}
          onViewChange={setSelectedView}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          targetMuscleFilter={targetMuscleFilter}
          onTargetMuscleChange={setTargetMuscleFilter}
          onApplyTargetMuscle={setAppliedTargetMuscleFilter}
        />

        <div className="flex flex-col lg:flex-row gap-[3px] flex-[0.9] min-h-0 w-full mb-1">
          <UserAnnouncementsCard
            announcements={announcements}
            onSelect={handleAnnouncementClick}
            onMore={() => navigate('/announcements')}
          />
          <AdminRecommendedCard
            rows={adminWorkoutGridRows}
            onMore={() => navigate('/MonthProgram?admin=true')}
          />
        </div>

        <UserAnnouncementDialog
          open={modalOpen}
          onClose={handleDialogClose}
          selected={selectedAnnouncement}
        />
      </div>
    </TooltipProvider>
  )
}

export default UserDashboard
