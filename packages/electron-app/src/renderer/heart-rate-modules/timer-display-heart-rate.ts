/// <reference path="../../types/electron.d.ts" />

import type { WorkoutTimer } from '../components/WorkoutTimer.js'

/** TimerDisplayUI 심박 섹션·차트용 데이터 */
export interface HeartRateData {
  heartRate: number
  timestamp: Date
  zone?: 'rest' | 'fat-burn' | 'cardio' | 'peak'
}

const MAX_HISTORY = 50

/**
 * TimerDisplayUI 내 심박 표시·히스토리·차트·통계 (DOM id 고정)
 */
export class TimerDisplayHeartRate {
  private currentHeartRate = 0
  private heartRateHistory: HeartRateData[] = []

  updateHeartRate(heartRate: number): void {
    this.currentHeartRate = heartRate

    const heartRateData: HeartRateData = {
      heartRate,
      timestamp: new Date(),
      zone: this.getHeartRateZone(heartRate)
    }

    this.heartRateHistory.push(heartRateData)

    if (this.heartRateHistory.length > MAX_HISTORY) {
      this.heartRateHistory.shift()
    }

    const heartRateElement = document.getElementById('heart-rate-value')
    const zoneElement = document.getElementById('heart-rate-zone')

    if (heartRateElement) {
      heartRateElement.textContent = heartRate.toString()
    }

    if (zoneElement) {
      zoneElement.textContent = this.getHeartRateZoneText(heartRateData.zone || 'rest')
      zoneElement.className = `heart-rate-zone zone-${heartRateData.zone}`
    }

    this.updateHeartRateChart()
    this.updateHeartRateStats()
  }

  getAverageHeartRateForCalories(): number {
    if (this.heartRateHistory.length === 0) return 70
    return this.heartRateHistory.reduce((sum, data) => sum + data.heartRate, 0) / this.heartRateHistory.length
  }

  resetStats(): void {
    this.heartRateHistory = []
    this.updateHeartRateStats()
    this.updateHeartRateChart()
  }

  /** 개발 빌드에서만 시뮬레이션 */
  startDevSimulation(timer: WorkoutTimer): void {
    if (window.location.hostname === 'localhost') {
      setInterval(() => {
        const baseHeartRate = timer.isRunning() ? 120 : 70
        const variation = Math.random() * 20 - 10
        const simulatedHeartRate = Math.round(baseHeartRate + variation)
        this.updateHeartRate(Math.max(60, Math.min(180, simulatedHeartRate)))
      }, 2000)
    }
  }

  private getHeartRateZone(heartRate: number): HeartRateData['zone'] {
    if (heartRate < 100) return 'rest'
    if (heartRate < 130) return 'fat-burn'
    if (heartRate < 160) return 'cardio'
    return 'peak'
  }

  private getHeartRateZoneText(zone: string): string {
    switch (zone) {
      case 'rest': return 'Rest'
      case 'fat-burn': return 'Fat Burn'
      case 'cardio': return 'Cardio'
      case 'peak': return 'Peak'
      default: return 'Rest'
    }
  }

  private updateHeartRateChart(): void {
    const canvas = document.getElementById('heart-rate-canvas') as HTMLCanvasElement
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (this.heartRateHistory.length < 2) return

    const width = canvas.width
    const height = canvas.height
    const padding = 10

    const maxHR = Math.max(...this.heartRateHistory.map(d => d.heartRate))
    const minHR = Math.min(...this.heartRateHistory.map(d => d.heartRate))
    const range = maxHR - minHR || 1

    ctx.strokeStyle = '#ff4757'
    ctx.lineWidth = 2
    ctx.beginPath()

    this.heartRateHistory.forEach((data, index) => {
      const x = padding + (index / (this.heartRateHistory.length - 1)) * (width - 2 * padding)
      const y = height - padding - ((data.heartRate - minHR) / range) * (height - 2 * padding)

      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })

    ctx.stroke()
  }

  private updateHeartRateStats(): void {
    if (this.heartRateHistory.length === 0) return

    const heartRates = this.heartRateHistory.map(d => d.heartRate)
    const avg = Math.round(heartRates.reduce((a, b) => a + b, 0) / heartRates.length)
    const max = Math.max(...heartRates)
    const min = Math.min(...heartRates)

    const avgElement = document.getElementById('avg-heart-rate')
    const maxElement = document.getElementById('max-heart-rate')
    const minElement = document.getElementById('min-heart-rate')

    if (avgElement) avgElement.textContent = avg.toString()
    if (maxElement) maxElement.textContent = max.toString()
    if (minElement) minElement.textContent = min.toString()
  }
}
