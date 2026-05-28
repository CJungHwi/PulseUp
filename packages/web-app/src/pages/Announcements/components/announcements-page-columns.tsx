/**
 * 공지사항 목록 DataTable 컬럼 정의
 */

import React from 'react'
import { Pin, Edit, Trash2, Paperclip } from 'lucide-react'
import { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Notification as NotificationItem,
  NOTIFICATION_TYPE_LABELS,
  NotificationType,
  parseNotificationAttachments,
} from '@/types/notification'

const rowHasAttachments = (n: NotificationItem): boolean =>
  parseNotificationAttachments(n.attachments).length > 0

const getTypeBadgeVariant = (type: NotificationType) => {
  switch (type) {
    case 'urgent':
      return 'destructive'
    case 'maintenance':
      return 'destructive'
    case 'update':
      return 'default'
    case 'event':
      return 'outline'
    default:
      return 'secondary'
  }
}

export type AnnouncementsPageColumnsParams = {
  isAdmin: boolean
  onRowOpen: (notification: NotificationItem) => void
  onDeleteRow: (e: React.MouseEvent, id: number) => void
}

export const buildAnnouncementsPageColumns = ({
  isAdmin,
  onRowOpen,
  onDeleteRow,
}: AnnouncementsPageColumnsParams): ColumnDef<NotificationItem>[] => [
  {
    accessorKey: 'is_pinned',
    header: '고정',
    cell: ({ row }) => (
      <div className="flex justify-center">
        {row.original.is_pinned ? (
          <Pin className="h-4 w-4 text-primary fill-primary" />
        ) : (
          <span className="text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-yellow-400 group-hover:font-bold">
            -
          </span>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'type',
    header: '유형',
    cell: ({ row }) => (
      <div className="flex justify-center">
        <Badge variant={getTypeBadgeVariant(row.original.type)}>
          {NOTIFICATION_TYPE_LABELS[row.original.type]}
        </Badge>
      </div>
    ),
  },
  {
    id: 'attachments',
    header: '첨부',
    cell: ({ row }) => (
      <div className="flex justify-center">
        {rowHasAttachments(row.original) ? (
          <span
            className="inline-flex text-primary"
            title="첨부파일 있음"
            aria-label="첨부파일 있음"
          >
            <Paperclip className="h-4 w-4" aria-hidden />
          </span>
        ) : (
          <span className="text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-yellow-400 group-hover:font-bold">
            -
          </span>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'title',
    header: '제목',
    cell: ({ row }) => (
      <div
        className="font-medium cursor-pointer hover:underline text-left truncate max-w-[400px] group-hover:text-blue-600 dark:group-hover:text-yellow-400 group-hover:font-bold"
        onClick={() => onRowOpen(row.original)}
      >
        {row.original.title}
      </div>
    ),
  },
  {
    accessorKey: 'author_name',
    header: '작성자',
    cell: ({ row }) => (
      <div className="text-center group-hover:text-blue-600 dark:group-hover:text-yellow-400 group-hover:font-bold">
        {row.original.author_name || '관리자'}
      </div>
    ),
  },
  {
    accessorKey: 'created_at',
    header: '작성일',
    cell: ({ row }) => (
      <div className="text-center text-muted-foreground whitespace-nowrap group-hover:text-blue-600 dark:group-hover:text-yellow-400 group-hover:font-bold">
        {new Date(row.original.created_at).toLocaleDateString()}
      </div>
    ),
  },
  {
    accessorKey: 'view_count',
    header: '조회수',
    cell: ({ row }) => (
      <div className="text-center font-mono group-hover:text-blue-600 dark:group-hover:text-yellow-400 group-hover:font-bold">
        {row.original.view_count}
      </div>
    ),
  },
  {
    id: 'actions',
    header: '관리',
    cell: ({ row }) =>
      isAdmin ? (
        <div className="flex justify-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:text-blue-600 dark:hover:text-yellow-400"
            onClick={(e) => {
              e.stopPropagation()
              onRowOpen(row.original)
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => onDeleteRow(e, row.original.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : null,
  },
]
