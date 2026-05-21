import { Router } from 'express';
import { executeQuery, callProcedure } from '../lib/database.js';
import { ResponseUtil } from '../utils/response.util.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

/**
 * 사용자 대시보드 - 많이 하는 운동 리스트
 */
router.get('/popular-workouts', authenticateToken as any, async (req, res) => {
  try {
    const { view = 'all', branch_id, date } = req.query;

    const results = await callProcedure('sp_GetPopularWorkouts', [
      view,
      branch_id || null,
      date || null
    ]);

    const popularWorkouts = results || [];

    return ResponseUtil.success(res, popularWorkouts, '인기 운동을 조회했습니다.');
  } catch (error) {
    console.error('인기 운동 조회 실패:', error);
    return ResponseUtil.error(res, '인기 운동 조회에 실패했습니다.');
  }
});

/**
 * 사용자 대시보드 - 최근 5일간 운동기록
 */
router.get('/recent-workouts', authenticateToken as any, async (req, res) => {
  try {
    const userId = (req as any).user?.id;

    // console.log('=== 최근 운동기록 API 호출 시작 ===');
    // console.log('사용자 ID:', userId);

    if (!userId) {
      return ResponseUtil.unauthorized(res, '로그인이 필요합니다.');
    }

    // console.log('프로시저 호출: sp_GetRecentWorkouts, 파라미터:', [userId]);

    // 먼저 직접 쿼리로 데이터 존재 여부 확인
    const testQuery = `
      SELECT COUNT(*) as total_records 
      FROM workout_history_master 
      WHERE user_id = ? 
        AND date >= DATE_SUB(CURDATE(), INTERVAL 5 DAY)
    `;
    const testResult = await executeQuery(testQuery, [userId]);
    //console.log('최근 5일간 workout_history_master 레코드 수:', testResult);

    const results = await callProcedure('sp_GetRecentWorkouts', [userId]);

    //console.log('=== 최근 운동기록 프로시저 실행 결과 ===');
    //console.log('results 타입:', typeof results);
    //console.log('results 길이:', Array.isArray(results) ? results.length : 'Not Array');
    //console.log('results 전체:', JSON.stringify(results, null, 2));

    // results는 [데이터배열, 메타데이터] 형태로 반환됨
    const dataArray = results && results.length > 0 ? results[0] : [];
    const recentWorkouts = Array.isArray(dataArray) ? dataArray : [];

    //console.log('=== 최종 최근 운동기록 데이터 ===');
    //console.log('recentWorkouts:', JSON.stringify(recentWorkouts, null, 2));

    return ResponseUtil.success(res, recentWorkouts, '최근 운동기록을 조회했습니다.');
  } catch (error: any) {
    console.error('=== 최근 운동기록 조회 실패 ===');
    console.error('오류 상세:', error);
    return ResponseUtil.error(res, '최근 운동기록 조회에 실패했습니다.');
  }
});

/**
 * 사용자 대시보드 - 공지사항 (사용자용)
 */
router.get('/announcements', authenticateToken as any, async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        title,
        content,
        attachments,
        type,
        priority,
        created_at,
        is_active,
        is_pinned,
        view_count
      FROM announcements
      WHERE is_active = 1
        AND (target_audience = 'user' OR target_audience = 'all')
      ORDER BY is_pinned DESC, created_at DESC
      LIMIT 10
    `;

    const announcements = await executeQuery(query);

    return ResponseUtil.success(res, announcements, '공지사항을 조회했습니다.');
  } catch (error) {
    console.error('공지사항 조회 실패:', error);
    return ResponseUtil.error(res, '공지사항 조회에 실패했습니다.');
  }
});

/**
 * 사용자 대시보드 - 운동 통계
 */
router.get('/stats', authenticateToken as any, async (req, res) => {
  try {
    const userId = (req as any).user?.id;

    //console.log('=== 운동 통계 API 호출 시작 ===');
    //console.log('사용자 ID:', userId);

    if (!userId) {
      return ResponseUtil.unauthorized(res, '로그인이 필요합니다.');
    }

    //console.log('프로시저 호출: sp_GetWorkoutStats, 파라미터:', [userId]);

    // 먼저 직접 쿼리로 데이터 존재 여부 확인
    const testQuery = `
      SELECT COUNT(*) as total_records 
      FROM workout_history_master 
      WHERE user_id = ?
    `;
    const testResult = await executeQuery(testQuery, [userId]);
    //console.log('직접 쿼리 결과 - workout_history_master 레코드 수:', testResult);

    const results = await callProcedure('sp_GetWorkoutStats', [userId]);

    //console.log('=== 프로시저 실행 결과 ===');
    //console.log('results 타입:', typeof results);
    //console.log('results 길이:', Array.isArray(results) ? results.length : 'Not Array');
    //console.log('results 전체:', JSON.stringify(results, null, 2));

    // results는 [데이터배열, 메타데이터] 형태로 반환됨
    const dataArray = results && results.length > 0 ? results[0] : [];
    const rawStats = dataArray && dataArray.length > 0 ? dataArray[0] : {};
    //console.log('dataArray:', JSON.stringify(dataArray, null, 2));
    //console.log('rawStats:', JSON.stringify(rawStats, null, 2));

    // 일평균 운동시간 계산 (총 운동시간 / 운동일수)
    const avgDailyMinutes = rawStats.workout_days > 0
      ? Math.round(rawStats.total_minutes / rawStats.workout_days)
      : 0;

    const stats = {
      workout_days: rawStats.workout_days || 0,
      total_minutes: rawStats.total_minutes || 0,
      avg_daily_minutes: avgDailyMinutes,
      exercise_types_used: rawStats.exercise_types_used || 0
    };

    //console.log('=== 최종 응답 데이터 ===');
    //console.log('stats:', JSON.stringify(stats, null, 2));

    return ResponseUtil.success(res, stats, '운동 통계를 조회했습니다.');
  } catch (error: any) {
    console.error('=== 운동 통계 조회 실패 ===');
    console.error('오류 상세:', error);
    console.error('오류 스택:', error.stack);
    return ResponseUtil.error(res, '운동 통계 조회에 실패했습니다.');
  }
});

/**
 * 디버깅용 - 운동 기록 테이블 데이터 확인
 */
router.get('/debug/workout-data', authenticateToken as any, async (req, res) => {
  try {
    const userId = (req as any).user?.id;

    //console.log('=== 운동 기록 데이터 디버깅 ===');
    //console.log('사용자 ID:', userId);

    if (!userId) {
      return ResponseUtil.unauthorized(res, '로그인이 필요합니다.');
    }

    // 1. workout_history_master 테이블 확인
    const masterQuery = `
      SELECT COUNT(*) as master_count 
      FROM workout_history_master 
      WHERE user_id = ?
    `;
    const masterResult = await executeQuery(masterQuery, [userId]);
    //console.log('workout_history_master 테이블 데이터 수:', masterResult);

    // 2. workout_history_detail 테이블 확인
    const detailQuery = `
      SELECT COUNT(*) as detail_count 
      FROM workout_history_detail whd
      INNER JOIN workout_history_master whm ON whd.workout_history_master_id = whm.id
      WHERE whm.user_id = ?
    `;
    const detailResult = await executeQuery(detailQuery, [userId]);
    //console.log('workout_history_detail 테이블 데이터 수:', detailResult);

    // 3. 최근 30일 데이터 확인
    const recentQuery = `
      SELECT 
        whm.date,
        whm.memo,
        COUNT(whd.exercises_id) as exercise_count,
        SUM(whd.duration) as total_duration
      FROM workout_history_master whm
      LEFT JOIN workout_history_detail whd ON whm.id = whd.workout_history_master_id
      WHERE whm.user_id = ?
        AND whm.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY whm.id, whm.date, whm.memo
      ORDER BY whm.date DESC
      LIMIT 10
    `;
    const recentResult = await executeQuery(recentQuery, [userId]);
    //console.log('최근 30일 운동 기록:', recentResult);

    // 4. 전체 사용자 데이터 확인 (다른 사용자 데이터가 있는지)
    const allUsersQuery = `
      SELECT 
        user_id,
        COUNT(DISTINCT whm.id) as workout_sessions,
        COUNT(DISTINCT whm.date) as workout_days,
        SUM(whd.duration) as total_duration
      FROM workout_history_master whm
      LEFT JOIN workout_history_detail whd ON whm.id = whd.workout_history_master_id
      WHERE whm.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY user_id
      LIMIT 5
    `;
    const allUsersResult = await executeQuery(allUsersQuery, []);
    //console.log('전체 사용자 운동 기록 요약:', allUsersResult);

    const debugInfo = {
      userId,
      masterCount: masterResult[0]?.master_count || 0,
      detailCount: detailResult[0]?.detail_count || 0,
      recentWorkouts: recentResult,
      allUsersStats: allUsersResult
    };

    return ResponseUtil.success(res, debugInfo, '디버깅 정보를 조회했습니다.');
  } catch (error: any) {
    console.error('디버깅 정보 조회 실패:', error);
    return ResponseUtil.error(res, '디버깅 정보 조회에 실패했습니다.');
  }
});

export default router;
