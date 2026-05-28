import { Router } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { WorkoutCategoryService } from '../services/workoutCategory.service.js';
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { requireAdmin, type AdminRequest } from '../middleware/admin.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';
import { successResponse, errorResponse } from '../utils/response.util.js';
import { callProcedure, executeQuery, executeTransaction } from '../lib/database.js';
import { LicenseService } from '../services/license.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** DB에 저장되는 이미지 공개 URL의 origin (미설정 시 운영 도메인 고정, 개발에서도 동일) */
const resolvePublicUploadBaseUrl = (): string => {
  const raw = process.env.API_BASE_URL || process.env.PUBLIC_UPLOAD_BASE_URL;
  if (raw) return raw.replace(/\/$/, '');
  return 'https://linkhiit.co.kr';
};

const router = Router();
const workoutCategoryService = new WorkoutCategoryService();

const yearMonthSchema = z.string().regex(/^\d{4}-\d{2}$/, 'yearMonth는 YYYY-MM 형식이어야 합니다').optional();

const getWorkoutHistoryMasterQuerySchema = z.object({
  yearMonth: yearMonthSchema,
  memo: z.string().optional(),
  workoutCategory: z.string().optional(),
  workout_category: z.string().optional(),
  circuitType: z.string().optional(),
  circuit_type: z.string().optional(),
  admin: z.string().optional()
});

const masterIdParamsSchema = z.object({
  masterId: z.string().min(1)
});

const workoutSettingMethodTypeSchema = z.enum(['stress', 'loop', 'AMRAP', 'EMOM']);
const workoutSettingRowSchema = z.object({
  round: z.number().int().min(1),
  time: z.number().int().min(0),
  rest: z.number().int().min(0),
  waterBreak: z.number().int().min(0).default(0),
  reps: z.number().int().min(0).default(0),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional()
});
const workoutSettingSaveSchema = z.object({
  rows: z.array(workoutSettingRowSchema).min(1)
});
const monitorImageSaveSchema = z.object({
  leftImageUrl: z.string().optional().nullable(),
  rightImageUrl: z.string().optional().nullable()
});
const monitorImageUploadSchema = z.object({
  side: z.enum(['left', 'right']),
  imageBase64: z.string().min(1, '이미지 데이터가 필요합니다')
});
const systemImageUploadSchema = z.object({
  side: z.enum(['left', 'right']),
  imageBase64: z.string().min(1, '이미지 데이터가 필요합니다')
});
const systemImageSaveSchema = z.object({
  leftImageUrl: z.string().optional().nullable(),
  rightImageUrl: z.string().optional().nullable()
});

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date는 YYYY-MM-DD 형식이어야 합니다');

function parseLooseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'y';
  }
  return false;
}

/** CALL 결과에서 첫 번째 결과 집합을 배열로 반환 (mysql2) */
function firstProcedureResultRows(procedureResult: unknown): unknown[] {
  if (!Array.isArray(procedureResult)) return [];
  const first = procedureResult[0];
  return Array.isArray(first) ? first : [];
}

/**
 * 운동 시간 요약 계산 헬퍼 함수
 * - exercises JSON에서 DS/MAIN/CD 타입별로 duration 합산
 * - workoutExercises JSON에서 exercise/rest/water 타입별로 duration 합산
 * - 프론트엔드에서 전달된 값이 0이면 서버에서 직접 계산
 */
interface WorkoutTimeSummary {
  dsSeconds: number;
  mainSeconds: number;
  cdSeconds: number;
  totalSeconds: number;
  restSeconds: number;
}

function calculateWorkoutTimeSummaryFromJson(
  exercisesJson: string,
  workoutExercisesJson: string,
  plansJson: string,
  majorCategory?: string
): WorkoutTimeSummary {
  let dsSeconds = 0;
  let mainSeconds = 0;
  let cdSeconds = 0;
  let restSeconds = 0;

  try {
    // 1. exercises JSON에서 DS/CD 시간 계산
    const exercises = JSON.parse(exercisesJson || '[]');
    if (Array.isArray(exercises)) {
      exercises.forEach((ex: any) => {
        const type = String(ex.exercise_type || '').toUpperCase();
        const duration = Number(ex.duration) || 0;
        
        if (type === 'DYNAMIC-STRETCHING' || type === 'DYNAMIC_STRETCHING' || type === 'DS') {
          dsSeconds += duration;
        } else if (type === 'COOL-DOWN' || type === 'COOLDOWN' || type === 'CD' || type === 'STATIC-STRETCHING') {
          cdSeconds += duration;
        }
      });
    }

    // 2. workoutExercises JSON에서 Main/Rest 시간 계산
    const workoutExercises = JSON.parse(workoutExercisesJson || '[]');
    if (Array.isArray(workoutExercises) && workoutExercises.length > 0) {
      workoutExercises.forEach((item: any) => {
        const type = String(item.exercise_type || '').toLowerCase();
        const round = Number(item.round) || 0;
        const duration = Number(item.duration) || 0;
        
        // round가 0 (DS) 또는 99 (CD)인 경우 이미 위에서 계산됨
        if (round > 0 && round < 99) {
          if (type === 'exercise') {
            mainSeconds += duration;
          } else if (type === 'rest') {
            restSeconds += duration;
          } else if (type === 'water') {
            // 물보충 시간은 mainSeconds에 포함 (운동 계획의 일부)
            mainSeconds += duration;
          }
        }
      });
    } else {
      // workoutExercises가 없으면 plans에서 계산 (fallback)
      const plans = JSON.parse(plansJson || '[]');
      if (Array.isArray(plans)) {
        const isTimeStructured = majorCategory === 'AMRAP' || majorCategory === 'EMOM';
        
        // exercises에서 MAIN 운동 개수 카운트
        let mainExerciseCount = 0;
        if (Array.isArray(exercises)) {
          mainExerciseCount = exercises.filter((ex: any) => {
            const type = String(ex.exercise_type || '').toUpperCase();
            return type === 'MAIN';
          }).length;
        }
        
        plans.forEach((plan: any) => {
          const time = Number(plan.time) || 0;
          const rest = Number(plan.rest) || 0;
          const hydration = Number(plan.hydration) || 0;
          
          if (isTimeStructured) {
            // AMRAP/EMOM: time/rest가 이미 초 단위로 저장됨
            mainSeconds += time;
            restSeconds += rest;
          } else {
            // Circuit: time은 운동당 시간(초), 각 라운드에서 모든 운동 실행
            mainSeconds += time * mainExerciseCount;
            restSeconds += rest * mainExerciseCount;
            mainSeconds += hydration; // 물보충 시간 추가
          }
        });
      }
    }
  } catch (error) {
    console.error('calculateWorkoutTimeSummaryFromJson 오류:', error);
  }

  const totalSeconds = dsSeconds + mainSeconds + cdSeconds + restSeconds;

  console.log('🔧 [서버 시간 계산] 결과:', { dsSeconds, mainSeconds, cdSeconds, restSeconds, totalSeconds });

  return { dsSeconds, mainSeconds, cdSeconds, totalSeconds, restSeconds };
}

const hyberStrengthCircuitSaveBodySchema = z.object({
  date: dateSchema,
  time: z.string().min(1),
  memo: z.string().optional().nullable(),
  workoutCategory: z.string().min(1),
  method_type: z.string().optional().nullable(),
  admin: z.any().optional(),
  masterId: z.string().optional().nullable(),
  plans: z.array(
    z.object({
      round: z.number().optional(),
      time: z.number().optional(),
      rest: z.number().optional(),
      hydration: z.number().optional(),
      circuit_type: z.string().optional()
    })
  ).optional().default([]),
  exercises: z.array(
    z.object({
      originalExerciseId: z.string().min(1),
      duration: z.number().optional(),
      reps: z.number().optional(),
      round: z.number().optional(),
      position: z.string().optional().nullable(),
      exercise_type: z.string().min(1),
      sequence: z.number().optional()
    })
  ).optional().default([]),
  workoutExercises: z.array(z.any()).optional().default([]),
  dynamicMasterId: z.string().optional().nullable(),
  dynamic_master_id: z.string().optional().nullable(),
  cooldownMasterId: z.string().optional().nullable(),
  cooldown_master_id: z.string().optional().nullable(),
  staticMasterId: z.string().optional().nullable(),
  static_master_id: z.string().optional().nullable(),
  dsSeconds: z.number().optional(),
  ds_seconds: z.number().optional(),
  mainSeconds: z.number().optional(),
  main_seconds: z.number().optional(),
  cdSeconds: z.number().optional(),
  cd_seconds: z.number().optional(),
  totalSeconds: z.number().optional(),
  total_seconds: z.number().optional(),
  restSeconds: z.number().optional(),
  rest_seconds: z.number().optional()
});

const workoutHistoryDeleteParamsSchema = z.object({
  masterId: z.string().min(1)
});

/**
 * @route GET /api/workout-categories
 * @desc 운동구분 목록 조회
 * @access Private
 */
router.get('/',
  authenticateToken,
  async (req, res) => {
    try {
      //console.log('🔍 workout-categories 요청 받음');
      const query = req.query as any;
      //console.log('🔍 [API] getWorkoutCategories 파라미터:', query);
      let categories = await workoutCategoryService.getWorkoutCategories(query);
      const user = (req as AuthenticatedRequest).user;
      if (user?.role !== 'super_admin' && user?.branchId) {
        const licenses = await LicenseService.getActiveByBranch(user.branchId);
        const licensedCategoryIds = new Set(licenses.map((license: any) => String(license.workout_category_id)));
        categories = categories.filter((category: any) => licensedCategoryIds.has(String(category.id)));
      }
      console.log('🔍 [API] workout-categories 응답:', JSON.stringify(categories, null, 2));
      res.json(successResponse(categories, '운동구분 목록을 성공적으로 조회했습니다'));
    } catch (error) {
      console.error('운동구분 목록 조회 오류:', error);
      res.status(500).json({ success: false, error: '운동구분 목록 조회에 실패했습니다' });
    }
  }
);

/**
 * @route GET /api/workout-categories/stats
 * @desc 운동구분별 운동 개수 조회 (운동구분 대분류 목록)
 * @access Public
 */
router.get('/stats',
  async (req, res) => {
    try {
      const gubun = req.query.gubun as string || null;
      const results = await callProcedure('sp_GetWorkoutMajorCategories', []);
      let categories = results[0] || [];
      if (gubun) {
        categories = categories.filter((cat: any) => cat.gubun === gubun);
      }
      res.json(successResponse(categories, '운동구분별 통계를 성공적으로 조회했습니다'));
    } catch (error) {
      console.error('운동구분별 통계 조회 오류:', error);
      res.status(500).json(errorResponse('운동구분별 통계 조회에 실패했습니다'));
    }
  }
);

/**
 * @route GET /api/workout-categories/:majorCategory/minor
 * @desc 대분류별 중분류 목록 조회
 * @access Private
 */
router.get('/:majorCategory/minor',
  authenticateToken,
  async (req, res) => {
    try {
      const majorCategory = req.params.majorCategory;
      const minorCategories = await workoutCategoryService.getMinorCategoriesByMajor(majorCategory);
      res.json(successResponse(minorCategories, '대분류별 중분류 목록을 성공적으로 조회했습니다'));
    } catch (error) {
      console.error('대분류별 중분류 목록 조회 오류:', error);
      res.status(500).json(errorResponse('대분류별 중분류 목록 조회에 실패했습니다'));
    }
  }
);

/**
 * @route POST /api/workout-categories/initialize
 * @desc 기본 운동구분 데이터 초기화
 * @access Private (Admin)
 */
router.post('/initialize',
  authenticateToken,
  async (req, res) => {
    try {
      await workoutCategoryService.initializeDefaultWorkoutCategories();
      res.json(successResponse({}, '기본 운동구분 데이터가 성공적으로 초기화되었습니다'));
    } catch (error) {
      console.error('기본 운동구분 데이터 초기화 오류:', error);
      res.status(500).json(errorResponse('기본 운동구분 데이터 초기화에 실패했습니다'));
    }
  }
);

// === 운동정보 관련 라우트 ===

/**
 * @route GET /api/workout-categories/exercises/list
 * @desc 운동정보 목록 조회 (운동구분 포함)
 * @access Private
 */
router.get('/exercises/list',
  async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const majorCategory = req.query.major_category as string;
      const searchType = req.query.search_type as string;
      const searchKeyword = req.query.search_keyword as string;
      const includeInactiveRaw = req.query.include_inactive as string | undefined;
      const includeInactive = includeInactiveRaw === 'true' || includeInactiveRaw === '1';

      const results = await callProcedure('sp_GetExercises', [
        majorCategory || null,
        searchType || null,
        searchKeyword || null,
        page,
        limit,
        includeInactive
      ]);

      const totalResult = results[0] || [];
      const dataResult = results[1] || [];
      const total = totalResult[0]?.total || 0;
      const exercises = dataResult || [];

      const responseData = {
        exercises,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };

      res.json(successResponse(responseData, '운동정보 목록을 성공적으로 조회했습니다'));
    } catch (error) {
      console.error('운동정보 목록 조회 오류:', error);
      res.status(500).json(errorResponse('운동정보 목록 조회에 실패했습니다'));
    }
  }
);

/**
 * @route POST /api/workout-categories/exercises
 * @desc 운동정보 생성 (운동구분 포함)
 * @access Private (Admin)
 */
router.post('/exercises',
  authenticateToken,
  async (req, res) => {
    try {
      const data = req.body;
      const result = await workoutCategoryService.createExercise(data);
      res.status(201).json(successResponse(result, '운동정보가 성공적으로 생성되었습니다'));
    } catch (error) {
      console.error('운동정보 생성 오류:', error);
      res.status(500).json(errorResponse('운동정보 생성에 실패했습니다'));
    }
  }
);

/**
 * @route GET /api/workout-categories/exercises/:id
 * @desc 운동정보 상세 조회
 * @access Private
 */
router.get('/exercises/:id',
  authenticateToken,
  async (req, res) => {
    try {
      const exerciseId = req.params.id;
      const exercise = await workoutCategoryService.getExerciseById(exerciseId);
      if (!exercise) {
        return res.status(404).json(errorResponse('운동정보를 찾을 수 없습니다'));
      }
      res.json(successResponse(exercise, '운동정보를 성공적으로 조회했습니다'));
    } catch (error) {
      console.error('운동정보 상세 조회 오류:', error);
      res.status(500).json(errorResponse('운동정보 상세 조회에 실패했습니다'));
    }
  }
);

/**
 * @route PUT /api/workout-categories/exercises/:id
 * @desc 운동정보 수정
 * @access Private (Admin)
 */
router.put('/exercises/:id',
  authenticateToken,
  async (req, res) => {
    try {
      const exerciseId = req.params.id;
      const data = req.body;
      const result = await workoutCategoryService.updateExercise(exerciseId, data);
      res.json(successResponse(result, '운동정보가 성공적으로 수정되었습니다'));
    } catch (error) {
      console.error('운동정보 수정 오류:', error);
      res.status(500).json(errorResponse('운동정보 수정에 실패했습니다'));
    }
  }
);

/**
 * @route DELETE /api/workout-categories/exercises/:id
 * @desc 운동정보 삭제 (비활성화)
 * @access Private (Admin)
 */
router.delete('/exercises/:id',
  authenticateToken,
  async (req, res) => {
    try {
      const exerciseId = req.params.id;
      const result = await workoutCategoryService.deleteExercise(exerciseId);
      res.json(successResponse(result, '운동정보가 성공적으로 삭제되었습니다'));
    } catch (error) {
      console.error('운동정보 삭제 오류:', error);
      res.status(500).json(errorResponse(error.message || '운동 시간 요약 조회에 실패했습니다'));
    }
  }
);

// 운동 기록 복사
router.post('/copy-workout',
  authenticateToken,
  async (req, res) => {
    try {
      const { originalMasterId, newDate, newTime, userId, exerciseSequences } = req.body;
      const currentUser = (req as any).user;
      const isAdmin = currentUser?.role === 'branch_admin' || currentUser?.role === 'super_admin';

      if (!originalMasterId || !newDate || !newTime || !userId || !exerciseSequences) return res.status(400).json({ success: false, error: '필수 파라미터가 누락되었습니다' });

      const result = await callProcedure('sp_CopyWorkout', [originalMasterId, newDate, newTime, userId, JSON.stringify(exerciseSequences), isAdmin]);
      res.json({ success: true, message: '운동이 성공적으로 복사되었습니다', result });
    } catch (error: any) {
      console.error('운동복사 오류:', error);
      res.status(500).json({ success: false, error: '운동 복사에 실패했습니다' });
    }
  }
);

/**
 * @route POST /api/workout-categories/HyberStrengthCircuitSave
 * @desc 하이브리드/서킷/스트레칭 공용 저장 (날짜/운동선택 변경 여부에 따라 update vs insert)
 * @access Private
 */
router.post(
  '/HyberStrengthCircuitSave',
  authenticateToken,
  validateRequest({ body: hyberStrengthCircuitSaveBodySchema }),
  async (req, res) => {
    try {
      const authedReq = req as AuthenticatedRequest;
      const userId = authedReq.user?.id;
      if (!userId) return res.status(401).json(errorResponse('인증 정보가 없습니다', 'UNAUTHORIZED'));

      const body = req.body as z.infer<typeof hyberStrengthCircuitSaveBodySchema>;
      const incomingMasterId = body.masterId?.trim() || null;

      // 저장 규칙:
      // 1) 기존데이터는 운동일자(date)와 운동선택(workoutCategory)이 변경되지 않으면 update
      // 2) 변경된다면 insert
      let effectiveMasterId: string | null = incomingMasterId;
      if (incomingMasterId) {
        const rows = await executeQuery(
          `SELECT 
             DATE_FORMAT(date, '%Y-%m-%d') AS date, 
             workout_categories_id AS workoutCategory,
             COALESCE(
               (SELECT circuit_type FROM workout_history_plan WHERE workout_history_master_id = workout_history_master.id ORDER BY round LIMIT 1),
               method_type,
               method_name
             ) AS circuitType
           FROM workout_history_master
           WHERE id = ?
           LIMIT 1`,
          [incomingMasterId]
        );

        const current = Array.isArray(rows) ? rows[0] : null;
        if (!current) {
          effectiveMasterId = null;
        } else {
          const isSameDate = String(current.date) === body.date;
          const isSameCategory = String(current.workoutCategory) === body.workoutCategory;
          const incomingCircuitType =
            (typeof body.method_type === 'string' && body.method_type.trim().length > 0)
              ? body.method_type
              : (body.plans?.[0] as any)?.circuit_type;
          const isSameCircuitType =
            incomingCircuitType == null
              ? true
              : String(current.circuitType ?? '').toLowerCase() === String(incomingCircuitType).toLowerCase();

          // date/workoutCategory/circuitType 중 하나라도 변경되면 insert
          if (!isSameDate || !isSameCategory || !isSameCircuitType) effectiveMasterId = null;
        }
      }

      const admin = parseLooseBoolean(body.admin);
      const plansJson = JSON.stringify(body.plans || []);
      const exercisesJson = JSON.stringify(body.exercises || []);
      const workoutExercisesJson = JSON.stringify(body.workoutExercises || []);

      const dynamicMasterId =
        body.dynamicMasterId || body.dynamic_master_id || null;
      const staticMasterId =
        body.staticMasterId ||
        body.static_master_id ||
        body.cooldownMasterId ||
        body.cooldown_master_id ||
        null;

      // 운동시간 요약 파라미터 추출 (프론트엔드 값이 0이면 서버에서 직접 계산)
      let dsSeconds = body.dsSeconds || body.ds_seconds || 0;
      let mainSeconds = body.mainSeconds || body.main_seconds || 0;
      let cdSeconds = body.cdSeconds || body.cd_seconds || 0;
      let totalSeconds = body.totalSeconds || body.total_seconds || 0;
      let restSeconds = body.restSeconds || body.rest_seconds || 0;

      // 프론트엔드에서 시간 값이 모두 0이면 서버에서 직접 계산
      if (dsSeconds === 0 && mainSeconds === 0 && cdSeconds === 0 && totalSeconds === 0) {
        console.log('🔧 [HyberStrengthCircuitSave] 프론트엔드 시간값이 0 - 서버에서 직접 계산');
        const calculated = calculateWorkoutTimeSummaryFromJson(
          exercisesJson,
          workoutExercisesJson,
          plansJson,
          body.workoutCategory
        );
        dsSeconds = calculated.dsSeconds;
        mainSeconds = calculated.mainSeconds;
        cdSeconds = calculated.cdSeconds;
        totalSeconds = calculated.totalSeconds;
        restSeconds = calculated.restSeconds;
      }

      // 디버깅: 최종 시간 요약 파라미터 로깅
      console.log('🔍 [HyberStrengthCircuitSave] 최종 시간 요약 파라미터:', {
        dsSeconds,
        mainSeconds,
        cdSeconds,
        totalSeconds,
        restSeconds,
        masterId: effectiveMasterId
      });

      // DB에 어떤 버전의 sp_SaveWorkout가 올라가 있는지 환경별로 다를 수 있어,
      // (18파라미터 버전 -> 17파라미터 버전 -> 13파라미터 버전 -> 10파라미터 버전) 순서로 시도한다.
      let results: any;
      try {
        console.log('🔍 [HyberStrengthCircuitSave] 18파라미터 버전 시도');
        results = await callProcedure('sp_SaveWorkout', [
          userId,
          body.date,
          body.time,
          body.memo || '',
          body.workoutCategory,
          body.method_type || null,
          plansJson,
          exercisesJson,
          workoutExercisesJson,
          effectiveMasterId,
          dynamicMasterId,
          staticMasterId,
          admin,
          dsSeconds,
          mainSeconds,
          cdSeconds,
          totalSeconds,
          restSeconds
        ]);
        console.log('✅ [HyberStrengthCircuitSave] 18파라미터 버전 성공');
      } catch (error: any) {
        const msg = String(error?.message || '');
        console.log('⚠️ [HyberStrengthCircuitSave] 18파라미터 버전 실패:', msg);
        // 파라미터 개수/시그니처 불일치 가능성만 fallback 처리
        if (!msg.includes('Incorrect number of arguments') && !msg.includes('ER_WRONG_PARAMCOUNT')) throw error;

        try {
          console.log('🔍 [HyberStrengthCircuitSave] 17파라미터 버전 시도');
          // 17파라미터 버전 (restSeconds 제외)
          results = await callProcedure('sp_SaveWorkout', [
            userId,
            body.date,
            body.time,
            body.memo || '',
            body.workoutCategory,
            body.method_type || null,
            plansJson,
            exercisesJson,
            workoutExercisesJson,
            effectiveMasterId,
            dynamicMasterId,
            staticMasterId,
            admin,
            dsSeconds,
            mainSeconds,
            cdSeconds,
            totalSeconds
          ]);
        } catch (fallbackError: any) {
          const fallbackMsg = String(fallbackError?.message || '');
          if (!fallbackMsg.includes('Incorrect number of arguments') && !fallbackMsg.includes('ER_WRONG_PARAMCOUNT')) throw fallbackError;

          // 10파라미터 버전 (시간 관련 파라미터 없음 - 이 버전은 시간 저장 불가)
          results = await callProcedure('sp_SaveWorkout', [
            userId,
            body.date,
            body.time,
            body.memo || '',
            body.workoutCategory,
            plansJson,
            exercisesJson,
            workoutExercisesJson,
            effectiveMasterId,
            admin
          ]);
          console.log('✅ [HyberStrengthCircuitSave] 10파라미터 버전 성공 (시간 저장 불가)');
        }
      }

      // 결과에서 master id 추출
      const firstRows = Array.isArray(results) && Array.isArray(results[0]) ? results[0] : Array.isArray(results) ? results : [];
      const firstRow = Array.isArray(firstRows) ? firstRows[0] : null;
      const savedId = firstRow?.id || firstRow?.master_id || effectiveMasterId;

      res.json(successResponse({ id: savedId }, '저장되었습니다.'));
    } catch (error) {
      console.error('HyberStrengthCircuitSave 오류:', error);
      res.status(500).json(errorResponse('저장에 실패했습니다'));
    }
  }
);

/**
 * @route POST /api/workout-categories/Time-StructuredAMRAP
 * @desc AMRAP 저장 (HyberStrengthCircuitSave와 동일 규칙: date+workoutCategory 동일이면 update, 변경이면 insert)
 * @access Private
 */
router.post(
  '/Time-StructuredAMRAP',
  authenticateToken,
  validateRequest({ body: hyberStrengthCircuitSaveBodySchema }),
  async (req, res) => {
    try {
      const authedReq = req as AuthenticatedRequest;
      const userId = authedReq.user?.id;
      if (!userId) return res.status(401).json(errorResponse('인증 정보가 없습니다', 'UNAUTHORIZED'));

      const body = req.body as z.infer<typeof hyberStrengthCircuitSaveBodySchema>;
      body.method_type = body.method_type || 'AMRAP';
      body.plans = (body.plans || []).map((p: any) => {
        const raw = String(p?.circuit_type ?? '').toLowerCase();
        const circuit_type =
          raw && raw !== 'none' ? raw : 'amrap';
        return { ...p, circuit_type, hydration: p?.hydration ?? 0 };
      });
      body.exercises = (body.exercises || []).map((ex: any) => ({ ...ex, duration: ex?.duration ?? 0 }));
      const incomingMasterId = body.masterId?.trim() || null;

      let effectiveMasterId: string | null = incomingMasterId;
      if (incomingMasterId) {
        const rows = await executeQuery(
          `SELECT 
             DATE_FORMAT(date, '%Y-%m-%d') AS date, 
             workout_categories_id AS workoutCategory,
             COALESCE(
               NULLIF((SELECT circuit_type FROM workout_history_plan WHERE workout_history_master_id = workout_history_master.id ORDER BY round LIMIT 1), 'none'),
               method_type,
               method_name
             ) AS circuitType
           FROM workout_history_master
           WHERE id = ?
           LIMIT 1`,
          [incomingMasterId]
        );

        const current = Array.isArray(rows) ? rows[0] : null;
        if (!current) {
          effectiveMasterId = null;
        } else {
          const isSameDate = String(current.date) === body.date;
          const isSameCategory = String(current.workoutCategory) === body.workoutCategory;
          const incomingCircuitType =
            (typeof body.method_type === 'string' && body.method_type.trim().length > 0)
              ? body.method_type
              : (body.plans?.[0] as any)?.circuit_type;
          const isSameCircuitType =
            incomingCircuitType == null
              ? true
              : String(current.circuitType ?? '').toLowerCase() === String(incomingCircuitType).toLowerCase();
          if (!isSameDate || !isSameCategory || !isSameCircuitType) effectiveMasterId = null;
        }
      }

      const admin = parseLooseBoolean(body.admin);
      const plansJson = JSON.stringify(body.plans || []);
      const exercisesJson = JSON.stringify(body.exercises || []);
      const workoutExercisesJson = JSON.stringify(body.workoutExercises || []);

      const dynamicMasterId = body.dynamicMasterId || body.dynamic_master_id || null;
      const staticMasterId =
        body.staticMasterId ||
        body.static_master_id ||
        body.cooldownMasterId ||
        body.cooldown_master_id ||
        null;

      // 운동시간 요약 파라미터 추출 (프론트엔드 값이 0이면 서버에서 직접 계산)
      let dsSecondsAMRAP = body.dsSeconds || body.ds_seconds || 0;
      let mainSecondsAMRAP = body.mainSeconds || body.main_seconds || 0;
      let cdSecondsAMRAP = body.cdSeconds || body.cd_seconds || 0;
      let totalSecondsAMRAP = body.totalSeconds || body.total_seconds || 0;
      let restSecondsAMRAP = body.restSeconds || body.rest_seconds || 0;

      // 프론트엔드에서 시간 값이 모두 0이면 서버에서 직접 계산
      if (dsSecondsAMRAP === 0 && mainSecondsAMRAP === 0 && cdSecondsAMRAP === 0 && totalSecondsAMRAP === 0) {
        console.log('🔧 [Time-StructuredAMRAP] 프론트엔드 시간값이 0 - 서버에서 직접 계산');
        const calculated = calculateWorkoutTimeSummaryFromJson(
          exercisesJson,
          workoutExercisesJson,
          plansJson,
          'AMRAP'
        );
        dsSecondsAMRAP = calculated.dsSeconds;
        mainSecondsAMRAP = calculated.mainSeconds;
        cdSecondsAMRAP = calculated.cdSeconds;
        totalSecondsAMRAP = calculated.totalSeconds;
        restSecondsAMRAP = calculated.restSeconds;
      }

      console.log('🔍 [Time-StructuredAMRAP] 최종 시간 요약 파라미터:', {
        dsSeconds: dsSecondsAMRAP, mainSeconds: mainSecondsAMRAP, cdSeconds: cdSecondsAMRAP, 
        totalSeconds: totalSecondsAMRAP, restSeconds: restSecondsAMRAP
      });

      let results: any;
      try {
        results = await callProcedure('sp_SaveWorkout', [
          userId,
          body.date,
          body.time,
          body.memo || '',
          body.workoutCategory,
          body.method_type || null,
          plansJson,
          exercisesJson,
          workoutExercisesJson,
          effectiveMasterId,
          dynamicMasterId,
          staticMasterId,
          admin,
          dsSecondsAMRAP,
          mainSecondsAMRAP,
          cdSecondsAMRAP,
          totalSecondsAMRAP,
          restSecondsAMRAP
        ]);
      } catch (error: any) {
        const msg = String(error?.message || '');
        if (!msg.includes('Incorrect number of arguments') && !msg.includes('ER_WRONG_PARAMCOUNT')) throw error;

        try {
          // 17파라미터 버전 (restSeconds 제외)
          results = await callProcedure('sp_SaveWorkout', [
            userId,
            body.date,
            body.time,
            body.memo || '',
            body.workoutCategory,
            body.method_type || null,
            plansJson,
            exercisesJson,
            workoutExercisesJson,
            effectiveMasterId,
            dynamicMasterId,
            staticMasterId,
            admin,
            dsSecondsAMRAP,
            mainSecondsAMRAP,
            cdSecondsAMRAP,
            totalSecondsAMRAP
          ]);
        } catch (fallbackError: any) {
          const fallbackMsg = String(fallbackError?.message || '');
          if (!fallbackMsg.includes('Incorrect number of arguments') && !fallbackMsg.includes('ER_WRONG_PARAMCOUNT')) throw fallbackError;

          // 10파라미터 버전 (시간 관련 파라미터 없음 - 이 버전은 시간 저장 불가)
          results = await callProcedure('sp_SaveWorkout', [
            userId,
            body.date,
            body.time,
            body.memo || '',
            body.workoutCategory,
            plansJson,
            exercisesJson,
            workoutExercisesJson,
            effectiveMasterId,
            admin
          ]);
          console.log('⚠️ [Time-StructuredAMRAP] 10파라미터 버전 사용 - 시간 저장 불가');
        }
      }

      const firstRows = Array.isArray(results) && Array.isArray(results[0]) ? results[0] : Array.isArray(results) ? results : [];
      const firstRow = Array.isArray(firstRows) ? firstRows[0] : null;
      const savedId = firstRow?.id || firstRow?.master_id || effectiveMasterId;

      res.json(successResponse({ id: savedId }, '저장되었습니다.'));
    } catch (error) {
      console.error('Time-StructuredAMRAP 오류:', error);
      res.status(500).json(errorResponse('저장에 실패했습니다'));
    }
  }
);

/**
 * @route POST /api/workout-categories/Time-StructuredEMOM
 * @desc EMOM 저장 (HyberStrengthCircuitSave와 동일 규칙: date+workoutCategory 동일이면 update, 변경이면 insert)
 * @access Private
 */
router.post(
  '/Time-StructuredEMOM',
  authenticateToken,
  validateRequest({ body: hyberStrengthCircuitSaveBodySchema }),
  async (req, res) => {
    try {
      const authedReq = req as AuthenticatedRequest;
      const userId = authedReq.user?.id;
      if (!userId) return res.status(401).json(errorResponse('인증 정보가 없습니다', 'UNAUTHORIZED'));

      const body = req.body as z.infer<typeof hyberStrengthCircuitSaveBodySchema>;
      body.method_type = body.method_type || 'EMOM';
      body.plans = (body.plans || []).map((p: any) => {
        const raw = String(p?.circuit_type ?? '').toLowerCase();
        const circuit_type =
          raw && raw !== 'none' ? raw : 'emom';
        return { ...p, circuit_type, hydration: p?.hydration ?? 0 };
      });
      body.exercises = (body.exercises || []).map((ex: any) => ({ ...ex, duration: ex?.duration ?? 0 }));
      const incomingMasterId = body.masterId?.trim() || null;

      let effectiveMasterId: string | null = incomingMasterId;
      if (incomingMasterId) {
        const rows = await executeQuery(
          `SELECT 
             DATE_FORMAT(date, '%Y-%m-%d') AS date, 
             workout_categories_id AS workoutCategory,
             COALESCE(
               NULLIF((SELECT circuit_type FROM workout_history_plan WHERE workout_history_master_id = workout_history_master.id ORDER BY round LIMIT 1), 'none'),
               method_type,
               method_name
             ) AS circuitType
           FROM workout_history_master
           WHERE id = ?
           LIMIT 1`,
          [incomingMasterId]
        );

        const current = Array.isArray(rows) ? rows[0] : null;
        if (!current) {
          effectiveMasterId = null;
        } else {
          const isSameDate = String(current.date) === body.date;
          const isSameCategory = String(current.workoutCategory) === body.workoutCategory;
          const incomingCircuitType =
            (typeof body.method_type === 'string' && body.method_type.trim().length > 0)
              ? body.method_type
              : (body.plans?.[0] as any)?.circuit_type;
          const isSameCircuitType =
            incomingCircuitType == null
              ? true
              : String(current.circuitType ?? '').toLowerCase() === String(incomingCircuitType).toLowerCase();
          if (!isSameDate || !isSameCategory || !isSameCircuitType) effectiveMasterId = null;
        }
      }

      const admin = parseLooseBoolean(body.admin);
      const plansJson = JSON.stringify(body.plans || []);
      const exercisesJson = JSON.stringify(body.exercises || []);
      const workoutExercisesJson = JSON.stringify(body.workoutExercises || []);

      const dynamicMasterId = body.dynamicMasterId || body.dynamic_master_id || null;
      const staticMasterId =
        body.staticMasterId ||
        body.static_master_id ||
        body.cooldownMasterId ||
        body.cooldown_master_id ||
        null;

      // 운동시간 요약 파라미터 추출 (프론트엔드 값이 0이면 서버에서 직접 계산)
      let dsSecondsEMOM = body.dsSeconds || body.ds_seconds || 0;
      let mainSecondsEMOM = body.mainSeconds || body.main_seconds || 0;
      let cdSecondsEMOM = body.cdSeconds || body.cd_seconds || 0;
      let totalSecondsEMOM = body.totalSeconds || body.total_seconds || 0;
      let restSecondsEMOM = body.restSeconds || body.rest_seconds || 0;

      // 프론트엔드에서 시간 값이 모두 0이면 서버에서 직접 계산
      if (dsSecondsEMOM === 0 && mainSecondsEMOM === 0 && cdSecondsEMOM === 0 && totalSecondsEMOM === 0) {
        console.log('🔧 [Time-StructuredEMOM] 프론트엔드 시간값이 0 - 서버에서 직접 계산');
        const calculated = calculateWorkoutTimeSummaryFromJson(
          exercisesJson,
          workoutExercisesJson,
          plansJson,
          'EMOM'
        );
        dsSecondsEMOM = calculated.dsSeconds;
        mainSecondsEMOM = calculated.mainSeconds;
        cdSecondsEMOM = calculated.cdSeconds;
        totalSecondsEMOM = calculated.totalSeconds;
        restSecondsEMOM = calculated.restSeconds;
      }

      console.log('🔍 [Time-StructuredEMOM] 최종 시간 요약 파라미터:', {
        dsSeconds: dsSecondsEMOM, mainSeconds: mainSecondsEMOM, cdSeconds: cdSecondsEMOM, 
        totalSeconds: totalSecondsEMOM, restSeconds: restSecondsEMOM
      });

      let results: any;
      try {
        results = await callProcedure('sp_SaveWorkout', [
          userId,
          body.date,
          body.time,
          body.memo || '',
          body.workoutCategory,
          body.method_type || null,
          plansJson,
          exercisesJson,
          workoutExercisesJson,
          effectiveMasterId,
          dynamicMasterId,
          staticMasterId,
          admin,
          dsSecondsEMOM,
          mainSecondsEMOM,
          cdSecondsEMOM,
          totalSecondsEMOM,
          restSecondsEMOM
        ]);
      } catch (error: any) {
        const msg = String(error?.message || '');
        if (!msg.includes('Incorrect number of arguments') && !msg.includes('ER_WRONG_PARAMCOUNT')) throw error;

        try {
          // 17파라미터 버전 (restSeconds 제외)
          results = await callProcedure('sp_SaveWorkout', [
            userId,
            body.date,
            body.time,
            body.memo || '',
            body.workoutCategory,
            body.method_type || null,
            plansJson,
            exercisesJson,
            workoutExercisesJson,
            effectiveMasterId,
            dynamicMasterId,
            staticMasterId,
            admin,
            dsSecondsEMOM,
            mainSecondsEMOM,
            cdSecondsEMOM,
            totalSecondsEMOM
          ]);
        } catch (fallbackError: any) {
          const fallbackMsg = String(fallbackError?.message || '');
          if (!fallbackMsg.includes('Incorrect number of arguments') && !fallbackMsg.includes('ER_WRONG_PARAMCOUNT')) throw fallbackError;

          // 10파라미터 버전 (시간 관련 파라미터 없음 - 이 버전은 시간 저장 불가)
          results = await callProcedure('sp_SaveWorkout', [
            userId,
            body.date,
            body.time,
            body.memo || '',
            body.workoutCategory,
            plansJson,
            exercisesJson,
            workoutExercisesJson,
            effectiveMasterId,
            admin
          ]);
          console.log('⚠️ [Time-StructuredEMOM] 10파라미터 버전 사용 - 시간 저장 불가');
        }
      }

      const firstRows = Array.isArray(results) && Array.isArray(results[0]) ? results[0] : Array.isArray(results) ? results : [];
      const firstRow = Array.isArray(firstRows) ? firstRows[0] : null;
      const savedId = firstRow?.id || firstRow?.master_id || effectiveMasterId;

      res.json(successResponse({ id: savedId }, '저장되었습니다.'));
    } catch (error) {
      console.error('Time-StructuredEMOM 오류:', error);
      res.status(500).json(errorResponse('저장에 실패했습니다'));
    }
  }
);

/**
 * @route DELETE /api/workout-categories/workout-history/:masterId
 * @desc 운동 기록 삭제 (마스터 + 하위 테이블)
 * @access Private
 */
router.delete(
  '/workout-history/:masterId',
  authenticateToken,
  validateRequest({ params: workoutHistoryDeleteParamsSchema }),
  async (req, res) => {
    try {
      const authedReq = req as AuthenticatedRequest;
      const userId = authedReq.user?.id;
      if (!userId) return res.status(401).json(errorResponse('인증 정보가 없습니다', 'UNAUTHORIZED'));

      const { masterId } = req.params as z.infer<typeof workoutHistoryDeleteParamsSchema>;

      // 프로시저가 있으면 사용, 없으면 직접 삭제(자식 -> 부모 순서)
      try {
        const results = await callProcedure('sp_Deleteworkout_exercises', [masterId, userId]);
        const rows = Array.isArray(results) && Array.isArray(results[0]) ? results[0] : results;
        return res.json(successResponse(rows?.[0] || {}, '삭제되었습니다.'));
      } catch (error: any) {
        const msg = String(error?.message || '');
        if (!msg.includes('does not exist') && !msg.includes('PROCEDURE') && !msg.includes('ER_SP_DOES_NOT_EXIST')) throw error;
      }

      await executeQuery('DELETE FROM workout_exercises WHERE workout_history_master_id = ?', [masterId]);
      await executeQuery('DELETE FROM workout_history_detail WHERE workout_history_master_id = ?', [masterId]);
      await executeQuery('DELETE FROM workout_history_plan WHERE workout_history_master_id = ?', [masterId]);
      const result = await executeQuery('DELETE FROM workout_history_master WHERE id = ? AND user_id = ?', [masterId, userId]);

      res.json(successResponse({ affectedRows: result?.affectedRows ?? 0 }, '삭제되었습니다.'));
    } catch (error) {
      console.error('운동 기록 삭제 오류:', error);
      res.status(500).json(errorResponse('삭제에 실패했습니다'));
    }
  }
);

/**
 * @route GET /api/workout-categories/workout-history-master
 * @desc 운동 기록 마스터 조회
 * @access Private
 */
router.get(
  '/workout-history-master',
  authenticateToken,
  validateRequest({ query: getWorkoutHistoryMasterQuerySchema }),
  async (req, res) => {
    try {
      const authedReq = req as AuthenticatedRequest;
      const userId = authedReq.user?.id;
      if (!userId) return res.status(401).json(errorResponse('인증 정보가 없습니다', 'UNAUTHORIZED'));

      const query = req.query as z.infer<typeof getWorkoutHistoryMasterQuerySchema>;
      const workoutCategory = query.workoutCategory || query.workout_category || null;
      const circuitType = query.circuitType || query.circuit_type || null;

      const admin = query.admin === '1' ? '1' : '0';

      //console.log('🔍 [API] 운동 기록 마스터 조회 - Query:', query);
      //console.log('🔍 [API] 운동 기록 마스터 조회 - Authenticated UserId:', userId);
      //console.log('🔍 [API] 운동 기록 마스터 조회 - Final Admin Param:', admin);

      const results = await callProcedure('sp_GetWorkoutHistoryMaster', [
        userId,
        query.yearMonth || null,
        query.memo || null,
        workoutCategory,
        circuitType,
        admin
      ]);

      const rows = Array.isArray(results) && Array.isArray(results[0]) ? results[0] : results;

      // 프로시저/DB 반영 상태에 따라 is_admin 컬럼이 없을 수 있어 API에서 보강
      const hasIsAdminField = Array.isArray(rows) && rows.length > 0 && Object.prototype.hasOwnProperty.call(rows[0], 'is_admin');
      if (Array.isArray(rows) && rows.length > 0 && !hasIsAdminField) {
        const ids = rows.map((r: any) => r?.id).filter(Boolean) as string[];
        if (ids.length > 0) {
          const placeholders = ids.map(() => '?').join(', ');
          const adminRows = await executeQuery(
            `SELECT id, admin as is_admin FROM workout_history_master WHERE id IN (${placeholders})`,
            ids
          );
          const adminMap = new Map<string, any>();
          (adminRows || []).forEach((r: any) => adminMap.set(r.id, r.is_admin));

          rows.forEach((r: any) => {
            if (r && r.is_admin === undefined) r.is_admin = adminMap.get(r.id) ?? r.admin ?? 0;
          });
        }
      }
      res.json(successResponse(rows, '운동 기록을 성공적으로 조회했습니다'));
    } catch (error) {
      console.error('운동 기록 조회 오류:', error);
      res.status(500).json(errorResponse('운동 기록 조회에 실패했습니다'));
    }
  }
);

/**
 * @route GET /api/workout-categories/workout-history-detail/:masterId
 * @desc 운동 기록 상세 조회
 * @access Private
 */
router.get(
  '/workout-history-detail/:masterId',
  authenticateToken,
  validateRequest({ params: masterIdParamsSchema }),
  async (req, res) => {
    try {
      const { masterId } = req.params as z.infer<typeof masterIdParamsSchema>;
      console.log('[workout-history-detail] 더블클릭 - 호출 프로시저: sp_GetWorkoutHistoryDetail | masterId:', masterId);

      const results = await callProcedure('sp_GetWorkoutHistoryDetail', [masterId]);

      const masterRows = Array.isArray(results) && Array.isArray(results[0]) ? results[0] : [];
      const detailRows = Array.isArray(results) && Array.isArray(results[1]) ? results[1] : [];
      const planRows = Array.isArray(results) && Array.isArray(results[2]) ? results[2] : [];

      console.log('[workout-history-detail] 프로시저 반환값:', {
        procedure: 'sp_GetWorkoutHistoryDetail',
        master: masterRows[0] ?? null,
        detailsCount: detailRows.length,
        plansCount: planRows.length,
        details: detailRows,
        plans: planRows
      });

      // 프로시저가 is_admin을 내려주지 않는 환경 대비: master row에 is_admin 보강
      const master = masterRows[0] || null;
      if (master && master.is_admin === undefined) {
        const [row] = await executeQuery(
          `SELECT admin as is_admin FROM workout_history_master WHERE id = ? LIMIT 1`,
          [masterId]
        );
        master.is_admin = row?.is_admin ?? master.admin ?? 0;
      }

      res.json(
        successResponse(
          { master, details: detailRows, plans: planRows },
          '운동 기록 상세를 성공적으로 조회했습니다'
        )
      );
    } catch (error) {
      console.error('운동 기록 상세 조회 오류:', error);
      res.status(500).json(errorResponse('운동 기록 상세 조회에 실패했습니다'));
    }
  }
);

/**
 * @route GET /api/workout-categories/workout-exercises/:masterId
 * @desc 운동 실행 순서 조회 (workout_exercises)
 * @access Private
 */
router.get(
  '/workout-exercises/:masterId',
  authenticateToken,
  validateRequest({ params: masterIdParamsSchema }),
  async (req, res) => {
    try {
      const { masterId } = req.params as z.infer<typeof masterIdParamsSchema>;
      const results = await callProcedure('sp_GetWorkoutExercises', [masterId]);
      const rows = Array.isArray(results) && Array.isArray(results[0]) ? results[0] : results;

      res.json(successResponse(rows, '운동 실행 순서를 성공적으로 조회했습니다'));
    } catch (error) {
      console.error('운동 실행 순서 조회 오류:', error);
      res.status(500).json(errorResponse('운동 실행 순서 조회에 실패했습니다'));
    }
  }
);

/**
 * @route GET /api/workout-categories/workout-exercises-summary/:masterId
 * @desc 운동 기록(마스터) 기준 운동 시간 요약(DS/MAIN/CD)
 * @access Private
 */
router.get(
  '/workout-exercises-summary/:masterId',
  authenticateToken,
  validateRequest({ params: masterIdParamsSchema }),
  async (req, res) => {
    try {
      const { masterId } = req.params as z.infer<typeof masterIdParamsSchema>;

      // 먼저 workout_history_master 테이블에서 저장된 운동시간 요약 조회 시도
      const masterQuery = `
        SELECT ds_seconds, main_seconds, cd_seconds, total_seconds
        FROM workout_history_master
        WHERE id = ?
        LIMIT 1
      `;
      const [masterRow] = await executeQuery(masterQuery, [masterId]);

      // 저장된 값이 있고 모두 0이 아니면 저장된 값 사용, 아니면 기존 계산 방식 사용
      if (masterRow && (masterRow.ds_seconds || masterRow.main_seconds || masterRow.cd_seconds || masterRow.total_seconds)) {
        res.json(
          successResponse(
            {
              dsSeconds: Number(masterRow.ds_seconds || 0),
              mainSeconds: Number(masterRow.main_seconds || 0),
              cdSeconds: Number(masterRow.cd_seconds || 0),
              totalSeconds: Number(masterRow.total_seconds || 0)
            },
            '운동 시간 요약을 성공적으로 조회했습니다'
          )
        );
        return;
      }

      // 저장된 값이 없으면 기존 계산 방식 사용 (하위 호환성)
      const query = `
        SELECT
          SUM(CASE WHEN e.number IS NULL OR e.number IN (999997, 999998, 999999) THEN 0
                   WHEN UPPER(COALESCE(wc.major_category, '')) IN ('DS', 'DYNAMIC_STRETCHING', 'DYNAMIC_STRETCH') THEN whd.duration
                   ELSE 0 END) AS dsSeconds,
          SUM(CASE WHEN e.number IS NULL OR e.number IN (999997, 999998, 999999) THEN 0
                   WHEN UPPER(COALESCE(wc.major_category, '')) IN ('CD', 'STATIC_STRETCHING', 'STATIC_STRETCH') THEN whd.duration
                   ELSE 0 END) AS cdSeconds,
          SUM(CASE WHEN e.number IS NULL OR e.number IN (999997, 999998, 999999) THEN 0
                   WHEN UPPER(COALESCE(wc.major_category, '')) IN ('DS', 'DYNAMIC_STRETCHING', 'DYNAMIC_STRETCH', 'CD', 'STATIC_STRETCHING', 'STATIC_STRETCH') THEN 0
                   ELSE whd.duration END) AS mainSeconds,
          SUM(CASE WHEN e.number IS NULL OR e.number IN (999997, 999998, 999999) THEN 0 ELSE whd.duration END) AS totalSeconds
        FROM workout_history_detail whd
        LEFT JOIN exercises e ON (
          whd.exercises_id = e.id
          OR whd.exercises_id LIKE CONCAT(e.id, '%')
          OR SUBSTRING_INDEX(whd.exercises_id, '_', 1) = e.id
        )
        LEFT JOIN workout_categories wc ON e.workout_category_id = wc.id
        WHERE whd.workout_history_master_id = ?;
      `;

      const [row] = await executeQuery(query, [masterId]);

      res.json(
        successResponse(
          {
            dsSeconds: Number(row?.dsSeconds || 0),
            mainSeconds: Number(row?.mainSeconds || 0),
            cdSeconds: Number(row?.cdSeconds || 0),
            totalSeconds: Number(row?.totalSeconds || 0)
          },
          '운동 시간 요약을 성공적으로 조회했습니다'
        )
      );
    } catch (error) {
      console.error('운동 시간 요약 조회 오류:', error);
      res.status(500).json(errorResponse('운동 시간 요약 조회에 실패했습니다'));
    }
  }
);

/**
 * @route GET /api/workout-categories/test-user-exercises
 * @desc 사용자별 많이 하는 운동 조회 (상위 10개)
 * @access Private
 */
router.get(
  '/test-user-exercises',
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json(errorResponse('사용자 정보를 찾을 수 없습니다'));
      }

      const results = await callProcedure('sp_GetUserTopExercises', [userId]);
      const rows = Array.isArray(results) && Array.isArray(results[0]) ? results[0] : results;

      res.json(successResponse(rows, '사용자별 많이 하는 운동을 성공적으로 조회했습니다'));
    } catch (error) {
      console.error('사용자별 많이 하는 운동 조회 오류:', error);
      res.status(500).json(errorResponse('사용자별 많이 하는 운동 조회에 실패했습니다'));
    }
  }
);

/**
 * @route POST /api/workout-categories
 * @desc 운동구분 생성
 * @access Private (Admin)
 */
router.post('/',
  authenticateToken,
  async (req, res) => {
    try {
      const data = req.body;
      const result = await workoutCategoryService.createWorkoutCategory(data);
      res.status(201).json(successResponse(result, '운동구분이 성공적으로 생성되었습니다'));
    } catch (error) {
      console.error('운동구분 생성 오류:', error);
      res.status(500).json(errorResponse('운동구분 생성에 실패했습니다'));
    }
  }
);

/**
 * @route GET /api/workout-categories/workout-setting
 * @desc 운동 방식별 기본 설정값 조회
 * @access Private
 */
router.get('/workout-setting',
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const methodType = req.query.methodType as string || '';
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(errorResponse('인증 정보가 없습니다'));
      }

      let data: unknown[] = [];
      try {
        const profileResult = await callProcedure('sp_GetWorkoutSettingProfile', [userId, methodType]);
        data = firstProcedureResultRows(profileResult);
      } catch (profileError) {
        console.error('[workout-setting] sp_GetWorkoutSettingProfile 실패:', methodType || '(전체)', profileError);
        data = [];
      }

      if (data.length === 0) {
        try {
          const globalResult = await callProcedure('sp_GetWorkoutSetting', [methodType]);
          data = firstProcedureResultRows(globalResult);
        } catch (fallbackError) {
          console.error('[workout-setting] sp_GetWorkoutSetting 실패:', methodType || '(전체)', fallbackError);
          data = [];
        }
      }

      res.json(successResponse(data, '운동 설정값 조회 성공'));
    } catch (error) {
      console.error('운동 설정값 조회 오류:', error);
      res.status(500).json(errorResponse('운동 설정값 조회에 실패했습니다'));
    }
  }
);

/**
 * @route GET /api/workout-categories/workout-setting/:methodType
 * @desc 특정 운동 방식의 기본 설정값 조회
 * @access Private
 */
router.get('/workout-setting/:methodType',
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { methodType } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(errorResponse('인증 정보가 없습니다'));
      }

      const parsedMethod = workoutSettingMethodTypeSchema.safeParse(methodType);
      if (!parsedMethod.success) {
        return res.status(400).json(errorResponse('지원하지 않는 운동 방식입니다'));
      }
      const normalizedMethodType = parsedMethod.data;

      let data: unknown[] = [];
      try {
        const profileResult = await callProcedure('sp_GetWorkoutSettingProfile', [
          userId,
          normalizedMethodType
        ]);
        data = firstProcedureResultRows(profileResult);
      } catch (profileError) {
        console.error('[workout-setting] sp_GetWorkoutSettingProfile 실패:', normalizedMethodType, profileError);
        data = [];
      }

      if (data.length === 0) {
        try {
          const globalResult = await callProcedure('sp_GetWorkoutSetting', [normalizedMethodType]);
          data = firstProcedureResultRows(globalResult);
        } catch (fallbackError) {
          console.error('[workout-setting] sp_GetWorkoutSetting 실패:', normalizedMethodType, fallbackError);
          data = [];
        }
      }

      res.json(successResponse(data, '운동 설정값 조회 성공'));
    } catch (error) {
      console.error('운동 설정값 조회 오류:', error);
      res.status(500).json(errorResponse('운동 설정값 조회에 실패했습니다'));
    }
  }
);

/**
 * @route PUT /api/workout-categories/workout-setting/:methodType
 * @desc 로그인 사용자의 운동 방식별 설정 저장
 * @access Private
 */
router.put('/workout-setting/:methodType',
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(errorResponse('인증 정보가 없습니다'));
      }

      const normalizedMethodType = workoutSettingMethodTypeSchema.parse(req.params.methodType);
      const parsed = workoutSettingSaveSchema.parse(req.body);
      const rows = parsed.rows;

      const rowsPayload = rows.map((row, i) => ({
        round: row.round,
        time: row.time,
        rest: row.rest,
        waterBreak: row.waterBreak ?? 0,
        reps: row.reps ?? 0,
        sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : i + 1,
        isActive: row.isActive !== false ? 1 : 0
      }));

      await callProcedure('sp_SaveWorkoutSettingProfile', [
        userId,
        normalizedMethodType,
        JSON.stringify(rowsPayload)
      ]);

      res.json(successResponse(true, '운동 설정값 저장 성공'));
    } catch (error) {
      console.error('운동 설정값 저장 오류:', error);
      res.status(500).json(errorResponse('운동 설정값 저장에 실패했습니다'));
    }
  }
);

/**
 * @route GET /api/workout-categories/workout-setting-images
 * @desc 로그인 사용자의 모니터 기본 이미지 URL 조회
 * @access Private
 */
router.get('/workout-setting-images',
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(errorResponse('인증 정보가 없습니다'));
      }

      const imgResult = await callProcedure('sp_GetMonitorDefaultImageProfile', [userId]);
      const rows = firstProcedureResultRows(imgResult) as { side: string; image_url: string }[];

      const data = {
        leftImageUrl: rows.find((row) => row.side === 'left')?.image_url || '',
        rightImageUrl: rows.find((row) => row.side === 'right')?.image_url || ''
      };

      res.json(successResponse(data, '모니터 기본 이미지 조회 성공'));
    } catch (error) {
      console.error('모니터 기본 이미지 조회 오류:', error);
      res.status(500).json(errorResponse('모니터 기본 이미지 조회에 실패했습니다'));
    }
  }
);

/**
 * @route POST /api/workout-categories/workout-setting-images/upload
 * @desc PC에서 선택한 이미지 파일을 서버에 저장 후 DB에 URL 기록
 * @access Private
 */
router.post('/workout-setting-images/upload',
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(errorResponse('인증 정보가 없습니다'));
      }

      const parsed = monitorImageUploadSchema.parse(req.body);
      const { side, imageBase64 } = parsed;

      const match = imageBase64.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!match) {
        return res.status(400).json(errorResponse('유효한 base64 이미지 형식이 아닙니다 (data:image/xxx;base64,...)'));
      }

      const ext = match[1] === 'jpeg' || match[1] === 'jpg' ? 'jpg' : match[1] === 'png' ? 'png' : 'jpg';
      const buffer = Buffer.from(match[2], 'base64');

      const uploadsDir = path.join(__dirname, '../../uploads');
      try {
        await fs.access(uploadsDir);
      } catch {
        await fs.mkdir(uploadsDir, { recursive: true });
      }

      const fileName = `${userId}_${side}_${Date.now()}.${ext}`;
      const filePath = path.join(uploadsDir, fileName);
      await fs.writeFile(filePath, buffer);

      const baseUrl = resolvePublicUploadBaseUrl();
      const imageUrl = `${baseUrl}/uploads/${fileName}`;
      console.log('[workout-setting-images/upload] 이미지 저장 완료:', { filePath, imageUrl, baseUrl });

      await callProcedure('sp_UpsertMonitorDefaultImageProfile', [userId, side, imageUrl]);

      res.json(successResponse({ imageUrl, side }, '이미지 업로드 및 저장 완료'));
    } catch (error) {
      console.error('모니터 이미지 업로드 오류:', error);
      const errMsg = error instanceof Error ? error.message : '알 수 없는 오류';
      res.status(500).json(errorResponse(`이미지 업로드에 실패했습니다: ${errMsg}`));
    }
  }
);

/**
 * @route PUT /api/workout-categories/workout-setting-images
 * @desc 로그인 사용자의 모니터 기본 이미지 URL 저장
 * @access Private
 */
router.put('/workout-setting-images',
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(errorResponse('인증 정보가 없습니다'));
      }

      const parsed = monitorImageSaveSchema.parse(req.body);

      await executeTransaction([
        async (connection) => {
          if (parsed.leftImageUrl !== undefined) {
            if (parsed.leftImageUrl === null || String(parsed.leftImageUrl).trim() === '') {
              await connection.execute('CALL sp_DeleteMonitorDefaultImageProfileSide(?, ?)', [userId, 'left']);
            } else {
              await connection.execute('CALL sp_UpsertMonitorDefaultImageProfile(?, ?, ?)', [
                userId,
                'left',
                parsed.leftImageUrl
              ]);
            }
          }

          if (parsed.rightImageUrl !== undefined) {
            if (parsed.rightImageUrl === null || String(parsed.rightImageUrl).trim() === '') {
              await connection.execute('CALL sp_DeleteMonitorDefaultImageProfileSide(?, ?)', [
                userId,
                'right'
              ]);
            } else {
              await connection.execute('CALL sp_UpsertMonitorDefaultImageProfile(?, ?, ?)', [
                userId,
                'right',
                parsed.rightImageUrl
              ]);
            }
          }

          return true;
        }
      ]);

      res.json(successResponse(true, '모니터 기본 이미지 저장 성공'));
    } catch (error) {
      console.error('모니터 기본 이미지 저장 오류:', error);
      res.status(500).json(errorResponse('모니터 기본 이미지 저장에 실패했습니다'));
    }
  }
);

/**
 * @route GET /api/workout-categories/system-default-images
 * @desc 시스템 기본 이미지 URL 조회 (admin 전용)
 * @access Private (Admin)
 */
router.get('/system-default-images',
  authenticateToken,
  requireAdmin as any,
  async (req: AdminRequest, res) => {
    try {
      const sysResult = await callProcedure('sp_GetSystemDefaultImages', []);
      const rows = firstProcedureResultRows(sysResult) as { side: string; image_url: string }[];

      const data = {
        leftImageUrl: rows.find((row) => row.side === 'left')?.image_url || '',
        rightImageUrl: rows.find((row) => row.side === 'right')?.image_url || ''
      };

      res.json(successResponse(data, '시스템 기본 이미지 조회 성공'));
    } catch (error) {
      console.error('시스템 기본 이미지 조회 오류:', error);
      res.status(500).json(errorResponse('시스템 기본 이미지 조회에 실패했습니다'));
    }
  }
);

/**
 * @route GET /api/workout-categories/system-default-images/public
 * @desc 시스템 기본 이미지 URL 조회 (인증된 사용자 모두 접근 가능 - 읽기 전용)
 * @access Private
 */
router.get('/system-default-images/public',
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const sysResult = await callProcedure('sp_GetSystemDefaultImages', []);
      const rows = firstProcedureResultRows(sysResult) as { side: string; image_url: string }[];

      const data = {
        leftImageUrl: rows.find((row) => row.side === 'left')?.image_url || '',
        rightImageUrl: rows.find((row) => row.side === 'right')?.image_url || ''
      };

      res.json(successResponse(data, '시스템 기본 이미지 조회 성공'));
    } catch (error) {
      console.error('시스템 기본 이미지 조회 오류:', error);
      res.status(500).json(errorResponse('시스템 기본 이미지 조회에 실패했습니다'));
    }
  }
);

/**
 * @route POST /api/workout-categories/system-default-images/upload
 * @desc 시스템 기본 이미지 파일 업로드 (admin 전용)
 * @access Private (Admin)
 */
router.post('/system-default-images/upload',
  authenticateToken,
  requireAdmin as any,
  async (req: AdminRequest, res) => {
    try {
      const parsed = systemImageUploadSchema.parse(req.body);
      const { side, imageBase64 } = parsed;

      const match = imageBase64.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!match) {
        return res.status(400).json(errorResponse('유효한 base64 이미지 형식이 아닙니다'));
      }

      const ext = match[1] === 'jpeg' || match[1] === 'jpg' ? 'jpg' : match[1] === 'png' ? 'png' : 'jpg';
      const buffer = Buffer.from(match[2], 'base64');

      const uploadsDir = path.join(__dirname, '../../uploads');
      try {
        await fs.access(uploadsDir);
      } catch {
        await fs.mkdir(uploadsDir, { recursive: true });
      }

      const fileName = `system_${side}_${Date.now()}.${ext}`;
      const filePath = path.join(uploadsDir, fileName);
      await fs.writeFile(filePath, buffer);

      const baseUrl = resolvePublicUploadBaseUrl();
      const imageUrl = `${baseUrl}/uploads/${fileName}`;
      console.log('[system-default-images/upload] 이미지 저장 완료:', { filePath, imageUrl, baseUrl });

      await callProcedure('sp_UpsertSystemDefaultImage', [side, imageUrl]);

      res.json(successResponse({ imageUrl, side }, '시스템 기본 이미지 업로드 완료'));
    } catch (error) {
      console.error('시스템 기본 이미지 업로드 오류:', error);
      const errMsg = error instanceof Error ? error.message : '알 수 없는 오류';
      res.status(500).json(errorResponse(`시스템 기본 이미지 업로드에 실패했습니다: ${errMsg}`));
    }
  }
);

/**
 * @route PUT /api/workout-categories/system-default-images
 * @desc 시스템 기본 이미지 URL 저장 (admin 전용)
 * @access Private (Admin)
 */
router.put('/system-default-images',
  authenticateToken,
  requireAdmin as any,
  async (req: AdminRequest, res) => {
    try {
      const parsed = systemImageSaveSchema.parse(req.body);

      await executeTransaction([
        async (connection) => {
          if (parsed.leftImageUrl !== undefined) {
            if (parsed.leftImageUrl === null || String(parsed.leftImageUrl).trim() === '') {
              await connection.execute('CALL sp_DeleteSystemDefaultImageSide(?)', ['left']);
            } else {
              await connection.execute('CALL sp_UpsertSystemDefaultImage(?, ?)', [
                'left',
                parsed.leftImageUrl
              ]);
            }
          }

          if (parsed.rightImageUrl !== undefined) {
            if (parsed.rightImageUrl === null || String(parsed.rightImageUrl).trim() === '') {
              await connection.execute('CALL sp_DeleteSystemDefaultImageSide(?)', ['right']);
            } else {
              await connection.execute('CALL sp_UpsertSystemDefaultImage(?, ?)', [
                'right',
                parsed.rightImageUrl
              ]);
            }
          }

          return true;
        }
      ]);

      res.json(successResponse(true, '시스템 기본 이미지 저장 성공'));
    } catch (error) {
      console.error('시스템 기본 이미지 저장 오류:', error);
      res.status(500).json(errorResponse('시스템 기본 이미지 저장에 실패했습니다'));
    }
  }
);

/**
 * @route GET /api/workout-categories/:id
 * @desc 운동구분 상세 조회
 */
router.get('/:id',
  authenticateToken,
  async (req, res) => {
    try {
      const categoryId = req.params.id;
      const category = await workoutCategoryService.getWorkoutCategoryById(categoryId);
      if (!category) return res.status(404).json(errorResponse('운동구분을 찾을 수 없습니다'));
      res.json(successResponse(category, '운동구분을 성공적으로 조회했습니다'));
    } catch (error) {
      console.error('운동구분 상세 조회 오류:', error);
      res.status(500).json(errorResponse('운동구분 상세 조회에 실패했습니다'));
    }
  }
);

/**
 * @route PUT /api/workout-categories/:id
 * @desc 운동구분 수정
 * @access Private (Admin)
 */
router.put('/:id',
  authenticateToken,
  async (req, res) => {
    try {
      const categoryId = req.params.id;
      const data = req.body;
      const result = await workoutCategoryService.updateWorkoutCategory(categoryId, data);
      res.json(successResponse(result, '운동구분이 성공적으로 수정되었습니다'));
    } catch (error) {
      console.error('운동구분 수정 오류:', error);
      res.status(500).json(errorResponse('운동구분 수정에 실패했습니다'));
    }
  }
);

/**
 * @route DELETE /api/workout-categories/:id
 * @desc 운동구분 삭제
 * @access Private (Admin)
 */
router.delete('/:id',
  authenticateToken,
  async (req, res) => {
    try {
      const categoryId = req.params.id;
      const result = await workoutCategoryService.deleteWorkoutCategory(categoryId);
      res.json(successResponse(result, '운동구분이 성공적으로 삭제되었습니다'));
    } catch (error) {
      console.error('운동구분 삭제 오류:', error);
      if (error instanceof Error && error.message.includes('해당 운동구분을 사용하는 운동이 있어')) {
        res.status(400).json(errorResponse(error.message));
      } else {
        res.status(500).json(errorResponse('운동구분 삭제에 실패했습니다'));
      }
    }
  }
);

export default router;