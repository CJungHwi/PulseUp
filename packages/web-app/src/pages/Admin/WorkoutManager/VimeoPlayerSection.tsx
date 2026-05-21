import React, { useEffect, useRef, useState } from 'react'
import Player from '@vimeo/player'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pause, Play, RotateCcw, Video } from 'lucide-react'

interface VimeoPlayerSectionProps {
    videoUrl: string
    startTime?: number
    endTime?: number
    loopCount?: number
    onTimeChange: (field: 'video_start_time' | 'video_end_time' | 'video_loop_count', value: number | undefined) => void
}

export const VimeoPlayerSection: React.FC<VimeoPlayerSectionProps> = ({
    videoUrl,
    startTime,
    endTime,
    loopCount,
    onTimeChange
}) => {
    const vimeoPlayerRef = useRef<Player | null>(null)
    const vimeoIframeRef = useRef<HTMLDivElement | null>(null)
    const [isPlayerReady, setIsPlayerReady] = useState(false)
    const [isPlaying, setIsPlaying] = useState(false)

    const parseVimeoVideoId = (raw: string) => {
        const trimmed = raw.trim()
        if (!trimmed) return null
        if (/^\d+$/.test(trimmed)) return trimmed

        const vimeoMatch = trimmed.match(/(?:vimeo\.com\/)(\d+)|(?:player\.vimeo\.com\/video\/)(\d+)/)
        return vimeoMatch?.[1] || vimeoMatch?.[2] || null
    }

    // Vimeo Player 초기화
    useEffect(() => {
        if (!videoUrl || !vimeoIframeRef.current) {
            setIsPlayerReady(false)
            setIsPlaying(false)
            return
        }

        const videoId = parseVimeoVideoId(videoUrl)
        if (!videoId) {
            setIsPlayerReady(false)
            setIsPlaying(false)
            return
        }

        // 기존 플레이어 정리
        if (vimeoPlayerRef.current) {
            vimeoPlayerRef.current.destroy().catch(console.error)
            vimeoPlayerRef.current = null
        }

        // 새 플레이어 생성
        const player = new Player(vimeoIframeRef.current, {
            id: parseInt(videoId),
            loop: true,
            autoplay: true,
            controls: false,
            title: false,
            byline: false,
            portrait: false,
            muted: true,
        })

        vimeoPlayerRef.current = player

        player.ready().then(() => {
            setIsPlayerReady(true)

            if (startTime && startTime > 0) {
                player.setCurrentTime(startTime).catch(console.error)
            }

            // 무음 강제 (영상 내 컨트롤이 없지만, 혹시라도 환경에 따라 볼륨이 살아나는 경우 방지)
            player.setVolume(0).catch(() => {})
            player.setMuted(true).catch(() => {})
            player.on('volumechange', () => {
                player.setVolume(0).catch(() => {})
                player.setMuted(true).catch(() => {})
            })

            player.on('play', () => setIsPlaying(true))
            player.on('pause', () => setIsPlaying(false))
            player.on('ended', () => setIsPlaying(false))

            // autoplay가 환경 정책으로 막히는 경우를 대비해 한 번 더 시도
            player.play().catch(() => {})
        }).catch(console.error)

        return () => {
            if (vimeoPlayerRef.current) {
                vimeoPlayerRef.current.destroy().catch(console.error)
                vimeoPlayerRef.current = null
            }
        }
    }, [videoUrl])

    // 구간 반복 로직
    useEffect(() => {
        if (!vimeoPlayerRef.current || !isPlayerReady) return

        const handleTimeUpdate = (data: { seconds: number }) => {
            if (endTime && endTime > (startTime || 0) && data.seconds >= endTime) {
                vimeoPlayerRef.current?.setCurrentTime(startTime || 0).catch(console.error)
            }
        }

        vimeoPlayerRef.current.on('timeupdate', handleTimeUpdate)
        return () => {
            vimeoPlayerRef.current?.off('timeupdate', handleTimeUpdate)
        }
    }, [startTime, endTime, isPlayerReady])

    const handlePlayPause = () => {
        if (!vimeoPlayerRef.current || !isPlayerReady) return
        if (isPlaying) {
            vimeoPlayerRef.current.pause().catch(() => {})
            return
        }
        vimeoPlayerRef.current.play().catch(() => {})
    }

    const handleReplay = () => {
        if (!vimeoPlayerRef.current || !isPlayerReady) return
        vimeoPlayerRef.current.setCurrentTime(startTime || 0).catch(() => {})
        vimeoPlayerRef.current.play().catch(() => {})
    }

    const handleSetStartTime = async () => {
        if (!vimeoPlayerRef.current || !isPlayerReady) return
        const seconds = await vimeoPlayerRef.current.getCurrentTime().catch(() => null)
        if (seconds === null) return
        onTimeChange('video_start_time', Math.max(0, Math.round(seconds * 10) / 10))
    }

    const handleSetEndTime = async () => {
        if (!vimeoPlayerRef.current || !isPlayerReady) return
        const seconds = await vimeoPlayerRef.current.getCurrentTime().catch(() => null)
        if (seconds === null) return
        onTimeChange('video_end_time', Math.max(0, Math.round(seconds * 10) / 10))
    }

    return (
        <Card className="h-full flex flex-col bg-card shadow-md">
            <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2 min-w-0">
                    <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
                        <Video className="w-5 h-5" />
                        영상 미리보기
                    </CardTitle>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handlePlayPause}
                        disabled={!isPlayerReady}
                        title={isPlaying ? '일시정지' : '재생'}
                    >
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleReplay}
                        disabled={!isPlayerReady}
                        title="구간 반복 확인"
                    >
                        <RotateCcw className="h-4 w-4" />
                    </Button>
                </div>

                <div />
            </CardHeader>

            <CardContent className="flex-1 min-h-0 flex flex-col gap-[3px] p-4">
                <div className="flex-1 min-h-0 flex items-center justify-center">
                    {/* 16:9 비율을 유지하면서, 가능한 최대 크기로 표시(짤림 방지) */}
                    <div className="w-full max-w-full max-h-full aspect-video rounded-lg border border-[#343637] dark:border-[#6b7280] overflow-hidden relative bg-black">
                        {!videoUrl ? (
                            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                영상 URL을 입력해주세요
                            </div>
                        ) : (
                            <div
                                ref={vimeoIframeRef}
                                className="absolute inset-0 [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:block"
                            />
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
