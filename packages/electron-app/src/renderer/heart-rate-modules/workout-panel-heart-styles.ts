/**
 * 운동 재생 화면 우측 심박 패널 — 존별 색·글로우 (4구간)
 */

export const getWorkoutPanelHeartRateZone = (heartRate: number): number => {
  if (heartRate <= 108) return 1
  if (heartRate <= 126) return 2
  if (heartRate <= 153) return 3
  return 4
}

export const getWorkoutPanelHeartRateColor = (heartRate: number): string => {
  const zone = getWorkoutPanelHeartRateZone(heartRate)
  switch (zone) {
    case 1:
      return '#00BFFF'
    case 2:
      return '#0066FF'
    case 3:
      return '#FFA500'
    case 4:
      return '#FF3333'
    default:
      return '#888'
  }
}

export const getWorkoutPanelHeartRateGlowStyle = (heartRate: number): {
  bg: string
  border: string
  shadow: string
  textColor: string
} => {
  if (heartRate <= 0) {
    return {
      bg: 'rgba(0,0,0,0.4)',
      border: '2px solid #444',
      shadow: 'none',
      textColor: '#888',
    }
  }

  const zone = getWorkoutPanelHeartRateZone(heartRate)
  const color = getWorkoutPanelHeartRateColor(heartRate)
  const zoneColors: { [key: number]: { r: number; g: number; b: number } } = {
    1: { r: 0, g: 191, b: 255 },
    2: { r: 0, g: 102, b: 255 },
    3: { r: 255, g: 165, b: 0 },
    4: { r: 255, g: 51, b: 51 },
  }
  const rgb = zoneColors[zone] || { r: 136, g: 136, b: 136 }

  return {
    bg: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`,
    border: `3px solid ${color}`,
    shadow: `0 0 20px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6), 0 0 40px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`,
    textColor: color,
  }
}
