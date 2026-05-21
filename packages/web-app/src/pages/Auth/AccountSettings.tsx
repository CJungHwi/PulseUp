/**
 * 페이지 요약 — 계정 설정 (`/settings`)
 *
 * 기능: 이름·이메일·선택 비밀번호 변경, Redux 사용자 정보 동기화.
 *
 * 호출/연동:
 * - `authService.updateProfile` → 프로필 수정 API(`services/auth.service.ts`).
 *
 * 관련 컴포넌트: shadcn `Card`/`Input`, `useSnackbar`, Redux `updateUser`.
 *
 * 흐름: `user`로 폼 초기화 → 저장 → 스토어 갱신·토스트 → 비밀번호 필드 초기화.
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppSelector, useAppDispatch } from '../../hooks/redux'
import { authService } from '../../services/auth.service'
import { updateUser as updateUserAction } from '../../store/slices/authSlice'
import { useSnackbar } from '../../contexts/SnackbarContext'
import { User, Mail, Lock, Save, Loader2 } from 'lucide-react'

const AccountSettings: React.FC = () => {
    const dispatch = useAppDispatch()
    const { user } = useAppSelector((state) => state.auth)
    const { showSnackbar } = useSnackbar()

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
    })
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (user) {
            setFormData((prev) => ({
                ...prev,
                name: user.name || '',
                email: user.email || '',
            }))
        }
    }, [user])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setFormData((prev) => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (formData.password && formData.password !== formData.confirmPassword) {
            showSnackbar({ message: '비밀번호가 일치하지 않습니다.', severity: 'error' })
            return
        }

        setIsLoading(true)
        try {
            const updateData: any = {
                name: formData.name,
                email: formData.email,
            }

            if (formData.password) {
                updateData.password = formData.password
            }

            const updatedUser = await authService.updateProfile(updateData)

            // 사용자 정보가 User 타입 형식을 맞추도록 보장
            const formattedUser = {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role as any,
                branchId: updatedUser.branchId,
                branchName: updatedUser.branchName
            }

            dispatch(updateUserAction(formattedUser))
            showSnackbar({ message: '계정 정보가 성공적으로 업데이트되었습니다.', severity: 'success' })

            // 비밀번호 필드 초기화
            setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }))
        } catch (error: any) {
            console.error('Update profile error:', error)
            showSnackbar({ message: error.response?.data?.error || '정보 업데이트 중 오류가 발생했습니다.', severity: 'error' })
        } finally {
            setIsLoading(false)
        }
    }

    if (!user) return null

    return (
        <div className="flex items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-lg border-border bg-card">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
                        <User className="w-6 h-6 text-primary" />
                        계정 설정
                    </CardTitle>
                    <CardDescription className="text-center">
                        나의 기본 정보 및 비밀번호를 관리합니다.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-sm font-medium">이름</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="name"
                                    name="name"
                                    placeholder="이름을 입력하세요"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-medium">이메일</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="이메일을 입력하세요"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-border/50">
                            <Label htmlFor="password" className="text-sm font-medium">새 비밀번호 (변경시에만 입력)</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    placeholder="새 비밀번호"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="text-sm font-medium">비밀번호 확인</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    placeholder="비밀번호 확인"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full mt-6"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    처리 중...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    수정하기
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter>
                    <div className="w-full text-center text-xs text-muted-foreground">
                        아이디: <span className="font-semibold">{user.userid}</span> | 역할: <span className="font-semibold">{user.role === 'admin' ? '관리자' : '일반 사용자'}</span>
                    </div>
                </CardFooter>
            </Card >
        </div >
    )
}

export default AccountSettings
