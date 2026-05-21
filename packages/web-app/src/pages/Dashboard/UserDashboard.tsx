/**
 * 페이지 요약 — 사용자 대시보드 (`/dashboard`)
 *
 * 기능: 운동 통계·최근 기록·공지(첨부 표시·팝업 링크)·인기 운동·이력/테스트 데이터 조회 및 Vimeo 툴팁 미리보기.
 *
 * 호출/연동:
 * - `userDashboardService`: `GET /user-dashboard/popular-workouts`, `recent-workouts`, `announcements`, `stats`
 * - `api`: `GET /workout-categories/workout-history-master`, `GET /workout-categories/test-user-exercises`
 * - `notificationApi.markAsRead` 등
 * - DB/SP는 `packages/api-server` 해당 라우트 구현 참조.
 *
 * 관련 컴포넌트: 내부 `VideoTooltip`, shadcn `Table`/`Dialog`/`DatePicker`.
 *
 * 흐름: 병렬 데이터 로드 → 필터·날짜로 이력 조회 → 공지 읽음 처리·첨부 링크 표시.
 */

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ko';
import updateLocale from 'dayjs/plugin/updateLocale';
import { DatePicker } from '@/components/ui/date-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

dayjs.extend(updateLocale);
import {
  Users as People,
  TrendingUp,
  Activity,
  Megaphone,
  ChevronRight,
  Paperclip,
  Clock as AccessTime,
  Dumbbell as FitnessCenter,
  Timer,
  Edit as EditIcon,
  X as CancelIcon,
  X as ClearIcon,
  Calendar,
  Search,
  Info
} from 'lucide-react';
import { useTheme as useCustomTheme } from '../../contexts/ThemeContext';
import api from '../../services/api';
import { notificationApi } from '../../services/notificationApi';
import {
  userDashboardService,
  type PopularWorkout,
  type RecentWorkout,
  type UserAnnouncement,
  type UserStats
} from '../../services/userDashboard.service';
import { parseNotificationAttachments } from '../../types/notification';


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
        top: rect.top, // fixed는 뷰포트 기준이므로 scrollY 불필요
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
      <div
        ref={anchorRef}
        className="w-full h-full inline-flex items-center cursor-pointer"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>
      {open && typeof document !== 'undefined' && document.body && createPortal(
        <div
          className="fixed w-[560px] h-[315px] bg-black rounded-lg overflow-hidden p-1 z-[9999] shadow-2xl pointer-events-auto"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
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
            style={{ borderRadius: '4px' }}
          />
        </div>,
        document.body
      )}
    </>
  );
};

interface WorkoutItem {
  id: string;
  name: string;
  count: number;
  image?: string;
  category: string;
}

// 확장된 사용자 통계 타입
interface ExtendedUserStats {
  workout_days: number;
  total_minutes: number;
  avg_daily_minutes: number;
  exercise_types_used: number;
}

// 사용자별 많이 하는 운동 타입
interface UserTopExercise {
  exercise_id: string;
  exercise_name: string;
  exercise_name_en: string;
  target_muscles: string;
  equipment: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  characteristics?: string;
  purpose?: string;
  video_url?: string;
  thumbnail_url?: string;
  video_title?: string;
  video_duration?: number;
  is_active: boolean;
  exercise_count: number;
  total_duration: number;
  avg_duration: number;
  first_workout_date: string;
  last_workout_date: string;
  category_name: string;
  category_id: string;
  avg_duration_rounded: number;
  frequency_level: string;
  level_ko: string;
}

// 확장된 운동 타입 (기존 호환성 유지)
interface ExtendedPopularWorkout extends PopularWorkout {
  name_ko?: string;
  target_muscles?: string;
  equipment?: string;
}

// 확장된 최근 운동 타입 (RecentWorkout에 이미 필요한 속성들이 있음)
interface ExtendedRecentWorkout extends RecentWorkout {
  // RecentWorkout에 이미 exercise_names, exercise_count, workout_date, workout_time, total_duration이 있음
}

const UserDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { mode } = useCustomTheme();

  const [workoutList, setWorkoutList] = useState<UserTopExercise[]>([]);
  const [announcements, setAnnouncements] = useState<UserAnnouncement[]>([]);
  const [recentWorkouts, setRecentWorkouts] = useState<ExtendedRecentWorkout[]>([]);
  const [userStats, setUserStats] = useState<ExtendedUserStats | null>(null);
  const [adminWorkoutMasters, setAdminWorkoutMasters] = useState<any[]>([]);

  // 공지사항 팝업 관련 상태
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<UserAnnouncement | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'general',
    priority: 'normal',
  });
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<'전체' | '날짜별' | '자극부위'>('전체');
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [targetMuscleFilter, setTargetMuscleFilter] = useState<string>('');
  const [appliedTargetMuscleFilter, setAppliedTargetMuscleFilter] = useState<string>('');


  useEffect(() => {
    console.log('=== Dashboard useEffect 실행 ===');
    dayjs.locale('ko');
    dayjs.updateLocale('ko', {
      months: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
      monthsShort: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
    });
    loadDashboardData();
  }, []);

  // 사용자별 많이 하는 운동 데이터 로드
  // 관리자 추천 운동 데이터 로드
  const loadAdminWorkoutMasters = async () => {
    try {
      // 년월 관계없이 관리자 데이터만 조회
      const params = {
        admin: '1' // 관리자 데이터만 조회
      };

      console.log('=== 관리자 추천 운동 조회 시작 ===');
      console.log('요청 파라미터:', params);
      const response = await api.get('/workout-categories/workout-history-master', { params });
      console.log('API 응답:', response.data);

      if (response.data.success) {
        const masterData = response.data.data || [];
        console.log('관리자 추천 운동 원본 데이터:', masterData);
        console.log('데이터 개수:', masterData.length);

        // 데이터 검증 및 정제
        const validatedData = masterData.map((item: any, index: number) => ({
          id: item.id || `temp-${index}`,
          date: item.date || '',
          time: item.time || '',
          workoutTime: item.workoutTime || item.workout_time || item.total_workout_time || '',
          memo: item.memo || '',
          workoutCategory: item.workoutCategory || item.workout_category || 'Unknown',
          workoutCategoriesId: item.workout_categories_id || 'Unknown',
          workoutCategoriesName: item.major_category_name || '-',
          circuitType: item.circuit_type || item.circuitType || null,
          created_at: item.created_at || ''
        }));

        console.log('검증된 데이터:', validatedData);

        // 날짜(내림차순) -> 생성일자(내림차순) 정렬 후 최근 5개만
        const sortedData = validatedData
          .sort((a, b) => {
            const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
            if (dateCompare !== 0) return dateCompare;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          })
          .slice(0, 5);

        console.log('최종 정렬된 데이터 (5개):', sortedData);
        setAdminWorkoutMasters(sortedData);
      } else {
        console.error('관리자 추천 운동 조회 실패:', response.data.message);
        setAdminWorkoutMasters([]);
      }
    } catch (error: any) {
      console.error('관리자 추천 운동 조회 오류:', error);
      console.error('오류 상세:', error.response?.data);
      setAdminWorkoutMasters([]);
    }
  };

  const loadUserTopExercises = async () => {
    try {
      console.log('=== 사용자별 많이 하는 운동 데이터 로드 시작 ===');

      // 현재 로그인한 사용자 정보 확인 (sessionStorage 사용 - 브라우저 닫으면 만료)
      const token = sessionStorage.getItem('token');

      console.log('=== 로그인 상태 확인 ===');
      console.log('토큰 존재 여부:', !!token);
      console.log('실제 토큰 값:', token ? token.substring(0, 50) + '...' : 'null');

      if (!token) {
        console.warn('토큰이 없습니다. 로그인이 필요합니다.');
        return;
      }

      console.log('🌐🌐🌐 API 호출 시작: /workout-categories/test-user-exercises 🌐🌐🌐');
      const response = await api.get('/workout-categories/test-user-exercises');
      console.log('🌐 API 호출 완료');

      console.log('📥📥📥 API 응답 상세 📥📥📥');
      console.log('response.status:', response.status);
      console.log('response.data 전체:', JSON.stringify(response.data, null, 2));
      console.log('response.data.success:', response.data.success);
      console.log('response.data.data 타입:', typeof response.data.data);
      console.log('response.data.data 길이:', Array.isArray(response.data.data) ? response.data.data.length : 'Not Array');
      console.log('response.data.data 내용:', JSON.stringify(response.data.data, null, 2));

      if (response.data.success) {
        const topExercises = response.data.data || [];
        console.log('🎯🎯🎯 최종 처리 데이터 🎯🎯🎯');
        console.log('topExercises 타입:', typeof topExercises);
        console.log('topExercises 배열 여부:', Array.isArray(topExercises));
        console.log('topExercises 길이:', Array.isArray(topExercises) ? topExercises.length : 'Not Array');
        console.log('topExercises 내용:', JSON.stringify(topExercises, null, 2));

        console.log('🔄 setWorkoutList 호출 중...');
        setWorkoutList(topExercises);
        console.log('✅ setWorkoutList 호출 완료');

        if (topExercises.length === 0) {
          console.warn('⚠️ 운동 기록이 없습니다. 운동을 먼저 등록해주세요.');
        } else {
          console.log('🎉🎉🎉 운동 데이터', topExercises.length, '건 로드 성공! 🎉🎉🎉');
        }
      } else {
        console.error('❌ 사용자별 많이 하는 운동 조회 실패:', response.data.message);
        setWorkoutList([]);
      }
    } catch (error) {
      console.error('사용자별 많이 하는 운동 로드 실패:', error);
      console.error('오류 상세:', error.response?.data);
      setWorkoutList([]);
    }
  };

  const loadDashboardData = async () => {
    try {
      console.log('=== loadDashboardData 시작 ===');
      setLoading(true);

      // 병렬로 사용자 대시보드 데이터 로드
      console.log('공지사항, 최근운동 로드 시작...');
      const [userAnnouncements, recent] = await Promise.all([
        userDashboardService.getAnnouncements().catch((err) => {
          console.error('공지사항 로드 실패:', err);
          return [];
        }),
        userDashboardService.getRecentWorkouts().catch((err) => {
          console.error('최근 운동 로드 실패:', err);
          return [];
        })
      ]);

      // 통계는 별도로 호출하여 에러 상세 확인
      console.log('=== 통계 데이터 별도 로드 시작 ===');
      let stats = null;
      try {
        stats = await userDashboardService.getStats();
        console.log('통계 API 호출 성공:', stats);
      } catch (statsError) {
        console.error('=== 통계 API 호출 실패 상세 ===');
        console.error('오류 객체:', statsError);
        console.error('응답 데이터:', statsError?.response?.data);
        console.error('상태 코드:', statsError?.response?.status);
      }

      console.log('사용자별 많이 하는 운동 데이터 로드 시작...');
      // 사용자별 많이 하는 운동 데이터 로드
      console.log('loadUserTopExercises 함수 호출 중...');
      await loadUserTopExercises();
      console.log('loadUserTopExercises 함수 호출 완료');

      // 관리자 추천 운동 데이터 로드
      console.log('관리자 추천 운동 데이터 로드 시작...');
      await loadAdminWorkoutMasters();
      console.log('관리자 추천 운동 데이터 로드 완료');

      console.log('=== API 응답 데이터 확인 ===');
      console.log('공지사항:', userAnnouncements);
      console.log('최근 운동 원본:', recent);
      console.log('최근 운동 길이:', recent?.length);
      console.log('최근 운동 상세:', JSON.stringify(recent, null, 2));
      console.log('통계 원본 데이터:', stats);
      console.log('통계 데이터 타입:', typeof stats);
      console.log('통계 데이터가 null인가?', stats === null);
      console.log('통계 데이터가 undefined인가?', stats === undefined);

      setAnnouncements(userAnnouncements);

      // 최근 운동 데이터 설정 - 빈 배열이 아닐 때만
      console.log('=== 최근 운동 데이터 설정 ===');
      if (recent && Array.isArray(recent) && recent.length > 0) {
        console.log('실제 데이터 사용:', recent.length, '건');
        setRecentWorkouts(recent as ExtendedRecentWorkout[]);
      } else {
        console.log('최근 운동 데이터가 없습니다.');
        setRecentWorkouts([]);
      }

      // 실제 통계 데이터가 있으면 사용, 없으면 기본값
      if (stats && typeof stats === 'object') {
        console.log('=== 실제 통계 데이터 사용 ===');
        console.log('workout_days:', stats.workout_days);
        console.log('total_minutes:', stats.total_minutes);
        console.log('avg_daily_minutes:', stats.avg_daily_minutes);
        console.log('exercise_types_used:', stats.exercise_types_used);
        setUserStats(stats);
      } else {
        console.log('=== 기본 통계 데이터 사용 (stats가 없음) ===');
        setUserStats({
          workout_days: 0,
          total_minutes: 0,
          avg_daily_minutes: 0,
          exercise_types_used: 0
        });
      }

      // 목업 데이터는 데이터가 없을 때만 사용
      if (userAnnouncements.length === 0) {
        setAnnouncements([
          { id: '1', title: '오늘 AA 운동이 추가 되었습니다.', content: '', type: 'update', priority: 'normal', created_at: '2024-01-18', is_active: true, is_pinned: false, view_count: 0 },
          { id: '2', title: '오늘 BB 운동이 추가 되었습니다.', content: '', type: 'update', priority: 'normal', created_at: '2024-01-18', is_active: true, is_pinned: false, view_count: 0 },
          { id: '3', title: '시스템이 업데이트되었습니다.', content: '', type: 'maintenance', priority: 'high', created_at: '2024-01-17', is_active: true, is_pinned: true, view_count: 0 }
        ]);
      }

    } catch (error) {
      console.error('=== 대시보드 데이터 로딩 실패 ===', error);
    } finally {
      console.log('=== loadDashboardData 완료 ===');
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
      case 'urgent':
        return 'error';
      case 'normal':
        return 'default';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  const getAnnouncementTypeLabel = (type: string) => {
    switch (type) {
      case 'general': return '일반';
      case 'maintenance': return '점검';
      case 'update': return '업데이트';
      case 'event': return '이벤트';
      case 'urgent': return '긴급';
      default: return '일반';
    }
  };

  const getAnnouncementTypeColor = (type: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (type) {
      case 'general': return 'default';
      case 'maintenance': return 'warning';
      case 'update': return 'info';
      case 'event': return 'success';
      case 'urgent': return 'error';
      default: return 'default';
    }
  };

  const getAnnouncementTypeVariant = (type: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (type) {
      case 'urgent': return 'destructive';
      case 'maintenance': return 'secondary';
      case 'update': return 'outline';
      default: return 'default';
    }
  };

  // 공지사항 클릭 핸들러
  const handleAnnouncementClick = async (announcement: UserAnnouncement) => {
    setSelectedAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
      priority: announcement.priority || 'normal',
    });
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

  // DataGrid용 데이터 준비 (사용자별 많이 하는 운동) - useMemo로 메모이제이션
  const allGridRows = useMemo(() => {
    return workoutList.map((workout, index) => ({
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
      thumbnail_url: workout.thumbnail_url
    }));
  }, [workoutList]);

  // 필터링된 데이터 - useMemo로 메모이제이션
  const gridRows = useMemo(() => {
    let filtered = allGridRows;

    // 자극부위 필터 적용 (Enter 키로 적용된 필터만 사용)
    if (selectedView === '자극부위' && appliedTargetMuscleFilter.trim()) {
      filtered = filtered.filter(row =>
        row.target_muscles?.toLowerCase().includes(appliedTargetMuscleFilter.toLowerCase().trim())
      );
    }

    // 날짜별 필터 적용
    if (selectedView === '날짜별' && selectedDate) {
      const selectedDateStr = selectedDate.format('YYYY-MM-DD');
      filtered = filtered.filter(row => {
        if (row.last_workout_date) {
          const workoutDate = dayjs(row.last_workout_date).format('YYYY-MM-DD');
          return workoutDate === selectedDateStr;
        }
        return false;
      });
    }

    // 순위 재계산
    return filtered.map((row, index) => ({
      ...row,
      rank: index + 1
    }));
  }, [allGridRows, selectedView, selectedDate, appliedTargetMuscleFilter]);

  // 디버깅: 데이터 상태 확인
  useEffect(() => {
    console.log('=== 자주하는 운동 리스트 데이터 상태 ===');
    console.log('workoutList 길이:', workoutList.length);
    console.log('selectedView:', selectedView);
    console.log('selectedDate:', selectedDate?.format('YYYY-MM-DD'));
    console.log('appliedTargetMuscleFilter:', appliedTargetMuscleFilter);
    console.log('allGridRows 길이:', allGridRows.length);
    console.log('gridRows 길이:', gridRows.length);
  }, [workoutList, selectedView, selectedDate, appliedTargetMuscleFilter, allGridRows, gridRows]);

  // 관리자 추천 운동 DataGrid용 데이터 준비
  const adminWorkoutGridRows = useMemo(() => {
    return adminWorkoutMasters.map((workout) => ({
      id: workout.id,
      date: workout.date,
      workoutCategoriesName: workout.workoutCategoriesName,
      circuitType: workout.circuitType,
      workoutTime: workout.workoutTime,
      memo: workout.memo
    }));
  }, [adminWorkoutMasters]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p>대시보드 데이터를 불러오는 중...</p>
      </div>
    );
  }


  return (
    <TooltipProvider>
      <div
        data-testid="user-dashboard-main"
        className="p-0 h-[calc(100vh-140px)] overflow-hidden flex flex-col bg-background"
      >
        {/* 상단 통계 카드 4개 */}
        <div className="flex flex-wrap justify-between gap-[3px] mb-[3px] shrink-0 w-full">
          {userStats && [
            {
              key: 'workout_days',
              icon: <Activity className="w-8 h-8 text-blue-500" />,
              label: '운동 일수',
              value: userStats.workout_days,
              unit: '일',
              bgColor: 'bg-blue-500/10'
            },
            {
              key: 'total_minutes',
              icon: <AccessTime className="w-8 h-8 text-emerald-500" />,
              label: '총 운동 시간',
              value: userStats.total_minutes,
              unit: '분',
              bgColor: 'bg-emerald-500/10'
            },
            {
              key: 'avg_daily_minutes',
              icon: <Timer className="w-8 h-8 text-amber-500" />,
              label: '일 평균 운동시간',
              value: userStats.avg_daily_minutes,
              unit: '분',
              bgColor: 'bg-amber-500/10'
            },
            {
              key: 'exercise_types_used',
              icon: <FitnessCenter className="w-8 h-8 text-rose-500" />,
              label: '실시한 운동 종류',
              value: userStats.exercise_types_used,
              unit: '개',
              bgColor: 'bg-rose-500/10'
            }
          ].map((stat) => (
            <Card
              key={stat.key}
              className="flex-1 min-w-[200px] h-20 flex items-center gap-4 p-4 hover:translate-y-[-2px] hover:shadow-lg transition-all duration-200 bg-card shadow-md"
            >
              <div className={`p-3 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                {stat.icon}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{stat.value}</span>
                  <span className="text-sm text-muted-foreground">{stat.unit}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* 많이 하는 운동 리스트 */}
        <div className="flex-[1.4] min-h-0 mb-[3px] w-full">
          <Card className="h-full flex flex-col bg-card shadow-md">
            <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
                <FitnessCenter className="w-5 h-5 text-primary" />
                자주 하는 운동 리스트
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
                    <RadioGroupItem value="날짜별" id="view-date" />
                    <Label htmlFor="view-date">날짜별</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="자극부위" id="view-muscle" />
                    <Label htmlFor="view-muscle">자극부위</Label>
                  </div>
                </RadioGroup>

                {selectedView === '날짜별' && (
                  <DatePicker
                    date={selectedDate.toDate()}
                    setDate={(date) => {
                      if (date) {
                        setSelectedDate(dayjs(date))
                      }
                    }}
                    className="w-[170px]"
                  />
                )}

                {selectedView === '자극부위' && (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="자극부위 입력"
                      value={targetMuscleFilter}
                      onChange={(e) => setTargetMuscleFilter(e.target.value)}
                      className="w-[150px] bg-card"
                    />
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

            <CardContent className="flex-1 min-h-0 p-0 overflow-hidden flex flex-col">
              <div className="flex-1 min-h-0 border border-[#343637] dark:border-[#6b7280] overflow-auto relative scrollbar-hide bg-[#f9fafb] dark:bg-[#1d1d1d]">
                {gridRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                    <FitnessCenter className="w-12 h-12 opacity-20" />
                    <div className="text-center">
                      <p className="text-lg font-semibold">운동 기록이 없습니다</p>
                      <p className="text-sm">운동을 등록하면 통계가 표시됩니다</p>
                    </div>
                  </div>
                ) : (
                  <Table className="w-full table-fixed border-separate border-spacing-0">
                    <TableHeader className="sticky top-0 z-10 shadow-sm bg-[#b9adb5] dark:bg-gray-800">
                      <TableRow className="hover:bg-transparent border-b-0 h-[45px]">
                        <TableHead className="w-[60px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">순위</TableHead>
                        <TableHead className="w-[60px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">횟수</TableHead>
                        <TableHead className="w-[110px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">카테고리</TableHead>
                        <TableHead className="w-[120px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">운동명(영문)</TableHead>
                        <TableHead className="w-[120px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">운동명(한글)</TableHead>
                        <TableHead className="w-[70px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">자극부위</TableHead>
                        <TableHead className="w-[150px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">특징/효과</TableHead>
                        <TableHead className="w-[70px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">기구</TableHead>
                        <TableHead className="w-[100px] text-center font-bold px-2 border-b-0 text-[#27272a] dark:text-[#94a3b8]">최근운동</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gridRows.map((row) => (
                        <TableRow
                          key={row.id}
                          className="h-[35px] border-b-0 group transition-colors bg-[#f9fafb] dark:bg-[#1d1d1d] hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30"
                        >
                          <TableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500">
                            <div className={cn(
                              "w-6 h-6 rounded-full mx-auto flex items-center justify-center font-bold",
                              row.rank <= 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            )}>
                              {row.rank}
                            </div>
                          </TableCell>
                          <TableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 font-bold text-primary group-hover:text-inherit group-hover:font-inherit transition-colors">
                            {row.exercise_count}회
                          </TableCell>
                          <TableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 truncate group-hover:text-inherit group-hover:font-inherit transition-colors">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="truncate w-full">
                                  {row.category_name || '-'}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{row.category_name}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 truncate group-hover:text-inherit group-hover:font-inherit transition-colors">
                            <VideoTooltip videoUrl={row.video_url} exerciseName={row.exercise_name_en}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-pointer hover:text-blue-600 dark:hover:text-yellow-400 transition-colors truncate block">{row.exercise_name_en}</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{row.exercise_name_en}</p>
                                </TooltipContent>
                              </Tooltip>
                            </VideoTooltip>
                          </TableCell>
                          <TableCell className="h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 truncate group-hover:text-inherit group-hover:font-inherit transition-colors">
                            <VideoTooltip videoUrl={row.video_url} exerciseName={row.exercise_name}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-pointer hover:text-blue-600 dark:hover:text-yellow-400 transition-colors truncate block">{row.exercise_name}</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{row.exercise_name}</p>
                                </TooltipContent>
                              </Tooltip>
                            </VideoTooltip>
                          </TableCell>
                          <TableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 truncate group-hover:text-inherit group-hover:font-inherit transition-colors">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="truncate w-full">{row.target_muscles}</div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{row.target_muscles}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 truncate group-hover:text-inherit group-hover:font-inherit transition-colors">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="truncate w-full">{row.characteristics || '-'}</div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{row.characteristics || '-'}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 truncate group-hover:text-inherit group-hover:font-inherit transition-colors">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="truncate w-full">{row.equipment || '맨몸'}</div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{row.equipment || '맨몸'}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="text-center h-[35px] py-0 px-2 text-xs truncate group-hover:text-inherit group-hover:font-inherit transition-colors">
                            {row.last_workout_date ? dayjs(row.last_workout_date).format('YYYY-MM-DD') : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 하단 그리드: 공지사항 + 최근 운동 기록 */}
        <div className="flex flex-col lg:flex-row gap-[3px] flex-[0.9] min-h-0 w-full mb-1">
          {/* 공지사항 */}
          <div className="flex-[1.68] lg:order-1 order-2 min-w-0">
            <Card className="flex flex-col h-full shadow-md overflow-hidden">
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
                            <Badge variant={getAnnouncementTypeVariant(row.type)} className="text-[10px] py-0 h-5">
                              {getAnnouncementTypeLabel(row.type)}
                            </Badge>
                          </TableCell>
                          <TableCell className="h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 truncate font-semibold group-hover:text-inherit group-hover:font-inherit transition-colors">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 min-w-0 w-full">
                                  {parseNotificationAttachments(row.attachments).length > 0 && (
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
                                  {parseNotificationAttachments(row.attachments).length > 0 ? ' (첨부 있음)' : ''}
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

          {/* 관리자 추천 운동 기록 */}
          <div className="flex-[1.08] lg:order-2 order-1 min-w-0">
            <Card className="flex flex-col h-full shadow-md overflow-hidden">
              <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  관리자 추천 운동
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/MonthProgram?admin=true')}
                >
                  더보기
                </Button>
              </CardHeader>

              <CardContent className="flex-1 min-h-0 p-0 overflow-hidden flex flex-col">
                <div className="flex-1 min-h-0 border border-[#343637] dark:border-[#6b7280] overflow-auto relative scrollbar-hide bg-[#f9fafb] dark:bg-[#1d1d1d]">
                  {adminWorkoutGridRows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                      <Activity className="w-12 h-12 opacity-20" />
                      <div className="text-center">
                        <p className="text-lg font-semibold">관리자 추천 운동이 없습니다</p>
                        <p className="text-sm">관리자가 운동을 등록하면 표시됩니다</p>
                      </div>
                    </div>
                  ) : (
                    <Table className="w-full table-fixed border-separate border-spacing-0">
                      <TableHeader className="sticky top-0 z-10 shadow-sm bg-[#b9adb5] dark:bg-gray-800">
                        <TableRow className="hover:bg-transparent border-b-0 h-[45px]">
                          <TableHead className="w-[100px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">날짜</TableHead>
                          <TableHead className="w-[120px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">운동구분</TableHead>
                          <TableHead className="w-[80px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">서킷</TableHead>
                          <TableHead className="text-center font-bold px-2 border-b-0 text-[#27272a] dark:text-[#94a3b8]">메모</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adminWorkoutGridRows.map((row) => (
                          <TableRow
                            key={row.id}
                            className="h-[35px] border-b-0 group transition-colors bg-[#f9fafb] dark:bg-[#1d1d1d] hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30"
                          >
                            <TableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 truncate group-hover:text-inherit group-hover:font-inherit transition-colors">
                              {row.date ? dayjs(row.date).format('YYYY-MM-DD') : '-'}
                            </TableCell>
                            <TableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 truncate font-semibold group-hover:text-inherit group-hover:font-inherit transition-colors">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="truncate w-full">
                                    {row.workoutCategoriesName || '-'}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{row.workoutCategoriesName}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 truncate group-hover:text-inherit group-hover:font-inherit transition-colors">
                              {!row.circuitType || row.circuitType === 'none' ? '-' : row.circuitType === 'stress' ? '스트레스' : '루프'}
                            </TableCell>
                            <TableCell className="h-[35px] py-0 px-2 text-xs truncate group-hover:text-inherit group-hover:font-inherit transition-colors">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="truncate w-full">{row.memo || '-'}</div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs whitespace-pre-wrap">{row.memo || '-'}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 공지사항 보기 팝업 */}
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
                priority: 'normal',
              });
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <EditIcon className="w-5 h-5" />
                <span>공지사항 보기</span>
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">제목</Label>
                  <div className="p-2 border rounded-md bg-muted/50 text-sm font-medium">
                    {formData.title}
                  </div>
                </div>
                <div className="w-[120px]">
                  <Label className="text-xs text-muted-foreground mb-1 block">공지유형</Label>
                  <div className="p-2 border rounded-md bg-muted/50 text-sm font-medium text-center">
                    {getAnnouncementTypeLabel(formData.type)}
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">내용</Label>
                <div className="p-4 border rounded-md bg-muted/50 text-sm min-h-[300px] whitespace-pre-wrap">
                  {formData.content}
                </div>
              </div>

              {parseNotificationAttachments(selectedAnnouncement?.attachments ?? []).length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    첨부파일
                  </Label>
                  <ul className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
                    {parseNotificationAttachments(selectedAnnouncement?.attachments ?? []).map((file) => (
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
                    priority: 'normal',
                  });
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

export default UserDashboard;

