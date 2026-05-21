/** 모니터 기본 이미지 등은 항상 운영 도메인의 /uploads 경로로 통일 */
export const MONITOR_UPLOAD_PUBLIC_ORIGIN = 'https://linkhiit.co.kr'

export const normalizeMonitorUploadUrl = (url: string): string => {
  if (!url || !url.trim()) return url
  const trimmed = url.trim()
  try {
    const u = new URL(trimmed)
    if (u.pathname.startsWith('/uploads')) {
      return `${MONITOR_UPLOAD_PUBLIC_ORIGIN}${u.pathname}${u.search}`
    }
  } catch {
    if (trimmed.startsWith('/uploads')) {
      return `${MONITOR_UPLOAD_PUBLIC_ORIGIN}${trimmed}`
    }
  }
  return trimmed
}
