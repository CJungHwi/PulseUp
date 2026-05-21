export const buildWorkoutGridVideoKey = (videoId: string, startTime: number, endTime: number): string =>
  `${videoId}:${startTime}:${endTime}`

export const extractVimeoIdFromUrl = (url: string): string => {
  if (!url) return ''
  if (/^\d+$/.test(url.trim())) return url.trim()
  const patterns = [/(?:vimeo\.com\/)(\d+)/, /(?:player\.vimeo\.com\/video\/)(\d+)/]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) return match[1]
  }
  return ''
}

export const getSequenceVideoUrlFromSequence = (sequence: any): string => {
  if (!sequence) return ''
  const candidates = [
    sequence.video_url,
    sequence.videoUrl,
    sequence.videoURL,
    sequence.video_id,
    sequence.videoId,
    sequence.video?.url,
    sequence.video?.video_url,
  ]
  for (const item of candidates) {
    if (typeof item === 'string' && item.trim()) return item.trim()
    if (typeof item === 'number' && Number.isFinite(item)) return String(item)
  }
  return ''
}
