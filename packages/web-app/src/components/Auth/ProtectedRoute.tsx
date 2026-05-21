/**
 * 라우트 가드 — `ProtectedRoute`
 *
 * 기능: 인증 여부 확인, 선택적 `requiredRole`(admin) 검사, 미인증 시 로그인으로 `Navigate`.
 *
 * 호출/연동: 필요 시 `getCurrentUser` dispatch로 세션 복구(`authSlice`).
 *
 * 관련 컴포넌트: 자식으로 `MainLayout`, `RemoteControlPage`, 관리자 페이지 등 래핑.
 *
 * 흐름: 토큰·스토어 확인 → 권한 불일치 시 홈 또는 로그인 → 통과 시 `children` 렌더.
 */

import React, { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../../hooks/redux'
import { getCurrentUser } from '../../store/slices/authSlice'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'user' | 'admin' | 'super_admin'
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const dispatch = useAppDispatch()
  const { isAuthenticated, user, accessToken } = useAppSelector((state) => state.auth)
  const location = useLocation()

  useEffect(() => {
    // 토큰이 있지만 사용자 정보가 없는 경우 사용자 정보 조회
    if (accessToken && !user) {
      dispatch(getCurrentUser())
    }
  }, [dispatch, accessToken, user])

  if (!isAuthenticated || !accessToken) {
    // 현재 경로를 state로 전달하여 로그인 후 리다이렉트
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // 역할 기반 접근 제어
  if (requiredRole && user?.role) {
    // super_admin은 모든 페이지 접근 가능
    if (user.role === 'super_admin') {
      return <>{children}</>
    }
    
    // 요구되는 역할과 사용자 역할이 다른 경우
    if (user.role !== requiredRole) {
      console.log(`권한 부족: 요구역할=${requiredRole}, 사용자역할=${user.role}`)
      // 권한이 없는 경우 역할에 맞는 대시보드로 리다이렉트
      if (user.role === 'admin') {
        return <Navigate to="/admin/dashboard" replace />
      } else {
        return <Navigate to="/dashboard" replace />
      }
    }
  }
  
  // 사용자 정보가 아직 로드되지 않은 경우 로딩 표시
  if (!user && isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner">사용자 정보 로드 중...</div>
      </div>
    )
  }

  return <>{children}</>
}

export { ProtectedRoute }