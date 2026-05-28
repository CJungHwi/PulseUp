export type MenuTargetAudience = 'all' | 'user' | 'branch_admin' | 'super_admin'

/**
 * menus.target_audience 기준 페이지 접근 가능 여부
 * - user / all: 모든 역할
 * - branch_admin: branch_admin, super_admin
 * - super_admin: super_admin만
 */
export const canAccessByTargetAudience = (
  userRole: string | undefined,
  targetAudience: MenuTargetAudience | string | null | undefined
): boolean => {
  if (!userRole) return false

  const audience = targetAudience || 'all'

  if (audience === 'all' || audience === 'user') {
    return true
  }

  if (audience === 'branch_admin') {
    return userRole === 'branch_admin' || userRole === 'super_admin'
  }

  if (audience === 'super_admin') {
    return userRole === 'super_admin'
  }

  return false
}

export const roleMeetsRequiredRole = (
  userRole: string | undefined,
  requiredRole: 'user' | 'branch_admin' | 'super_admin'
): boolean => {
  if (!userRole) return false
  if (requiredRole === 'super_admin') return userRole === 'super_admin'
  if (requiredRole === 'branch_admin') {
    return userRole === 'branch_admin' || userRole === 'super_admin'
  }
  return true
}

export const normalizeMenuPath = (path: string | null | undefined): string => {
  if (!path) return ''
  const withoutQuery = path.split('?')[0]
  if (!withoutQuery) return ''
  return withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`
}
