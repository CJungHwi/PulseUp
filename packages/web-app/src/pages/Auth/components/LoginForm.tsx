/**
 * LoginForm — 로그인 입력 폼
 *
 * 기능: 아이디/비밀번호 입력, 비밀번호 표시 토글, 오류 메시지, 회원가입 링크를 렌더링한다.
 *
 * 사용처: `Login.tsx`
 */
import React from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, Loader2, Lock, User } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface LoginFormState {
  userid: string
  password: string
}

interface LoginFormProps {
  formData: LoginFormState
  error: string | null
  loading: boolean
  showPassword: boolean
  onInputChange: (field: keyof LoginFormState, value: string) => void
  onTogglePassword: () => void
  onSubmit: (event: React.FormEvent) => void
}

export const LoginForm: React.FC<LoginFormProps> = ({
  formData,
  error,
  loading,
  showPassword,
  onInputChange,
  onTogglePassword,
  onSubmit,
}) => (
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
      {error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="size-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="userid" className="sr-only">아이디</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="userid"
              placeholder="아이디를 입력하세요"
              value={formData.userid}
              onChange={(event) => onInputChange('userid', event.target.value)}
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
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="비밀번호를 입력하세요"
              value={formData.password}
              onChange={(event) => onInputChange('password', event.target.value)}
              disabled={loading}
              required
              autoComplete="current-password"
              className="pl-10 pr-10 h-10 bg-card border-input focus-visible:ring-ring"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 size-10 text-muted-foreground hover:text-foreground"
              onClick={onTogglePassword}
              aria-label="비밀번호 보기/숨기기"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
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
              <Loader2 className="mr-2 size-4 animate-spin" />
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
          <Link to="/register" className="text-primary font-medium hover:underline underline-offset-4">
            회원가입
          </Link>
        </p>
      </div>
    </CardContent>
  </Card>
)
