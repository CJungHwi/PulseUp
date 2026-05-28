/**
 * BranchEditForm — 지점 등록/수정 폼 카드
 *
 * 기능: 지점명/지역/전화/주소/담당자 입력, 취소/저장 액션
 *
 * Props:
 * - formData, isEditing, isNewRow, loading
 * - onChange(field, value), onCancel, onSave
 *
 * 사용처: `Branch.tsx`
 */
import React from 'react'
import { Edit, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CreateBranchRequest } from '@/types/branch'

interface BranchEditFormProps {
  formData: CreateBranchRequest
  isEditing: boolean
  isNewRow: boolean
  loading: boolean
  onChange: (field: keyof CreateBranchRequest, value: string) => void
  onCancel: () => void
  onSave: () => void
}

export const BranchEditForm: React.FC<BranchEditFormProps> = ({
  formData,
  isEditing,
  isNewRow,
  loading,
  onChange,
  onCancel,
  onSave,
}) => {
  const disabled = !isEditing && !isNewRow
  const saveDisabled =
    loading ||
    !formData.name.trim() ||
    !formData.region.trim() ||
    (!isNewRow && !isEditing)

  return (
    <Card className="h-full flex flex-col bg-card shadow-md overflow-hidden">
      <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
          <Edit className="h-5 w-5 text-blue-500" />
          지점 {isNewRow ? '등록' : isEditing ? '수정' : '정보'}
        </CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={!isEditing && !isNewRow}
            className="h-9"
          >
            <X className="h-4 w-4 mr-2" />
            취소
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onSave}
            disabled={saveDisabled}
            className="h-9"
          >
            <Save className="h-4 w-4 mr-2" />
            {isNewRow ? '등록' : '저장'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-auto scrollbar-hide p-4">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">지점명 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => onChange('name', e.target.value)}
                disabled={disabled}
                placeholder="지점명 입력"
                className="h-10 bg-card"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">지점지역 *</Label>
              <Input
                id="region"
                value={formData.region}
                onChange={(e) => onChange('region', e.target.value)}
                disabled={disabled}
                placeholder="지역 입력"
                className="h-10 bg-card"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">전화번호</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => onChange('phone', e.target.value)}
                disabled={disabled}
                placeholder="전화번호 입력"
                className="h-10 bg-card"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="address">주소</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => onChange('address', e.target.value)}
                disabled={disabled}
                placeholder="주소 입력"
                className="h-10 bg-card"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manager">담당자</Label>
              <Input
                id="manager"
                value={formData.manager}
                onChange={(e) => onChange('manager', e.target.value)}
                disabled={disabled}
                placeholder="담당자 입력"
                className="h-10 bg-card"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
