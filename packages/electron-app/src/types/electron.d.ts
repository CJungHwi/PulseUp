// Web Bluetooth API 타입 정의
declare global {
  interface Navigator {
    bluetooth: Bluetooth
  }

  interface Bluetooth {
    requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>
    getDevices(): Promise<BluetoothDevice[]>
  }

  interface RequestDeviceOptions {
    filters?: BluetoothLEScanFilter[]
    optionalServices?: BluetoothServiceUUID[]
  }

  interface BluetoothLEScanFilter {
    services?: BluetoothServiceUUID[]
    name?: string
    namePrefix?: string
  }

  type BluetoothServiceUUID = number | string

  interface BluetoothDevice {
    id: string
    name?: string
    gatt?: BluetoothRemoteGATTServer
    addEventListener(type: 'gattserverdisconnected', listener: () => void): void
  }

  interface BluetoothRemoteGATTServer {
    connected: boolean
    device: BluetoothDevice
    connect(): Promise<BluetoothRemoteGATTServer>
    disconnect(): void
    getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>
  }

  interface BluetoothRemoteGATTService {
    device: BluetoothDevice
    uuid: string
    getCharacteristic(characteristic: BluetoothServiceUUID): Promise<BluetoothRemoteGATTCharacteristic>
  }

  interface BluetoothRemoteGATTCharacteristic {
    service: BluetoothRemoteGATTService
    uuid: string
    value?: DataView
    startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
    stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
    addEventListener(type: 'characteristicvaluechanged', listener: (event: Event) => void): void
  }
}

// Electron API 타입 정의
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

  // 이벤트 리스너
  onWorkoutStarted: (callback: (data: any) => void) => void
  onWorkoutStopped: (callback: () => void) => void
  onPlaylistLoaded: (callback: (data: any) => void) => void
  onHeartRateUpdated: (callback: (data: any) => void) => void
  onANTConnectionStatus: (callback: (data: any) => void) => void
  onHeartRateCleanupDisconnected: (callback: (data: { reason: string }) => void) => void
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
  onCountdownStarted: (callback: (data: { phase?: 'session-start' | 'segment-transition' }) => void) => void
  onIntroStarted: (callback: (data: any) => void) => void
  onIntroCancelledResetToReady: (callback: (data?: { showSplash?: boolean }) => void) => void
  onWindowModeChanged: (callback: (data: { isFullscreen: boolean }) => void) => void
  onConfigUpdated?: (callback: (config: { displayLabel?: string }) => void) => void

  // 디바이스 등록 관리
  getDeviceInfo?: () => Promise<{
    deviceId: string
    isRegistered: boolean
    displayLabel?: string
    registerCode: string | null
    registerCodeExpiresAt: number | null
    isWsConnected: boolean
  }>

  // 디바이스 등록 이벤트 리스너
  onDeviceRegisterCode?: (callback: (data: { code: string; expiresIn: number; deviceId: string }) => void) => void
  onDeviceRegistered?: (callback: (data: { displayLabel?: string; storeId?: number }) => void) => void
  onDisplayLabelUpdated?: (callback: (data: { displayLabel: string }) => void) => void

  // 큐 프리로드 알림
  notifyQueuePreloadReady: (side: string) => void

  // 이벤트 리스너 제거
  removeAllListeners: (channel: string) => void
}

// 운동 시퀀스 타입 정의
export interface ExerciseSequence {
  id: string
  workout_history_master_id: string
  sequence: number
  round: number
  exercise_type: 'exercise' | 'rest' | 'water'
  exercise_id?: string
  exercise_name: string
  duration: number
  reps?: number
  position?: string
  name_ko?: string
  name_en?: string
  target_muscles?: string
  equipment?: string
  level?: string
  characteristics?: string
  purpose?: string
  video_url?: string
  video_start_time?: number
  video_end_time?: number
  thumbnail_url?: string
  major_category?: string
  major_category_name?: string
  created_at?: string
  updated_at?: string
}

// 스트레칭 위치 그룹 타입
export interface StretchingPositionGroups {
  L1: ExerciseSequence[]
  L2: ExerciseSequence[]
  L3: ExerciseSequence[]
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}