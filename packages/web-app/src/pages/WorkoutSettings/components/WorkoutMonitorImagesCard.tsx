import React, { type RefObject } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Save, Trash2, Upload } from 'lucide-react'

export type WorkoutMonitorImagesCardProps = {
  isAdmin: boolean
  leftImageUrl: string
  rightImageUrl: string
  onLeftImageUrlChange: (value: string) => void
  onRightImageUrlChange: (value: string) => void
  leftFileInputRef: RefObject<HTMLInputElement | null>
  rightFileInputRef: RefObject<HTMLInputElement | null>
  onUserFileChange: (side: 'left' | 'right', file: File) => void
  onSaveUserImages: () => void
  isSavingImages: boolean
  isUploadingLeft: boolean
  isUploadingRight: boolean
  isDeletingUserLeft: boolean
  isDeletingUserRight: boolean
  onDeleteUserImage: (side: 'left' | 'right') => void
  systemLeftImageUrl: string
  systemRightImageUrl: string
  onSystemLeftImageUrlChange: (value: string) => void
  onSystemRightImageUrlChange: (value: string) => void
  systemLeftFileInputRef: RefObject<HTMLInputElement | null>
  systemRightFileInputRef: RefObject<HTMLInputElement | null>
  onSystemFileChange: (side: 'left' | 'right', file: File) => void
  onSaveSystemImages: () => void
  isSavingSystemImages: boolean
  isUploadingSystemLeft: boolean
  isUploadingSystemRight: boolean
  isDeletingSystemLeft: boolean
  isDeletingSystemRight: boolean
  onDeleteSystemImage: (side: 'left' | 'right') => void
}

export const WorkoutMonitorImagesCard: React.FC<WorkoutMonitorImagesCardProps> = ({
  isAdmin,
  leftImageUrl,
  rightImageUrl,
  onLeftImageUrlChange,
  onRightImageUrlChange,
  leftFileInputRef,
  rightFileInputRef,
  onUserFileChange,
  onSaveUserImages,
  isSavingImages,
  isUploadingLeft,
  isUploadingRight,
  isDeletingUserLeft,
  isDeletingUserRight,
  onDeleteUserImage,
  systemLeftImageUrl,
  systemRightImageUrl,
  onSystemLeftImageUrlChange,
  onSystemRightImageUrlChange,
  systemLeftFileInputRef,
  systemRightFileInputRef,
  onSystemFileChange,
  onSaveSystemImages,
  isSavingSystemImages,
  isUploadingSystemLeft,
  isUploadingSystemRight,
  isDeletingSystemLeft,
  isDeletingSystemRight,
  onDeleteSystemImage
}) => {
  return (
    <Card className="flex-[1] min-h-0 border border-[#343637] dark:border-[#6b7280] shadow-md overflow-auto">
      <CardHeader className="h-12 px-4 py-0 border-b bg-muted/20 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
        <CardTitle className="text-sm font-bold">모니터 기본 이미지 URL</CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-dashed border-muted-foreground/40 pb-1">
              내 기본 이미지
            </span>
            <Button className="h-7 text-xs" onClick={onSaveUserImages} disabled={isSavingImages}>
              <Save className="h-3.5 w-3.5 mr-1" />
              저장
            </Button>
          </div>

          <div className="space-y-2">
            <Label>좌측 모니터 기본 이미지</Label>
            <div className="flex gap-2 items-stretch">
              <input
                ref={leftFileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                disabled={isUploadingLeft}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) onUserFileChange('left', file)
                  e.target.value = ''
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={isUploadingLeft || isDeletingUserLeft}
                onClick={() => leftFileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploadingLeft ? '업로드 중...' : 'PC에서 파일 선택'}
              </Button>
              {leftImageUrl.trim() ? (
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 px-3 text-destructive border-destructive/40 hover:bg-destructive/10"
                  disabled={isUploadingLeft || isDeletingUserLeft}
                  onClick={() => void onDeleteUserImage('left')}
                  aria-label="좌측 모니터 기본 이미지 삭제"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              ) : null}
            </div>
            <Input
              value={leftImageUrl}
              onChange={(event) => onLeftImageUrlChange(event.target.value)}
              placeholder="또는 URL 직접 입력 (https://...)"
            />
            {leftImageUrl && (
              <img
                src={leftImageUrl}
                alt="좌측 기본 이미지 미리보기"
                className="w-full h-40 object-cover rounded border"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>우측 모니터 기본 이미지</Label>
            <div className="flex gap-2 items-stretch">
              <input
                ref={rightFileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                disabled={isUploadingRight}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) onUserFileChange('right', file)
                  e.target.value = ''
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={isUploadingRight || isDeletingUserRight}
                onClick={() => rightFileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploadingRight ? '업로드 중...' : 'PC에서 파일 선택'}
              </Button>
              {rightImageUrl.trim() ? (
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 px-3 text-destructive border-destructive/40 hover:bg-destructive/10"
                  disabled={isUploadingRight || isDeletingUserRight}
                  onClick={() => void onDeleteUserImage('right')}
                  aria-label="우측 모니터 기본 이미지 삭제"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              ) : null}
            </div>
            <Input
              value={rightImageUrl}
              onChange={(event) => onRightImageUrlChange(event.target.value)}
              placeholder="또는 URL 직접 입력 (https://...)"
            />
            {rightImageUrl && (
              <img
                src={rightImageUrl}
                alt="우측 기본 이미지 미리보기"
                className="w-full h-40 object-cover rounded border"
              />
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="space-y-3 border-t border-[#343637] dark:border-[#6b7280] pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide border-b border-dashed border-amber-400/40 pb-1">
                시스템 기본 이미지
              </span>
              <Button
                className="h-7 text-xs"
                onClick={onSaveSystemImages}
                disabled={isSavingSystemImages}
              >
                <Save className="h-3.5 w-3.5 mr-1" />
                저장
              </Button>
            </div>

            <div className="space-y-2">
              <Label>좌측 시스템 기본 이미지</Label>
              <div className="flex gap-2 items-stretch">
                <input
                  ref={systemLeftFileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  disabled={isUploadingSystemLeft}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) onSystemFileChange('left', file)
                    e.target.value = ''
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={isUploadingSystemLeft || isDeletingSystemLeft}
                  onClick={() => systemLeftFileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploadingSystemLeft ? '업로드 중...' : 'PC에서 파일 선택'}
                </Button>
                {systemLeftImageUrl.trim() ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0 px-3 text-destructive border-destructive/40 hover:bg-destructive/10"
                    disabled={isUploadingSystemLeft || isDeletingSystemLeft}
                    onClick={() => void onDeleteSystemImage('left')}
                    aria-label="좌측 시스템 기본 이미지 삭제"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                ) : null}
              </div>
              <Input
                value={systemLeftImageUrl}
                onChange={(event) => onSystemLeftImageUrlChange(event.target.value)}
                placeholder="또는 URL 직접 입력 (https://...)"
              />
              {systemLeftImageUrl && (
                <img
                  src={systemLeftImageUrl}
                  alt="좌측 시스템 기본 이미지 미리보기"
                  className="w-full h-40 object-cover rounded border"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>우측 시스템 기본 이미지</Label>
              <div className="flex gap-2 items-stretch">
                <input
                  ref={systemRightFileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  disabled={isUploadingSystemRight}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) onSystemFileChange('right', file)
                    e.target.value = ''
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={isUploadingSystemRight || isDeletingSystemRight}
                  onClick={() => systemRightFileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploadingSystemRight ? '업로드 중...' : 'PC에서 파일 선택'}
                </Button>
                {systemRightImageUrl.trim() ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0 px-3 text-destructive border-destructive/40 hover:bg-destructive/10"
                    disabled={isUploadingSystemRight || isDeletingSystemRight}
                    onClick={() => void onDeleteSystemImage('right')}
                    aria-label="우측 시스템 기본 이미지 삭제"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                ) : null}
              </div>
              <Input
                value={systemRightImageUrl}
                onChange={(event) => onSystemRightImageUrlChange(event.target.value)}
                placeholder="또는 URL 직접 입력 (https://...)"
              />
              {systemRightImageUrl && (
                <img
                  src={systemRightImageUrl}
                  alt="우측 시스템 기본 이미지 미리보기"
                  className="w-full h-40 object-cover rounded border"
                />
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
