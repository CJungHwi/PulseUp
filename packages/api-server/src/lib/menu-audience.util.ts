export type MenuTargetAudience = 'all' | 'user' | 'branch_admin' | 'super_admin'
export type AppUserRole = 'user' | 'branch_admin' | 'super_admin'

/**
 * menus.target_audience 기준 페이지 접근 가능 여부
 * - user / all: 모든 역할
 * - branch_admin: branch_admin, super_admin
 * - super_admin: super_admin만
 */
export const canAccessByTargetAudience = (
  userRole: string,
  targetAudience: string | null | undefined
): boolean => {
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
  userRole: string,
  requiredRole: 'user' | 'branch_admin' | 'super_admin'
): boolean => {
  if (requiredRole === 'super_admin') {
    return userRole === 'super_admin'
  }
  if (requiredRole === 'branch_admin') {
    return userRole === 'branch_admin' || userRole === 'super_admin'
  }
  return true
}

export const menuMatchesAudienceCsv = (
  menuTargetAudience: string | null | undefined,
  audienceCsv: string | null | undefined
): boolean => {
  if (!audienceCsv) return true
  const audience = (menuTargetAudience || '').trim()
  if (!audience) return false
  return audienceCsv.split(',').some((part) => part.trim() === audience)
}

export const filterMenuTreeByTargetAudience = (
  menus: any[],
  userRole: string
): any[] => {
  return menus
    .map((menu) => {
      const children = menu.children
        ? filterMenuTreeByTargetAudience(menu.children, userRole)
        : []

      if (menu.menu_type === 'folder') {
        if (!canAccessByTargetAudience(userRole, menu.target_audience)) {
          return null
        }
        return children.length > 0 ? { ...menu, children } : null
      }

      if (menu.menu_type === 'page' && !canAccessByTargetAudience(userRole, menu.target_audience)) {
        return null
      }

      return { ...menu, children }
    })
    .filter(Boolean)
}

export const normalizeMenuPath = (path: string | null | undefined): string => {
  if (!path) return ''
  const withoutQuery = path.split('?')[0]
  if (!withoutQuery) return ''
  return withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`
}
