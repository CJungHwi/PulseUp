/**
 * 페이지 요약 — 로그인 (`/login`)
 *
 * 기능: 아이디/비밀번호 로그인, 세션 스토리지 토큰 저장, `from`·역할에 따른 이동.
 *
 * 호출/연동:
 * - `authService.login` → `services/auth.service.ts` 경유 API 로그인(예: `POST /auth/login`).
 *
 * 관련 컴포넌트(`./components/`):
 * - `AuthPageShell`: 인증 화면 공통 레이아웃/브랜드 영역
 * - `ThemeToggleButton`: 테마 전환 버튼
 * - `LoginForm`: 로그인 입력 폼
 *
 * 흐름: 폼 검증 → 로그인 API → 스토어·세션 반영 → `navigate`.
 */

import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '../../contexts/ThemeContext'
import { useAppDispatch, useAppSelector } from '../../hooks/redux'
import { authService } from '../../services/auth.service'
import { loginSuccess } from '../../store/slices/authSlice'
import { resolvePostLoginPath } from '../../utils/roleDefaultRoutes'
import { AuthPageShell } from './components/AuthPageShell'
import { LoginForm, type LoginFormState } from './components/LoginForm'
import { ThemeToggleButton } from './components/ThemeToggleButton'

const createInitialLoginForm = (): LoginFormState => ({
  userid: '',
  password: '',
})

const getLoginErrorMessage = (error: any) => {
  if (error.response?.status === 502) {
    return '서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.'
  }
  if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
    return '서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.'
  }
  if (error.response?.status === 500) {
    return '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
  }
  if (error.response?.status === 401) {
    return error.response?.data?.error || error.response?.data?.message || '아이디 또는 비밀번호가 올바르지 않습니다.'
  }
  if (error.response?.status === 403) {
    return error.response?.data?.error || error.response?.data?.message || '관리자 승인 후 로그인 가능합니다.'
  }
  if (error.response?.data?.error) {
    const errorMessage = error.response.data.error
    return errorMessage && errorMessage.length > 2 && errorMessage !== 'qt'
      ? errorMessage
      : '로그인에 실패했습니다. 다시 시도해주세요.'
  }
  if (error.response?.data?.message) {
    return error.response.data.message
  }
  return error.message || '로그인에 실패했습니다. 다시 시도해주세요.'
}

export const Login: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useAppDispatch()
  const { isAuthenticated, user } = useAppSelector((state) => state.auth)
  const { mode, toggleTheme } = useTheme()
  const locationState = location.state as { from?: { pathname: string } } | null
  const fromPath = locationState?.from?.pathname

  const [formData, setFormData] = useState<LoginFormState>(createInitialLoginForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || !user) return

    navigate(resolvePostLoginPath(user.role, fromPath), { replace: true })
  }, [isAuthenticated, user, navigate, fromPath])

  const handleLoginFieldChange = (field: keyof LoginFormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (error) setError(null)
  }

  const handleTogglePassword = () => {
    setShowPassword((prev) => !prev)
  }

  const handleLoginSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!formData.userid || !formData.password) {
      setError('아이디와 비밀번호를 입력해주세요.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await authService.login(formData.userid, formData.password)

      dispatch(loginSuccess({
        user: response.user,
        token: response.accessToken,
      }))

      sessionStorage.setItem('token', response.accessToken)
      sessionStorage.setItem('accessToken', response.accessToken)
      sessionStorage.setItem('refreshToken', response.refreshToken)

      navigate(resolvePostLoginPath(response.user.role, fromPath), { replace: true })
    } catch (loginError: any) {
      console.error('로그인 에러:', loginError)
      setError(getLoginErrorMessage(loginError))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell topRightAction={<ThemeToggleButton mode={mode} onToggle={toggleTheme} />}>
      <LoginForm
        formData={formData}
        error={error}
        loading={loading}
        showPassword={showPassword}
        onInputChange={handleLoginFieldChange}
        onTogglePassword={handleTogglePassword}
        onSubmit={handleLoginSubmit}
      />
    </AuthPageShell>
  )
}
