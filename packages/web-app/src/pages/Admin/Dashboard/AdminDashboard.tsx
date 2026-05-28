/**
 * 페이지 요약 — 관리자 대시보드 (`/admin/dashboard`)
 *
 * 기능: 가입·운동·공지 통계, 인기 운동, 지점 필터, 승인 대기 사용자/지점관리자 신청,
 *       공지 읽음·첨부 표시·팝업 상세 보기 등 운영 요약.
 *
 * 호출/연동:
 * - `dashboardService`: `getDashboardStats`, `getPopularWorkouts`, `getPendingUsers`, `approveUser`
 * - `branchApi.getBranches`, `notificationApi.getNotifications`, `markAsRead`
 * - DB/SP는 `packages/api-server` `dashboard`·`notifications` 등 참조.
 *
 * 관련 컴포넌트(`./components/`):
 * - `DashboardStatsCards`: 사용자 통계 4종 카드
 * - `PopularWorkoutsCard`: 보기 모드 필터 + 운동 DataTable
 * - `DashboardAnnouncements`: 공지사항 카드(테이블)
 * - `DashboardUserInfo`: 승인 대기 사용자 카드
 * - `AnnouncementDetailDialog`: 공지 상세 보기 모달
 * - `VideoTooltip`: Vimeo 호버 툴팁
 * - `adminDashboardTypes`, `adminDashboardUtils`
 *
 * 흐름: 필터·기간 설정 → 통계·목록 로드 → 승인·읽음 처리.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import dayjs, { Dayjs } from 'dayjs'
import 'dayjs/locale/ko'
import updateLocale from 'dayjs/plugin/updateLocale'

import { TooltipProvider } from '@/components/ui/tooltip'
import { useSnackbar } from '@/contexts/SnackbarContext'
import { dashboardService } from '@/services/dashboard.service'
import { notificationApi } from '@/services/notificationApi'
import { branchApi } from '@/services/branchApi'
import type { Branch } from '@/types/branch'
import { parseNotificationAttachments, type NotificationType } from '@/types/notification'

import type {
  PopularView,
  SimpleAnnouncement,
  SimpleStats,
  SimpleUser,
  SimpleWorkout,
} from './components/adminDashboardTypes'
import { DashboardStatsCards } from './components/DashboardStatsCards'
import { PopularWorkoutsCard } from './components/PopularWorkoutsCard'
import { DashboardAnnouncements } from './components/DashboardAnnouncements'
import { DashboardUserInfo } from './components/DashboardUserInfo'
import { AnnouncementDetailDialog } from './components/AnnouncementDetailDialog'

dayjs.extend(updateLocale)

const AdminDashboard: React.FC = () => {
  const { showSnackbar } = useSnackbar()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [selectedView, setSelectedView] = useState<PopularView>('전체')
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs())
  const [targetMuscleFilter, setTargetMuscleFilter] = useState<string>('')
  const [appliedTargetMuscleFilter, setAppliedTargetMuscleFilter] = useState<string>('')

  const [workoutList, setWorkoutList] = useState<SimpleWorkout[]>([])
  const [announcements, setAnnouncements] = useState<SimpleAnnouncement[]>([])
  const [pendingUsers, setPendingUsers] = useState<SimpleUser[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [dashboardStats, setDashboardStats] = useState<SimpleStats>({
    total_users: 0,
    approved_users: 0,
    pending_users: 0,
    inactive_users: 0,
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<SimpleAnnouncement | null>(null)

  const loadPopularWorkouts = async () => {
    try {
      const filters: Record<string, unknown> = { limit: 20 }
      if (selectedView === '지점별' && selectedBranch) {
        const branch = branches.find((b) => b.name === selectedBranch)
        if (branch) filters.branch_id = branch.id
      } else if (selectedView === '날짜별') {
        filters.start_date = selectedDate.format('YYYY-MM-DD')
        filters.end_date = selectedDate.format('YYYY-MM-DD')
      } else if (selectedView === '자극부위' && appliedTargetMuscleFilter) {
        filters.target_muscle = appliedTargetMuscleFilter
      }
      const data = await dashboardService.getPopularWorkouts(filters)
      setWorkoutList(data)
    } catch (error) {
      console.error('인기 운동 리스트 로드 실패:', error)
    }
  }

  const loadBranches = async () => {
    try {
      const response = await branchApi.getBranches()
      if (response.success && response.data) setBranches(response.data.items)
    } catch (error) {
      console.error('지점 목록 로드 실패:', error)
    }
  }

  const loadDashboardStats = async () => {
    try {
      setLoading(true)
      const stats = await dashboardService.getDashboardStats()
      if (stats.userStats) {
        setDashboardStats({
          total_users: stats.userStats.total_users || 0,
          approved_users: stats.userStats.approved_users || 0,
          pending_users: stats.userStats.pending_users || 0,
          inactive_users:
            stats.userStats.total_users -
              stats.userStats.approved_users -
              stats.userStats.pending_users || 0,
        })
      }
    } catch (error) {
      console.error('대시보드 통계 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPendingUsers = async () => {
    try {
      const users = await dashboardService.getPendingUsers()
      setPendingUsers(users as SimpleUser[])
    } catch (error) {
      console.error('사용자 목록 로드 실패:', error)
    }
  }

  const handleApproveUser = async (userId: string) => {
    try {
      await dashboardService.approveUser(userId)
      await loadPendingUsers()
      await loadDashboardStats()
    } catch (error) {
      console.error('사용자 승인 실패:', error)
      showSnackbar({ message: '사용자 승인에 실패했습니다.', severity: 'error' })
    }
  }

  const loadAnnouncements = async () => {
    try {
      const response = await notificationApi.getNotifications({
        page: 1,
        limit: 5,
        status: 'active',
        isAdmin: true,
      })
      if (response.success && response.data) {
        let items: any[] = []
        if (Array.isArray(response.data)) {
          items = response.data
        } else if (response.data.items) {
          items = response.data.items
        }
        const formatted: SimpleAnnouncement[] = items.map((item: any) => ({
          id: item.id.toString(),
          title: item.title,
          content: item.content,
          type: item.type as NotificationType,
          priority: item.priority,
          view_count: item.view_count || 0,
          created_at: item.created_at,
          is_active: item.is_active,
          is_pinned: item.is_pinned,
          attachments: parseNotificationAttachments(item.attachments),
        }))
        setAnnouncements(formatted)
      }
    } catch (error) {
      console.error('공지사항 목록 로드 실패:', error)
    }
  }

  const handleAnnouncementClick = async (announcement: SimpleAnnouncement) => {
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
    loadDashboardStats()
    loadPendingUsers()
    loadAnnouncements()
    loadPopularWorkouts()
    loadBranches()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadPopularWorkouts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedView, selectedBranch, selectedDate, appliedTargetMuscleFilter])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg font-medium text-muted-foreground">대시보드 데이터를 불러오는 중...</p>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div
        data-testid="admin-dashboard-main"
        className="p-0 h-[calc(100vh-140px)] overflow-hidden flex flex-col bg-background"
      >
        <DashboardStatsCards stats={dashboardStats} />

        <PopularWorkoutsCard
          workoutList={workoutList}
          branches={branches}
          selectedView={selectedView}
          onViewChange={setSelectedView}
          selectedBranch={selectedBranch}
          onBranchChange={setSelectedBranch}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          targetMuscleFilter={targetMuscleFilter}
          onTargetMuscleChange={setTargetMuscleFilter}
          onApplyTargetMuscle={setAppliedTargetMuscleFilter}
        />

        <div className="flex flex-col lg:flex-row gap-[3px] flex-[0.9] min-h-0">
          <DashboardAnnouncements
            announcements={announcements}
            onSelect={handleAnnouncementClick}
            onMore={() => navigate('/announcements')}
          />
          <DashboardUserInfo
            pendingUsers={pendingUsers}
            onApprove={handleApproveUser}
            onMore={() => (window.location.href = '/admin/usermanager')}
          />
        </div>

        <AnnouncementDetailDialog
          open={modalOpen}
          onClose={handleDialogClose}
          selected={selectedAnnouncement}
        />
      </div>
    </TooltipProvider>
  )
}

export default AdminDashboard
