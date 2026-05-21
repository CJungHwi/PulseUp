/** 운동 타이머 우측 심박 그리드 — 디바이스별 표시용 */
export type HeartRateDeviceStatus = 'connected' | 'disconnected'

export type HeartRateDeviceEntry = {
  deviceName: string
  heartRate: number
  status: HeartRateDeviceStatus
  /** 마지막으로 데이터/연결 상태 수신한 시각(ms). 디버깅·정렬용 */
  lastSeenAt: number
  disconnectReason?: string
  secondsSinceLastUpdate?: number
  reconnecting?: boolean
  reconnectExpiresInSec?: number | null
}
