/**
 * UserAnnouncementDialog — 사용자용 공지사항 상세 보기 모달
 */

import React from 'react'
import { Edit as EditIcon, Paperclip } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { parseNotificationAttachments } from '@/types/notification'
import type { UserAnnouncement } from '@/services/userDashboard.service'
import { getAnnouncementTypeLabel } from './userDashboardUtils'

interface UserAnnouncementDialogProps {
  open: boolean
  onClose: () => void
  selected: UserAnnouncement | null
}

export const UserAnnouncementDialog: React.FC<UserAnnouncementDialogProps> = ({
  open,
  onClose,
  selected,
}) => {
  const attachments = parseNotificationAttachments(selected?.attachments ?? [])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <EditIcon className="w-5 h-5" />
            <span>공지사항 보기</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">제목</Label>
              <div className="p-2 border rounded-md bg-muted/50 text-sm font-medium">
                {selected?.title ?? ''}
              </div>
            </div>
            <div className="w-[120px]">
              <Label className="text-xs text-muted-foreground mb-1 block">공지유형</Label>
              <div className="p-2 border rounded-md bg-muted/50 text-sm font-medium text-center">
                {getAnnouncementTypeLabel(selected?.type ?? 'general')}
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">내용</Label>
            <div className="p-4 border rounded-md bg-muted/50 text-sm min-h-[300px] whitespace-pre-wrap">
              {selected?.content ?? ''}
            </div>
          </div>

          {attachments.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden />
                첨부파일
              </Label>
              <ul className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
                {attachments.map((file) => (
                  <li key={file.url}>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={file.originalName}
                      className="text-primary underline-offset-2 hover:underline break-all"
                    >
                      {file.originalName}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            확인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
