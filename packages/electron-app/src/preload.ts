import { contextBridge, ipcRenderer } from 'electron'

// 타입 정의
export interface ElectronAPI {
  // 운동 세션 관리
  startWorkout: (data: any) => Promise<{ success: boolean }>
  pauseWorkout: () => Promise<{ success: boolean, status?: string }>
  stopWorkout: () => Promise<{ success: boolean }>
  loadPlaylist: (playlistData: any) => Promise<{ success: boolean }>

  // 심박수 및 모니터링
  updateHeartRate: (heartRateData: any) => Promise<{ success: boolean }>
  getHeartRateThreshold: () => Promise<{ success: boolean; threshold: number }>

  // 디스플레이 관리
  getDisplays: () => Promise<any[]>
  repositionWindows: () => Promise<{ success: boolean }>

  // 앱 제어
  quitApp: () => Promise<void>
  toggleFullscreen: () => Promise<{ success: boolean, isFullscreen: boolean }>
  getWindowMode: () => Promise<{ isFullscreen: boolean }>
  getScreenMode: () => Promise<{ mode: 'three' | 'five' }>
  notifyIntroPlaybackEnded: () => Promise<{ success: boolean }>

  // 디바이스 등록 관리
  getDeviceInfo: () => Promise<{
    deviceId: string
    isRegistered: boolean
    displayLabel: string
    registerCode: string | null
    registerCodeExpiresAt: number | null
    isWsConnected: boolean
  }>
  wsReconnect: () => Promise<{ success: boolean }>
  resetDeviceRegistration: () => Promise<{ success: boolean }>

  // 이벤트 리스너
  onWorkoutStarted: (callback: (data: any) => void) => void
  onWorkoutStopped: (callback: () => void) => void
  onPlaylistLoaded: (callback: (data: any) => void) => void
  onHeartRateUpdated: (callback: (data: any) => void) => void
  onANTConnectionStatus: (callback: (data: any) => void) => void
  onMenuStartWorkout: (callback: () => void) => void
  onMenuStopWorkout: (callback: () => void) => void

  // 운동 플레이 이벤트 리스너
  onWorkoutPlayReady: (callback: (data: any) => void) => void
  onWorkoutPlayStarted: (callback: (data: any) => void) => void
  onWorkoutPlayPreview: (callback: (data: any) => void) => void
  onWorkoutPlayPreload: (callback: (data: any) => void) => void
  onWorkoutPlayClearPreload: (callback: (data?: { preservePreloadCache?: boolean }) => void) => void
  onWorkoutPlaySequence: (callback: (data: any) => void) => void
  onWorkoutPlayCompleted: (callback: (data: any) => void) => void
  onWorkoutPlayPaused: (callback: (data: any) => void) => void
  onWorkoutPlayResumed: (callback: (data: any) => void) => void
  onWorkoutPlayStopped: (callback: (data: any) => void) => void
  onWorkoutStretchingSwitchGroup: (callback: (data: any) => void) => void
  onWorkoutSetupQueue: (callback: (data: any) => void) => void
  onWorkoutAdvanceSlots: (callback: (data: any) => void) => void
  onWorkoutSeekQueue: (callback: (data: { round: number; position: string }) => void) => void
  onCountdownStarted: (callback: (data: { phase?: string }) => void) => void
  onShowSplashBeforeWorkout: (callback: () => void) => void
  onIntroStarted: (callback: (data: any) => void) => void
  onIntroCancelledResetToReady: (callback: (data?: { showSplash?: boolean }) => void) => void
  onIntroFocus: (callback: (data: { target: any }) => void) => void
  onIntroFocusCancel: (callback: () => void) => void
  onWindowModeChanged: (callback: (data: { isFullscreen: boolean }) => void) => void
  onConfigUpdated?: (callback: (config: { displayLabel?: string }) => void) => void

  // 디바이스 등록 이벤트 리스너
  onDeviceRegisterCode: (callback: (data: { code: string; expiresIn: number; deviceId: string }) => void) => void
  onDeviceRegistered: (callback: (data: { displayLabel?: string; storeId?: number }) => void) => void
  onWsRelayStatus: (callback: (data: { connected: boolean; error?: string }) => void) => void
  onDisplayLabelUpdated: (callback: (data: { displayLabel: string }) => void) => void

  // 이벤트 리스너 제거
  removeAllListeners: (channel: string) => void
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // 운동 세션 관리
  startWorkout: (data: any) => ipcRenderer.invoke('start-workout', data),
  pauseWorkout: () => ipcRenderer.invoke('pause-workout'),
  stopWorkout: () => ipcRenderer.invoke('stop-workout'),
  loadPlaylist: (playlistData: any) => ipcRenderer.invoke('load-playlist', playlistData),

  // 심박수 및 모니터링
  updateHeartRate: (heartRateData: any) => ipcRenderer.invoke('update-heart-rate', heartRateData),
  getHeartRateThreshold: () => ipcRenderer.invoke('get-heart-rate-threshold'),

  // 디스플레이 관리
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  repositionWindows: () => ipcRenderer.invoke('reposition-windows'),

  // 앱 제어
  quitApp: () => ipcRenderer.invoke('quit-app'),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  getWindowMode: () => ipcRenderer.invoke('get-window-mode'),
  getScreenMode: () => ipcRenderer.invoke('get-screen-mode'),
  notifyIntroPlaybackEnded: () => ipcRenderer.invoke('intro-playback-ended'),

  // 디바이스 등록 관리
  getDeviceInfo: () => ipcRenderer.invoke('get-device-info'),
  wsReconnect: () => ipcRenderer.invoke('ws-reconnect'),
  resetDeviceRegistration: () => ipcRenderer.invoke('reset-device-registration'),

  // 이벤트 리스너 등록
  onWorkoutStarted: (callback: (data: any) => void) => {
    ipcRenderer.on('workout-started', (_, data) => callback(data))
  },
  onWorkoutStopped: (callback: () => void) => {
    ipcRenderer.on('workout-stopped', () => callback())
  },
  onPlaylistLoaded: (callback: (data: any) => void) => {
    ipcRenderer.on('playlist-loaded', (_, data) => callback(data))
  },
  onHeartRateUpdated: (callback: (data: any) => void) => {
    ipcRenderer.on('heart-rate-updated', (_, data) => callback(data))
  },
  onANTConnectionStatus: (callback: (data: any) => void) => {
    ipcRenderer.on('ant-connection-status', (_, data) => callback(data))
  },
  /**
   * 운동 단계 전환 시점에 main 프로세스가 보내는 cleanup 신호.
   * renderer는 status === 'disconnected' 인 심박 카드만 일괄 제거한다.
   * 페이로드의 `reason`은 디버깅·로깅 용도(예: 'ds-to-main', 'water-break', 'main-to-cd').
   */
  onHeartRateCleanupDisconnected: (callback: (data: { reason: string }) => void) => {
    ipcRenderer.on('heart-rate-cleanup-disconnected', (_, data) => callback(data ?? { reason: 'unknown' }))
  },
  onMenuStartWorkout: (callback: () => void) => {
    ipcRenderer.on('menu-start-workout', () => callback())
  },
  onMenuStopWorkout: (callback: () => void) => {
    ipcRenderer.on('menu-stop-workout', () => callback())
  },

  // 운동 플레이 이벤트 리스너 등록
  onWorkoutPlayReady: (callback: (data: any) => void) => {
    ipcRenderer.on('workout-play-ready', (_, data) => callback(data))
  },
  onWorkoutPlayStarted: (callback: (data: any) => void) => {
    ipcRenderer.on('workout-play-started', (_, data) => callback(data))
  },
  onWorkoutPlayPreview: (callback: (data: any) => void) => {
    ipcRenderer.on('workout-play-preview', (_, data) => callback(data))
  },
  onWorkoutPlayPreload: (callback: (data: any) => void) => {
    ipcRenderer.on('workout-play-preload', (_, data) => callback(data))
  },
  onWorkoutPlayClearPreload: (callback: (data?: { preservePreloadCache?: boolean }) => void) => {
    ipcRenderer.on('workout-play-clear-preload', (_, data) => callback(data ?? undefined))
  },
  onWorkoutPlaySequence: (callback: (data: any) => void) => {
    ipcRenderer.on('workout-play-sequence', (_, data) => callback(data))
  },
  onWorkoutPlayCompleted: (callback: (data: any) => void) => {
    ipcRenderer.on('workout-play-completed', (_, data) => callback(data))
  },
  onWorkoutPlayPaused: (callback: (data: any) => void) => {
    ipcRenderer.on('workout-play-paused', (_, data) => callback(data))
  },
  onWorkoutPlayResumed: (callback: (data: any) => void) => {
    ipcRenderer.on('workout-play-resumed', (_, data) => callback(data))
  },
  onWorkoutPlayStopped: (callback: (data: any) => void) => {
    ipcRenderer.on('workout-play-stopped', (_, data) => callback(data))
  },
  onWorkoutStretchingSwitchGroup: (callback: (data: any) => void) => {
    ipcRenderer.on('workout-stretching-switch-group', (_, data) => callback(data))
  },
  onWorkoutSetupQueue: (callback: (data: any) => void) => {
    ipcRenderer.on('workout-setup-queue', (_, data) => callback(data))
  },
  onWorkoutAdvanceSlots: (callback: (data: any) => void) => {
    ipcRenderer.on('workout-advance-slots', (_, data) => callback(data))
  },
  onWorkoutSeekQueue: (callback: (data: { round: number; position: string }) => void) => {
    ipcRenderer.on('workout-seek-queue', (_, data) => callback(data))
  },
  onCountdownStarted: (callback: (data: { phase?: string }) => void) => {
    ipcRenderer.on('countdown-started', (_, data) => callback(data ?? {}))
  },
  onShowSplashBeforeWorkout: (callback: () => void) => {
    ipcRenderer.on('show-splash-before-workout', () => callback())
  },
  onIntroStarted: (callback: (data: any) => void) => {
    ipcRenderer.on('intro-started', (_, data) => callback(data))
  },
  onIntroCancelledResetToReady: (callback: (data?: { showSplash?: boolean }) => void) => {
    ipcRenderer.on('intro-cancelled-reset-to-ready', (_, data) => callback(data ?? {}))
  },
  onIntroFocus: (callback: (data: { target: any }) => void) => {
    ipcRenderer.on('intro-focus', (_, data) => callback(data))
  },
  onIntroFocusCancel: (callback: () => void) => {
    ipcRenderer.on('intro-focus-cancel', () => callback())
  },
  onMonitorDisplayUpdated: (callback: (data: { display: any; context?: string }) => void) => {
    ipcRenderer.on('monitor-display-updated', (_, data) => callback(data))
  },
  onWindowModeChanged: (callback: (data: { isFullscreen: boolean }) => void) => {
    ipcRenderer.on('window-mode-changed', (_, data) => callback(data))
  },
  onConfigUpdated: (callback: (config: { displayLabel?: string }) => void) => {
    ipcRenderer.on('config-updated', (_, config) => callback(config))
  },

  // 디바이스 등록 이벤트 리스너
  onDeviceRegisterCode: (callback: (data: { code: string; expiresIn: number; deviceId: string }) => void) => {
    ipcRenderer.on('device-register-code', (_, data) => callback(data))
  },
  onDeviceRegistered: (callback: (data: { displayLabel?: string; storeId?: number }) => void) => {
    ipcRenderer.on('device-registered', (_, data) => callback(data))
  },
  onWsRelayStatus: (callback: (data: { connected: boolean; error?: string }) => void) => {
    ipcRenderer.on('ws-relay-status', (_, data) => callback(data))
  },
  onDisplayLabelUpdated: (callback: (data: { displayLabel: string }) => void) => {
    ipcRenderer.on('display-label-updated', (_, data) => callback(data))
  },

  // 큐 프리로드 알림 (renderer → main)
  notifyQueuePreloadReady: (side: string) => {
    ipcRenderer.send('workout-queue-preload-ready', side)
  },

  // 이벤트 리스너 제거
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  }
} as ElectronAPI)