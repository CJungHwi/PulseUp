export type HeartRateAntState = 'disabled' | 'initializing' | 'ready' | 'failed'

export type HeartRateSlotState = 'empty' | 'connected' | 'disconnected' | 'reconnecting'

export type HeartRateUploadStatus = {
  bufferCount: number
  queue: {
    exists: boolean
    bytes: number
    mtimeMs: number | null
  }
  lastUpload: unknown
}

export type HeartRateSlotDiagnostics = {
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

export type HeartRateAntDiagnostics = {
  state: HeartRateAntState
  ready: boolean
  staleTimeoutMs: number
  gracePeriodMs: number
  lastError: string | null
  slots: HeartRateSlotDiagnostics[]
}

export type HeartRateDiagnosticsSnapshot = {
  generatedAt: string
  ant: HeartRateAntDiagnostics
  upload: HeartRateUploadStatus
  summary: {
    connectedSlots: number
    reconnectingSlots: number
    hasUploadBacklog: boolean
    primaryIssue: string | null
    hints: string[]
  }
}
