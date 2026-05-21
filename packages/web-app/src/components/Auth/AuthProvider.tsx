import React, { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../hooks/redux'
import { getCurrentUser, restoreAuth, restoreUserSuccess, restoreUserFailure } from '../../store/slices/authSlice'
import { loadMenuTree } from '../../store/slices/menuSlice'
import { authService } from '../../services/auth.service'

interface AuthProviderProps {
  children: React.ReactNode
}

const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const dispatch = useAppDispatch()
  const { accessToken, isAuthenticated, user, isLoading } = useAppSelector((state) => state.auth)
  const { menuTree, menuTreeLoading } = useAppSelector((state) => state.menus)
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const initializeAuth = async () => {
      console.log('인증 초기화 시작...')

      // sessionStorage에서 토큰 확인 (브라우저 닫으면 자동 만료)
      const token = sessionStorage.getItem('token') || sessionStorage.getItem('accessToken')

      // console.log('🔍 AuthProvider 상태 확인:', {
      //   hasToken: !!token,
      //   isAuthenticated,
      //   hasUser: !!user,
      //   userRole: user?.role
      // })

      if (token && !isAuthenticated) {
        console.log('🔑 토큰 발견, 인증 상태 복원 중...')
        // 토큰이 있지만 Redux 상태에 없는 경우 복원
        dispatch(restoreAuth())

        try {
          // 사용자 정보 조회
          console.log('👤 사용자 정보 조회 중...')
          const userInfo = await authService.getCurrentUser()
          dispatch(restoreUserSuccess(userInfo))
          console.log('✅ 사용자 정보 복원 완료:', userInfo.name, 'role:', userInfo.role)

          // 사용자 정보 복원 후 메뉴 로드 (중복 로드 방지)
          if (userInfo.role && (!menuTree || menuTree.length === 0) && !menuTreeLoading) {
            console.log('🎯 AuthProvider: 메뉴 트리 로드 시작...', userInfo.role)
            setTimeout(() => {
              console.log('🚀 AuthProvider: 메뉴 트리 로드 실행...', userInfo.role)
              dispatch(loadMenuTree(userInfo.role))
            }, 200) // Redux 상태 업데이트 후 메뉴 로드
          } else {
            console.log('ℹ️ 메뉴 로드 스킵:', {
              hasRole: !!userInfo.role,
              menuTreeLength: menuTree?.length || 0,
              isLoading: menuTreeLoading
            })
          }
        } catch (error) {
          console.error('❌ 사용자 정보 조회 실패:', error)
          dispatch(restoreUserFailure())
        }
      } else if (!token && isAuthenticated) {
        // 토큰이 없는데 인증된 상태인 경우 로그아웃 처리
        console.log('🚪 토큰이 없어 로그아웃 처리')
        dispatch(restoreUserFailure())
      } else if (token && isAuthenticated && !user) {
        // 토큰과 인증 상태는 있지만 사용자 정보가 없는 경우
        console.log('🔄 사용자 정보 재조회...')
        try {
          const userInfo = await authService.getCurrentUser()
          dispatch(restoreUserSuccess(userInfo))
          console.log('✅ 사용자 정보 재조회 완료:', userInfo.name, 'role:', userInfo.role)

          // 사용자 정보 재조회 후 메뉴 로드 (중복 로드 방지)
          if (userInfo.role && (!menuTree || menuTree.length === 0) && !menuTreeLoading) {
            console.log('🎯 AuthProvider: 메뉴 트리 재로드 시작...', userInfo.role)
            setTimeout(() => {
              console.log('🚀 AuthProvider: 메뉴 트리 재로드 실행...', userInfo.role)
              dispatch(loadMenuTree(userInfo.role))
            }, 200) // Redux 상태 업데이트 후 메뉴 로드
          } else {
            console.log('ℹ️ 메뉴 재로드 스킵:', {
              hasRole: !!userInfo.role,
              menuTreeLength: menuTree?.length || 0,
              isLoading: menuTreeLoading
            })
          }
        } catch (error: any) {
          // 401 에러는 토큰 만료이므로 에러 로그 출력하지 않음
          if (error?.response?.status !== 401) {
            console.error('❌ 사용자 정보 재조회 실패:', error)
          } else {
            console.log('🔒 토큰 만료됨 (401), 로그아웃 처리')
          }
          dispatch(restoreUserFailure())
        }
      } else {
        console.log('ℹ️ AuthProvider: 초기화 조건에 맞지 않음 - 이미 초기화됨')
      }

      setIsInitialized(true)
      console.log('인증 초기화 완료')
    }

    initializeAuth()
  }, [dispatch]) // 의존성을 dispatch만으로 제한하여 무한 반복 방지

  // 초기화가 완료되지 않았으면 로딩 표시
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  return <>{children}</>
}

export default AuthProvider