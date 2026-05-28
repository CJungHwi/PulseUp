/**
 * UserManagementEditForm — 우측 사용자 편집 폼
 *
 * 기능:
 * - 사용자 ID(읽기전용)/이름/이메일/역할/지점 편집
 * - 승인 / 사용중지 / 재사용 / 비밀번호 초기화 액션
 *
 * 사용처: `UserManagement.tsx`
 */
import React from 'react'
import {
  Ban,
  CheckCircle,
  Pencil,
  Play,
  Save,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { User } from '@/services/admin.service'
import { BranchSelect } from './BranchSelect'

export interface UserManagementFormState {
  userid: string
  email: string
  name: string
  role: 'user' | 'branch_admin' | 'super_admin'
  branchId: string
  is_approved: boolean
  used: boolean
}

interface UserManagementEditFormProps {
  selectedUser: User | undefined
  formData: UserManagementFormState
  isBranchAdmin: boolean
  onChange: (field: keyof UserManagementFormState, value: any) => void
  onSave: () => void
  onCancel: () => void
  onApprove: (userId: string) => void
  onToggleStatus: (userId: string, currentStatus: boolean) => void
  onResetPassword: () => void
}

export const UserManagementEditForm: React.FC<UserManagementEditFormProps> = ({
  selectedUser,
  formData,
  isBranchAdmin,
  onChange,
  onSave,
  onCancel,
  onApprove,
  onToggleStatus,
  onResetPassword,
}) => (
  <Card className="h-full flex flex-col shadow-md">
    <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
      <div className="flex items-center gap-2">
        <Pencil className="w-5 h-5" />
        <h3 className="text-lg font-medium">{selectedUser ? '사용자 편집' : '사용자 선택'}</h3>
      </div>
      {selectedUser && (
        <div className="flex gap-2">
          <Button size="sm" className="h-9" onClick={onSave}>
            <Save className="w-4 h-4 mr-2" /> 저장
          </Button>
          <Button variant="outline" size="sm" className="h-9" onClick={onCancel}>
            <X className="w-4 h-4 mr-2" /> 취소
          </Button>
        </div>
      )}
    </CardHeader>
    <CardContent className="flex-1 p-4 overflow-auto scrollbar-hide">
      {selectedUser ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">사용자 ID</Label>
            <Input value={formData.userid} readOnly className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">이름</Label>
            <Input
              value={formData.name}
              onChange={(e) => onChange('name', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">이메일</Label>
            <Input
              value={formData.email}
              onChange={(e) => onChange('email', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">역할</Label>
            <Select
              value={formData.role}
              onValueChange={(val) => onChange('role', val as UserManagementFormState['role'])}
              disabled={isBranchAdmin}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">일반 사용자</SelectItem>
                <SelectItem value="branch_admin">지점관리자</SelectItem>
                <SelectItem value="super_admin">슈퍼 관리자</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <BranchSelect
              value={formData.branchId}
              onChange={(val) => onChange('branchId', val === 'none' ? '' : val)}
              disabled={isBranchAdmin}
            />
          </div>

          <Separator className="my-4" />

          <div className="flex flex-col gap-2">
            <div className="flex gap-2 mt-2">
              {!selectedUser.isApproved ? (
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => onApprove(selectedUser.id)}
                >
                  <CheckCircle className="w-4 h-4 mr-2" /> 승인
                </Button>
              ) : selectedUser.isActive ? (
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => onToggleStatus(selectedUser.id, true)}
                >
                  <Ban className="w-4 h-4 mr-2" /> 사용중지
                </Button>
              ) : (
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={() => onToggleStatus(selectedUser.id, false)}
                >
                  <Play className="w-4 h-4 mr-2" /> 재사용
                </Button>
              )}
            </div>
            <Button
              variant="outline"
              className="mt-2 w-full text-muted-foreground hover:text-foreground"
              onClick={onResetPassword}
            >
              <ShieldCheck className="w-4 h-4 mr-2" /> 비밀번호 초기화
            </Button>
          </div>
        </div>
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
          <Users className="w-16 h-16 mb-4" />
          <p>좌측 목록에서 사용자를 선택해주세요</p>
        </div>
      )}
    </CardContent>
  </Card>
)
