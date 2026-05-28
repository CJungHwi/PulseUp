/**
 * UserManagement 유틸리티
 *
 * - 안전한 날짜 포맷터 (YYYY-MM-DD, optional 시:분:초)
 * - 역할 라벨/배지 variant 매퍼
 *
 * 사용처: `UserManagementTable.tsx`, `UserManagementEditForm.tsx`, `UserManagement.tsx`
 */

export const formatSafeDate = (
  dateValue: string | Date | null | undefined,
  fallback: string = '-',
  includeTime: boolean = false
): string => {
  try {
    if (!dateValue) return fallback
    const date = new Date(dateValue)
    if (isNaN(date.getTime())) return fallback
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const base = `${year}-${month}-${day}`
    if (!includeTime) return base
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${base} ${hours}:${minutes}:${seconds}`
  } catch {
    return fallback
  }
}

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

export const getRoleBadgeVariant = (role: string): BadgeVariant => {
  switch (role) {
    case 'super_admin':
      return 'destructive'
    case 'admin':
      return 'default'
    case 'user':
      return 'secondary'
    default:
      return 'secondary'
  }
}

export const getRoleLabel = (role: string): string => {
  switch (role) {
    case 'super_admin':
      return '슈퍼 관리자'
    case 'admin':
      return '관리자'
    case 'user':
      return '일반 사용자'
    case 'branch_admin':
      return '지점관리자'
    default:
      return role
  }
}
