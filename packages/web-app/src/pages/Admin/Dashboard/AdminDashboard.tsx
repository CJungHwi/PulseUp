/**
 * 페이지 요약 — 관리자 대시보드 (`/admin/dashboard`)
 *
 * 기능: 가입·운동·공지 통계, 인기 운동, 지점 필터, 승인 대기 사용자, 공지 읽음·첨부 표시·팝업 다운로드 링크 등 운영 요약.
 *
 * 호출/연동:
 * - `dashboardService`: `GET /dashboard/stats`, `popular-workouts`, `pending-users`, `approveUser` 등
 * - `branchApi.getBranches`, `notificationApi.getNotifications`, `markAsRead`
 * - DB/SP는 `packages/api-server` `dashboard`·`notifications` 등 참조.
 *
 * 관련 컴포넌트: shadcn `Tabs`, `DataTable`, Dialog, `Table`.
 *
 * 흐름: 필터·기간 설정 → 통계·목록 로드 → 승인·읽음 처리.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  TrendingUp,
  UserPlus,
  UserMinus,
  Ban,
  Pencil,
  X,
  Search,
  Filter,
  MoreHorizontal,
  Trash2,
  Eye,
  RefreshCw,
  BarChart3,
  Clock,
  Monitor,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Calendar as CalendarIcon,
  Loader2,
  Dumbbell,
  Target,
  Award,
  Megaphone,
  Paperclip,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';

import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DatePicker } from '@/components/ui/date-picker';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ko';
import updateLocale from 'dayjs/plugin/updateLocale';

dayjs.extend(updateLocale);

import { useTheme } from '../../../contexts/ThemeContext';
import { useSnackbar } from '@/contexts/SnackbarContext';
import { dashboardService } from '../../../services/dashboard.service';
import { notificationApi } from '../../../services/notificationApi';
import { branchApi } from '../../../services/branchApi';
import { Branch } from '../../../types/branch';
import api from '../../../services/api';
import {
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_STATUS_LABELS,
  NotificationType,
  NotificationStatus,
  parseNotificationAttachments,
  type AnnouncementAttachment,
} from '../../../types/notification';

// 간단한 타입 정의
interface SimpleWorkout {
  id: string;
  name: string;
  name_en?: string;
  count: number;
  category: string;
  description: string;
  target_muscles?: string;
  equipment?: string;
  purpose?: string;
  video_url?: string;
}

interface SimpleAnnouncement {
  id: string;
  title: string;
  content: string;
  type: string;
  priority?: string;
  view_count: number;
  created_at: string;
  is_active?: boolean;
  is_pinned?: boolean;
  attachments?: AnnouncementAttachment[];
}

interface SimpleUser {
  id: string;
  userid: string;
  name: string;
  email: string;
  role: string;
  branch_name: string;
  is_approved: boolean;
  created_at: string;
}

interface SimpleStats {
  total_users: number;
  approved_users: number;
  pending_users: number;
  inactive_users: number;
}

/**
 * Vimeo URL을 embed URL로 변환
 */
const convertToEmbedUrl = (url: string | undefined): string | null => {
  if (!url) return null;

  // Vimeo URL 패턴 매칭
  const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)|(?:player\.vimeo\.com\/video\/)(\d+)/);

  if (vimeoMatch) {
    const videoId = vimeoMatch[1] || vimeoMatch[2];
    return `https://player.vimeo.com/video/${videoId}?autoplay=1&controls=1&title=0&byline=0&portrait=0`;
  }

  return null;
}

/**
 * 영상 재생 툴팁 컴포넌트
 */
interface VideoTooltipProps {
  videoUrl: string | undefined;
  exerciseName: string;
  children: React.ReactElement;
}

const VideoTooltip: React.FC<VideoTooltipProps> = ({ videoUrl, exerciseName, children }) => {
  const embedUrl = convertToEmbedUrl(videoUrl);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setOpen(false);
    };
  }, []);

  if (!embedUrl) {
    return <>{children}</>;
  }

  const updatePosition = useCallback(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top,
        left: rect.right + 10
      });
    }
  }, []);

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    updatePosition();

    timeoutRef.current = setTimeout(() => {
      updatePosition();
      setOpen(true);
    }, 300);
  }, [updatePosition]);

  useEffect(() => {
    if (open) {
      const handleScroll = () => {
        updatePosition();
      };

      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);

      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleScroll);
      };
    }
  }, [open, updatePosition]);

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setOpen(false);
  }, []);

  return (
    <>
      <span
        ref={anchorRef}
        className="w-full h-full inline-flex items-center cursor-pointer"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </span>
      {open && typeof document !== 'undefined' && document.body && createPortal(
        <div
          className="fixed bg-black rounded-lg overflow-hidden p-1 z-[9999] shadow-2xl pointer-events-auto"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            width: '560px',
            height: '315px',
          }}
          onMouseEnter={() => {
            updatePosition();
            setOpen(true);
          }}
          onMouseLeave={() => setOpen(false)}
        >
          <iframe
            width="100%"
            height="100%"
            src={embedUrl}
            title={exerciseName}
            frameBorder="0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="rounded-md"
          />
        </div>,
        document.body
      )}
    </>
  );
};

const AdminDashboard: React.FC = () => {
  const { mode } = useTheme();
  const { showSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);


  const [selectedView, setSelectedView] = useState<'전체' | '지점별' | '날짜별' | '자극부위'>('전체');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [targetMuscleFilter, setTargetMuscleFilter] = useState<string>('');
  const [appliedTargetMuscleFilter, setAppliedTargetMuscleFilter] = useState<string>('');

  const [workoutList, setWorkoutList] = useState<SimpleWorkout[]>([]);

  const [announcements, setAnnouncements] = useState<SimpleAnnouncement[]>([]);

  const [pendingUsers, setPendingUsers] = useState<SimpleUser[]>([]);

  const [dashboardStats, setDashboardStats] = useState<SimpleStats>({
    total_users: 0,
    approved_users: 0,
    pending_users: 0,
    inactive_users: 0
  });

  // 공지사항 팝업 관련 상태
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<SimpleAnnouncement | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'general' as NotificationType,
    status: 'active' as NotificationStatus,
    priority: 'normal',
    targetAudience: 'all',
  });
  const [isPinned, setIsPinned] = useState(false);

  const [branches, setBranches] = useState<Branch[]>([]);

  // 대시보드 데이터 로드
  useEffect(() => {
    dayjs.locale('ko');
    dayjs.updateLocale('ko', {
      months: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
      monthsShort: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
    });
    loadDashboardStats();
    loadPendingUsers();
    loadAnnouncements();
    loadPopularWorkouts();
    loadBranches();
  }, []);

  // 필터 변경 시 인기 운동 리스트 로드
  useEffect(() => {
    loadPopularWorkouts();
  }, [selectedView, selectedBranch, selectedDate, appliedTargetMuscleFilter]);

  const loadPopularWorkouts = async () => {
    try {
      const filters: any = { limit: 20 };

      if (selectedView === '지점별' && selectedBranch) {
        // 지점 ID를 찾아야 함
        const branch = branches.find(b => b.name === selectedBranch);
        if (branch) filters.branch_id = branch.id;
      } else if (selectedView === '날짜별') {
        filters.start_date = selectedDate.format('YYYY-MM-DD');
        filters.end_date = selectedDate.format('YYYY-MM-DD');
      } else if (selectedView === '자극부위' && appliedTargetMuscleFilter) {
        filters.target_muscle = appliedTargetMuscleFilter;
      }

      const data = await dashboardService.getPopularWorkouts(filters);
      setWorkoutList(data);
    } catch (error) {
      console.error('인기 운동 리스트 로드 실패:', error);
    }
  };

  const loadBranches = async () => {
    try {
      const response = await branchApi.getBranches();
      if (response.success && response.data) {
        setBranches(response.data.items);
      }
    } catch (error) {
      console.error('지점 목록 로드 실패:', error);
    }
  };

  const loadDashboardStats = async () => {
    try {
      setLoading(true);
      console.log('대시보드 통계 로드 시작...');

      const stats = await dashboardService.getDashboardStats();
      console.log('대시보드 통계 응답:', stats);

      // API 응답 구조에 맞게 데이터 매핑
      if (stats.userStats) {
        setDashboardStats({
          total_users: stats.userStats.total_users || 0,
          approved_users: stats.userStats.approved_users || 0,
          pending_users: stats.userStats.pending_users || 0,
          inactive_users: stats.userStats.total_users - stats.userStats.approved_users - stats.userStats.pending_users || 0
        });
      }
    } catch (error) {
      console.error('대시보드 통계 로드 실패:', error);
      // 에러 시 기본값 유지
    } finally {
      setLoading(false);
    }
  };

  const loadPendingUsers = async () => {
    try {
      console.log('사용자 목록 로드 시작...');

      const users = await dashboardService.getPendingUsers();
      console.log('사용자 목록 응답:', users);

      // role이 'user'인 사용자만 필터링
      const filteredUsers = users.filter(user => user.role === 'user');
      setPendingUsers(filteredUsers as SimpleUser[]);
    } catch (error) {
      console.error('사용자 목록 로드 실패:', error);
      // 에러 시 빈 배열 유지
    }
  };

  const handleApproveUser = async (userId: string) => {
    try {
      console.log('사용자 승인 처리:', userId);

      await dashboardService.approveUser(userId);

      // 승인 후 사용자 목록 새로고침
      await loadPendingUsers();
      await loadDashboardStats(); // 통계도 새로고침

      console.log('사용자 승인 완료');
    } catch (error) {
      console.error('사용자 승인 실패:', error);
      showSnackbar({ message: '사용자 승인에 실패했습니다.', severity: 'error' });
    }
  };

  const loadAnnouncements = async () => {
    try {
      console.log('공지사항 목록 로드 시작...');

      const response = await notificationApi.getNotifications({
        page: 1,
        limit: 5,
        status: 'active',
        isAdmin: true
      });
      console.log('공지사항 목록 응답:', response);

      if (response.success && response.data) {
        let items: any[] = [];

        // 응답 데이터가 배열인지 객체인지 확인
        if (Array.isArray(response.data)) {
          // 사용자용 API 응답 (배열)
          items = response.data;
        } else if (response.data.items) {
          // 관리자용 API 응답 (객체)
          items = response.data.items;
        }

        const formattedAnnouncements = items.map((item: any) => ({
          id: item.id.toString(),
          title: item.title,
          content: item.content,
          type: item.type,
          priority: item.priority,
          view_count: item.view_count || 0,
          created_at: item.created_at,
          is_active: item.is_active,
          is_pinned: item.is_pinned,
          attachments: parseNotificationAttachments(item.attachments),
        }));
        setAnnouncements(formattedAnnouncements);
      }
    } catch (error) {
      console.error('공지사항 목록 로드 실패:', error);
      // 에러 시 빈 배열 유지
    }
  };

  // 공지사항 클릭 핸들러
  const handleAnnouncementClick = async (announcement: SimpleAnnouncement) => {
    setSelectedAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      type: announcement.type as NotificationType,
      status: announcement.is_active ? 'active' : 'inactive',
      priority: announcement.priority || 'normal',
      targetAudience: 'all',
    });
    setIsPinned(Boolean(announcement.is_pinned));
    setModalOpen(true);

    // 조회수 증가 API 호출
    try {
      await notificationApi.markAsRead(Number(announcement.id));

      // 로컬 상태 업데이트 (조회수 +1)
      setAnnouncements(prev =>
        prev.map(item =>
          item.id === announcement.id
            ? { ...item, view_count: (item.view_count || 0) + 1 }
            : item
        )
      );
    } catch (error) {
      console.error('조회수 증가 실패:', error);
    }
  };


  const userInfoColumns: ColumnDef<SimpleUser>[] = [
    {
      accessorKey: 'name',
      header: '사용자',
      cell: ({ row }) => (
        <div className="font-medium text-xs truncate max-w-[140px] dark:group-hover:text-yellow-400" title={row.original.name}>
          {row.original.name}
        </div>
      ),
    },
    {
      accessorKey: 'branch_name',
      header: '지점',
      cell: ({ row }) => (
        <div className="text-center text-xs dark:group-hover:text-yellow-400">
          {row.original.branch_name.replace(' 지점', '')}
        </div>
      ),
    },
    {
      accessorKey: 'is_approved',
      header: '승인',
      cell: ({ row }) => (
        <div className="flex justify-center">
          {row.original.is_approved ? (
            <Badge className="text-[10px] h-6 bg-green-500 hover:bg-green-600 text-white border-none">
              승인됨
            </Badge>
          ) : (
            <Button
              size="sm"
              className="text-[10px] h-7 px-3"
              onClick={() => handleApproveUser(row.original.id)}
            >
              승인
            </Button>
          )}
        </div>
      ),
    },
  ];

  const getStatIconColor = (iconClass: string) => {
    switch (iconClass) {
      case 'approved':
        return 'bg-green-500';
      case 'pending':
        return 'bg-yellow-500';
      case 'disabled':
        return 'bg-red-500';
      default:
        return 'bg-primary';
    }
  };

  const getAnnouncementTypeLabel = (type: string) => {
    switch (type) {
      case 'general':
        return '일반';
      case 'maintenance':
        return '점검';
      case 'update':
        return '업데이트';
      case 'event':
        return '이벤트';
      case 'urgent':
        return '긴급';
      default:
        return '일반';
    }
  };

  // Badge variant 타입 정의에 맞게 수정
  const getAnnouncementTypeVariant = (type: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (type) {
      case 'general':
        return 'secondary';
      case 'maintenance':
        return 'destructive'; // 점검은 붉은색 계열 경고 느낌
      case 'update':
        return 'default'; // 업데이트는 기본(Primary) 색상
      case 'event':
        return 'outline'; // 이벤트는 외곽선
      case 'urgent':
        return 'destructive'; // 긴급은 붉은색
      default:
        return 'secondary';
    }
  };

  // 추가적인 커스텀 색상이 필요한 경우 className으로 처리하기 위한 헬퍼
  const getAnnouncementTypeClassName = (type: string): string => {
    switch (type) {
      case 'general':
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
      case 'maintenance':
        return 'bg-orange-100 text-orange-800 hover:bg-orange-200 border-none';
      case 'update':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200 border-none';
      case 'event':
        return 'bg-purple-100 text-purple-800 hover:bg-purple-200 border-none';
      case 'urgent':
        return 'bg-red-100 text-red-800 hover:bg-red-200 border-none';
      default:
        return '';
    }
  };




  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg font-medium text-muted-foreground">
          대시보드 데이터를 불러오는 중...
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div
      data-testid="admin-dashboard-main"
      className="p-0 h-[calc(100vh-140px)] overflow-hidden flex flex-col bg-background"
    >
      {/* 통계 카드 */}
      <div className="flex flex-wrap justify-between gap-[3px] mb-[3px] shrink-0 w-full">
        {[
          {
            key: 'total-users',
            icon: <Users className="h-6 w-6" />,
            iconClass: '',
            title: '전체 사용자',
            value: dashboardStats.total_users
          },
          {
            key: 'approved-users',
            icon: <UserPlus className="h-6 w-6" />,
            iconClass: 'approved',
            title: '승인된 사용자',
            value: dashboardStats.approved_users
          },
          {
            key: 'pending-users',
            icon: <UserMinus className="h-6 w-6" />,
            iconClass: 'pending',
            title: '승인 대기',
            value: dashboardStats.pending_users
          },
          {
            key: 'disabled-users',
            icon: <Ban className="h-6 w-6" />,
            iconClass: 'disabled',
            title: '사용중지',
            value: dashboardStats.inactive_users
          }
        ].map((stat) => (
          <Card
            key={stat.key}
            data-testid="stats-card"
            className="flex-1 min-w-[200px] h-20 flex items-center gap-4 p-4 hover:translate-y-[-2px] hover:shadow-lg transition-all duration-200 bg-card shadow-md"
          >
            <div className={`p-2 rounded-lg ${getStatIconColor(stat.iconClass)} text-white flex items-center justify-center shrink-0`}>
              {stat.icon}
            </div>
            <div className="text-left min-w-0 flex-1">
              <p className="text-sm text-muted-foreground leading-tight mb-1">
                {stat.title}
              </p>
              <p className="text-2xl font-bold leading-none">
                {stat.value.toLocaleString()}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* 많이 하는 운동 리스트 */}
      <div className="flex-[1.4] min-h-0 mb-[3px]">
        <Card className="h-full flex flex-col bg-card shadow-md">
          <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              많이 하는 운동 리스트
            </CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <RadioGroup
                defaultValue="전체"
                value={selectedView}
                onValueChange={(value: any) => setSelectedView(value)}
                className="flex items-center gap-4 border border-[#343637] dark:border-[#6b7280] rounded-md p-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="전체" id="view-all" />
                  <Label htmlFor="view-all">전체</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="지점별" id="view-branch" />
                  <Label htmlFor="view-branch">지점별</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="날짜별" id="view-date" />
                  <Label htmlFor="view-date">날짜별</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="자극부위" id="view-muscle" />
                  <Label htmlFor="view-muscle">자극부위</Label>
                </div>
              </RadioGroup>

              {selectedView === '지점별' && (
                <Select
                  value={selectedBranch}
                  onValueChange={setSelectedBranch}
                  labels={Object.fromEntries(branches.map(b => [b.name, b.name]))}
                >
                  <SelectTrigger className="w-[150px] bg-card">
                    <SelectValue placeholder="지점 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.name}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {selectedView === '날짜별' && (
                <DatePicker
                  date={selectedDate.toDate()}
                  setDate={(date) => date && setSelectedDate(dayjs(date))}
                  className="min-w-[150px] w-[170px] border-[#343637] dark:border-[#6b7280] h-9 text-xs"
                />
              )}

              {selectedView === '자극부위' && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Input
                      placeholder="자극부위 입력"
                      value={targetMuscleFilter}
                      onChange={(e) => setTargetMuscleFilter(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setAppliedTargetMuscleFilter(targetMuscleFilter);
                        }
                      }}
                      className="w-[150px] bg-card pr-8"
                    />
                    {targetMuscleFilter && (
                      <button
                        type="button"
                        onClick={() => {
                          setTargetMuscleFilter('');
                          setAppliedTargetMuscleFilter('');
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setAppliedTargetMuscleFilter(targetMuscleFilter)}
                  >
                    검색
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-1 min-h-0 overflow-hidden p-0">
            <DataTable
              data={workoutList.map((workout, index) => ({
                ...workout,
                rank: index + 1,
              }))}
              columns={[
                {
                  accessorKey: 'rank',
                  header: '순위',
                  size: 90,
                  cell: ({ row }) => (
                    <div className="flex justify-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ${(row.getValue('rank') as number) <= 3 ? 'bg-blue-500 text-white' : 'bg-gray-500 text-white'} group-hover:text-blue-600 dark:group-hover:text-yellow-400`}>
                        {row.getValue('rank')}
                      </div>
                    </div>
                  ),
                },
                {
                  accessorKey: 'count',
                  header: '횟수',
                  size: 100,
                  cell: ({ row }) => (
                    <div className="flex items-center justify-center gap-1 font-bold text-primary group-hover:text-blue-600 dark:group-hover:text-yellow-400">
                      {row.getValue('count')}회
                    </div>
                  ),
                },
                {
                  accessorKey: 'category',
                  header: '카테고리',
                  size: 145,
                  cell: ({ row }) => (
                    <div className="flex items-center justify-center gap-1 font-bold text-primary group-hover:text-blue-600 dark:group-hover:text-yellow-400">
                      {row.getValue('category')}
                    </div>
                  ),
                },
                {
                  accessorKey: 'name',
                  header: '운동명(한글)',
                  cell: ({ row }) => (
                    <VideoTooltip
                      videoUrl={row.original.video_url}
                      exerciseName={row.getValue('name')}
                    >
                      <span className="font-medium cursor-pointer hover:underline">
                        {row.getValue('name')}
                      </span>
                    </VideoTooltip>
                  ),
                },
                {
                  accessorKey: 'name_en',
                  header: '운동명(영문)',
                  cell: ({ row }) => (
                    <span className="text-muted-foreground text-sm group-hover:text-blue-600 dark:group-hover:text-yellow-400">
                      {row.original.name_en || '-'}
                    </span>
                  ),
                },
                {
                  accessorKey: 'target_muscles',
                  header: '자극부위',
                  cell: ({ row }) => (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-yellow-400">
                      <Target className="w-3 h-3" />
                      {row.original.target_muscles}
                    </div>
                  ),
                },
                {
                  accessorKey: 'description',
                  header: '특징 및 효과',
                  size: 300,
                  cell: ({ row }) => (
                    <span className="text-sm truncate max-w-[250px] block group-hover:text-blue-600 dark:group-hover:text-yellow-400" title={row.original.description}>
                      {row.original.description}
                    </span>
                  ),
                },
                {
                  accessorKey: 'equipment',
                  header: '필요기구',
                  size: 120,
                  cell: ({ row }) => (
                    <div className="flex items-center justify-center gap-2 text-sm group-hover:text-blue-600 dark:group-hover:text-yellow-400">
                      <Dumbbell className="w-3 h-3" />
                      {row.original.equipment}
                    </div>
                  ),
                }
              ]}
            />
          </CardContent>
        </Card>
      </div>

      {/* 하단 그리드: 공지사항 + 사용자 정보 */}
      <div className="flex flex-col lg:flex-row gap-[3px] flex-[0.9] min-h-0">
        {/* 공지사항 */}
        <div className="flex-[2] order-2 lg:order-1">
          <Card className="h-full flex flex-col bg-card shadow-md">
            <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-orange-500" />
                공지사항
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/announcements')}
              >
                더보기
              </Button>
            </CardHeader>

            <CardContent className="flex-1 min-h-0 p-0 overflow-hidden flex flex-col">
              <div className="flex-1 min-h-0 border border-[#343637] dark:border-[#6b7280] overflow-auto relative scrollbar-hide bg-[#f9fafb] dark:bg-[#1d1d1d]">
                <Table className="w-full table-fixed border-separate border-spacing-0">
                  <TableHeader className="sticky top-0 z-10 shadow-sm bg-[#b9adb5] dark:bg-gray-800">
                    <TableRow className="hover:bg-transparent border-b-0 h-[45px]">
                      <TableHead className="w-[100px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">유형</TableHead>
                      <TableHead className="w-[200px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">제목</TableHead>
                      <TableHead className="w-[300px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">내용</TableHead>
                      <TableHead className="w-[100px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">작성일</TableHead>
                      <TableHead className="w-[80px] text-center font-bold px-2 border-b-0 text-[#27272a] dark:text-[#94a3b8]">조회수</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {announcements.map((row) => (
                      <TableRow
                        key={row.id}
                        className="h-[35px] border-b-0 group transition-colors bg-[#f9fafb] dark:bg-[#1d1d1d] hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30 cursor-pointer"
                        onClick={() => handleAnnouncementClick(row)}
                      >
                        <TableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">
                          <Badge
                            variant={getAnnouncementTypeVariant(row.type)}
                            className={getAnnouncementTypeClassName(row.type)}
                          >
                            {getAnnouncementTypeLabel(row.type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 truncate font-semibold group-hover:text-inherit group-hover:font-inherit transition-colors">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 min-w-0 w-full">
                                {(row.attachments?.length ?? 0) > 0 && (
                                  <span
                                    className="inline-flex shrink-0 text-primary"
                                    title="첨부파일 있음"
                                    aria-label="첨부파일 있음"
                                  >
                                    <Paperclip className="h-3.5 w-3.5" aria-hidden />
                                  </span>
                                )}
                                <div className="truncate flex-1 min-w-0">{row.title}</div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">
                                {row.title}
                                {(row.attachments?.length ?? 0) > 0 ? ' (첨부 있음)' : ''}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 truncate text-muted-foreground group-hover:text-inherit group-hover:font-inherit transition-colors">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="truncate w-full">{row.content || '-'}</div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs whitespace-pre-wrap">{row.content || '-'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 truncate group-hover:text-inherit group-hover:font-inherit transition-colors">
                          {dayjs(row.created_at).format('YYYY-MM-DD')}
                        </TableCell>
                        <TableCell className="text-center h-[35px] py-0 px-2 text-xs truncate group-hover:text-inherit group-hover:font-inherit transition-colors">
                          {row.view_count || 0}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 사용자 정보 */}
        <div className="flex-1 order-1 lg:order-2">
          <Card className="h-full flex flex-col bg-card shadow-md">
            <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-green-500" />
                사용자 정보
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.href = '/admin/usermanager'}
              >
                더보기
              </Button>
            </CardHeader>

            <CardContent className="flex-1 min-h-0 overflow-auto p-0">
              <DataTable
                data={pendingUsers}
                columns={userInfoColumns}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 공지사항 상세 보기 팝업 */}
      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setModalOpen(false);
            setSelectedAnnouncement(null);
            setFormData({
              title: '',
              content: '',
              type: 'general',
              status: 'active',
              priority: 'normal',
              targetAudience: 'all',
            });
            setIsPinned(false);
          }
        }}
      >
        <DialogContent className="w-full max-w-[500px] min-h-[470px]">
          <DialogHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 leading-none">
              <Pencil className="h-5 w-5 text-primary" />
              공지사항 보기
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-left">
                제목
              </Label>
              <Input
                id="title"
                value={formData.title}
                readOnly
                className="col-span-3 bg-muted"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-left">
                공지유형
              </Label>
              <Select value={formData.type} disabled labels={NOTIFICATION_TYPE_LABELS}>
                <SelectTrigger className="col-span-3 bg-muted">
                  <SelectValue placeholder="유형 선택" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(NOTIFICATION_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="content" className="text-left pt-2">
                내용
              </Label>
              <Textarea
                id="content"
                value={formData.content}
                readOnly
                className="col-span-3 min-h-[200px] bg-muted resize-none"
              />
            </div>

            {((selectedAnnouncement?.attachments ?? []).length > 0) && (
              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-left pt-2 flex items-center gap-1">
                  <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  첨부파일
                </Label>
                <ul className="col-span-3 space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
                  {(selectedAnnouncement?.attachments ?? []).map((file) => (
                    <li key={file.url}>
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={file.originalName}
                        className="text-primary underline-offset-2 hover:underline break-all"
                      >
                        {file.originalName}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setModalOpen(false);
                setSelectedAnnouncement(null);
                setFormData({
                  title: '',
                  content: '',
                  type: 'general',
                  status: 'active',
                  priority: 'normal',
                  targetAudience: 'all',
                });
                setIsPinned(false);
              }}
            >
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
};

export default AdminDashboard;