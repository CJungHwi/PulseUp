import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { electronService } from '../services/electronService'

export type HeartRateZone = 'rest' | 'fat-burn' | 'cardio' | 'peak'

export interface HeartRateDataPoint {
  heartRate: number
  timestamp: number
  zone: HeartRateZone
}

export interface HeartRateStats {
  current: number | null
  average: number | null
  max: number | null
  min: number | null
  zone: string | null
  dataPoints: HeartRateDataPoint[]
  sessionDuration: number
}

export interface UseHeartRateDataOptions {
  maxDataPoints?: number
}

/** 테스트 스펙(`useHeartRateData.test.ts`)과 동일한 구간 경계 */
const zoneForHeartRate = (heartRate: number): HeartRateZone => {
  if (heartRate < 100) return 'rest'
  if (heartRate < 140) return 'fat-burn'
  if (heartRate < 170) return 'cardio'
  return 'peak'
}

const emptyStats = (): HeartRateStats => ({
  current: null,
  average: null,
  max: null,
  min: null,
  zone: null,
  dataPoints: [],
  sessionDuration: 0
})

const aggregateFromPoints = (points: HeartRateDataPoint[]): Omit<HeartRateStats, 'sessionDuration'> => {
  if (points.length === 0) {
    return {
      current: null,
      average: null,
      max: null,
      min: null,
      zone: null,
      dataPoints: []
    }
  }
  const hrs = points.map((p) => p.heartRate)
  const sum = hrs.reduce((a, b) => a + b, 0)
  const last = points[points.length - 1]
  return {
    current: last.heartRate,
    average: sum / points.length,
    max: Math.max(...hrs),
    min: Math.min(...hrs),
    zone: last.zone,
    dataPoints: points
  }
}

export const useHeartRateData = (options: UseHeartRateDataOptions = {}) => {
  const maxDataPoints = options.maxDataPoints ?? Number.POSITIVE_INFINITY
  const [stats, setStats] = useState<HeartRateStats>(emptyStats)
  const [isRecording, setIsRecording] = useState(false)
  const durationTickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearDurationTick = useCallback(() => {
    if (durationTickRef.current != null) {
      clearInterval(durationTickRef.current)
      durationTickRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isRecording) {
      clearDurationTick()
      return
    }
    durationTickRef.current = setInterval(() => {
      setStats((prev) => ({
        ...prev,
        sessionDuration: prev.sessionDuration + 1
      }))
    }, 1000)
    return clearDurationTick
  }, [isRecording, clearDurationTick])

  const startSession = useCallback(() => {
    setIsRecording(true)
    setStats(() => ({
      ...emptyStats(),
      sessionDuration: 0
    }))
  }, [])

  const stopSession = useCallback(() => {
    setIsRecording(false)
  }, [])

  const resetSession = useCallback(() => {
    clearDurationTick()
    setIsRecording(false)
    setStats(emptyStats())
  }, [clearDurationTick])

  const addHeartRateData = useCallback(
    async (input: { heartRate: number; timestamp: number }) => {
      if (!isRecording) return

      const zone = zoneForHeartRate(input.heartRate)
      const point: HeartRateDataPoint = {
        heartRate: input.heartRate,
        timestamp: input.timestamp,
        zone
      }

      setStats((prev) => {
        let nextPoints = [...prev.dataPoints, point]
        if (Number.isFinite(maxDataPoints) && nextPoints.length > maxDataPoints) {
          nextPoints = nextPoints.slice(-maxDataPoints)
        }
        const agg = aggregateFromPoints(nextPoints)
        return {
          ...agg,
          sessionDuration: prev.sessionDuration
        }
      })

      await electronService.sendHeartRateData({
        heartRate: input.heartRate,
        timestamp: new Date(input.timestamp),
        zone
      })
    },
    [isRecording, maxDataPoints]
  )

  const getZoneDistribution = useCallback(() => {
    const pts = stats.dataPoints
    const n = pts.length
    const base = { rest: 0, 'fat-burn': 0, cardio: 0, peak: 0 as number }
    if (n === 0) return base
    for (const p of pts) {
      base[p.zone] += 1
    }
    return {
      rest: (base.rest / n) * 100,
      'fat-burn': (base['fat-burn'] / n) * 100,
      cardio: (base.cardio / n) * 100,
      peak: (base.peak / n) * 100
    }
  }, [stats.dataPoints])

  const getRecentAverage = useCallback(
    (minutes: number) => {
      const cutoff = Date.now() - minutes * 60 * 1000
      const recent = stats.dataPoints.filter((p) => p.timestamp >= cutoff)
      if (recent.length === 0) return null
      const sum = recent.reduce((a, p) => a + p.heartRate, 0)
      return sum / recent.length
    },
    [stats.dataPoints]
  )

  const exportData = useCallback(() => {
    return {
      stats: { ...stats, dataPoints: [...stats.dataPoints] },
      sessionInfo: {
        exportedAt: Date.now(),
        isRecording
      }
    }
  }, [stats, isRecording])

  return useMemo(
    () => ({
      stats,
      isRecording,
      startSession,
      stopSession,
      resetSession,
      addHeartRateData,
      getZoneDistribution,
      getRecentAverage,
      exportData
    }),
    [
      stats,
      isRecording,
      startSession,
      stopSession,
      resetSession,
      addHeartRateData,
      getZoneDistribution,
      getRecentAverage,
      exportData
    ]
  )
}
