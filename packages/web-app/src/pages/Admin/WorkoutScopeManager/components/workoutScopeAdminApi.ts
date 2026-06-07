/**
 * workoutScopeAdminApi — Admin 운동 Scope CRUD
 *
 * API: GET/POST /workout-scopes, PUT /workout-scopes/:id
 */

import api from '@/services/api'
import type { WorkoutScopeFormValues, WorkoutScopeItem } from './workoutScopeTypes'

const mapItem = (row: Record<string, unknown>): WorkoutScopeItem => ({
  id: String(row.id ?? ''),
  scopeCode: String(row.scopeCode ?? row.scope_code ?? ''),
  scopeName: String(row.scopeName ?? row.scope_name ?? ''),
  sortOrder: Number(row.sortOrder ?? row.sort_order ?? 0),
  isActive: Boolean(row.isActive ?? row.is_active ?? true),
})

export const fetchAdminWorkoutScopes = async (): Promise<WorkoutScopeItem[]> => {
  const response = await api.get('/workout-scopes', { params: { includeInactive: 'true' } })
  if (!response.data?.success) return []
  return (response.data.data ?? []).map((row: Record<string, unknown>) => mapItem(row))
}

export const createWorkoutScope = async (values: WorkoutScopeFormValues): Promise<WorkoutScopeItem> => {
  const response = await api.post('/workout-scopes', values)
  if (!response.data?.success) {
    throw new Error(response.data?.error || '등록에 실패했습니다')
  }
  return mapItem(response.data.data)
}

export const updateWorkoutScope = async (
  id: string,
  values: Partial<WorkoutScopeFormValues>,
): Promise<WorkoutScopeItem> => {
  const response = await api.put(`/workout-scopes/${id}`, values)
  if (!response.data?.success) {
    throw new Error(response.data?.error || '수정에 실패했습니다')
  }
  return mapItem(response.data.data)
}
