/**
 * 공지 등록/수정 다이얼로그용 첨부파일 UI
 * — 로컬에서 선택한 파일(pending)과 서버에 이미 올라간 URL(uploaded) 목록 표시
 * — 파일 선택은 투명한 file input을 버튼 위에 올려 브라우저 기본 동작으로 처리
 */

import React from 'react'
import { Paperclip, X } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AnnouncementAttachment } from '@/types/notification'

const ACCEPT_EXTENSIONS =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.txt,.zip,.csv,.hwp'

export type AnnouncementAttachmentsFieldProps = {
  readOnly: boolean
  uploaded: AnnouncementAttachment[]
  pendingFiles: File[]
  onAddFiles: (files: File[]) => void
  onRemoveUploaded: (url: string) => void
  onRemovePending: (index: number) => void
}

export const AnnouncementAttachmentsField: React.FC<AnnouncementAttachmentsFieldProps> = ({
  readOnly,
  uploaded,
  pendingFiles,
  onAddFiles,
  onRemoveUploaded,
  onRemovePending,
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.currentTarget.files ?? [])
    e.currentTarget.value = ''
    if (selectedFiles.length === 0) return
    onAddFiles(selectedFiles)
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium leading-none">첨부파일</div>
      {!readOnly && (
        <>
          <div
            className="relative inline-flex w-fit"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'inline-flex w-fit gap-2 pointer-events-none'
              )}
              aria-hidden
            >
              <Paperclip className="h-4 w-4 shrink-0" aria-hidden />
              파일 추가
            </div>
            <input
              id="announcement-attachments"
              type="file"
              multiple
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              accept={ACCEPT_EXTENSIONS}
              aria-label="공지에 첨부할 파일 선택, 여러 개 선택 가능"
              onChange={handleFileChange}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            PDF·이미지·문서 등 (파일당 최대 15MB, 저장 시 서버에 업로드됩니다)
          </p>
        </>
      )}
      <ul className="space-y-1 text-sm border rounded-md p-2 bg-muted/10 max-h-40 overflow-y-auto">
        {uploaded.map((f) => (
          <li key={f.url} className="flex items-center justify-between gap-2 min-h-8">
            <a
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-primary underline-offset-2 hover:underline"
            >
              {f.originalName}
            </a>
            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => onRemoveUploaded(f.url)}
                aria-label={`첨부 제거 ${f.originalName}`}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            )}
          </li>
        ))}
        {pendingFiles.map((f, i) => (
          <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 min-h-8">
            <span className="truncate text-muted-foreground">{f.name} (저장 시 업로드)</span>
            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => onRemovePending(i)}
                aria-label={`선택 취소 ${f.name}`}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            )}
          </li>
        ))}
        {uploaded.length === 0 && pendingFiles.length === 0 && (
          <li className="text-muted-foreground py-1">첨부 없음</li>
        )}
      </ul>
    </div>
  )
}
