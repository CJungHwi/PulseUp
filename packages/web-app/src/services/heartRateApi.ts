import api from './api'
import { HeartRateDataPoint } from '../hooks/useHeartRateData'

export interface HeartRateSessionData {
  workoutSessionId?: string
  sessionStartTime: number
  sessionDuration: number
  stats: {
    average: number | null
    max: number | null
    min: number | null
  }
  dataPoints: HeartRateDataPoint[]
  exportedAt: number
}

export interface HeartRateSession {
  id: string
  userId: string
  workoutSessionId?: string
  sessionStartTime: string
  sessionDuration: number
  averageHeartRate: number | null
  maxHeartRate: number | null
  minHeartRate: number | null
  totalDataPoints: number
  exportedAt: string
  createdAt: string
  updatedAt: string
  workoutSession?: {
    id: string
    playlistId: string
    playlist: {
      name: string
    }
  }
  _count?: {
    heartRateData: number
  }
}

export interface HeartRateSessionDetail extends HeartRateSession {
  dataPoints: HeartRateDataPoint[]
  zoneDistribution: {
    rest: number
    'fat-burn': number
    cardio: number
    peak: number
  }
  totalDataPoints: number
}

export interface HeartRateStats {
  totalSessions: number
  totalDuration: number
  averageHeartRate: number | null
  maxHeartRate: number | null
  recentSessions: number
  zoneDistribution: {
    rest: number
    'fat-burn': number
    cardio: number
    peak: number
  }
}

export interface HeartRateApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface PaginatedHeartRateResponse {
  sessions: HeartRateSession[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * 심박수 데이터를 서버에 저장
 */
export const saveHeartRateData = async (data: HeartRateSessionData): Promise<{ sessionId: string; dataPointsSaved: number }> => {
  try {
    const response = await api.post<HeartRateApiResponse<{ sessionId: string; dataPointsSaved: number; message: string }>>('/heart-rate-data', data)
    return response.data.data
  } catch (error) {
    console.error('Failed to save heart rate data:', error)
    throw new Error('심박수 데이터 저장에 실패했습니다')
  }
}

/**
 * 심박수 세션 목록 조회
 */
export const getHeartRateSessions = async (params?: {
  workoutSessionId?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}): Promise<PaginatedHeartRateResponse> => {
  try {
    const queryParams = new URLSearchParams()
    
    if (params?.workoutSessionId) queryParams.append('workoutSessionId', params.workoutSessionId)
    if (params?.startDate) queryParams.append('startDate', params.startDate)
    if (params?.endDate) queryParams.append('endDate', params.endDate)
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())

    const response = await api.get<HeartRateApiResponse<PaginatedHeartRateResponse>>(`/heart-rate-data?${queryParams}`)
    return response.data.data
  } catch (error) {
    console.error('Failed to fetch heart rate sessions:', error)
    throw new Error('심박수 세션 목록 조회에 실패했습니다')
  }
}

/**
 * 특정 심박수 세션의 상세 데이터 조회
 */
export const getHeartRateSessionDetail = async (sessionId: string): Promise<HeartRateSessionDetail> => {
  try {
    const response = await api.get<HeartRateApiResponse<HeartRateSessionDetail>>(`/heart-rate-data/${sessionId}`)
    return response.data.data
  } catch (error) {
    console.error('Failed to fetch heart rate session detail:', error)
    throw new Error('심박수 세션 상세 정보 조회에 실패했습니다')
  }
}

/**
 * 심박수 세션 삭제
 */
export const deleteHeartRateSession = async (sessionId: string): Promise<void> => {
  try {
    await api.delete<HeartRateApiResponse<{ message: string }>>(`/heart-rate-data/${sessionId}`)
  } catch (error) {
    console.error('Failed to delete heart rate session:', error)
    throw new Error('심박수 세션 삭제에 실패했습니다')
  }
}

/**
 * 심박수 통계 요약 조회
 */
export const getHeartRateStats = async (): Promise<HeartRateStats> => {
  try {
    const response = await api.get<HeartRateApiResponse<HeartRateStats>>('/heart-rate-data/stats/summary')
    return response.data.data
  } catch (error) {
    console.error('Failed to fetch heart rate stats:', error)
    throw new Error('심박수 통계 조회에 실패했습니다')
  }
}

/**
 * 심박수 데이터를 CSV 형식으로 내보내기
 */
export const exportHeartRateDataToCsv = (sessionData: HeartRateSessionDetail): string => {
  const headers = ['timestamp', 'heartRate', 'zone', 'date', 'time']
  const rows = sessionData.dataPoints.map(point => {
    const date = new Date(point.timestamp)
    return [
      point.timestamp.toString(),
      point.heartRate.toString(),
      point.zone,
      date.toISOString().split('T')[0], // YYYY-MM-DD
      date.toTimeString().split(' ')[0] // HH:MM:SS
    ]
  })

  return [headers, ...rows].map(row => row.join(',')).join('\n')
}

/**
 * 심박수 데이터를 JSON 형식으로 내보내기
 */
export const exportHeartRateDataToJson = (sessionData: HeartRateSessionDetail): string => {
  const exportData = {
    session: {
      id: sessionData.id,
      sessionStartTime: sessionData.sessionStartTime,
      sessionDuration: sessionData.sessionDuration,
      averageHeartRate: sessionData.averageHeartRate,
      maxHeartRate: sessionData.maxHeartRate,
      minHeartRate: sessionData.minHeartRate,
      totalDataPoints: sessionData.totalDataPoints,
      workoutSession: sessionData.workoutSession
    },
    stats: {
      zoneDistribution: sessionData.zoneDistribution
    },
    dataPoints: sessionData.dataPoints,
    exportedAt: new Date().toISOString()
  }

  return JSON.stringify(exportData, null, 2)
}

/**
 * 심박수 구간별 색상 반환
 */
export const getZoneColor = (zone: string): string => {
  const colors = {
    rest: '#4CAF50',      // 녹색
    'fat-burn': '#FF9800', // 주황색
    cardio: '#F44336',     // 빨간색
    peak: '#9C27B0'       // 보라색
  }
  return colors[zone as keyof typeof colors] || '#666'
}

/**
 * 심박수 구간별 한글 이름 반환
 */
export const getZoneName = (zone: string): string => {
  const names = {
    rest: '휴식 구간',
    'fat-burn': '지방 연소',
    cardio: '유산소 운동',
    peak: '최대 강도'
  }
  return names[zone as keyof typeof names] || zone
}

/**
 * 심박수 구간 계산
 */
export const calculateHeartRateZone = (heartRate: number, age?: number): string => {
  // 기본적인 심박수 구간 계산 (나이 기반)
  const maxHR = age ? 220 - age : 190 // 기본값 30세 기준
  
  if (heartRate < maxHR * 0.5) return 'rest'
  if (heartRate < maxHR * 0.6) return 'fat-burn'
  if (heartRate < maxHR * 0.8) return 'cardio'
  return 'peak'
}

/**
 * 시간 포맷팅 (초 -> HH:MM:SS)
 */
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  } else {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }
}