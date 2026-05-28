/**
 * 메뉴 target_audience 기반 페이지 접근 가드
 *
 * 기능: 현재 URL에 해당하는 menus 레코드가 있으면 역할별 audience 규칙으로 접근 차단.
 * 메뉴 권한(is_enabled)과 별도로 target_audience 미충족 시 페이지 진입 불가.
 *
 * 호출/연동: `menuApi.checkAccessByPath`, Redux `auth`.
 */
import React, { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAppSelector } from '../../hooks/redux'
import { menuApi } from '../../services/menuApi'
import { getDefaultRouteForRole } from '../../utils/roleDefaultRoutes'

export const MenuAudienceGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation()
  const { user } = useAppSelector((state) => state.auth)
  const [accessState, setAccessState] = useState<'loading' | 'allowed' | 'denied'>('loading')

  useEffect(() => {
    let cancelled = false

    const verifyAccess = async () => {
      if (!user?.role) {
        setAccessState('allowed')
        return
      }

      setAccessState('loading')

      try {
        const response = await menuApi.checkAccessByPath(location.pathname)
        const result = response.data

        if (cancelled) return

        if (!result.registered || result.hasAccess) {
          setAccessState('allowed')
          return
        }

        setAccessState('denied')
      } catch {
        if (!cancelled) setAccessState('allowed')
      }
    }

    verifyAccess()

    return () => {
      cancelled = true
    }
  }, [location.pathname, user?.role])

  if (accessState === 'loading') {
    return (
      <div className="min-h-[200px] flex items-center justify-center text-muted-foreground">
        접근 권한 확인 중...
      </div>
    )
  }

  if (accessState === 'denied') {
    return <Navigate to={getDefaultRouteForRole(user?.role)} replace state={{ accessDenied: true }} />
  }

  return <>{children}</>
}
