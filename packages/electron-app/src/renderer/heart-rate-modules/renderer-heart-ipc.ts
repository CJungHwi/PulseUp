/// <reference path="../../types/electron.d.ts" />

/**
 * main → renderer 심박/ANT 브로드캐스트를 한 번만 ipcRenderer.on 등록하고 팬아웃.
 * 여러 UI(타이머 패널, 디바이스 연결 화면)가 중복 리스너를 두지 않도록 한다.
 */

export interface HeartRateBroadcastPayload {
  heartRate: number
  slotNumber?: number
  deviceName?: string
  deviceId?: number
}

export interface AntConnectionBroadcastPayload {
  slotNumber: number
  isConnected: boolean
  deviceName: string
  reason?: string
  lastUpdate?: number
  secondsSinceLastUpdate?: number
  reconnecting?: boolean
  reconnectExpiresInSec?: number | null
}

type HeartRateHandler = (data: HeartRateBroadcastPayload) => void
type AntConnectionHandler = (data: AntConnectionBroadcastPayload) => void

let ipcBound = false
const heartRateHandlers = new Set<HeartRateHandler>()
const antConnectionHandlers = new Set<AntConnectionHandler>()

const bindRendererHeartIpcOnce = (): void => {
  if (ipcBound) return
  ipcBound = true
  if (!window.electronAPI) return

  window.electronAPI.onHeartRateUpdated((raw: any) => {
    const payload: HeartRateBroadcastPayload = {
      heartRate: typeof raw?.heartRate === 'number' ? raw.heartRate : 0,
      slotNumber: raw?.slotNumber,
      deviceName: raw?.deviceName,
      deviceId: raw?.deviceId,
    }
    heartRateHandlers.forEach((h) => h(payload))
  })

  window.electronAPI.onANTConnectionStatus((raw: any) => {
    const payload: AntConnectionBroadcastPayload = {
      slotNumber: Number(raw?.slotNumber) || 0,
      isConnected: !!raw?.isConnected,
      deviceName: typeof raw?.deviceName === 'string' ? raw.deviceName : '',
      reason: typeof raw?.reason === 'string' ? raw.reason : undefined,
      lastUpdate: typeof raw?.lastUpdate === 'number' ? raw.lastUpdate : undefined,
      secondsSinceLastUpdate: typeof raw?.secondsSinceLastUpdate === 'number' ? raw.secondsSinceLastUpdate : undefined,
      reconnecting: typeof raw?.reconnecting === 'boolean' ? raw.reconnecting : undefined,
      reconnectExpiresInSec: typeof raw?.reconnectExpiresInSec === 'number' ? raw.reconnectExpiresInSec : null,
    }
    antConnectionHandlers.forEach((h) => h(payload))
  })
}

export type RendererHeartIpcSubscription = {
  onHeartRate?: HeartRateHandler
  onAntConnection?: AntConnectionHandler
}

/**
 * @returns 구독 해제 함수
 */
export const subscribeRendererHeartIpc = (sub: RendererHeartIpcSubscription): (() => void) => {
  bindRendererHeartIpcOnce()
  if (sub.onHeartRate) heartRateHandlers.add(sub.onHeartRate)
  if (sub.onAntConnection) antConnectionHandlers.add(sub.onAntConnection)

  return () => {
    if (sub.onHeartRate) heartRateHandlers.delete(sub.onHeartRate)
    if (sub.onAntConnection) antConnectionHandlers.delete(sub.onAntConnection)
  }
}
