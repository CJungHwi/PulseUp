/**
 * 역할별 로그인 후 기본 경로 및 post-login from 경로 검증
 *
 * - super_admin → /admin/dashboard
 * - branch_admin → /dashboard
 * - user → /account/workout-records (내 운동기록)
 */

export type AppUserRole = 'user' | 'branch_admin' | 'super_admin'

const SUPER_ADMIN_ONLY_PATH_PREFIXES = [
  '/admin/menumanager',
  '/admin/branch',
  '/admin/vimeo',
  '/admin/licenses',
] as const

export const getDefaultRouteForRole = (role: string | null | undefined): string => {
  switch (role) {
    case 'super_admin':
      return '/admin/dashboard'
    case 'branch_admin':
      return '/dashboard'
    case 'user':
    default:
      return '/account/workout-records'
  }
}

/** 로그인 직후 이동 경로 — 이전 세션 from 경로가 새 역할과 맞지 않으면 기본 경로 사용 */
export const resolvePostLoginPath = (
  role: string | null | undefined,
  fromPath?: string | null
): string => {
  const defaultPath = getDefaultRouteForRole(role)

  if (!fromPath || fromPath === '/login' || fromPath === '/home') {
    return defaultPath
  }

  if (role === 'user') {
    if (fromPath.startsWith('/admin')) {
      return defaultPath
    }
    return fromPath
  }

  if (role === 'branch_admin') {
    if (fromPath === '/admin/dashboard') {
      return '/dashboard'
    }
    if (SUPER_ADMIN_ONLY_PATH_PREFIXES.some((prefix) => fromPath.startsWith(prefix))) {
      return '/dashboard'
    }
    return fromPath
  }

  return fromPath
}
