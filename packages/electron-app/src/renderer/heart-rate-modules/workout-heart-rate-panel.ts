/// <reference path="../../types/electron.d.ts" />

import type { HeartRateDeviceEntry } from './types.js'
import { getWorkoutPanelHeartRateColor } from './workout-panel-heart-styles.js'
import { subscribeRendererHeartIpc } from './renderer-heart-ipc.js'
import { formatHeartRateDeviceShortName } from './format-device-name.js'
import {
  getDeviceCardVisualStyle,
  renderOfflineBadgeHtml,
} from './device-card-status-style.js'
import { workoutInfoDevLog } from '../workout-dev-log.js'

export type { HeartRateDeviceEntry } from './types.js'

/**
 * 타이머 모니터 우측 심박 그리드: HTML 생성, ANT+ IPC, DOM 갱신
 */
export class WorkoutHeartRatePanel {
  private readonly heartRateData = new Map<string, HeartRateDeviceEntry>()
  private heartRateThreshold = 120
  private unsubscribeHeartIpc: (() => void) | null = null
  private cleanupSubscribed = false

  renderRightPanelHtml(): string {
    return `
      <div style="
        flex: 1;
        display: flex; 
        flex-direction: column; 
        height: 100vh;
        width: 100%;
        background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
        overflow: hidden;
        padding: 15px;
      ">
        <div id="heart-rate-grid-container" style="
          display: grid;
          grid-template-rows: repeat(4, minmax(0, 1fr));
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
          width: 100%;
          height: 100%;
        ">
          ${this.createLargeHeartRateBoxes()}
        </div>
      </div>
    `
  }

  async loadThresholdFromSettings(): Promise<void> {
    if (window.electronAPI && window.electronAPI.getHeartRateThreshold) {
      try {
        const result = await window.electronAPI.getHeartRateThreshold()
        if (result && result.success) {
          this.heartRateThreshold = result.threshold
          workoutInfoDevLog(`💓 심박수 임계값 업데이트: ${this.heartRateThreshold} BPM`)
          if (this.heartRateData.size > 0) {
            this.refreshGrid()
          }
        }
      } catch (error) {
        console.error('심박수 임계값 가져오기 실패:', error)
      }
    }
  }

  setupListeners(): void {
    this.unsubscribeHeartIpc?.()
    this.unsubscribeHeartIpc = subscribeRendererHeartIpc({
      onHeartRate: (data) => {
        if (!data.slotNumber || !data.deviceName) return

        const deviceId = `slot-${data.slotNumber}`
        const prev = this.heartRateData.get(deviceId)
        const wasDisconnected = prev?.status === 'disconnected'
        const entry: HeartRateDeviceEntry = {
          deviceName: `${data.deviceName} (슬롯${data.slotNumber})`,
          heartRate: data.heartRate || 0,
          status: 'connected',
          lastSeenAt: Date.now(),
        }
        this.heartRateData.set(deviceId, entry)

        // 새 기기 추가 또는 disabled에서 복귀한 경우 전체 리빌드(보더/뱃지/필터 변화 적용)
        if (!prev || wasDisconnected) {
          this.refreshGrid()
        } else {
          this.updateSingleDevice(deviceId, entry)
        }
      },
      onAntConnection: (data) => {
        const deviceId = `slot-${data.slotNumber}`
        if (data.isConnected) {
          workoutInfoDevLog(`슬롯 ${data.slotNumber} 연결됨: ${data.deviceName}`)
          // onHeartRate가 곧바로 따라오지만, 즉시 활성화 시각이 필요하면 여기서도 갱신
          const prev = this.heartRateData.get(deviceId)
          if (prev && prev.status === 'disconnected') {
            this.heartRateData.set(deviceId, {
              ...prev,
              deviceName: `${data.deviceName} (슬롯${data.slotNumber})`,
              status: 'connected',
              lastSeenAt: Date.now(),
            })
            this.refreshGrid()
          }
        } else {
          workoutInfoDevLog(`슬롯 ${data.slotNumber} 연결 해제됨 → disabled 처리`)
          const prev = this.heartRateData.get(deviceId)
          if (!prev) return
          this.heartRateData.set(deviceId, {
            ...prev,
            heartRate: 0,
            status: 'disconnected',
            lastSeenAt: Date.now(),
            disconnectReason: data.reason,
            secondsSinceLastUpdate: data.secondsSinceLastUpdate,
            reconnecting: data.reconnecting,
            reconnectExpiresInSec: data.reconnectExpiresInSec,
          })
          this.refreshGrid()
        }
      },
    })

    this.subscribeCleanupChannel()
  }

  /**
   * main 프로세스가 운동 단계 전환 시점에 보내는 cleanup 신호 구독.
   * status === 'disconnected' 인 카드만 일괄 제거한다.
   * preload의 ipcRenderer.on은 off 수단을 제공하지 않으므로 한 번만 등록한다.
   */
  private subscribeCleanupChannel(): void {
    if (this.cleanupSubscribed) return
    const api = window.electronAPI
    if (!api || typeof api.onHeartRateCleanupDisconnected !== 'function') return

    api.onHeartRateCleanupDisconnected((data) => {
      this.removeDisconnectedDevices(data?.reason || 'main 신호')
    })
    this.cleanupSubscribed = true
  }

  /** disabled(끊김) 카드만 제거하고 그리드를 다시 그린다. */
  removeDisconnectedDevices(reason: string = 'manual'): void {
    let removed = 0
    for (const [deviceId, entry] of this.heartRateData.entries()) {
      if (entry.status === 'disconnected') {
        this.heartRateData.delete(deviceId)
        removed++
      }
    }
    if (removed > 0) {
      workoutInfoDevLog(`🧹 끊긴 심박 슬롯 ${removed}개 일괄 정리 (${reason})`)
      this.refreshGrid()
    }
  }

  refreshGrid(): void {
    const container = document.getElementById('heart-rate-grid-container')
    if (container) {
      container.innerHTML = this.createLargeHeartRateBoxes()
    }
  }

  /** 개별 디바이스의 심박수·스타일만 타겟 업데이트 (전체 리빌드 방지) */
  private updateSingleDevice(deviceId: string, entry: HeartRateDeviceEntry): void {
    const boxEl = document.getElementById(`heart-rate-box-${deviceId}`)
    if (!boxEl) {
      this.refreshGrid()
      return
    }

    const valueEl = document.getElementById(`heart-rate-value-${deviceId}`)
    const heartSvg = document.getElementById(`heart-svg-${deviceId}`)

    const visual = getDeviceCardVisualStyle(entry.status, entry.heartRate)

    boxEl.style.background = visual.bg
    boxEl.style.border = visual.border
    boxEl.style.boxShadow = visual.shadow
    boxEl.style.filter = visual.filter
    boxEl.style.opacity = String(visual.opacity)

    if (valueEl) {
      valueEl.textContent = visual.bpmDisplay
      valueEl.style.color = visual.textColor
      valueEl.style.textShadow = visual.bpmTextShadow
    }

    if (heartSvg) {
      const pathEl = heartSvg.querySelector('path')
      if (pathEl) pathEl.setAttribute('fill', visual.heartColor)
      heartSvg.style.animation = visual.heartAnimation
    }
  }

  private createLargeHeartRateBoxes(): string {
    if (this.heartRateData.size === 0) {
      return `
        <div style="
          grid-column: 1 / -1;
          grid-row: 1 / -1;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
        ">
          <div style="
            width: 100%;
            max-width: 720px;
            padding: 36px 32px;
            border-radius: 16px;
            border: 2px solid rgba(255, 255, 255, 0.10);
            background: rgba(0, 0, 0, 0.35);
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
          text-align: center;
        ">
            <div style="
              font-size: 18px;
              font-weight: 900;
              letter-spacing: 6px;
              color: rgba(255, 255, 255, 0.55);
              margin-bottom: 16px;
              text-transform: uppercase;
            ">HEART RATE</div>
            <div style="
              font-size: 60px;
              font-weight: 900;
              color: #FFD700;
              letter-spacing: 2px;
              text-shadow: 0 0 26px rgba(255, 215, 0, 0.35);
              line-height: 1.1;
            ">심박계를 연결하세요</div>
            <div style="
              margin-top: 18px;
              font-size: 22px;
              font-weight: 700;
              color: rgba(255, 255, 255, 0.65);
              line-height: 1.4;
            ">
              ANT+ 동글 및 심박계를 확인해주세요
            </div>
          </div>
        </div>
      `
    }

    const devices = Array.from(this.heartRateData.entries())
    return devices
      .map(([deviceId, data]) => {
        const deviceNameMatch = data.deviceName.match(/^(.+?)\s*\(슬롯(\d+)\)$/)
        const rawDeviceName = deviceNameMatch ? deviceNameMatch[1] : data.deviceName
        const deviceName = formatHeartRateDeviceShortName(rawDeviceName)
        const slotNumber = deviceNameMatch ? deviceNameMatch[2] : ''

        const visual = getDeviceCardVisualStyle(data.status, data.heartRate)
        const offlineBadge = visual.showOfflineBadge ? renderOfflineBadgeHtml() : ''
        const offlineDetail = data.status === 'disconnected' ? this.renderOfflineDetail(data) : ''

        return `
        <div id="heart-rate-box-${deviceId}" style="
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: ${visual.bg};
          border: ${visual.border};
          border-radius: 12px;
          padding: 15px;
          transition: all 0.3s ease;
          box-shadow: ${visual.shadow};
          filter: ${visual.filter};
          opacity: ${visual.opacity};
          min-width: 0;
          min-height: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          box-sizing: border-box;
        ">
          ${offlineBadge}
          <div style="
            font-size: 48px;
            font-weight: bold;
            color: #fff;
            text-align: center;
            line-height: 1.2;
          ">
            ${deviceName}
          </div>
          <div style="
            font-size: 18px;
            font-weight: 600;
            color: #aaa;
            margin-bottom: 12px;
            text-align: center;
          ">
            ${slotNumber ? `(슬롯${slotNumber})` : ''}
          </div>
          ${offlineDetail}
          <svg id="heart-svg-${deviceId}" width="70" height="70" viewBox="0 0 24 24" style="margin-bottom: 12px; animation: ${visual.heartAnimation};">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="${visual.heartColor}"/>
          </svg>
          <div style="
            display: flex;
            align-items: center;
            gap: 10px;
          ">
            <span id="heart-rate-value-${deviceId}" style="
              font-size: 60px;
              font-weight: bold;
              color: ${visual.textColor};
              text-shadow: ${visual.bpmTextShadow};
            ">${visual.bpmDisplay}</span>
            <span style="
              font-size: 28px;
              color: #666;
            ">BPM</span>
          </div>
        </div>
      `
      })
      .join('')
  }

  private renderOfflineDetail(data: HeartRateDeviceEntry): string {
    const staleText = typeof data.secondsSinceLastUpdate === 'number'
      ? `${data.secondsSinceLastUpdate}초 동안 데이터 없음`
      : '심박 데이터 수신 중단'
    const reconnectText = data.reconnecting
      ? `자동 재연결 대기${typeof data.reconnectExpiresInSec === 'number' ? ` (${data.reconnectExpiresInSec}초)` : ''}`
      : '심박계 전원/배터리/착용 위치 확인'

    return `
      <div style="
        width: 100%;
        max-width: 260px;
        margin: -4px 0 10px;
        padding: 8px 10px;
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.28);
        color: rgba(255, 255, 255, 0.72);
        font-size: 14px;
        font-weight: 700;
        line-height: 1.35;
        text-align: center;
      ">
        <div>${staleText}</div>
        <div style="margin-top: 2px; color: rgba(255, 255, 255, 0.52);">${reconnectText}</div>
      </div>
    `
  }

  updateHeartRateDisplay(index: number, heartRate: number): void {
    const valueEl = document.getElementById(`heart-rate-value-${index}`)
    const heartSvg = document.getElementById(`heart-svg-${index}`)
    const boxEl = document.getElementById(`heart-rate-box-${index}`)

    if (valueEl) {
      if (heartRate > 0) {
        valueEl.textContent = heartRate.toString()
        valueEl.style.color = getWorkoutPanelHeartRateColor(heartRate)
        if (boxEl && boxEl.classList.contains('heart-rate-box-blurred')) {
          boxEl.classList.remove('heart-rate-box-blurred')
          boxEl.style.filter = 'none'
          boxEl.style.borderColor = '#4CAF50'
        }
      } else {
        valueEl.textContent = '--'
        valueEl.style.color = '#888'
      }
    }

    if (heartSvg && heartRate > 0) {
      const bpm = heartRate
      const animationDuration = 60 / bpm
      heartSvg.style.animation = `heartbeat ${animationDuration}s ease-in-out infinite`
      if (!document.getElementById('heartbeat-keyframes')) {
        const style = document.createElement('style')
        style.id = 'heartbeat-keyframes'
        style.textContent = `
          @keyframes heartbeat {
            0%, 100% { 
              transform: scale(1);
              filter: drop-shadow(0 0 10px rgba(255, 82, 82, 0.5));
            }
            8% { 
              transform: scale(1.3);
              filter: drop-shadow(0 0 30px rgba(255, 82, 82, 1));
            }
            16% { 
              transform: scale(1);
              filter: drop-shadow(0 0 10px rgba(255, 82, 82, 0.5));
            }
            28% { 
              transform: scale(1.25);
              filter: drop-shadow(0 0 28px rgba(255, 82, 82, 0.9));
            }
            36% { 
              transform: scale(1);
              filter: drop-shadow(0 0 10px rgba(255, 82, 82, 0.5));
            }
            50% {
              transform: scale(1);
              filter: drop-shadow(0 0 10px rgba(255, 82, 82, 0.5));
            }
          }
        `
        document.head.appendChild(style)
      }
    } else if (heartSvg) {
      heartSvg.style.animation = 'none'
    }
  }

  startMockHeartRate(): void {
    setInterval(() => {
      for (let i = 0; i < 10; i++) {
        const mockHeartRate = 60 + Math.floor(Math.random() * 80)
        this.updateHeartRateDisplay(i, mockHeartRate)
      }
    }, 2000)
  }
}
