import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireSuperAdmin } from '../middleware/admin.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';
import { executeQuery } from '../lib/database.js';
import { successResponse, errorResponse } from '../utils/response.util.js';

const router = Router();

const FALLBACK_SCOPES = [
  { scope_code: 'TOTAL', scope_name: '통합 운동', sort_order: 10, is_active: true },
  { scope_code: 'SINGLE', scope_name: '단일 운동', sort_order: 20, is_active: true },
] as const;

type WorkoutScopeRow = {
  id: string;
  scope_code: string;
  scope_name: string;
  sort_order: number;
  is_active: boolean | number;
  created_at?: string;
  updated_at?: string;
};

const normalizeRow = (row: WorkoutScopeRow) => ({
  id: row.id,
  scopeCode: row.scope_code,
  scopeName: row.scope_name,
  sortOrder: Number(row.sort_order ?? 0),
  isActive: Boolean(row.is_active),
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
});

const scopeCodeSchema = z.string().trim().min(1).max(20).regex(/^[A-Z0-9_]+$/, 'scopeCode는 대문자·숫자·_만 허용');

const createBodySchema = z.object({
  scopeCode: scopeCodeSchema,
  scopeName: z.string().trim().min(1).max(100),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

const updateBodySchema = createBodySchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: '수정할 필드가 필요합니다' },
);

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

const listQuerySchema = z.object({
  includeInactive: z.enum(['true', 'false']).optional(),
});

const SCOPE_SELECT = `id, scope_code, scope_name, sort_order, is_active, created_at, updated_at`;

const tableExists = async (): Promise<boolean> => {
  try {
    const rows = await executeQuery(
      `SELECT 1 AS ok FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'workout_scope' LIMIT 1`,
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
};

const fetchScopes = async (includeInactive: boolean): Promise<WorkoutScopeRow[]> => {
  const exists = await tableExists();
  if (!exists) {
    return FALLBACK_SCOPES.map((s, i) => ({
      id: `fallback-${i}`,
      scope_code: s.scope_code,
      scope_name: s.scope_name,
      sort_order: s.sort_order,
      is_active: s.is_active,
    }));
  }

  const where = includeInactive ? '' : 'WHERE is_active = TRUE';
  const rows = await executeQuery(
    `SELECT ${SCOPE_SELECT} FROM workout_scope ${where}
     ORDER BY sort_order ASC, scope_code ASC`,
  );
  return rows as WorkoutScopeRow[];
};

/** 활성 scope 코드 집합 — 저장 API 검증용 */
export const getActiveWorkoutScopeCodes = async (): Promise<Set<string>> => {
  const rows = await fetchScopes(false);
  return new Set(rows.map((r) => String(r.scope_code).toUpperCase()));
};

export const resolveWorkoutScopeCode = async (raw: unknown): Promise<string> => {
  const normalized = String(raw ?? 'TOTAL').trim().toUpperCase();
  const codes = await getActiveWorkoutScopeCodes();
  if (codes.has(normalized)) return normalized;
  return codes.has('TOTAL') ? 'TOTAL' : [...codes][0] ?? 'TOTAL';
};

/**
 * @route GET /api/workout-scopes
 * @desc scope 목록 (includeInactive=true 시 비활성 포함)
 */
router.get(
  '/',
  authenticateToken,
  validateRequest({ query: listQuerySchema }),
  async (req, res) => {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const rows = await fetchScopes(includeInactive);
      res.json(successResponse(rows.map(normalizeRow), 'workout scope 목록 조회 성공'));
    } catch (error) {
      console.error('[workout-scopes] list error:', error);
      res.status(500).json(errorResponse('workout scope 목록 조회에 실패했습니다'));
    }
  },
);

/**
 * @route POST /api/workout-scopes
 * @desc scope 등록 (슈퍼관리자)
 */
router.post(
  '/',
  authenticateToken,
  requireSuperAdmin as any,
  validateRequest({ body: createBodySchema }),
  async (req, res) => {
    try {
      const body = req.body as z.infer<typeof createBodySchema>;
      const exists = await tableExists();
      if (!exists) {
        return res.status(503).json(errorResponse('workout_scope 테이블이 없습니다. DB 마이그레이션을 실행하세요'));
      }

      const duplicate = await executeQuery(
        `SELECT id FROM workout_scope WHERE scope_code = ? LIMIT 1`,
        [body.scopeCode],
      );
      if (Array.isArray(duplicate) && duplicate.length > 0) {
        return res.status(409).json(errorResponse('이미 사용 중인 scopeCode입니다'));
      }

      await executeQuery(
        `INSERT INTO workout_scope (scope_code, scope_name, sort_order, is_active)
         VALUES (?, ?, ?, ?)`,
        [body.scopeCode, body.scopeName, body.sortOrder, body.isActive],
      );

      const rows = await executeQuery(
        `SELECT ${SCOPE_SELECT} FROM workout_scope WHERE scope_code = ? LIMIT 1`,
        [body.scopeCode],
      );
      const row = (rows as WorkoutScopeRow[])[0];
      res.status(201).json(successResponse(normalizeRow(row), 'workout scope가 등록되었습니다'));
    } catch (error) {
      console.error('[workout-scopes] create error:', error);
      res.status(500).json(errorResponse('workout scope 등록에 실패했습니다'));
    }
  },
);

/**
 * @route PUT /api/workout-scopes/:id
 * @desc scope 수정 (슈퍼관리자)
 */
router.put(
  '/:id',
  authenticateToken,
  requireSuperAdmin as any,
  validateRequest({ params: idParamsSchema, body: updateBodySchema }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const body = req.body as z.infer<typeof updateBodySchema>;

      const currentRows = await executeQuery(
        `SELECT id FROM workout_scope WHERE id = ? LIMIT 1`,
        [id],
      );
      if (!Array.isArray(currentRows) || currentRows.length === 0) {
        return res.status(404).json(errorResponse('workout scope를 찾을 수 없습니다', 'NOT_FOUND'));
      }

      if (body.scopeCode) {
        const dupCode = await executeQuery(
          `SELECT id FROM workout_scope WHERE id <> ? AND scope_code = ? LIMIT 1`,
          [id, body.scopeCode],
        );
        if (Array.isArray(dupCode) && dupCode.length > 0) {
          return res.status(409).json(errorResponse('이미 사용 중인 scopeCode입니다'));
        }
      }

      const fields: string[] = [];
      const params: unknown[] = [];
      if (body.scopeCode != null) { fields.push('scope_code = ?'); params.push(body.scopeCode); }
      if (body.scopeName != null) { fields.push('scope_name = ?'); params.push(body.scopeName); }
      if (body.sortOrder != null) { fields.push('sort_order = ?'); params.push(body.sortOrder); }
      if (body.isActive != null) { fields.push('is_active = ?'); params.push(body.isActive); }

      if (fields.length === 0) {
        return res.status(400).json(errorResponse('수정할 필드가 없습니다'));
      }

      params.push(id);
      await executeQuery(`UPDATE workout_scope SET ${fields.join(', ')} WHERE id = ?`, params);

      const rows = await executeQuery(
        `SELECT ${SCOPE_SELECT} FROM workout_scope WHERE id = ? LIMIT 1`,
        [id],
      );
      res.json(successResponse(normalizeRow((rows as WorkoutScopeRow[])[0]), 'workout scope가 수정되었습니다'));
    } catch (error) {
      console.error('[workout-scopes] update error:', error);
      res.status(500).json(errorResponse('workout scope 수정에 실패했습니다'));
    }
  },
);

export default router;
