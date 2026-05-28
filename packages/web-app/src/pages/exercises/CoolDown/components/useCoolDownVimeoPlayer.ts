/**
 * useCoolDownVimeoPlayer — Vimeo 플레이어 초기화 + 구간 반복 훅
 *
 * 입력:
 * - videoUrl: Vimeo URL (없거나 변경 시 플레이어 재생성/제거)
 * - videoStartTime / videoEndTime: 구간 반복 범위
 *
 * 반환:
 * - iframeRef: 플레이어 부착 대상 iframe ref
 * - isPlayerReady, isPlaying
 * - handlePlayPause, handleReplay
 *
 * 사용처: `CoolDown.tsx` → `CoolDownPreviewPanel.tsx`
 */
import Player from '@vimeo/player'
import { useEffect, useRef, useState } from 'react'

interface UseCoolDownVimeoPlayerArgs {
  videoUrl?: string | null
  videoStartTime?: number
  videoEndTime?: number
}

export const useCoolDownVimeoPlayer = ({
  videoUrl,
  videoStartTime = 0,
  videoEndTime = 0,
}: UseCoolDownVimeoPlayerArgs) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const playerRef = useRef<Player | null>(null)
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  const destroy = () => {
    if (playerRef.current) {
      try {
        playerRef.current.destroy()
      } catch {
        /* ignore */
      }
      playerRef.current = null
    }
    setIsPlayerReady(false)
    setIsPlaying(false)
  }

  // 비디오 변경 시 플레이어 재초기화
  useEffect(() => {
    const trimmed = videoUrl?.trim()
    if (!trimmed) {
      destroy()
      return
    }

    const vimeoMatch = trimmed.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)?(\d+)/)
    if (!vimeoMatch) {
      setIsPlayerReady(false)
      return
    }

    destroy()

    let initTimer: ReturnType<typeof setTimeout> | null = null
    let retryCount = 0
    const maxRetries = 10

    const tryInitPlayer = () => {
      if (!iframeRef.current) {
        retryCount += 1
        if (retryCount < maxRetries) initTimer = setTimeout(tryInitPlayer, 100)
        return
      }
      try {
        const player = new Player(iframeRef.current)
        playerRef.current = player
        player
          .ready()
          .then(() => {
            player.setMuted(true)
            setIsPlayerReady(true)
            if (videoStartTime > 0) player.setCurrentTime(videoStartTime).catch(() => {})
            player.on('play', () => setIsPlaying(true))
            player.on('pause', () => setIsPlaying(false))
            player.on('ended', () => setIsPlaying(false))
          })
          .catch(() => setIsPlayerReady(false))
      } catch {
        setIsPlayerReady(false)
      }
    }
    initTimer = setTimeout(tryInitPlayer, 100)

    return () => {
      if (initTimer) clearTimeout(initTimer)
      destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl])

  // 구간 반복 처리
  useEffect(() => {
    if (!playerRef.current || !isPlayerReady) return
    if (!videoEndTime || videoEndTime <= videoStartTime) return

    const handleTimeUpdate = (data: { seconds: number }) => {
      if (data.seconds >= videoEndTime) {
        playerRef.current?.setCurrentTime(videoStartTime).catch(() => {})
      }
    }
    playerRef.current.on('timeupdate', handleTimeUpdate)
    return () => {
      playerRef.current?.off('timeupdate', handleTimeUpdate)
    }
  }, [videoStartTime, videoEndTime, isPlayerReady])

  const handlePlayPause = () => {
    if (!playerRef.current || !isPlayerReady) return
    if (isPlaying) {
      playerRef.current.pause().catch(() => {})
      return
    }
    playerRef.current.play().catch(() => {})
  }

  const handleReplay = () => {
    if (!playerRef.current || !isPlayerReady) return
    playerRef.current.setCurrentTime(videoStartTime).catch(() => {})
    playerRef.current.play().catch(() => {})
  }

  return {
    iframeRef,
    isPlayerReady,
    isPlaying,
    handlePlayPause,
    handleReplay,
  }
}
