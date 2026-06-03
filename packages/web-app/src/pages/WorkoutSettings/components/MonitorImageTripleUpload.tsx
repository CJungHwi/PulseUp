/**
 * MonitorImageTripleUpload — 좌/중/우 모니터 이미지 업로드·URL·미리보기 공통 UI
 */
import React, { type RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash2, Upload } from 'lucide-react'

export type MonitorSide = 'left' | 'center' | 'right'

export type MonitorImageTripleValues = {
  leftImageUrl: string
  centerImageUrl: string
  rightImageUrl: string
}

type SideUploadState = {
  isUploading: boolean
  isDeleting: boolean
}

export type MonitorImageTripleUploadProps = {
  values: MonitorImageTripleValues
  onChange: (side: MonitorSide, value: string) => void
  fileInputRefs: Record<MonitorSide, RefObject<HTMLInputElement | null>>
  onFileChange: (side: MonitorSide, file: File) => void
  onDelete: (side: MonitorSide) => void
  uploadState: Record<MonitorSide, SideUploadState>
  sideLabels?: Record<MonitorSide, string>
}

const DEFAULT_LABELS: Record<MonitorSide, string> = {
  left: '좌측',
  center: '중간',
  right: '우측'
}

export const MonitorImageTripleUpload: React.FC<MonitorImageTripleUploadProps> = ({
  values,
  onChange,
  fileInputRefs,
  onFileChange,
  onDelete,
  uploadState,
  sideLabels = DEFAULT_LABELS
}) => {
  const sides: MonitorSide[] = ['left', 'center', 'right']
  const valueKeys: Record<MonitorSide, keyof MonitorImageTripleValues> = {
    left: 'leftImageUrl',
    center: 'centerImageUrl',
    right: 'rightImageUrl'
  }

  return (
    <div className="space-y-4">
      {sides.map((side) => {
        const url = values[valueKeys[side]]
        const { isUploading, isDeleting } = uploadState[side]
        return (
          <div key={side} className="space-y-2">
            <Label>{sideLabels[side]} 이미지</Label>
            <div className="flex gap-2 items-stretch">
              <input
                ref={fileInputRefs[side]}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                disabled={isUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) onFileChange(side, file)
                  e.target.value = ''
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={isUploading || isDeleting}
                onClick={() => fileInputRefs[side].current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? '업로드 중...' : 'PC에서 파일 선택'}
              </Button>
              {url.trim() ? (
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 px-3 text-destructive border-destructive/40 hover:bg-destructive/10"
                  disabled={isUploading || isDeleting}
                  onClick={() => void onDelete(side)}
                  aria-label={`${sideLabels[side]} 이미지 삭제`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              ) : null}
            </div>
            <Input
              value={url}
              onChange={(e) => onChange(side, e.target.value)}
              placeholder="또는 URL 직접 입력 (https://...)"
            />
            {url ? (
              <img
                src={url}
                alt={`${sideLabels[side]} 미리보기`}
                className="w-full h-32 object-cover rounded border"
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
