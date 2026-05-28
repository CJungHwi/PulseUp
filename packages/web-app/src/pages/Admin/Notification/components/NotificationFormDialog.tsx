/**
 * NotificationFormDialog — 공지사항 등록/수정 모달
 *
 * 입력: 제목, 공지유형, 상태, 상단고정, 본문(Textarea)
 * 모드: create / edit / view
 *
 * 사용처: `Notification.tsx`
 */
import React from 'react'
import { Edit, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  CreateNotificationRequest,
  NOTIFICATION_STATUS_LABELS,
  NOTIFICATION_TYPE_LABELS,
  NotificationStatus,
  NotificationType,
} from '@/types/notification'

export type NotificationFormMode = 'create' | 'edit' | 'view'

interface NotificationFormDialogProps {
  open: boolean
  mode: NotificationFormMode
  loading: boolean
  formData: CreateNotificationRequest
  isPinned: boolean
  onOpenChange: (open: boolean) => void
  onChange: (field: keyof CreateNotificationRequest, value: any) => void
  onPinnedChange: (value: boolean) => void
  onSave: () => void
  onCancel: () => void
}

export const NotificationFormDialog: React.FC<NotificationFormDialogProps> = ({
  open,
  mode,
  loading,
  formData,
  isPinned,
  onOpenChange,
  onChange,
  onPinnedChange,
  onSave,
  onCancel,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Edit className="w-5 h-5" />
          공지사항 {mode === 'create' ? '등록' : mode === 'edit' ? '수정' : '조회'}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4 pt-4">
        <div className="flex gap-4 items-end">
          <div className="flex-[2] space-y-2">
            <Label htmlFor="title">제목 *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => onChange('title', e.target.value)}
              placeholder="제목 입력"
            />
          </div>
          <div className="min-w-[120px] space-y-2">
            <Label>공지유형</Label>
            <Select
              value={formData.type}
              onValueChange={(val) => onChange('type', val as NotificationType)}
              labels={NOTIFICATION_TYPE_LABELS}
            >
              <SelectTrigger>
                <SelectValue />
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
          <div className="min-w-[100px] space-y-2">
            <Label>상태</Label>
            <Select
              value={formData.status}
              onValueChange={(val) => onChange('status', val as NotificationStatus)}
              labels={NOTIFICATION_STATUS_LABELS}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(NOTIFICATION_STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="pinned"
              checked={isPinned}
              onCheckedChange={(checked) => onPinnedChange(checked as boolean)}
            />
            <Label htmlFor="pinned" className="cursor-pointer">
              상단고정
            </Label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="content">내용 *</Label>
          <Textarea
            id="content"
            value={formData.content}
            onChange={(e) => onChange('content', e.target.value)}
            placeholder="내용 입력"
            rows={12}
          />
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 mr-2" />
          취소
        </Button>
        {mode !== 'view' && (
          <Button
            onClick={onSave}
            disabled={loading || !formData.title.trim() || !formData.content.trim()}
          >
            <Save className="w-4 h-4 mr-2" />
            {mode === 'create' ? '등록' : '수정'}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
