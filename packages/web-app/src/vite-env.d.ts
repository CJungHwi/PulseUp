/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  // 다른 환경 변수들...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Electron API 타입 정의
interface ElectronAPI {
  // 운동 세션 관리
  startWorkout: (data: any) => Promise<{ success: boolean }>
  pauseWorkout: () => Promise<{ success: boolean, status?: string }>
  stopWorkout: () => Promise<{ success: boolean }>
  loadPlaylist: (playlistData: any) => Promise<{ success: boolean }>
  
  // 심박수 및 모니터링
  updateHeartRate: (heartRateData: any) => Promise<{ success: boolean }>
  
  // 디스플레이 관리
  getDisplays: () => Promise<any[]>
  repositionWindows: () => Promise<{ success: boolean }>
  
  // 앱 제어
  quitApp: () => Promise<void>
  toggleFullscreen: () => Promise<{ success: boolean, isFullscreen: boolean }>
  
  // 이벤트 리스너
  onWorkoutStarted: (callback: (data: any) => void) => void
  onWorkoutStopped: (callback: () => void) => void
  onPlaylistLoaded: (callback: (data: any) => void) => void
  onHeartRateUpdated: (callback: (data: any) => void) => void
  onMenuStartWorkout: (callback: () => void) => void
  onMenuStopWorkout: (callback: () => void) => void
  
  // 운동 플레이 이벤트 리스너
  onWorkoutPlayReady: (callback: (data: any) => void) => void
  onWorkoutPlayStarted: (callback: (data: any) => void) => void
  onWorkoutPlaySequence: (callback: (data: any) => void) => void
  onWorkoutPlayCompleted: (callback: (data: any) => void) => void
  onWorkoutPlayPaused: (callback: (data: any) => void) => void
  onWorkoutPlayResumed: (callback: (data: any) => void) => void
  onWorkoutPlayStopped: (callback: (data: any) => void) => void
  onCountdownStarted: (callback: (data: { phase?: 'session-start' | 'segment-transition' }) => void) => void
  
  // 이벤트 리스너 제거
  removeAllListeners: (channel: string) => void
}

interface Window {
  electronAPI?: ElectronAPI
}