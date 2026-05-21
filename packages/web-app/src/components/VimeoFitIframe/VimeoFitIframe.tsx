import { Box } from '@mui/material'
import { useEffect, useMemo, useRef, useState } from 'react'

interface VimeoFitIframeProps {
  videoId: string
  iframeRef?: React.RefObject<HTMLIFrameElement>
  fitMode?: 'contain' | 'cover' // contain: 여백 남김, cover: 꽉 채움(일부 잘림)
  className?: string
}

const aspectCache = new Map<string, number>()

async function fetchVimeoAspect(videoId: string, signal: AbortSignal): Promise<number | null> {
  try {
    const normalizedUrl = `https://vimeo.com/${encodeURIComponent(videoId)}`
    const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(normalizedUrl)}`
    const resp = await fetch(oembedUrl, { method: 'GET', signal })
    if (!resp.ok) return null
    const data = (await resp.json()) as { width?: number; height?: number }
    if (!data.width || !data.height) return null
    if (data.width <= 0 || data.height <= 0) return null
    return data.width / data.height
  } catch {
    return null
  }
}

export function VimeoFitIframe({ videoId, iframeRef, fitMode = 'cover', className }: VimeoFitIframeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [aspect, setAspect] = useState<number>(() => aspectCache.get(videoId) || 16 / 9)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setContainerSize({ width, height })
    })

    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const cached = aspectCache.get(videoId)
    if (cached) {
      setAspect(cached)
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    fetchVimeoAspect(videoId, controller.signal).then((next) => {
      if (!next) return
      aspectCache.set(videoId, next)
      setAspect(next)
    }).finally(() => clearTimeout(timeout))

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [videoId])

  const fitted = useMemo(() => {
    const cw = containerSize.width
    const ch = containerSize.height
    if (!cw || !ch) return { width: '100%', height: '100%', scale: 1 }

    const containerRatio = cw / ch

    if (fitMode === 'contain') {
      if (containerRatio > aspect) {
        // 컨테이너가 더 넓음 → 높이에 맞추고 좌우 여백
        return { width: ch * aspect, height: ch, scale: 1 }
      }
      // 컨테이너가 더 좁음 → 너비에 맞추고 상하 여백
      return { width: cw, height: cw / aspect, scale: 1 }
    } else {
      // cover 모드: 컨테이너를 완전히 채움
      if (containerRatio > aspect) {
        // 컨테이너가 더 넓음 → 너비에 맞추고 상하가 잘림
        return { width: cw, height: cw / aspect, scale: 1 }
      }
      // 컨테이너가 더 좁음 → 높이에 맞추고 좌우가 잘림
      return { width: ch * aspect, height: ch, scale: 1 }
    }
  }, [containerSize.height, containerSize.width, aspect, fitMode])

  const embedUrl = useMemo(() => {
    const id = videoId.trim()
    return `https://player.vimeo.com/video/${encodeURIComponent(id)}?controls=0&title=0&byline=0&portrait=0&badge=0`
  }, [videoId])

  return (
    <Box
      ref={containerRef}
      className={className}
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
        overflow: 'hidden', // cover 모드 시 잘리는 부분 숨김
      }}
    >
      <Box sx={{
        width: fitted.width,
        height: fitted.height,
        flexShrink: 0, // 크기 유지
      }}>
        <iframe
          key={videoId}
          ref={iframeRef}
          src={embedUrl}
          title="Vimeo video player"
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </Box>
    </Box>
  )
}


