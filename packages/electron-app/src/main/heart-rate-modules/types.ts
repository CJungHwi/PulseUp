/**
 * 심박수 모듈 공통 타입 (main process)
 */

export interface HeartRateReading {
  deviceId?: string
  deviceName?: string
  timestamp: Date
  heartRate: number
  zone?: string
  slotNumber?: number | null
}

/** HeartRateManager가 IPCHandlers에 의존하는 최소 인터페이스 */
export interface HeartRateManagerDeps {
  broadcastToAllWindows: (channel: string, data: any) => void
  fetchWithTimeout: (input: string, init: RequestInit, timeoutMs: number) => Promise<Response>
  buildAuthHeaders: () => Record<string, string>
  getWebAppUrl: () => string
  getActivePlaySession: () => { userId?: string; masterId?: string } | null
  getActiveSession: () => { heartRateData: HeartRateReading[] } | null
}
