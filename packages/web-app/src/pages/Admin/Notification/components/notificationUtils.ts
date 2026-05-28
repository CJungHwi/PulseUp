/**
 * Notification 유틸리티
 * - 공지유형별 Badge variant 매퍼
 *
 * 사용처: `NotificationTable.tsx`
 */
import type { NotificationType } from '@/types/notification'

export type NotificationBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

export const getTypeBadgeVariant = (type: NotificationType): NotificationBadgeVariant => {
  switch (type) {
    case 'urgent':
      return 'destructive'
    case 'important':
      return 'default'
    default:
      return 'secondary'
  }
}
