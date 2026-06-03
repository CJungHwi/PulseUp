import { apiClient } from './api.service'

export interface Device {
  id: number
  deviceId: string
  displayLabel: string
  status: 'pending' | 'approved' | 'blocked'
  isOnline: boolean
  lastSeenAt: string | null
  ipAddress: string | null
}

export interface DeviceRegisterResponse {
  success: boolean
  message?: string
  device?: Device
  error?: string
}

export interface DevicesListResponse {
  success: boolean
  devices: Device[]
  error?: string
}

export interface DeviceControlLockInfo {
  locked: boolean
  isOwner: boolean
  lock: {
    userid: string
    lockedAt: string
    lastSeenAt: string
  } | null
}

export type HeartRateAntState = 'disabled' | 'initializing' | 'ready' | 'failed'
export type HeartRateSlotState = 'empty' | 'connected' | 'disconnected' | 'reconnecting'

export interface HeartRateSlotDiagnostics {
  slotNumber: number
  state: HeartRateSlotState
  deviceId: number
  deviceName: string
  heartRate: number
  lastUpdate: number
  secondsSinceLastUpdate: number | null
  reconnecting: boolean
  reconnectExpiresInSec: number | null
}

export interface HeartRateDiagnostics {
  generatedAt: string
  ant: {
    state: HeartRateAntState
    ready: boolean
    staleTimeoutMs: number
    gracePeriodMs: number
    lastError: string | null
    slots: HeartRateSlotDiagnostics[]
  }
  upload: {
    bufferCount: number
    queue: {
      exists: boolean
      bytes: number
      mtimeMs: number | null
    }
    lastUpload: unknown
  }
  summary: {
    connectedSlots: number
    reconnectingSlots: number
    hasUploadBacklog: boolean
    primaryIssue: string | null
    hints: string[]
  }
}

const CONTROLLER_ID_STORAGE_KEY = 'linkhiitControllerId'

export const getControllerId = (): string => {
  try {
    const existing = localStorage.getItem(CONTROLLER_ID_STORAGE_KEY)
    if (existing) return existing

    const generated = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

    localStorage.setItem(CONTROLLER_ID_STORAGE_KEY, generated)
    return generated
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

/**
 * 현재 매장의 등록된 디바이스 목록 조회
 */
export const getDevices = async (): Promise<Device[]> => {
  const response = await apiClient.get<DevicesListResponse>('/devices')
  if (response.data.success) {
    return response.data.devices
  }
  throw new Error(response.data.error || '디바이스 목록 조회 실패')
}

/**
 * 현재 온라인 상태인 디바이스 목록 조회
 */
export const getOnlineDevices = async (): Promise<Device[]> => {
  const response = await apiClient.get<DevicesListResponse>('/devices/online')
  if (response.data.success) {
    return response.data.devices
  }
  throw new Error(response.data.error || '온라인 디바이스 조회 실패')
}

/**
 * 실시간 연결된 디바이스 목록 (WebSocket 연결 기준)
 */
export const getConnectedDevices = async (): Promise<{ deviceId: string; displayLabel: string; storeId: number | null }[]> => {
  const response = await apiClient.get<{ success: boolean; devices: { deviceId: string; displayLabel: string; storeId: number | null }[] }>('/electron-relay/connected')
  if (response.data.success) {
    return response.data.devices
  }
  return []
}

/**
 * 등록 코드로 디바이스 등록
 */
export const registerDevice = async (code: string, displayLabel: string): Promise<DeviceRegisterResponse> => {
  try {
    const response = await apiClient.post<DeviceRegisterResponse>('/devices/register', {
      code: code.toUpperCase().trim(),
      displayLabel: displayLabel.trim()
    })
    return response.data
  } catch (error: any) {
    // Axios 에러의 경우 서버 응답에서 에러 메시지 추출
    if (error.response?.data) {
      return {
        success: false,
        error: error.response.data.error || error.response.data.message || '등록에 실패했습니다.'
      }
    }
    return {
      success: false,
      error: error.message || '등록 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 디바이스 표시 이름 변경
 */
export const updateDeviceLabel = async (deviceId: number, displayLabel: string): Promise<void> => {
  await apiClient.put(`/devices/${deviceId}/label`, { displayLabel })
}

/**
 * 디바이스 삭제 (연결 해제)
 */
export const deleteDevice = async (deviceId: number): Promise<void> => {
  await apiClient.delete(`/devices/${deviceId}`)
}

/**
 * 특정 디바이스 연결 상태 확인
 */
export const checkDeviceStatus = async (deviceId: string): Promise<boolean> => {
  try {
    const response = await apiClient.get<{ success: boolean; isConnected: boolean }>(`/electron-relay/status/${deviceId}`, {
      params: { controllerId: getControllerId() }
    })
    return response.data.isConnected
  } catch {
    return false
  }
}

export const getControlLockStatus = async (deviceId: string): Promise<DeviceControlLockInfo> => {
  const response = await apiClient.get<{ success: boolean; controlLock: DeviceControlLockInfo }>(
    `/electron-relay/control-lock/status/${deviceId}`,
    { params: { controllerId: getControllerId() } }
  )
  return response.data.controlLock
}

export const releaseControlLock = async (deviceId: string): Promise<boolean> => {
  const response = await apiClient.post<{ success: boolean; released: boolean }>('/electron-relay/control-lock/release', {
    deviceId,
    controllerId: getControllerId()
  })
  return !!response.data.released
}

/**
 * 디바이스에 명령 전송
 */
export const sendDeviceCommand = async (
  deviceId: string,
  command: string,
  data: any = {}
): Promise<any> => {
  try {
    const response = await apiClient.post('/electron-relay/command', {
      deviceId,
      command,
      controllerId: getControllerId(),
      data
    })

    if (!response.data.success) {
      throw new Error(response.data.error || '명령 전송 실패')
    }

    return response.data.data
  } catch (error: any) {
    const serverError: string | undefined = error?.response?.data?.error || error?.response?.data?.message
    if (serverError) {
      throw new Error(serverError)
    }
    if (error instanceof Error) {
      throw error
    }
    throw new Error('명령 전송 실패')
  }
}

/**
 * 운동 시작 (서버 중계)
 *
 * 503: 디바이스(=LINKHIIT 앱)가 서버에 연결되어 있지 않은 상태.
 *      axios 기본 메시지("Request failed with status code 503") 대신
 *      사용자에게 의미 있는 한글 안내 메시지로 변환해서 throw 한다.
 */
export const startWorkoutPlay = async (
  deviceId: string,
  playData: {
    masterId: string | number
    userId: string | number
    sequences: any[]
    metadata?: any
  }
): Promise<any> => {
  try {
    const response = await apiClient.post('/electron-relay/start-workout-play', {
      deviceId,
      controllerId: getControllerId(),
      ...playData
    })

    if (!response.data.success) {
      throw new Error(response.data.error || '운동 시작 실패')
    }

    return response.data.data
  } catch (error: any) {
    const status: number | undefined = error?.response?.status
    const serverError: string | undefined = error?.response?.data?.error || error?.response?.data?.message

    if (status === 503) {
      throw new Error('LINKHIIT 앱이 실행되어 있지 않거나 서버와 연결되어 있지 않습니다.\n매장 PC에서 LINKHIIT 앱을 실행한 후 다시 시도해주세요.')
    }

    if (status === 423) {
      throw new Error(serverError || '다른 태블릿에서 이 LINKHIIT 앱을 제어 중입니다. 기존 연결을 끊은 후 다시 시도해주세요.')
    }

    if (status === 401 || status === 403) {
      throw new Error(serverError || '운동 시작 권한이 없거나 로그인이 만료되었습니다.')
    }

    if (serverError) {
      throw new Error(serverError)
    }

    if (error instanceof Error) {
      throw error
    }

    throw new Error('운동 시작 실패')
  }
}

/**
 * 운동 시작 (대기 -> 재생)
 */
export const playStart = async (deviceId: string): Promise<any> => {
  return sendDeviceCommand(deviceId, 'play-start', {})
}

/**
 * 일시정지/재개
 */
export const playPause = async (deviceId: string): Promise<any> => {
  return sendDeviceCommand(deviceId, 'play-pause', {})
}

/**
 * 운동 종료
 */
export const playStop = async (deviceId: string): Promise<any> => {
  return sendDeviceCommand(deviceId, 'play-stop', {})
}

/**
 * 다음 운동
 */
export const playNext = async (deviceId: string): Promise<any> => {
  return sendDeviceCommand(deviceId, 'play-next', {})
}

/**
 * 이전 운동
 */
export const playPrevious = async (deviceId: string): Promise<any> => {
  return sendDeviceCommand(deviceId, 'play-previous', {})
}

/** 인트로 시작 */
export const playIntro = async (deviceId: string): Promise<{ success?: boolean }> => {
  return sendDeviceCommand(deviceId, 'play-intro', {})
}

/** 인트로 취소 — 준비(프리뷰) 화면으로 복귀 */
export const cancelIntro = async (deviceId: string): Promise<{ success?: boolean }> => {
  return sendDeviceCommand(deviceId, 'cancel-intro', {})
}

/** 인트로 선택보기 — A/B/C + 번호로 하단 확대 재생 */
export const sendIntroFocus = async (
  deviceId: string,
  payload: { zone: string; number: number; positionCode?: string },
): Promise<{ success?: boolean; positionCode?: string }> => {
  return sendDeviceCommand(deviceId, 'intro-focus', payload)
}

/** 인트로 선택보기 취소 — 하단 이미지 복원 및 선택 해제 */
export const sendIntroFocusCancel = async (deviceId: string): Promise<{ success?: boolean }> => {
  return sendDeviceCommand(deviceId, 'intro-focus-cancel', {})
}

/**
 * Electron 앱의 현재 운동 로그를 서버로 전송
 */
export const sendWorkoutLogs = async (deviceId: string): Promise<{
  fileCount: number
  totalBytes: number
  serverFileName?: string
  relativePath?: string
}> => {
  const commandResult = await sendDeviceCommand(deviceId, 'send-workout-logs', {})
  const result = commandResult && typeof commandResult === 'object' && 'success' in commandResult
    ? (() => {
        if (commandResult.success === false) {
          throw new Error(commandResult.error || '현재 운동 로그 전송에 실패했습니다')
        }
        return commandResult.data ?? commandResult
      })()
    : commandResult

  const fileCount = Number(result?.fileCount ?? 0)
  const totalBytes = Number(result?.totalBytes ?? 0)
  const serverFileName = typeof result?.serverFileName === 'string' ? result.serverFileName : undefined
  const relativePath = typeof result?.relativePath === 'string' ? result.relativePath : undefined

  if (!Number.isFinite(fileCount) || fileCount <= 0 || (!serverFileName && !relativePath)) {
    throw new Error('현재 운동 로그가 서버에 저장되지 않았습니다. Electron 앱 로그와 API 서버 로그를 확인해주세요.')
  }

  return {
    fileCount,
    totalBytes,
    serverFileName,
    relativePath,
  }
}

export type ScreenMode = 3 | 5
export type PlaySessionStatus = 'ready' | 'playing' | 'paused' | 'completed'

export interface DeviceSessionStatus {
  hasActivePlaySession: boolean
  playSessionStatus: PlaySessionStatus | null
}

/**
 * 디바이스의 현재 운동 세션 상태 조회 (ws-relay session-status 명령)
 * - hasActivePlaySession: true 이면 활성 세션 존재 (ready/playing/paused/completed)
 * - playSessionStatus: 실제 재생 단계 (서버 측 status)
 */
export const getSessionStatus = async (deviceId: string): Promise<DeviceSessionStatus> => {
  const result = await sendDeviceCommand(deviceId, 'session-status', {})
  return {
    hasActivePlaySession: !!result?.hasActivePlaySession,
    playSessionStatus: (result?.playSession?.status as PlaySessionStatus | undefined) ?? null,
  }
}

export const getHeartRateDiagnostics = async (deviceId: string): Promise<HeartRateDiagnostics> => {
  const response = await apiClient.get<{
    success: boolean
    diagnostics: HeartRateDiagnostics
    error?: string
  }>(`/electron-relay/heart-rate-status/${deviceId}`)

  if (!response.data.success || !response.data.diagnostics) {
    throw new Error(response.data.error || '심박 진단 상태 조회 실패')
  }

  return response.data.diagnostics
}

type ScreenModeWire = 'three' | 'five'

const toScreenMode = (wire: unknown): ScreenMode => (wire === 'five' || wire === 5 ? 5 : 3)
const toWireMode = (mode: ScreenMode): ScreenModeWire => (mode === 5 ? 'five' : 'three')

/**
 * 디바이스의 현재 화면 구성 모드 조회 (3: 좌중우 / 5: 좌외-좌내-중-우내-우외)
 */
export const getScreenMode = async (deviceId: string): Promise<ScreenMode> => {
  const result = await sendDeviceCommand(deviceId, 'get-screen-mode', {})
  return toScreenMode(result?.mode)
}

/**
 * 디바이스 화면 구성 모드 변경
 * - 운동 진행 중에는 거부됨 (error: 'WORKOUT_ACTIVE')
 * - sendDeviceCommand는 실패 시 throw 하므로, 운동중 거절을 분기하기 위해 자체 catch 처리
 * - 5분할 요청 시 모니터가 부족하면 fallbackToThree=true (전기 적용은 됐지만 3분할 레이아웃 표시)
 */
export const setScreenMode = async (
  deviceId: string,
  mode: ScreenMode
): Promise<{
  success: boolean
  mode: ScreenMode
  error?: string
  fallbackToThree?: boolean
  monitorCount?: number
}> => {
  try {
    const result = await sendDeviceCommand(deviceId, 'set-screen-mode', { mode: toWireMode(mode) })
    return {
      success: true,
      mode: toScreenMode(result?.mode ?? toWireMode(mode)),
      fallbackToThree: !!result?.fallbackToThree,
      monitorCount: typeof result?.monitorCount === 'number' ? result.monitorCount : undefined,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '화면 모드 변경 실패'
    const isWorkoutActive = /workout-active|운동\s*진행/i.test(message)
    return {
      success: false,
      mode,
      error: isWorkoutActive ? 'WORKOUT_ACTIVE' : message,
    }
  }
}
