/**
 * 페이지 요약 — 홈 엔트리 (`/home`)
 *
 * 기능: 로그인 사용자의 역할에 따라 기본 대시보드 경로로 리다이렉트한다.
 *
 * 호출/연동: 없음(Redux `auth` 상태만 조회).
 *
 * 관련 컴포넌트: `Navigate`(react-router-dom).
 *
 * 흐름: 미인증 → `/login`, admin/super_admin → `/admin/dashboard`, 그 외 → `/dashboard`.
 */

import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAppSelector } from '../../hooks/redux'

const RoleBasedRedirect: React.FC = () => {
  const { user, isAuthenticated } = useAppSelector((state) => state.auth)

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  // 역할에 따른 기본 대시보드로 리다이렉트
  switch (user.role) {
    case 'super_admin':
    case 'admin':
      return <Navigate to="/admin/dashboard" replace />
    case 'user':
    default:
      return <Navigate to="/dashboard" replace />
  }
}

export { RoleBasedRedirect }
