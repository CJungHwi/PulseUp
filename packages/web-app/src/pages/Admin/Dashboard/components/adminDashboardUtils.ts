/**
 * 관리자 대시보드 — 헬퍼 유틸
 *
 * - `convertToEmbedUrl`: Vimeo URL → 임베드 URL
 * - `getStatIconColor`: 통계 카드 아이콘 배경 색
 * - `getAnnouncementTypeLabel`: 공지 유형 라벨
 * - `getAnnouncementTypeVariant`: 공지 유형 Badge variant
 * - `getAnnouncementTypeClassName`: 공지 유형 추가 CSS
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

export const getStatIconColor = (iconClass: string): string => {
  switch (iconClass) {
    case 'approved':
      return 'bg-green-500'
    case 'pending':
      return 'bg-yellow-500'
    case 'disabled':
      return 'bg-red-500'
    default:
      return 'bg-primary'
  }
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

export type AnnouncementBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

export const getAnnouncementTypeVariant = (type: string): AnnouncementBadgeVariant => {
  switch (type) {
    case 'general':
      return 'secondary'
    case 'maintenance':
      return 'destructive'
    case 'update':
      return 'default'
    case 'event':
      return 'outline'
    case 'urgent':
      return 'destructive'
    default:
      return 'secondary'
  }
}

export const getAnnouncementTypeClassName = (type: string): string => {
  switch (type) {
    case 'general':
      return 'bg-gray-100 text-gray-800 hover:bg-gray-200'
    case 'maintenance':
      return 'bg-orange-100 text-orange-800 hover:bg-orange-200 border-none'
    case 'update':
      return 'bg-blue-100 text-blue-800 hover:bg-blue-200 border-none'
    case 'event':
      return 'bg-purple-100 text-purple-800 hover:bg-purple-200 border-none'
    case 'urgent':
      return 'bg-red-100 text-red-800 hover:bg-red-200 border-none'
    default:
      return ''
  }
}
