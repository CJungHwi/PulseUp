/**
 * 페이지 요약 — 계정 설정 (`/settings`)
 *
 * 기능: 이름·이메일·선택 비밀번호 변경, Redux 사용자 정보 동기화.
 *
 * 호출/연동:
 * - `authService.updateProfile` → 프로필 수정 API(`services/auth.service.ts`).
 *
 * 관련 컴포넌트(`./components/`):
 * - `AccountSettingsForm`: 계정 정보/비밀번호 변경 폼과 사용자 요약 표시.
 *
 * 흐름: `user`로 폼 초기화 → 저장 → 스토어 갱신·토스트 → 비밀번호 필드 초기화.
 */

import React, { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../hooks/redux'
import { authService } from '../../services/auth.service'
import { updateUser as updateUserAction } from '../../store/slices/authSlice'
import { useSnackbar } from '../../contexts/SnackbarContext'
import {
  AccountSettingsForm,
  type AccountSettingsFormState,
} from './components/AccountSettingsForm'

const createInitialFormData = (): AccountSettingsFormState => ({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
})

type ProfileUpdatePayload = {
  name: string
  email: string
  password?: string
}

const AccountSettings: React.FC = () => {
  const dispatch = useAppDispatch()
  const { user } = useAppSelector((state) => state.auth)
  const { showSnackbar } = useSnackbar()

  const [formData, setFormData] = useState<AccountSettingsFormState>(createInitialFormData)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!user) return

    setFormData((prev) => ({
      ...prev,
      name: user.name || '',
      email: user.email || '',
    }))
  }, [user])

  const handleAccountFieldChange = (field: keyof AccountSettingsFormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleAccountSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (formData.password && formData.password !== formData.confirmPassword) {
      showSnackbar({ message: '비밀번호가 일치하지 않습니다.', severity: 'error' })
      return
    }

    setIsLoading(true)
    try {
      const updateData: ProfileUpdatePayload = {
        name: formData.name,
        email: formData.email,
      }

      if (formData.password) {
        updateData.password = formData.password
      }

      const updatedUser = await authService.updateProfile(updateData)

      dispatch(updateUserAction({
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        branchId: updatedUser.branchId,
        branchName: updatedUser.branchName,
      }))
      showSnackbar({ message: '계정 정보가 성공적으로 업데이트되었습니다.', severity: 'success' })
      setFormData((prev) => ({ ...prev, password: '', confirmPassword: '' }))
    } catch (error: any) {
      console.error('Update profile error:', error)
      showSnackbar({
        message: error.response?.data?.error || '정보 업데이트 중 오류가 발생했습니다.',
        severity: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) return null

  return (
    <div className="flex items-center justify-center p-4">
      <AccountSettingsForm
        formData={formData}
        user={{ userid: user.userid, role: user.role }}
        isLoading={isLoading}
        onFieldChange={handleAccountFieldChange}
        onSubmit={handleAccountSubmit}
      />
    </div>
  )
}

export default AccountSettings
