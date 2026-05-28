import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';
import { successResponse, errorResponse } from '../utils/response.util.js';
import { pool } from '../lib/database.js';
import { AuthService } from '../services/auth.service.js';
import { z } from 'zod';

const router = Router();

// 쿼리 스키마 정의
const getDashboardStatsSchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional()
});

// 관리자 대시보드 통계 조회
router.get('/stats', authenticateToken, validateRequest({ query: getDashboardStatsSchema }), async (req: any, res) => {
  try {
    const userRole = req.user?.role;

    // 관리자 권한 확인
    if (!['branch_admin', 'super_admin'].includes(userRole)) {
      return res.status(403).json(errorResponse('관리자 권한이 필요합니다', 'FORBIDDEN'));
    }

    // 사용자 승인 통계 조회 (직접 쿼리)
    const [userStats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN is_approved = TRUE THEN 1 ELSE 0 END) as approved_users,
        SUM(CASE WHEN is_approved = FALSE THEN 1 ELSE 0 END) as pending_users,
        SUM(CASE WHEN used = FALSE THEN 1 ELSE 0 END) as inactive_users,
        SUM(CASE WHEN role = 'branch_admin' AND is_approved = TRUE THEN 1 ELSE 0 END) as approved_admins,
        SUM(CASE WHEN role = 'user' AND is_approved = TRUE THEN 1 ELSE 0 END) as approved_regular_users
      FROM users 
      WHERE used = TRUE
    `);

    // 운동 카테고리 통계 조회 (직접 쿼리)
    const [workoutStats] = await pool.execute(`
      SELECT 
        wc.id,
        wc.major_category,
        wc.minor_category,
        COUNT(e.id) as exercise_count
      FROM workout_categories wc
      LEFT JOIN exercises e ON wc.id = e.workout_category_id AND e.is_active = TRUE
      GROUP BY wc.id, wc.major_category, wc.minor_category
      ORDER BY exercise_count DESC
    `);

    // 공지사항 개수 조회
    const [announcementCount] = await pool.execute(
      'SELECT COUNT(*) as total_announcements FROM announcements WHERE is_active = TRUE'
    );

    // 최근 활동 통계 (옵션)
    const { start_date, end_date } = req.query;
    let activityStats = null;

    if (start_date && end_date) {
      const [activity] = await pool.execute(
        'CALL sp_get_user_activity_stats(?, ?, ?, ?)',
        [null, null, start_date, end_date]
      );
      activityStats = activity;
    }

    const stats = {
      userStats: Array.isArray(userStats) ? userStats[0] : userStats,
      workoutStats: Array.isArray(workoutStats) ? workoutStats : workoutStats,
      announcementCount: Array.isArray(announcementCount) ? announcementCount[0] : announcementCount,
      activityStats
    };

    res.json(successResponse(stats, '대시보드 통계를 성공적으로 조회했습니다'));
  } catch (error) {
    console.error('대시보드 통계 조회 실패:', error);
    res.status(500).json(errorResponse('대시보드 통계 조회에 실패했습니다'));
  }
});

// 인기 운동 리스트 조회 (실제 운동 세션 데이터 기반)
router.get('/popular-workouts', authenticateToken, async (req: any, res) => {
  try {
    const userRole = req.user?.role;

    // 관리자 권한 확인
    if (!['admin', 'super_admin'].includes(userRole)) {
      return res.status(403).json(errorResponse('관리자 권한이 필요합니다', 'FORBIDDEN'));
    }

    const { branch_id, start_date, end_date, target_muscle, limit } = req.query;

    const [results] = await pool.execute(
      'CALL sp_GetFrequentWorkouts(?, ?, ?, ?, ?)',
      [
        branch_id || null,
        start_date || null,
        end_date || null,
        target_muscle || null,
        limit ? parseInt(limit as string) : 10
      ]
    );

    const popularWorkouts = Array.isArray(results) ? results[0] : [];

    res.json(successResponse(popularWorkouts, '인기 운동 리스트를 성공적으로 조회했습니다'));
  } catch (error) {
    console.error('인기 운동 리스트 조회 실패:', error);
    res.status(500).json(errorResponse('인기 운동 리스트 조회에 실패했습니다'));
  }
});

// 최근 공지사항 조회
router.get('/recent-announcements', authenticateToken, async (req: any, res) => {
  try {
    const userRole = req.user?.role;

    // 관리자 권한 확인
    if (!['admin', 'super_admin'].includes(userRole)) {
      return res.status(403).json(errorResponse('관리자 권한이 필요합니다', 'FORBIDDEN'));
    }

    const [announcements] = await pool.execute(`
      SELECT 
        id, title, type, priority, created_at, is_active, is_pinned
      FROM announcements 
      WHERE is_active = TRUE
      ORDER BY is_pinned DESC, created_at DESC 
      LIMIT 5
    `);

    res.json(successResponse(announcements, '최근 공지사항을 성공적으로 조회했습니다'));
  } catch (error) {
    console.error('최근 공지사항 조회 실패:', error);
    res.status(500).json(errorResponse('최근 공지사항 조회에 실패했습니다'));
  }
});

// 승인 대기 사용자 목록 (대시보드용 - 제한된 개수)
router.get('/pending-users', authenticateToken, async (req: any, res) => {
  try {
    const userRole = req.user?.role;

    // 관리자 권한 확인
    if (!['branch_admin', 'super_admin'].includes(userRole)) {
      return res.status(403).json(errorResponse('관리자 권한이 필요합니다', 'FORBIDDEN'));
    }

    const whereConditions = [
      'u.used = TRUE',
      'u.is_approved = FALSE'
    ];
    const params: any[] = [];

    if (userRole === 'branch_admin') {
      if (!req.user?.branchId) {
        return res.status(400).json(errorResponse('소속 지점 정보가 없습니다', 'BAD_REQUEST'));
      }
      whereConditions.push('u.role = ?');
      whereConditions.push('u.branch_id = ?');
      params.push('user', req.user.branchId);
    } else {
      whereConditions.push("u.role = 'branch_admin'");
    }

    // branch_admin은 자기 지점 일반 사용자, super_admin은 지점관리자 신청만 조회
    const [pendingUsers] = await pool.execute(`
      SELECT 
        u.id,
        u.userid,
        u.name,
        u.email,
        u.role,
        u.is_approved,
        u.created_at,
        COALESCE(b.name, '미지정') as branch_name
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY 
        u.created_at DESC
      LIMIT 10
    `, params);

    res.json(successResponse(pendingUsers, '승인 대기 사용자 목록을 성공적으로 조회했습니다'));
  } catch (error) {
    console.error('승인 대기 사용자 조회 실패:', error);
    res.status(500).json(errorResponse('승인 대기 사용자 조회에 실패했습니다'));
  }
});

// 관리자 요약 정보
router.get('/admin-summary', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // 관리자 권한 확인
    if (!['admin', 'super_admin'].includes(userRole)) {
      return res.status(403).json(errorResponse('관리자 권한이 필요합니다', 'FORBIDDEN'));
    }

    // 관리자 정보 조회
    const [adminInfo] = await pool.execute('CALL sp_get_user_by_id(?)', [userId]);

    // 최근 승인한 사용자 수
    const [recentApprovals] = await pool.execute(`
      SELECT COUNT(*) as recent_approvals
      FROM users 
      WHERE approved_by = ? 
      AND approved_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `, [userId]);

    const summary = {
      adminInfo: Array.isArray(adminInfo) ? adminInfo[0]?.[0] : adminInfo,
      recentApprovals: Array.isArray(recentApprovals) ? recentApprovals[0] : recentApprovals
    };

    res.json(successResponse(summary, '관리자 요약 정보를 성공적으로 조회했습니다'));
  } catch (error) {
    console.error('관리자 요약 정보 조회 실패:', error);
    res.status(500).json(errorResponse('관리자 요약 정보 조회에 실패했습니다'));
  }
});

// 사용자 승인 처리
router.post('/approve-user/:userId', authenticateToken, async (req: any, res) => {
  try {
    const userRole = req.user?.role;
    const adminId = req.user?.id;
    const { userId } = req.params;

    // 관리자 권한 확인
    if (!['branch_admin', 'super_admin'].includes(userRole)) {
      return res.status(403).json(errorResponse('관리자 권한이 필요합니다', 'FORBIDDEN'));
    }

    const [targetRows] = await pool.execute(`
      SELECT id, userid, role, branch_id
      FROM users
      WHERE id = ? AND used = TRUE AND is_approved = FALSE
    `, [userId]);

    const targetUser = Array.isArray(targetRows) ? (targetRows as any[])[0] : null;
    if (!targetUser) {
      return res.status(404).json(errorResponse('승인 대기 사용자를 찾을 수 없습니다', 'NOT_FOUND'));
    }

    if (userRole === 'branch_admin') {
      if (targetUser.role !== 'user' || String(targetUser.branch_id ?? '') !== String(req.user?.branchId ?? '')) {
        return res.status(403).json(errorResponse('소속 지점 사용자만 승인할 수 있습니다', 'FORBIDDEN'));
      }
    }

    if (userRole === 'super_admin' && targetUser.role === 'branch_admin' && !targetUser.branch_id) {
      return res.status(400).json(errorResponse('지점관리자는 사용자 관리 화면에서 지점을 선택한 후 승인해주세요', 'BRANCH_REQUIRED'));
    }

    // 사용자 승인 처리
    const [result] = await pool.execute(`
      UPDATE users 
      SET is_approved = TRUE, 
          approved_by = ?, 
          approved_at = NOW() 
      WHERE id = ? AND used = TRUE
    `, [adminId, userId]);

    if ((result as any).affectedRows === 0) {
      return res.status(404).json(errorResponse('사용자를 찾을 수 없습니다', 'NOT_FOUND'));
    }

    try {
      await AuthService.createUserMenuItems(targetUser.userid)
    } catch (menuError) {
      console.error('승인 후 기본 메뉴 등록 실패:', menuError)
    }

    res.json(successResponse({ userId }, '사용자가 성공적으로 승인되었습니다'));
  } catch (error) {
    console.error('사용자 승인 실패:', error);
    res.status(500).json(errorResponse('사용자 승인에 실패했습니다'));
  }
});

export default router;

