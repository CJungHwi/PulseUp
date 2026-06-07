/**
 * useWorkoutScope — scope 코드의 DB 등록·사용 여부 확인
 *
 * 각 운동 페이지는 scope 코드를 직접 지정하고, DB에서 활성 여부만 검증한다.
 */

import { useEffect, useState } from 'react'
import { fetchWorkoutScopes } from './workoutScopeApi'
import type { WorkoutScopeRecord } from './workoutScope'

interface UseWorkoutScopeResult {
  scope: WorkoutScopeRecord | null
  loading: boolean
  scopeCode: string
  scopeName: string
  isActive: boolean
}

export const useWorkoutScope = (scopeCode: string): UseWorkoutScopeResult => {
  const [scope, setScope] = useState<WorkoutScopeRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchWorkoutScopes(true)
      .then((rows) => {
        if (cancelled) return
        const normalized = scopeCode.trim().toUpperCase()
        const found = rows.find((row) => row.scopeCode.toUpperCase() === normalized) ?? null
        setScope(found)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [scopeCode])

  return {
    scope,
    loading,
    scopeCode: scopeCode.trim().toUpperCase(),
    scopeName: scope?.scopeName ?? scopeCode,
    isActive: Boolean(scope?.isActive),
  }
}
