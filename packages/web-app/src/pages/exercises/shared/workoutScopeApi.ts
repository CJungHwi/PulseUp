/**
 * workoutScopeApi — DB workout_scope 마스터 조회
 *
 * API: GET /workout-scopes
 */

import api from '@/services/api'
import type { WorkoutScopeRecord } from './workoutScope'

const mapRow = (row: Record<string, unknown>): WorkoutScopeRecord => ({
  id: String(row.id ?? ''),
  scopeCode: String(row.scopeCode ?? row.scope_code ?? ''),
  scopeName: String(row.scopeName ?? row.scope_name ?? ''),
  sortOrder: Number(row.sortOrder ?? row.sort_order ?? 0),
  isActive: Boolean(row.isActive ?? row.is_active ?? true),
})

export const fetchWorkoutScopes = async (includeInactive = false): Promise<WorkoutScopeRecord[]> => {
  const response = await api.get('/workout-scopes', {
    params: includeInactive ? { includeInactive: 'true' } : undefined,
  })
  if (!response.data?.success) return []
  const rows = response.data.data ?? []
  return rows.map((row: Record<string, unknown>) => mapRow(row))
}
