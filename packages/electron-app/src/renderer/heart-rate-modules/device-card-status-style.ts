/**
 * 운동 패널 심박 카드의 연결 상태별 시각 스타일 헬퍼.
 *
 * - connected: 기존 톤(밝은 보더/글로우/색상 BPM 텍스트)을 그대로 사용한다.
 * - disconnected: 회색조 + 점선 보더 + 낮은 opacity, BPM '--' 표시, 박동 애니메이션 정지.
 *   카드 자체는 유지하여 어떤 슬롯이 끊겼는지 한눈에 파악하도록 한다.
 */

import type { HeartRateDeviceStatus } from './types.js'
import {
  getWorkoutPanelHeartRateColor,
  getWorkoutPanelHeartRateGlowStyle,
} from './workout-panel-heart-styles.js'

export type DeviceCardVisualStyle = {
  bg: string
  border: string
  shadow: string
  textColor: string
  /** 카드 전체에 적용할 filter 값 (회색조 등). 기본은 'none'. */
  filter: string
  /** 카드 전체 opacity. */
  opacity: number
  /** 심장 SVG/아이콘 컬러. */
  heartColor: string
  /** BPM 표시 문자열. disabled면 '--'. */
  bpmDisplay: string
  /** BPM textShadow. disabled면 'none'. */
  bpmTextShadow: string
  /** 'OFFLINE' 뱃지를 표시할지 여부. */
  showOfflineBadge: boolean
  /** 심장 박동 애니메이션 CSS 값. 정지 시 'none'. */
  heartAnimation: string
}

const OFFLINE_BORDER = '2px dashed rgba(255, 255, 255, 0.25)'
const OFFLINE_BG = 'rgba(40, 40, 40, 0.55)'
const OFFLINE_SHADOW = 'none'
const OFFLINE_TEXT_COLOR = 'rgba(255, 255, 255, 0.55)'
const OFFLINE_HEART_COLOR = '#666'

export const getDeviceCardVisualStyle = (
  status: HeartRateDeviceStatus,
  heartRate: number,
): DeviceCardVisualStyle => {
  if (status === 'disconnected') {
    return {
      bg: OFFLINE_BG,
      border: OFFLINE_BORDER,
      shadow: OFFLINE_SHADOW,
      textColor: OFFLINE_TEXT_COLOR,
      filter: 'grayscale(1)',
      opacity: 0.45,
      heartColor: OFFLINE_HEART_COLOR,
      bpmDisplay: '--',
      bpmTextShadow: 'none',
      showOfflineBadge: true,
      heartAnimation: 'none',
    }
  }

  const glow = getWorkoutPanelHeartRateGlowStyle(heartRate)
  const heartColor = heartRate > 0 ? getWorkoutPanelHeartRateColor(heartRate) : '#888'
  return {
    bg: glow.bg,
    border: glow.border,
    shadow: glow.shadow,
    textColor: glow.textColor,
    filter: 'none',
    opacity: 1,
    heartColor,
    bpmDisplay: heartRate > 0 ? String(heartRate) : '--',
    bpmTextShadow: heartRate > 0 ? `0 0 15px ${heartColor}` : 'none',
    showOfflineBadge: false,
    heartAnimation: heartRate > 0 ? `heartbeat ${60 / heartRate}s ease-in-out infinite` : 'none',
  }
}

/**
 * 카드 우상단에 절대배치로 띄울 OFFLINE 뱃지 HTML.
 * disconnected 상태에서만 사용한다.
 */
export const renderOfflineBadgeHtml = (): string => {
  return `
    <div style="
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 999px;
      background: rgba(220, 53, 69, 0.85);
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
    ">
      <span style="
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #fff;
        display: inline-block;
      "></span>
      OFFLINE
    </div>
  `
}
