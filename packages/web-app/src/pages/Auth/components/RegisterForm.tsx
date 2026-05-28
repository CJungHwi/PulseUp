/**
 * RegisterForm — 회원가입 입력 폼
 *
 * 기능: 아이디 중복확인, 지점 선택, 기본 사용자 정보/비밀번호 입력 UI를 렌더링한다.
 *
 * 사용처: `Register.tsx`
 */
import React from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Building2, CheckCircle2, Loader2, Lock, Mail, User } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Branch } from '@/types/branch'

export interface RegisterFormState {
  userid: string
  name: string
  email: string
  branchId: string
  password: string
  confirmPassword: string
}

interface RegisterFormProps {
  formData: RegisterFormState
  branches: Branch[]
  error: string | null
  loading: boolean
  branchesLoading: boolean
  checkingUserId: boolean
  checkedUserId: string
  isUserIdAvailable: boolean | null
  onInputChange: (field: keyof RegisterFormState, value: string) => void
  onCheckDuplicate: () => void
  onSubmit: (event: React.FormEvent) => void
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  formData,
  branches,
  error,
  loading,
  branchesLoading,
  checkingUserId,
  checkedUserId,
  isUserIdAvailable,
  onInputChange,
  onCheckDuplicate,
  onSubmit,
}) => {
  const canSubmit = isUserIdAvailable === true && checkedUserId === formData.userid.trim()

  return (
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
            <div className="flex gap-2">
              <div className="relative flex-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="userid"
                  placeholder="아이디"
                  value={formData.userid}
                  onChange={(event) => onInputChange('userid', event.target.value)}
                  disabled={loading}
                  required
                  className="pl-10 h-10 bg-card border-input focus-visible:ring-ring"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-10 shrink-0"
                onClick={onCheckDuplicate}
                disabled={loading || checkingUserId || !formData.userid.trim()}
              >
                {checkingUserId ? <Loader2 className="size-4 animate-spin" /> : '중복확인'}
              </Button>
            </div>
            {isUserIdAvailable === true && checkedUserId === formData.userid.trim() ? (
              <p className="text-xs text-green-600">사용 가능한 아이디입니다.</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="sr-only">이름</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="name"
                placeholder="이름"
                value={formData.name}
                onChange={(event) => onInputChange('name', event.target.value)}
                disabled={loading}
                required
                className="pl-10 h-10 bg-card border-input focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="sr-only">이메일</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="이메일 (선택사항)"
                value={formData.email}
                onChange={(event) => onInputChange('email', event.target.value)}
                className="pl-10 h-10 bg-card border-input focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="branch" className="sr-only">지점</Label>
            <Select
              value={formData.branchId}
              onValueChange={(value) => onInputChange('branchId', value)}
              disabled={loading || branchesLoading}
            >
              <SelectTrigger id="branch" className="h-10 bg-card border-input">
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-muted-foreground" />
                  <SelectValue placeholder={branchesLoading ? '지점 불러오는 중...' : '가입할 지점 선택'} />
                </div>
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={String(branch.id)}>
                    {branch.name} ({branch.region})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              * 지점관리자는 지점선택하지 말고 가입
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="sr-only">비밀번호</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="비밀번호"
                value={formData.password}
                onChange={(event) => onInputChange('password', event.target.value)}
                disabled={loading}
                required
                className="pl-10 h-10 bg-card border-input focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="sr-only">비밀번호 확인</Label>
            <div className="relative">
              <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type="password"
                placeholder="비밀번호 확인"
                value={formData.confirmPassword}
                onChange={(event) => onInputChange('confirmPassword', event.target.value)}
                disabled={loading}
                required
                className="pl-10 h-10 bg-card border-input focus-visible:ring-ring"
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-10 text-base font-semibold mt-2 shadow-lg hover:shadow-xl transition-all"
            disabled={loading || !canSubmit}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
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
            <ArrowLeft className="mr-2 size-4" />
            로그인 페이지로 돌아가기
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
