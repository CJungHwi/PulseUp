/// <reference path="../../types/electron.d.ts" />

import { VideoPlayer, VideoData, PlaylistData } from './VideoPlayer.js'

export interface MonitorConfig {
  id: number
  type: 'workout' | 'timer' | 'background'
  videoPlayer?: VideoPlayer
}

export class MultiMonitorManager {
  private monitors: MonitorConfig[] = []
  private currentDisplay: string
  private workoutPlayer: VideoPlayer | null = null
  private backgroundPlayer: VideoPlayer | null = null
  private isWorkoutActive = false
  private currentPlaylist: PlaylistData | null = null

  constructor(displayType: string) {
    this.currentDisplay = displayType
    this.init()
  }

  private async init() {
    try {
      // 디스플레이 정보 가져오기
      const displays = await window.electronAPI.getDisplays()
      this.monitors = displays.map((display: any) => ({
        id: display.index,
        type: display.type
      }))

      console.log('모니터 설정:', this.monitors)
      
      // 현재 디스플레이에 맞는 초기화
      this.initializeCurrentDisplay()
      
    } catch (error) {
      console.error('모니터 초기화 실패:', error)
    }
  }

  private initializeCurrentDisplay() {
    switch (this.currentDisplay) {
      case 'workout':
        this.initializeWorkoutDisplay()
        break
      case 'background':
        this.initializeBackgroundDisplay()
        break
      case 'timer':
        this.initializeTimerDisplay()
        break
      case 'control':
        this.initializeControlDisplay()
        break
    }
  }

  private initializeWorkoutDisplay() {
    console.log('🔧 [DEBUG] initializeWorkoutDisplay 시작')
    const container = document.getElementById('workout-video-container')
    console.log('🔧 [DEBUG] workout-video-container 찾기 결과:', !!container)
    
    if (!container) {
      console.error('❌ [DEBUG] 운동 비디오 컨테이너를 찾을 수 없습니다')
      // 모든 ID를 가진 요소들 확인
      const allElements = document.querySelectorAll('[id]')
      console.log('🔧 [DEBUG] 페이지의 모든 ID 요소들:', Array.from(allElements).map(el => el.id))
      return
    }

    console.log('🔧 [DEBUG] VideoPlayer 생성 시작')
    this.workoutPlayer = new VideoPlayer(container, {
      autoPlay: true,
      loop: false,
      controls: false,
      muted: false
    })
    console.log('🔧 [DEBUG] VideoPlayer 생성 완료')

    // 비디오 이벤트 리스너
    this.workoutPlayer.onVideoStarted((video) => {
      this.updateWorkoutInfo(video)
      this.notifyVideoStarted(video)
    })

    this.workoutPlayer.onVideoEnded(() => {
      this.notifyVideoEnded()
    })

    this.workoutPlayer.onVideoError((error) => {
      this.showError(error)
    })

    // 지정된 Vimeo 동영상 자동 로드
    this.loadSpecifiedVideo()

    console.log('운동 비디오 플레이어 초기화 완료')
  }

  private initializeBackgroundDisplay() {
    const container = document.getElementById('background-video-container')
    if (!container) {
      console.error('배경 비디오 컨테이너를 찾을 수 없습니다')
      return
    }

    this.backgroundPlayer = new VideoPlayer(container, {
      autoPlay: true,
      loop: true,
      controls: false,
      muted: true
    })

    // 기본 배경 비디오 로드
    this.loadDefaultBackgroundVideo()

    console.log('배경 비디오 플레이어 초기화 완료')
  }

  private initializeTimerDisplay() {
    // 타이머 디스플레이는 비디오 플레이어가 필요하지 않음
    console.log('타이머 디스플레이 초기화 완료')
  }

  private initializeControlDisplay() {
    // 제어 디스플레이는 비디오 플레이어가 필요하지 않음
    console.log('제어 디스플레이 초기화 완료')
  }

  // 운동 플레이리스트 로드
  loadWorkoutPlaylist(playlist: PlaylistData) {
    this.currentPlaylist = playlist
    
    if (this.workoutPlayer && this.currentDisplay === 'workout') {
      this.workoutPlayer.loadPlaylist(playlist)
      this.hideOverlay()
    }

    console.log('운동 플레이리스트 로드:', playlist.name)
  }

  // 운동 시작
  startWorkout() {
    this.isWorkoutActive = true
    
    if (this.workoutPlayer && this.currentDisplay === 'workout') {
      this.workoutPlayer.play()
      this.hideOverlay()
    }

    if (this.backgroundPlayer && this.currentDisplay === 'background') {
      this.backgroundPlayer.play()
    }

    console.log('운동 시작')
  }

  // 운동 종료
  stopWorkout() {
    this.isWorkoutActive = false
    
    if (this.workoutPlayer && this.currentDisplay === 'workout') {
      this.workoutPlayer.stop()
      this.showOverlay()
    }

    if (this.backgroundPlayer && this.currentDisplay === 'background') {
      this.backgroundPlayer.pause()
    }

    console.log('운동 종료')
  }

  // 운동 일시정지
  pauseWorkout() {
    if (this.workoutPlayer && this.currentDisplay === 'workout') {
      this.workoutPlayer.pause()
    }

    if (this.backgroundPlayer && this.currentDisplay === 'background') {
      this.backgroundPlayer.pause()
    }

    console.log('운동 일시정지')
  }

  // 운동 재개
  resumeWorkout() {
    if (this.workoutPlayer && this.currentDisplay === 'workout') {
      this.workoutPlayer.play()
    }

    if (this.backgroundPlayer && this.currentDisplay === 'background') {
      this.backgroundPlayer.play()
    }

    console.log('운동 재개')
  }

  // 다음 비디오
  playNextVideo() {
    if (this.workoutPlayer && this.currentDisplay === 'workout') {
      this.workoutPlayer.playNext()
    }
  }

  // 이전 비디오
  playPreviousVideo() {
    if (this.workoutPlayer && this.currentDisplay === 'workout') {
      this.workoutPlayer.playPrevious()
    }
  }

  // 볼륨 조절
  setVolume(volume: number) {
    if (this.workoutPlayer && this.currentDisplay === 'workout') {
      this.workoutPlayer.setVolume(volume / 100)
    }
  }

  // 지정된 Vimeo 동영상 로드
  private loadSpecifiedVideo() {
    console.log('🎬 [DEBUG] loadSpecifiedVideo 시작')
    console.log('🎬 [DEBUG] workoutPlayer 존재:', !!this.workoutPlayer)
    console.log('🎬 [DEBUG] currentDisplay:', this.currentDisplay)
    
    if (!this.workoutPlayer || this.currentDisplay !== 'workout') {
      console.warn('❌ [DEBUG] workoutPlayer가 없거나 workout 디스플레이가 아님')
      return
    }

    // 지정된 Vimeo 동영상 (실제 URL로 변경 필요)
    const specifiedVideo: VideoData = {
      id: 'specified-video',
      title: 'Sample Workout Video',
      url: 'https://vimeo.com/76979871', // 샘플 Vimeo URL
      duration: 0,
      video_start_time: 0,
      video_end_time: undefined
    }

    console.log('🎬 [DEBUG] 지정된 Vimeo 동영상 정보:', specifiedVideo)
    this.workoutPlayer.loadVideo(specifiedVideo)
    this.hideOverlay()
    console.log('✅ [DEBUG] 지정된 Vimeo 동영상 로드 완료:', specifiedVideo.title)
  }

  // 기본 배경 비디오 로드
  private loadDefaultBackgroundVideo() {
    if (!this.backgroundPlayer) return

    // 기본 배경 비디오 (실제로는 서버에서 가져와야 함)
    const defaultBackgroundVideo: VideoData = {
      id: 'bg-default',
      title: '기본 배경 비디오',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      duration: 596
    }

    this.backgroundPlayer.loadVideo(defaultBackgroundVideo)
  }

  // 운동 정보 업데이트
  private updateWorkoutInfo(video: VideoData) {
    const titleElement = document.getElementById('workout-title')
    const descriptionElement = document.getElementById('workout-description')
    const infoContainer = document.getElementById('workout-info')

    if (titleElement) titleElement.textContent = video.title
    if (descriptionElement) descriptionElement.textContent = `재생 시간: ${Math.floor(video.duration / 60)}분 ${video.duration % 60}초`
    if (infoContainer) infoContainer.style.display = 'block'
  }

  // 오버레이 표시/숨김
  private showOverlay() {
    const overlay = document.getElementById('workout-overlay')
    if (overlay) {
      overlay.style.display = 'flex'
    }
  }

  private hideOverlay() {
    const overlay = document.getElementById('workout-overlay')
    if (overlay) {
      overlay.style.display = 'none'
    }
  }

  // 에러 표시
  private showError(error: string) {
    const overlay = document.getElementById('workout-overlay')
    if (overlay) {
      overlay.innerHTML = `
        <div class="display-title">오류 발생</div>
        <div class="display-subtitle">${error}</div>
        <div class="display-subtitle">잠시 후 다음 비디오로 넘어갑니다...</div>
      `
      overlay.style.display = 'flex'
    }
  }

  // 비디오 시작 알림
  private notifyVideoStarted(video: VideoData) {
    // 다른 모니터에 비디오 시작 알림 (필요시 구현)
    console.log('비디오 시작 알림:', video.title)
  }

  // 비디오 종료 알림
  private notifyVideoEnded() {
    // 다른 모니터에 비디오 종료 알림 (필요시 구현)
    console.log('비디오 종료 알림')
  }

  // 현재 재생 상태 가져오기
  async getPlaybackState() {
    const state = {
      isWorkoutActive: this.isWorkoutActive,
      currentVideo: null as VideoData | null,
      currentTime: 0,
      duration: 0,
      playlist: this.currentPlaylist
    }

    if (this.workoutPlayer) {
      state.currentVideo = this.workoutPlayer.getCurrentVideo()
      state.currentTime = await this.workoutPlayer.getCurrentTime()
      state.duration = await this.workoutPlayer.getDuration()
    }

    return state
  }

  // 특정 시간으로 이동
  seekTo(time: number) {
    if (this.workoutPlayer && this.currentDisplay === 'workout') {
      this.workoutPlayer.seekTo(time)
    }
  }

  // 재생 속도 변경
  setPlaybackRate(rate: number) {
    if (this.workoutPlayer && this.currentDisplay === 'workout') {
      this.workoutPlayer.setPlaybackRate(rate)
    }
  }

  // 정리
  destroy() {
    if (this.workoutPlayer) {
      this.workoutPlayer.destroy()
    }
    if (this.backgroundPlayer) {
      this.backgroundPlayer.destroy()
    }
  }
}