/**
 * MonthProgram — 운동 영상 임베드 URL 유틸
 *
 * - `parseVimeoVideoId`: Vimeo ID 또는 URL에서 video ID 추출
 * - `buildExerciseVideoEmbedUrl`: Vimeo ID/URL, YouTube URL → 모달 재생용 임베드 URL
 */

export const parseVimeoVideoId = (raw: string | undefined): string | null => {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/^\d+$/.test(trimmed)) return trimmed

  const vimeoMatch = trimmed.match(/(?:vimeo\.com\/)(\d+)|(?:player\.vimeo\.com\/video\/)(\d+)/)
  return vimeoMatch?.[1] || vimeoMatch?.[2] || null
}

export const buildExerciseVideoEmbedUrl = (
  url: string | undefined,
  startTime?: number,
): string | null => {
  if (!url?.trim()) return null

  const vimeoVideoId = parseVimeoVideoId(url)
  if (vimeoVideoId) {
    const base = `https://player.vimeo.com/video/${vimeoVideoId}?autoplay=1&controls=0&title=0&byline=0&portrait=0&badge=0&dnt=1`
    if (startTime && startTime > 0) {
      return `${base}#t=${startTime}s`
    }
    return base
  }

  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
  if (youtubeMatch) {
    const videoId = youtubeMatch[1]
    let embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&rel=0&modestbranding=1&showinfo=0&iv_load_policy=3`
    if (startTime && startTime > 0) {
      embedUrl += `&start=${Math.floor(startTime)}`
    }
    return embedUrl
  }

  return null
}
