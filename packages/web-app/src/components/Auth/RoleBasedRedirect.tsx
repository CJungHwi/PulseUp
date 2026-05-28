/**
 * 페이지 요약 — 홈 엔트리 (`/home`)
 *
 * 기능: 로그인 사용자의 역할에 따라 기본 대시보드 경로로 리다이렉트한다.
 *
 * 호출/연동: 없음(Redux `auth` 상태만 조회).
 *
 * 관련 컴포넌트: `Navigate`(react-router-dom).
 *
 * 흐름: 미인증 → `/login`, 역할별 기본 경로(`roleDefaultRoutes`)로 리다이렉트.
 */

import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAppSelector } from '../../hooks/redux'
import { getDefaultRouteForRole } from '../../utils/roleDefaultRoutes'

const RoleBasedRedirect: React.FC = () => {
  const { user, isAuthenticated } = useAppSelector((state) => state.auth)

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to={getDefaultRouteForRole(user.role)} replace />
}

export { RoleBasedRedirect }
