/**
 * BranchSelect — 지점 선택 셀렉트 (UserManagement 편집 폼 전용)
 *
 * 기능: 마운트 시 `branchApi.getBranches`로 지점 목록 로드, 선택 시 `none` → 빈 문자열 처리
 *
 * 사용처: `UserManagementEditForm.tsx`
 */
import React, { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { branchApi } from '@/services/branchApi'

interface BranchOption {
  id: string
  name: string
  region: string
}

interface BranchSelectProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export const BranchSelect: React.FC<BranchSelectProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        setLoading(true)
        const response = await branchApi.getBranches()
        if (response.success) {
          const branchItems = response.data.items || []
          setBranches(
            branchItems.map((branch) => ({
              id: String((branch as any).id),
              name: branch.name,
              region: branch.region,
            }))
          )
        }
      } catch (error) {
        console.error('BranchSelect: 지점 목록 조회 실패:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBranches()
  }, [])

  const currentValue = value ? String(value) : 'none'

  return (
    <div className="w-full">
      <Label className="text-sm font-medium mb-1.5 block">소속 지점</Label>
      <Select value={currentValue} onValueChange={onChange} disabled={disabled || loading}>
        <SelectTrigger>
          {loading ? (
            <span className="text-muted-foreground">지점 불러오는 중...</span>
          ) : currentValue === 'none' ? (
            <span className="text-muted-foreground">지점 선택 안함</span>
          ) : (
            (() => {
              const selectedBranch = branches.find((branch) => branch.id === currentValue)
              if (!selectedBranch) return <span className="text-muted-foreground">지점 선택</span>
              return (
                <span>
                  {selectedBranch.name} ({selectedBranch.region})
                </span>
              )
            })()
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">지점 선택 안함</SelectItem>
          {branches.map((branch) => (
            <SelectItem key={branch.id} value={String(branch.id)}>
              {branch.name} ({branch.region})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
