/**
 * 페이지 요약 — 회원가입 (`/register`)
 *
 * 기능: 일반 사용자 계정 생성 폼(필수 필드·비밀번호 확인).
 *
 * 호출/연동:
 * - `authService.register` → `POST /auth/register` (`services/auth.service.ts`).
 *
 * 관련 컴포넌트: shadcn `Card`/`Input`/`Button`/`Alert`.
 *
 * 흐름: 검증 → 등록 API → 성공 시 `/login`으로 이동(메시지 state).
 */

import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authService, RegisterRequest } from '../../services/auth.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import {
  User,
  Mail,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft
} from 'lucide-react'

export const Register: React.FC = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    userid: '',
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (error) setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.userid || !formData.name || !formData.password) {
      setError('필수 항목을 입력해주세요.')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    setLoading(true)
    setError(null)

    const registerData: RegisterRequest = {
      userid: formData.userid.trim(),
      email: formData.email.trim() || null,
      name: formData.name.trim(),
      password: formData.password,
      role: 'user' as const,
      branchId: null
    }

    try {
      await authService.register(registerData)
      // 회원가입 성공 시 로그인 페이지로 이동 (성공 메시지는 로그인 페이지에서 처리하거나 여기서 알림)
      navigate('/login', { state: { message: '회원가입이 완료되었습니다. 로그인해주세요.' } })
    } catch (err: any) {
      setError(err.response?.data?.message || '회원가입에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen w-full overflow-y-auto bg-background font-sans">
      <div className="min-h-full flex flex-col items-center p-4 py-6">
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

          {/* 회원가입 폼 */}
          <Card className="w-full max-w-[420px] mx-auto shadow-md bg-card border-border animate-in slide-in-from-bottom-8 duration-500">
            <CardHeader className="h-20 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
              <div className="w-full flex flex-col items-center text-center">
                <CardTitle className="text-2xl font-bold text-foreground tracking-tight leading-none">
                  회원가입
                </CardTitle>
                <CardDescription className="mt-[10px] text-sm text-muted-foreground">
                  새로운 계정을 생성하세요
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
                      placeholder="아이디"
                      value={formData.userid}
                      onChange={(e) => handleInputChange('userid', e.target.value)}
                      disabled={loading}
                      required
                      className="pl-10 h-10 bg-card border-input focus-visible:ring-ring"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name" className="sr-only">이름</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      placeholder="이름"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      disabled={loading}
                      required
                      className="pl-10 h-10 bg-card border-input focus-visible:ring-ring"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="sr-only">이메일</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="이메일 (선택사항)"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
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
                      type="password"
                      placeholder="비밀번호"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      disabled={loading}
                      required
                      className="pl-10 h-10 bg-card border-input focus-visible:ring-ring"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="sr-only">비밀번호 확인</Label>
                  <div className="relative">
                    <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="비밀번호 확인"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      disabled={loading}
                      required
                      className="pl-10 h-10 bg-card border-input focus-visible:ring-ring"
                    />
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
                      가입 중...
                    </>
                  ) : (
                    '회원가입'
                  )}
                </Button>
              </form>

              <div className="text-center mt-6">
                <Link
                  to="/login"
                  className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  로그인 페이지로 돌아가기
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default Register
