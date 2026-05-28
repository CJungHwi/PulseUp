/**
 * AnnouncementDetailDialog — 공지사항 상세 보기 모달 (읽기 전용)
 */

import React from 'react'
import { Pencil, Paperclip } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { NOTIFICATION_TYPE_LABELS } from '@/types/notification'
import type { SimpleAnnouncement } from './adminDashboardTypes'

interface AnnouncementDetailDialogProps {
  open: boolean
  onClose: () => void
  selected: SimpleAnnouncement | null
}

export const AnnouncementDetailDialog: React.FC<AnnouncementDetailDialogProps> = ({
  open,
  onClose,
  selected,
}) => (
  <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="w-full max-w-[500px] min-h-[470px]">
      <DialogHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
        <DialogTitle className="text-lg font-bold flex items-center gap-2 leading-none">
          <Pencil className="h-5 w-5 text-primary" />
          공지사항 보기
        </DialogTitle>
      </DialogHeader>

      <div className="grid gap-6 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="title" className="text-left">
            제목
          </Label>
          <Input
            id="title"
            value={selected?.title ?? ''}
            readOnly
            className="col-span-3 bg-muted"
          />
        </div>

        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="type" className="text-left">
            공지유형
          </Label>
          <Select value={selected?.type ?? 'general'} disabled labels={NOTIFICATION_TYPE_LABELS}>
            <SelectTrigger className="col-span-3 bg-muted">
              <SelectValue placeholder="유형 선택" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(NOTIFICATION_TYPE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-4 items-start gap-4">
          <Label htmlFor="content" className="text-left pt-2">
            내용
          </Label>
          <Textarea
            id="content"
            value={selected?.content ?? ''}
            readOnly
            className="col-span-3 min-h-[200px] bg-muted resize-none"
          />
        </div>

        {(selected?.attachments ?? []).length > 0 && (
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-left pt-2 flex items-center gap-1">
              <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              첨부파일
            </Label>
            <ul className="col-span-3 space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
              {(selected?.attachments ?? []).map((file) => (
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
