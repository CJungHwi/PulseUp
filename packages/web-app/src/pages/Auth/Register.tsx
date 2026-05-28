/**
 * 페이지 요약 — 회원가입 (`/register`)
 *
 * 기능: 지점 선택 여부에 따른 가입 유형 결정, 아이디 중복확인, 계정 생성 폼.
 *
 * 호출/연동:
 * - `authService.register` → `POST /auth/register` (`services/auth.service.ts`).
 * - `branchApi.getBranches` → 가입 지점 목록 조회.
 *
 * 관련 컴포넌트(`./components/`):
 * - `AuthPageShell`: 인증 화면 공통 레이아웃/브랜드 영역
 * - `RegisterForm`: 회원가입 입력 폼
 *
 * 흐름: 지점 조회 → 검증 → 지점 미선택 시 지점관리자 가입 확인 → 등록 API → 성공 시 `/login`으로 이동.
 */

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService, RegisterRequest } from '../../services/auth.service'
import { branchApi } from '../../services/branchApi'
import type { Branch } from '../../types/branch'
import { AuthPageShell } from './components/AuthPageShell'
import { RegisterForm, type RegisterFormState } from './components/RegisterForm'

const createInitialRegisterForm = (): RegisterFormState => ({
  userid: '',
  name: '',
  email: '',
  branchId: '',
  password: '',
  confirmPassword: '',
})

export const Register: React.FC = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState<RegisterFormState>(createInitialRegisterForm)
  const [loading, setLoading] = useState(false)
  const [checkingUserId, setCheckingUserId] = useState(false)
  const [checkedUserId, setCheckedUserId] = useState('')
  const [isUserIdAvailable, setIsUserIdAvailable] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchesLoading, setBranchesLoading] = useState(true)

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const response = await branchApi.getBranches()
        setBranches(response.data?.items || [])
      } catch {
        setBranches([])
        setError('지점 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
      } finally {
        setBranchesLoading(false)
      }
    }

    loadBranches()
  }, [])

  const handleRegisterFieldChange = (field: keyof RegisterFormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))

    if (field === 'userid') {
      setCheckedUserId('')
      setIsUserIdAvailable(null)
    }
    if (error) setError(null)
  }

  const handleCheckUserIdDuplicate = async () => {
    const userid = formData.userid.trim()
    if (userid.length < 6) {
      setError('아이디는 최소 6자 이상이어야 합니다.')
      return
    }

    try {
      setCheckingUserId(true)
      setError(null)
      const exists = await authService.checkUserIdDuplicate(userid)
      setCheckedUserId(userid)
      setIsUserIdAvailable(!exists)

      if (exists) {
        setError('이미 사용 중인 아이디입니다.')
        setFormData((prev) => ({ ...prev, userid: '' }))
        setCheckedUserId('')
        setIsUserIdAvailable(null)
      }
    } catch {
      setError('아이디 중복 확인에 실패했습니다.')
      setCheckedUserId('')
      setIsUserIdAvailable(null)
    } finally {
      setCheckingUserId(false)
    }
  }

  const getMissingRequiredMessage = () => {
    if (!formData.userid.trim()) return '아이디를 입력해주세요.'
    if (checkedUserId !== formData.userid.trim() || isUserIdAvailable !== true) {
      return '아이디 중복 확인을 완료해주세요.'
    }
    if (!formData.name.trim()) return '이름을 입력해주세요.'
    if (!formData.password) return '비밀번호를 입력해주세요.'
    if (!formData.confirmPassword) return '비밀번호 확인을 입력해주세요.'
    return null
  }

  const handleRegisterSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const missingMessage = getMissingRequiredMessage()
    if (missingMessage) {
      setError(missingMessage)
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    if (!formData.branchId) {
      const confirmed = window.confirm('지점 선택 없이 가입하면 지점관리자 가입 신청으로 처리됩니다. 계속하시겠습니까?')
      if (!confirmed) return
    }

    setLoading(true)
    setError(null)

    const registerData: RegisterRequest = {
      userid: formData.userid.trim(),
      email: formData.email.trim() || null,
      name: formData.name.trim(),
      password: formData.password,
      branchId: formData.branchId || null,
    }

    try {
      await authService.register(registerData)
      navigate('/login', { state: { message: '가입 신청이 완료되었습니다. 관리자 승인 후 로그인해주세요.' } })
    } catch (registerError: any) {
      setError(registerError.response?.data?.message || '회원가입에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell logoMaxWidth="180px">
      <RegisterForm
        formData={formData}
        branches={branches}
        error={error}
        loading={loading}
        branchesLoading={branchesLoading}
        checkingUserId={checkingUserId}
        checkedUserId={checkedUserId}
        isUserIdAvailable={isUserIdAvailable}
        onInputChange={handleRegisterFieldChange}
        onCheckDuplicate={handleCheckUserIdDuplicate}
        onSubmit={handleRegisterSubmit}
      />
    </AuthPageShell>
  )
}

export default Register
