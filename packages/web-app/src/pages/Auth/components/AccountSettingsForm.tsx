/**
 * AccountSettingsForm — 계정 설정 폼
 *
 * 기능: 이름/이메일/비밀번호 변경 입력과 현재 사용자 요약을 렌더링한다.
 *
 * 사용처: `AccountSettings.tsx`
 */
import React from 'react'
import { Loader2, Lock, Mail, Save, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface AccountSettingsFormState {
  name: string
  email: string
  password: string
  confirmPassword: string
}

interface AccountSettingsUser {
  userid: string
  role?: string
}

interface AccountSettingsFormProps {
  formData: AccountSettingsFormState
  user: AccountSettingsUser
  isLoading: boolean
  onFieldChange: (field: keyof AccountSettingsFormState, value: string) => void
  onSubmit: (event: React.FormEvent) => void
}

const getRoleLabel = (role?: string) => {
  if (role === 'super_admin') return '슈퍼관리자'
  if (role === 'branch_admin') return '지점관리자'
  return '일반 사용자'
}

export const AccountSettingsForm: React.FC<AccountSettingsFormProps> = ({
  formData,
  user,
  isLoading,
  onFieldChange,
  onSubmit,
}) => (
  <Card className="w-full max-w-md shadow-lg border-border bg-card">
    <CardHeader className="space-y-1">
      <CardTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
        <User className="size-6 text-primary" />
        계정 설정
      </CardTitle>
      <CardDescription className="text-center">
        나의 기본 정보 및 비밀번호를 관리합니다.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium">이름</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="name"
              placeholder="이름을 입력하세요"
              required
              value={formData.name}
              onChange={(event) => onFieldChange('name', event.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">이메일</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="이메일을 입력하세요"
              required
              value={formData.email}
              onChange={(event) => onFieldChange('email', event.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-border/50">
          <Label htmlFor="password" className="text-sm font-medium">
            새 비밀번호 (변경시에만 입력)
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              placeholder="새 비밀번호"
              value={formData.password}
              onChange={(event) => onFieldChange('password', event.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-sm font-medium">비밀번호 확인</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="confirmPassword"
              type="password"
              placeholder="비밀번호 확인"
              value={formData.confirmPassword}
              onChange={(event) => onFieldChange('confirmPassword', event.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Button type="submit" className="w-full mt-6" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              처리 중...
            </>
          ) : (
            <>
              <Save className="mr-2 size-4" />
              수정하기
            </>
          )}
        </Button>
      </form>
    </CardContent>
    <CardFooter>
      <div className="w-full text-center text-xs text-muted-foreground">
        아이디: <span className="font-semibold">{user.userid}</span> | 역할:{' '}
        <span className="font-semibold">{getRoleLabel(user.role)}</span>
      </div>
    </CardFooter>
  </Card>
)
