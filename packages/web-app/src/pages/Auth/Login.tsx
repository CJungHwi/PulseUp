/**
 * 페이지 요약 — 로그인 (`/login`)
 *
 * 기능: 아이디/비밀번호 로그인, 세션 스토리지 토큰 저장, `from`·역할에 따른 이동.
 *
 * 호출/연동:
 * - `authService.login` → `services/auth.service.ts` 경유 API 로그인(예: `POST /auth/login`).
 *
 * 관련 컴포넌트: shadcn `Card`/`Input`/`Button`, Redux `loginSuccess`, 테마 토글.
 *
 * 흐름: 폼 검증 → 로그인 API → 스토어·세션 반영 → `navigate`.
 */

import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../../hooks/redux'
import { authService } from '../../services/auth.service'
import { loginSuccess } from '../../store/slices/authSlice'
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Sun,
  Moon
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'

export const Login: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useAppDispatch()
  const { isAuthenticated } = useAppSelector((state) => state.auth)
  const { user } = useAppSelector((state) => state.auth)
  const { mode, toggleTheme } = useTheme()

  // 이미 로그인된 경우 역할에 따라 리다이렉트 (단, from 경로가 있으면 그쪽으로)
  useEffect(() => {
    if (isAuthenticated && user) {
      const locationState = location.state as { from?: { pathname: string } } | null
      const from = locationState?.from?.pathname

      // from 경로가 있으면 그쪽으로, 없으면 역할에 따라 리다이렉트
      if (from && from !== '/login') {
        navigate(from, { replace: true })
      } else if (user.role === 'admin') {
        navigate('/admin/dashboard', { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
    }
  }, [isAuthenticated, user, navigate, location])

  const [formData, setFormData] = useState({
    userid: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (error) setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.userid || !formData.password) {
      setError('아이디와 비밀번호를 입력해주세요.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      console.log('로그인 요청 시작:', { userid: formData.userid })
      const response = await authService.login(formData.userid, formData.password)
      console.log('로그인 응답:', response)

      // Redux 스토어에 사용자 정보 저장
      console.log('✅ 로그인 API 응답 받음:', response)

      dispatch(loginSuccess({
        user: response.user,
        token: response.accessToken
      }))

      // 세션 스토리지에 토큰 저장 (브라우저 닫으면 자동 만료)
      sessionStorage.setItem('token', response.accessToken)
      sessionStorage.setItem('accessToken', response.accessToken)
      sessionStorage.setItem('refreshToken', response.refreshToken)

      // 역할에 따른 리다이렉트
      const locationState = location.state as { from?: { pathname: string } } | null
      const redirectPath = locationState?.from?.pathname || '/home'
      console.log('로그인 후 리다이렉트:', redirectPath)
      navigate(redirectPath, { replace: true })

      console.log('✅ 로그인 처리 완료')
    } catch (err: any) {
      console.error('로그인 에러:', err)

      // 에러 메시지 처리 로직 유지
      if (err.response?.status === 502) {
        setError('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.')
      } else if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK') {
        setError('서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.')
      } else if (err.response?.status === 500) {
        setError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
      } else if (err.response?.status === 401) {
        setError(err.response?.data?.error || err.response?.data?.message || '아이디 또는 비밀번호가 올바르지 않습니다.')
      } else if (err.response?.status === 403) {
        setError(err.response?.data?.error || err.response?.data?.message || '관리자 승인 후 로그인 가능합니다.')
      } else if (err.response?.data?.error) {
        const errorMsg = err.response.data.error
        if (errorMsg && errorMsg.length > 2 && errorMsg !== 'qt') {
          setError(errorMsg)
        } else {
          setError('로그인에 실패했습니다. 다시 시도해주세요.')
        }
      } else if (err.response?.data?.message) {
        setError(err.response.data.message)
      } else if (err.message) {
        setError(err.message)
      } else {
        setError('로그인에 실패했습니다. 다시 시도해주세요.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen w-full overflow-y-auto bg-background font-sans relative">
      <div className="min-h-full flex flex-col items-center p-4 py-6">
        {/* 테마 토글 버튼 */}
        <div className="absolute top-4 right-4 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full w-10 h-10"
          >
            {mode === 'dark' ? (
              <Sun className="h-5 w-5 text-yellow-400" />
            ) : (
              <Moon className="h-5 w-5 text-slate-700" />
            )}
            <span className="sr-only">테마 전환</span>
          </Button>
        </div>

        <div className="w-full max-w-sm my-auto">
          {/* 브랜드 영역 */}
          <div className="text-center mb-8 animate-in fade-in duration-700">
            <div className="flex justify-center items-center mb-3 bg-background rounded-lg p-2">
              <img
                src="/logo.png"
                alt="LINKHIIT"
                className="max-w-[200px] h-auto block"
              />
            </div>

            <h1 className="text-lg text-primary font-bold tracking-widest m-0 font-brand">
              MULTI-MONITOR WORKOUT SYSTEM
            </h1>
          </div>

          {/* 로그인 폼 */}
          <Card className="w-full max-w-[420px] mx-auto shadow-md bg-card border-border animate-in slide-in-from-bottom-8 duration-500">
            <CardHeader className="h-20 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
              <div className="w-full flex flex-col items-center text-center">
                <CardTitle className="text-2xl font-bold text-foreground tracking-tight leading-none">
                  로그인
                </CardTitle>
                <CardDescription className="mt-[10px] text-sm text-muted-foreground">
                  계정에 로그인하여 시작하세요
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-4">
              {error && (
                <Alert variant="destructive" className="mb-6">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label htmlFor="userid" className="sr-only">아이디</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="userid"
                      placeholder="아이디를 입력하세요"
                      value={formData.userid}
                      onChange={(e) => handleInputChange('userid', e.target.value)}
                      disabled={loading}
                      required
                      autoComplete="username"
                      className="pl-10 h-10 bg-card border-input focus-visible:ring-ring"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="sr-only">비밀번호</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="비밀번호를 입력하세요"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      disabled={loading}
                      required
                      autoComplete="current-password"
                      className="pl-10 pr-10 h-10 bg-card border-input focus-visible:ring-ring"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-10 w-10 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      <span className="sr-only">비밀번호 보기/숨기기</span>
                    </Button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-10 text-base font-semibold mt-2 shadow-lg hover:shadow-xl transition-all"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      로그인 중...
                    </>
                  ) : (
                    '로그인'
                  )}
                </Button>
              </form>

              <div className="text-center mt-6">
                <p className="text-sm text-muted-foreground">
                  계정이 없으신가요?{' '}
                  <Link
                    to="/register"
                    className="text-primary font-medium hover:underline underline-offset-4"
                  >
                    회원가입
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
