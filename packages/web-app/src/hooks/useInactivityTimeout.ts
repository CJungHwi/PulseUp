import { useEffect, useRef, useCallback } from 'react'
import { useAppDispatch } from './redux'
import { logout } from '../store/slices/authSlice'
import { authService } from '../services/auth.service'

const INACTIVITY_TIMEOUT = 90 * 60 * 1000 // 90분 (밀리초)

/**
 * 90분 비활성 타임아웃 훅
 * 사용자가 90분 동안 아무 동작을 하지 않으면 자동으로 로그아웃하고 로그인 페이지로 이동
 */
export const useInactivityTimeout = () => {
  const dispatch = useAppDispatch()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  const resetTimeout = useCallback(() => {
    // 기존 타임아웃 제거
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // 마지막 활동 시간 업데이트
    lastActivityRef.current = Date.now()

    // 새 타임아웃 설정
    timeoutRef.current = setTimeout(() => {
      console.log('⏰ 90분 비활성 타임아웃 - 자동 로그아웃')
      
      // 로그아웃 처리
      try {
        authService.logout()
      } catch (error) {
        console.error('로그아웃 요청 실패:', error)
      }
      
      // Redux 상태 초기화
      dispatch(logout())
      
      // 로그인 페이지로 이동 (useNavigate 대신 window.location 사용)
      window.location.href = '/login'
    }, INACTIVITY_TIMEOUT)
  }, [dispatch])

  useEffect(() => {
    // 사용자 활동 이벤트 리스너
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    const handleActivity = () => {
      resetTimeout()
    }

    // 이벤트 리스너 등록
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true)
    })

    // 초기 타임아웃 설정
    resetTimeout()

    // cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true)
      })
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [resetTimeout])
}

