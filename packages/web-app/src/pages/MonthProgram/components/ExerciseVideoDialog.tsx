/**
 * ExerciseVideoDialog — 운동 영상 모달 팝업 (Vimeo/YouTube iframe)
 */

import React from 'react'
import { createPortal } from 'react-dom'
import { PlayCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildExerciseVideoEmbedUrl } from './monthProgramVideoUtils'

interface ExerciseVideoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  exerciseName: string
  videoUrl?: string
  videoStartTime?: number
}

export const ExerciseVideoDialog: React.FC<ExerciseVideoDialogProps> = ({
  open,
  onOpenChange,
  exerciseName,
  videoUrl,
  videoStartTime,
}) => {
  const embedUrl = buildExerciseVideoEmbedUrl(videoUrl, videoStartTime)

  if (!open || typeof document === 'undefined') return null

  const handleClose = () => onOpenChange(false)

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="영상 닫기"
        className="absolute inset-0 bg-black/60"
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${exerciseName} 영상`}
        className="relative z-[10001] w-full max-w-[998px] overflow-hidden rounded-lg border border-[#343637] bg-black shadow-lg dark:border-[#6b7280]"
      >
        <div className="flex h-12 items-center justify-between border-b border-[#343637] bg-muted/30 px-4 dark:border-[#6b7280]">
          <h3 className="flex items-center gap-2 text-lg font-bold leading-none">
            <PlayCircle className="h-5 w-5 text-primary" />
            {exerciseName || '운동 영상'}
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="닫기"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="aspect-video w-full bg-black">
          {embedUrl ? (
            <iframe
              key={embedUrl}
              src={embedUrl}
              title={exerciseName}
              className="h-full w-full"
              frameBorder="0"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              재생 가능한 영상 URL이 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
