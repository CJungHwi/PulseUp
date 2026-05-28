/**
 * 사용자 대시보드 — 헬퍼 유틸
 *
 * - `convertToEmbedUrl`: Vimeo URL → 임베드 URL
 * - 공지 유형 라벨/Badge variant 매퍼
 */

export const convertToEmbedUrl = (url: string | undefined): string | null => {
  if (!url) return null
  const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)|(?:player\.vimeo\.com\/video\/)(\d+)/)
  if (vimeoMatch) {
    const videoId = vimeoMatch[1] || vimeoMatch[2]
    return `https://player.vimeo.com/video/${videoId}?autoplay=1&controls=1&title=0&byline=0&portrait=0`
  }
  return null
}

export const getAnnouncementTypeLabel = (type: string): string => {
  switch (type) {
    case 'general':
      return '일반'
    case 'maintenance':
      return '점검'
    case 'update':
      return '업데이트'
    case 'event':
      return '이벤트'
    case 'urgent':
      return '긴급'
    default:
      return '일반'
  }
}

export type UserBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

export const getAnnouncementTypeVariant = (type: string): UserBadgeVariant => {
  switch (type) {
    case 'urgent':
      return 'destructive'
    case 'maintenance':
      return 'secondary'
    case 'update':
      return 'outline'
    default:
      return 'default'
  }
}
