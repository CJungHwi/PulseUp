import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useHeartRateData } from '../useHeartRateData'
import * as electronService from '../../services/electronService'
import * as heartRateApi from '../../services/heartRateApi'

// Mock the services
vi.mock('../../services/electronService', () => ({
  electronService: {
    sendHeartRateData: vi.fn()
  }
}))

vi.mock('../../services/heartRateApi', () => ({
  saveHeartRateData: vi.fn()
}))

describe('useHeartRateData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('initializes with default state', () => {
    const { result } = renderHook(() => useHeartRateData())

    expect(result.current.stats).toEqual({
      current: null,
      average: null,
      max: null,
      min: null,
      zone: null,
      dataPoints: [],
      sessionDuration: 0
    })
    expect(result.current.isRecording).toBe(false)
  })

  it('starts and stops recording session', () => {
    const { result } = renderHook(() => useHeartRateData())

    act(() => {
      result.current.startSession()
    })

    expect(result.current.isRecording).toBe(true)

    act(() => {
      result.current.stopSession()
    })

    expect(result.current.isRecording).toBe(false)
  })

  it('adds heart rate data when recording', async () => {
    const mockSendHeartRateData = vi.mocked(electronService.electronService.sendHeartRateData)
    mockSendHeartRateData.mockResolvedValue({ success: true })

    const { result } = renderHook(() => useHeartRateData())

    act(() => {
      result.current.startSession()
    })

    await act(async () => {
      await result.current.addHeartRateData({
        heartRate: 120,
        timestamp: Date.now()
      })
    })

    expect(result.current.stats.current).toBe(120)
    expect(result.current.stats.dataPoints).toHaveLength(1)
    expect(result.current.stats.zone).toBe('fat-burn')
    expect(mockSendHeartRateData).toHaveBeenCalled()
  })

  it('does not add data when not recording', async () => {
    const { result } = renderHook(() => useHeartRateData())

    await act(async () => {
      await result.current.addHeartRateData({
        heartRate: 120,
        timestamp: Date.now()
      })
    })

    expect(result.current.stats.current).toBe(null)
    expect(result.current.stats.dataPoints).toHaveLength(0)
  })

  it('calculates correct heart rate zones', async () => {
    const { result } = renderHook(() => useHeartRateData())

    act(() => {
      result.current.startSession()
    })

    // Test rest zone
    await act(async () => {
      await result.current.addHeartRateData({
        heartRate: 80,
        timestamp: Date.now()
      })
    })
    expect(result.current.stats.zone).toBe('rest')

    // Test fat-burn zone
    await act(async () => {
      await result.current.addHeartRateData({
        heartRate: 120,
        timestamp: Date.now() + 1000
      })
    })
    expect(result.current.stats.zone).toBe('fat-burn')

    // Test cardio zone
    await act(async () => {
      await result.current.addHeartRateData({
        heartRate: 150,
        timestamp: Date.now() + 2000
      })
    })
    expect(result.current.stats.zone).toBe('cardio')

    // Test peak zone
    await act(async () => {
      await result.current.addHeartRateData({
        heartRate: 180,
        timestamp: Date.now() + 3000
      })
    })
    expect(result.current.stats.zone).toBe('peak')
  })

  it('calculates statistics correctly', async () => {
    const { result } = renderHook(() => useHeartRateData())

    act(() => {
      result.current.startSession()
    })

    // Add multiple data points
    const heartRates = [100, 120, 140, 160, 180]
    for (let i = 0; i < heartRates.length; i++) {
      await act(async () => {
        await result.current.addHeartRateData({
          heartRate: heartRates[i],
          timestamp: Date.now() + i * 1000
        })
      })
    }

    expect(result.current.stats.average).toBe(140) // (100+120+140+160+180)/5
    expect(result.current.stats.max).toBe(180)
    expect(result.current.stats.min).toBe(100)
    expect(result.current.stats.dataPoints).toHaveLength(5)
  })

  it('limits data points to maxDataPoints', async () => {
    const { result } = renderHook(() => useHeartRateData({ maxDataPoints: 3 }))

    act(() => {
      result.current.startSession()
    })

    // Add more data points than the limit
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await result.current.addHeartRateData({
          heartRate: 100 + i * 10,
          timestamp: Date.now() + i * 1000
        })
      })
    }

    expect(result.current.stats.dataPoints).toHaveLength(3)
    // Should keep the latest 3 data points
    expect(result.current.stats.dataPoints[0].heartRate).toBe(120) // 3rd point
    expect(result.current.stats.dataPoints[1].heartRate).toBe(130) // 4th point
    expect(result.current.stats.dataPoints[2].heartRate).toBe(140) // 5th point
  })

  it('updates session duration', () => {
    const { result } = renderHook(() => useHeartRateData())

    act(() => {
      result.current.startSession()
    })

    // Fast forward time by 30 seconds
    act(() => {
      vi.advanceTimersByTime(30000)
    })

    expect(result.current.stats.sessionDuration).toBe(30)
  })

  it('resets session data', async () => {
    const { result } = renderHook(() => useHeartRateData())

    act(() => {
      result.current.startSession()
    })

    await act(async () => {
      await result.current.addHeartRateData({
        heartRate: 120,
        timestamp: Date.now()
      })
    })

    expect(result.current.stats.dataPoints).toHaveLength(1)

    act(() => {
      result.current.resetSession()
    })

    expect(result.current.stats.dataPoints).toHaveLength(0)
    expect(result.current.stats.current).toBe(null)
    expect(result.current.stats.sessionDuration).toBe(0)
    expect(result.current.isRecording).toBe(false)
  })

  it('calculates zone distribution correctly', async () => {
    const { result } = renderHook(() => useHeartRateData())

    act(() => {
      result.current.startSession()
    })

    // Add data points in different zones
    const testData = [
      { heartRate: 80, zone: 'rest' },      // 1 rest
      { heartRate: 120, zone: 'fat-burn' }, // 1 fat-burn
      { heartRate: 125, zone: 'fat-burn' }, // 2 fat-burn
      { heartRate: 150, zone: 'cardio' },   // 1 cardio
    ]

    for (let i = 0; i < testData.length; i++) {
      await act(async () => {
        await result.current.addHeartRateData({
          heartRate: testData[i].heartRate,
          timestamp: Date.now() + i * 1000
        })
      })
    }

    const distribution = result.current.getZoneDistribution()
    
    expect(distribution.rest).toBe(25)      // 1/4 = 25%
    expect(distribution['fat-burn']).toBe(50) // 2/4 = 50%
    expect(distribution.cardio).toBe(25)    // 1/4 = 25%
    expect(distribution.peak).toBe(0)       // 0/4 = 0%
  })

  it('calculates recent average correctly', async () => {
    const { result } = renderHook(() => useHeartRateData())

    act(() => {
      result.current.startSession()
    })

    const now = Date.now()
    
    // Add old data (6 minutes ago)
    await act(async () => {
      await result.current.addHeartRateData({
        heartRate: 100,
        timestamp: now - 6 * 60 * 1000
      })
    })

    // Add recent data (2 minutes ago)
    await act(async () => {
      await result.current.addHeartRateData({
        heartRate: 140,
        timestamp: now - 2 * 60 * 1000
      })
    })

    // Add recent data (1 minute ago)
    await act(async () => {
      await result.current.addHeartRateData({
        heartRate: 160,
        timestamp: now - 1 * 60 * 1000
      })
    })

    // Get recent average for last 5 minutes
    const recentAverage = result.current.getRecentAverage(5)
    
    // Should average only the recent data: (140 + 160) / 2 = 150
    expect(recentAverage).toBe(150)
  })

  it('exports data correctly', async () => {
    const { result } = renderHook(() => useHeartRateData())

    act(() => {
      result.current.startSession()
    })

    await act(async () => {
      await result.current.addHeartRateData({
        heartRate: 120,
        timestamp: Date.now()
      })
    })

    const exportedData = result.current.exportData()

    expect(exportedData).toHaveProperty('stats')
    expect(exportedData).toHaveProperty('sessionInfo')
    expect(exportedData.stats.dataPoints).toHaveLength(1)
    expect(exportedData.stats.dataPoints[0].heartRate).toBe(120)
  })
})