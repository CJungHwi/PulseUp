import React, { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { branchApi } from '../../services/branchApi'
import { adminService } from '../../services/admin.service'
import { Branch } from '../../types/branch'

interface AddUserModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export const AddUserModal: React.FC<AddUserModalProps> = ({ open, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    userid: '',
    name: '',
    email: '',
    role: 'user' as 'user' | 'admin' | 'super_admin',
    branchId: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchesLoading, setBranchesLoading] = useState(false)

  // 지점 목록 조회
  useEffect(() => {
    if (open) {
      fetchBranches()
    } else {
      // 모달이 닫힐 때 상태 초기화
      setBranches([])
      setError(null)
    }
  }, [open])

  const fetchBranches = async () => {
    try {
      setBranchesLoading(true)
      console.log('AddUserModal: 지점 목록 조회 시작')
      const response = await branchApi.getBranches()
      console.log('AddUserModal: API 응답:', response)

      if (response && response.data && response.data.items) {
        console.log('AddUserModal: 지점 데이터:', response.data.items)
        setBranches(response.data.items)
      } else {
        console.log('AddUserModal: 지점 데이터가 없거나 형식이 잘못됨')
        setBranches([])
      }
    } catch (error) {
      console.error('AddUserModal: 지점 목록 조회 실패:', error)
      setBranches([]) // 오류 시 빈 배열로 설정
    } finally {
      setBranchesLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    setError(null)
  }

  const validateForm = () => {
    if (!formData.userid.trim()) {
      setError('사용자 ID를 입력해주세요.')
      return false
    }

    if (!formData.name.trim()) {
      setError('이름을 입력해주세요.')
      return false
    }

    // 사용자 ID 형식 검증 (영문, 숫자, 특수문자 조합)
    const useridRegex = /^[a-zA-Z0-9._-]{3,20}$/
    if (!useridRegex.test(formData.userid)) {
      setError('사용자 ID는 3-20자의 영문, 숫자, ., _, - 만 사용 가능합니다.')
      return false
    }

    // 이메일 형식 검증 (선택사항)
    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email)) {
        setError('올바른 이메일 형식을 입력해주세요.')
        return false
      }
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setLoading(true)
    setError(null)

    const userData = {
      userid: formData.userid.trim(),
      email: formData.email.trim() || null,
      name: formData.name.trim(),
      role: formData.role,
      branchId: formData.branchId || null,
      isApproved: true // 승인된 사용자로 생성
    }

    try {
      await adminService.createUser(userData)
      onSuccess()
      handleClose()
    } catch (err: any) {
      console.error('사용자 생성 에러:', err)

      let errorMessage = '사용자 추가에 실패했습니다.'

      if (err.response?.data) {
        const errorData = err.response.data
        if (errorData.error) {
          errorMessage = errorData.error
        } else if (errorData.message) {
          errorMessage = errorData.message
        }
      } else if (err.message) {
        errorMessage = err.message
      }

      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      userid: '',
      name: '',
      email: '',
      role: 'user',
      branchId: ''
    })
    setError(null)
    setLoading(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">사용자 추가</DialogTitle>
          <DialogDescription>
            새로운 사용자 계정을 생성합니다. 필수 항목을 입력해주세요.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="userid">
              사용자 ID <span className="text-destructive">*</span>
            </Label>
            <Input
              id="userid"
              value={formData.userid}
              onChange={(e) => handleInputChange('userid', e.target.value)}
              placeholder="영문, 숫자, ., _, - 조합 (3-20자)"
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">
              이름 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="사용자 이름"
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">이메일 (선택사항)</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="user@example.com"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">
              역할 <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.role}
              onValueChange={(value) => handleInputChange('role', value)}
              disabled={loading}
            >
              <SelectTrigger id="role">
                <SelectValue placeholder="역할 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">일반 사용자</SelectItem>
                <SelectItem value="admin">관리자</SelectItem>
                <SelectItem value="super_admin">슈퍼 관리자</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="branch">지점 (선택사항)</Label>
            <Select
              value={formData.branchId}
              onValueChange={(value) => handleInputChange('branchId', value)}
              disabled={loading || branchesLoading}
            >
              <SelectTrigger id="branch">
                <SelectValue placeholder="지점 선택 안함" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">지점 선택 안함</SelectItem>
                {branches?.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name} ({branch.region})
                  </SelectItem>
                )) || []}
              </SelectContent>
            </Select>
          </div>

          <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
            <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm font-medium text-center">
              초기 비밀번호는 123456 입니다. 로그인 시 비밀번호를 변경하세요.
            </AlertDescription>
          </Alert>
        </form>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            취소
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                추가 중...
              </>
            ) : (
              '사용자 추가'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
