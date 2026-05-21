/// <reference path="../../types/electron.d.ts" />

import { workoutInfoDevLog } from '../workout-dev-log.js'

// Vimeo Player는 CDN을 통해 전역으로 로드됨
declare const Vimeo: any

export interface VideoData {
  id: string
  title: string
  url: string
  duration: number
  thumbnail?: string
  video_start_time?: number
  video_end_time?: number
}

export interface PlaylistData {
  id: string
  name: string
  videos: VideoData[]
}

export class VideoPlayer {
  private container: HTMLElement
  private currentVideo: VideoData | null = null
  private playlist: VideoData[] = []
  private currentIndex = 0
  private isPlaying = false
  private autoPlay = true
  private loop = false
  private onVideoEnd?: () => void
  private onVideoStart?: (video: VideoData) => void
  private onError?: (error: string) => void
  private vimeoPlayer: any = null
  private vimeoIframe: HTMLIFrameElement | null = null
  private resizeObserver: ResizeObserver | null = null
  private videoAspect: number = 16 / 9 // 기본값 16:9

  constructor(container: HTMLElement, options: {
    autoPlay?: boolean
    loop?: boolean
    controls?: boolean
    muted?: boolean
  } = {}) {
    this.container = container
    this.autoPlay = options.autoPlay ?? true
    this.loop = options.loop ?? false

    // ResizeObserver 초기화
    this.initResizeObserver()
  }

  private initResizeObserver() {
    this.resizeObserver = new ResizeObserver(() => {
      this.updateVideoLayout()
    })
    this.resizeObserver.observe(this.container)
  }

  private updateVideoLayout() {
    if (!this.vimeoIframe) return

    const containerWidth = this.container.clientWidth
    const containerHeight = this.container.clientHeight
    if (containerWidth === 0 || containerHeight === 0) return

    const containerAspect = containerWidth / containerHeight
    let scale = 1

    if (containerAspect > this.videoAspect) {
      // 컨테이너가 더 넓음 -> 너비에 맞춤 (상하가 잘림)
      scale = containerAspect / this.videoAspect
    } else {
      // 컨테이너가 더 좁음 -> 높이에 맞춤 (좌우가 잘림)
      scale = this.videoAspect / containerAspect
    }

    // 약간의 여유를 두어 틈새 방지 (1.01배)
    this.vimeoIframe.style.transform = `translate(-50%, -50%) scale(${scale * 1.01})`
  }

  // Vimeo URL 확인
  private isVimeoUrl(url: string): boolean {
    return url.includes('vimeo.com') || url.includes('player.vimeo.com')
  }

  // Vimeo 비디오 ID 추출
  private extractVimeoVideoId(url: string): string | null {
    const regExp = /(?:vimeo\.com\/)(\d+)|(?:player\.vimeo\.com\/video\/)(\d+)/
    const match = url.match(regExp)
    return match ? (match[1] || match[2]) : null
  }

  // Vimeo 동영상 로드
  private async loadVimeoVideo(video: VideoData) {
    workoutInfoDevLog('🎬 Vimeo 비디오 로드 시작:', video.url)

    const videoId = this.extractVimeoVideoId(video.url)
    workoutInfoDevLog('🎬 추출된 videoId:', videoId)

    if (!videoId) {
      console.error('❌ 유효하지 않은 Vimeo URL')
      this.handleError('유효하지 않은 Vimeo URL입니다')
      return
    }

    // 기존 플레이어 정리
    if (this.vimeoPlayer) {
      try {
        this.vimeoPlayer.destroy()
      } catch (error) {
        console.error('플레이어 제거 실패:', error)
      }
      this.vimeoPlayer = null
    }

    // 기존 iframe 제거
    if (this.vimeoIframe) {
      this.vimeoIframe.remove()
      this.vimeoIframe = null
    }

    // Vimeo iframe 생성
    const iframe = document.createElement('iframe')
    const embedUrl = `https://player.vimeo.com/video/${videoId}?controls=0&title=0&byline=0&portrait=0&badge=0&dnt=1&quality=auto`

    iframe.src = embedUrl
    iframe.style.position = 'absolute'
    iframe.style.top = '50%'
    iframe.style.left = '50%'
    iframe.style.width = '100%'
    iframe.style.height = '100%'
    iframe.style.border = 'none'
    iframe.allow = 'autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share'
    iframe.setAttribute('allowfullscreen', 'true')
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin')

    const iframeLoadStart = Date.now()
    iframe.addEventListener('load', () => {
      console.log(`📄 [VideoPlayer] iframe 로드 완료 (${Date.now() - iframeLoadStart}ms, videoId=${videoId})`)
    })
    iframe.addEventListener('error', (e) => {
      console.error(`📄 [VideoPlayer] iframe 로드 실패 (videoId=${videoId}):`, (e as ErrorEvent).message || 'unknown')
    })

    this.container.appendChild(iframe)
    this.vimeoIframe = iframe

    // 초기 레이아웃 적용
    this.updateVideoLayout()

    // Vimeo Player 초기화 (iframe이 DOM에 추가된 후)
    setTimeout(() => {
      try {
        this.vimeoPlayer = new Vimeo.Player(iframe)

        // 플레이어 준비 완료
        this.vimeoPlayer.ready().then(() => {
          workoutInfoDevLog('🎬 Vimeo 플레이어 준비 완료')

          const startTime = video.video_start_time || 0
          if (startTime > 0) {
            this.vimeoPlayer?.setCurrentTime(startTime).then(() => {
              workoutInfoDevLog('🎬 시작 시간 설정 완료:', startTime)
            }).catch((error: any) => {
              console.error('시작 시간 설정 실패:', error)
            })
          }

          // 자동 재생
          if (this.autoPlay) {
            this.vimeoPlayer?.play().catch((error: any) => {
              console.error('자동 재생 실패:', error)
            })
          }

          // 이벤트 리스너 설정
          this.vimeoPlayer?.on('play', () => {
            this.isPlaying = true
            workoutInfoDevLog('🎬 비디오 재생 시작:', this.currentVideo?.title)
            if (this.onVideoStart && this.currentVideo) {
              this.onVideoStart(this.currentVideo)
            }
          })

          this.vimeoPlayer?.on('pause', () => {
            this.isPlaying = false
            workoutInfoDevLog('🎬 비디오 일시정지')
          })

          this.vimeoPlayer?.on('ended', () => {
            this.isPlaying = false
            workoutInfoDevLog('🎬 비디오 재생 완료:', this.currentVideo?.title)

            if (this.onVideoEnd) {
              this.onVideoEnd()
            }

            if (this.loop && this.playlist.length === 1) {
              // 단일 비디오 무한 반복
              this.play()
            } else if (this.playlist.length > 1) {
              // 플레이리스트 다음 비디오 재생
              this.playNext()
            }
          })

          // 구간 반복 로직
          const endTime = video.video_end_time
          if (endTime && endTime > startTime) {
            this.vimeoPlayer?.on('timeupdate', (data: { seconds: number }) => {
              if (data.seconds >= endTime) {
                this.vimeoPlayer?.setCurrentTime(startTime).catch((error: any) => {
                  console.error('시간 이동 실패:', error)
                })
              }
            })
          }

          this.vimeoPlayer?.on('error', (error: any) => {
            console.error('🎬 Vimeo 플레이어 오류:', error)
            this.handleError('비디오 재생 중 오류가 발생했습니다')
          })

          let bufferStartAt = 0
          this.vimeoPlayer?.on('bufferstart', () => {
            bufferStartAt = Date.now()
            console.warn(`⏳ [VideoPlayer] 버퍼링 시작: ${this.currentVideo?.title ?? '?'}`)
          })
          this.vimeoPlayer?.on('bufferend', () => {
            const duration = bufferStartAt > 0 ? Date.now() - bufferStartAt : 0
            console.warn(`✅ [VideoPlayer] 버퍼링 종료 (${duration}ms): ${this.currentVideo?.title ?? '?'}`)
            bufferStartAt = 0
          })

          this.vimeoPlayer?.on('loaded', (data: any) => {
            console.log(`📦 [VideoPlayer] 영상 로드 완료 (id=${data?.id ?? '?'}): ${this.currentVideo?.title ?? '?'}`)
          })

          this.vimeoPlayer?.on('qualitychange', (data: any) => {
            console.log(`🎞 [VideoPlayer] 화질 변경: ${data?.quality ?? '?'} — ${this.currentVideo?.title ?? '?'}`)
          })

        }).catch((error: any) => {
          console.error('🎬 플레이어 준비 실패:', error)
          this.handleError('비디오 플레이어 초기화에 실패했습니다')
        })

      } catch (error) {
        console.error('🎬 Player 객체 생성 실패:', error)
        this.handleError('비디오 플레이어 생성에 실패했습니다')
      }
    }, 300)

    workoutInfoDevLog('✅ Vimeo 비디오 로드 완료:', videoId)
  }

  // 단일 비디오 로드
  loadVideo(video: VideoData) {
    this.currentVideo = video
    this.playlist = [video]
    this.currentIndex = 0

    workoutInfoDevLog('비디오 로드:', video.title, video.url)

    // Vimeo URL인지 확인
    if (this.isVimeoUrl(video.url)) {
      this.loadVimeoVideo(video)
    } else {
      this.handleError('Vimeo URL만 지원됩니다')
    }
  }

  // 플레이리스트 로드
  loadPlaylist(playlist: PlaylistData) {
    if (!playlist.videos || playlist.videos.length === 0) {
      console.error('빈 플레이리스트입니다')
      return
    }

    this.playlist = playlist.videos
    this.currentIndex = 0
    this.loadCurrentVideo()

    workoutInfoDevLog('플레이리스트 로드:', playlist.name, `${playlist.videos.length}개 비디오`)
  }

  private loadCurrentVideo() {
    if (this.currentIndex >= 0 && this.currentIndex < this.playlist.length) {
      this.currentVideo = this.playlist[this.currentIndex]
      this.loadVideo(this.currentVideo)
    }
  }

  // 재생
  play() {
    if (this.vimeoPlayer) {
      this.vimeoPlayer.play().catch((error: any) => {
        console.error('재생 실패:', error)
        if (this.onError) {
          this.onError('비디오 재생에 실패했습니다')
        }
      })
    }
  }

  // 일시정지
  pause() {
    if (this.vimeoPlayer) {
      this.vimeoPlayer.pause().catch((error: any) => {
        console.error('일시정지 실패:', error)
      })
    }
  }

  // 정지
  stop() {
    this.pause()
    if (this.vimeoPlayer) {
      const startTime = this.currentVideo?.video_start_time || 0
      this.vimeoPlayer.setCurrentTime(startTime).catch((error: any) => {
        console.error('시간 이동 실패:', error)
      })
    }
  }

  // 다음 비디오
  playNext() {
    if (this.playlist.length <= 1) return

    this.currentIndex = (this.currentIndex + 1) % this.playlist.length
    this.loadCurrentVideo()
  }

  // 이전 비디오
  playPrevious() {
    if (this.playlist.length <= 1) return

    this.currentIndex = this.currentIndex === 0 ? this.playlist.length - 1 : this.currentIndex - 1
    this.loadCurrentVideo()
  }

  // 특정 인덱스 비디오 재생
  playAt(index: number) {
    if (index >= 0 && index < this.playlist.length) {
      this.currentIndex = index
      this.loadCurrentVideo()
    }
  }

  // 볼륨 설정 (0.0 ~ 1.0)
  setVolume(volume: number) {
    if (this.vimeoPlayer) {
      this.vimeoPlayer.setVolume(Math.max(0, Math.min(1, volume))).catch((error: any) => {
        console.error('볼륨 설정 실패:', error)
      })
    }
  }

  // 음소거 토글
  async toggleMute(): Promise<boolean> {
    if (this.vimeoPlayer) {
      try {
        const currentVolume = await this.vimeoPlayer.getVolume()
        const newVolume = currentVolume > 0 ? 0 : 1
        await this.vimeoPlayer.setVolume(newVolume)
        return newVolume === 0
      } catch (error) {
        console.error('음소거 토글 실패:', error)
        return false
      }
    }
    return false
  }

  // 재생 속도 설정
  setPlaybackRate(rate: number) {
    if (this.vimeoPlayer) {
      this.vimeoPlayer.setPlaybackRate(rate).catch((error: any) => {
        console.error('재생 속도 설정 실패:', error)
      })
    }
  }

  // 특정 시간으로 이동 (초 단위)
  seekTo(time: number) {
    if (this.vimeoPlayer) {
      this.vimeoPlayer.setCurrentTime(time).catch((error: any) => {
        console.error('시간 이동 실패:', error)
      })
    }
  }

  // 현재 재생 시간 가져오기
  async getCurrentTime(): Promise<number> {
    if (this.vimeoPlayer) {
      try {
        return await this.vimeoPlayer.getCurrentTime()
      } catch (error) {
        console.error('현재 시간 가져오기 실패:', error)
        return 0
      }
    }
    return 0
  }

  // 총 재생 시간 가져오기
  async getDuration(): Promise<number> {
    if (this.vimeoPlayer) {
      try {
        return await this.vimeoPlayer.getDuration()
      } catch (error) {
        console.error('재생 시간 가져오기 실패:', error)
        return 0
      }
    }
    return 0
  }

  // 재생 상태 확인
  getIsPlaying(): boolean {
    return this.isPlaying
  }

  // 현재 비디오 정보 가져오기
  getCurrentVideo(): VideoData | null {
    return this.currentVideo
  }

  // 플레이리스트 정보 가져오기
  getPlaylist(): VideoData[] {
    return this.playlist
  }

  // 현재 인덱스 가져오기
  getCurrentIndex(): number {
    return this.currentIndex
  }

  // 이벤트 리스너 설정
  onVideoStarted(callback: (video: VideoData) => void) {
    this.onVideoStart = callback
  }

  onVideoEnded(callback: () => void) {
    this.onVideoEnd = callback
  }

  onVideoError(callback: (error: string) => void) {
    this.onError = callback
  }

  // 설정 업데이트
  setAutoPlay(autoPlay: boolean) {
    this.autoPlay = autoPlay
  }

  setLoop(loop: boolean) {
    this.loop = loop
  }

  // 에러 처리
  private handleError(error: string) {
    console.error('VideoPlayer 에러:', error)
    if (this.onError) {
      this.onError(error)
    }
  }

  // 정리
  destroy() {
    if (this.vimeoPlayer) {
      try {
        this.vimeoPlayer.destroy()
      } catch (error) {
        console.error('플레이어 제거 실패:', error)
      }
      this.vimeoPlayer = null
    }

    if (this.vimeoIframe) {
      this.vimeoIframe.remove()
      this.vimeoIframe = null
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }
  }
}
