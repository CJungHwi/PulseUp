/**

 * 라우트 가드 — `ProtectedRoute`

 *

 * 기능: 인증 여부 확인, 선택적 `requiredRole` 검사, 미인증 시 로그인으로 `Navigate`.

 * 역할 계층: branch_admin 페이지는 super_admin도 접근, super_admin 페이지는 super_admin만.

 *

 * 호출/연동: 필요 시 `getCurrentUser` dispatch로 세션 복구(`authSlice`).

 * 페이지 audience 검사는 `MenuAudienceGuard`에서 수행.

 *

 * 관련 컴포넌트: 자식으로 `MainLayout`, `RemoteControlPage`, 관리자 페이지 등 래핑.

 *

 * 흐름: 토큰·스토어 확인 → 역할 계층 검사 → 통과 시 `children` 렌더.

 */



import React, { useEffect } from 'react'

import { Navigate, useLocation } from 'react-router-dom'

import { useAppDispatch, useAppSelector } from '../../hooks/redux'

import { getCurrentUser } from '../../store/slices/authSlice'

import { roleMeetsRequiredRole } from '../../utils/menuAudienceAccess'
import { getDefaultRouteForRole } from '../../utils/roleDefaultRoutes'



interface ProtectedRouteProps {

  children: React.ReactNode

  requiredRole?: 'user' | 'branch_admin' | 'super_admin'

}



const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {

  const dispatch = useAppDispatch()

  const { isAuthenticated, user, accessToken } = useAppSelector((state) => state.auth)

  const location = useLocation()



  useEffect(() => {

    if (accessToken && !user) {

      dispatch(getCurrentUser())

    }

  }, [dispatch, accessToken, user])



  if (!isAuthenticated || !accessToken) {

    return <Navigate to="/login" state={{ from: location }} replace />

  }



  if (requiredRole && user?.role && !roleMeetsRequiredRole(user.role, requiredRole)) {
    return <Navigate to={getDefaultRouteForRole(user.role)} replace />
  }



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

