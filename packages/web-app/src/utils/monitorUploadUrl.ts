/** 모니터 기본 이미지 등은 현재 API 서버의 /uploads 경로로 통일 */
const stripApiSuffix = (url: string): string => url.replace(/\/api\/?$/, '').replace(/\/$/, '')

export const MONITOR_UPLOAD_PUBLIC_ORIGIN = stripApiSuffix(
  import.meta.env.VITE_PUBLIC_UPLOAD_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  window.location.origin
)

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
