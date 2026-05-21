import React, { useEffect, useRef, useState } from 'react'
// import { HeartRateDataPoint } from '../../hooks/useHeartRateData'
import './HeartRateChart.css'

// HeartRateDataPoint 타입 정의
export interface HeartRateDataPoint {
  timestamp: number
  heartRate: number
  zone: 'rest' | 'fat-burn' | 'cardio' | 'peak'
}

interface HeartRateChartProps {
  dataPoints: HeartRateDataPoint[]
  width?: number
  height?: number
  showZones?: boolean
  timeWindow?: number // 표시할 시간 범위 (분)
}

const HeartRateChart: React.FC<HeartRateChartProps> = ({
  dataPoints,
  width = 600,
  height = 300,
  showZones = true,
  timeWindow = 10 // 기본 10분
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [currentTime, setCurrentTime] = useState(Date.now())

  // 심박수 구간별 색상
  const zoneColors = {
    rest: '#4CAF50',      // 녹색
    'fat-burn': '#FF9800', // 주황색
    cardio: '#F44336',     // 빨간색
    peak: '#9C27B0'        // 보라색
  }

  // 구간별 범위
  const zoneRanges = {
    rest: { min: 0, max: 100 },
    'fat-burn': { min: 100, max: 130 },
    cardio: { min: 130, max: 160 },
    peak: { min: 160, max: 220 }
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 캔버스 크기 설정
    canvas.width = width
    canvas.height = height

    // 캔버스 초기화
    ctx.clearRect(0, 0, width, height)

    // 시간 범위 계산
    const timeWindowMs = timeWindow * 60 * 1000
    const endTime = currentTime
    const startTime = endTime - timeWindowMs

    // 시간 범위 내의 데이터 필터링
    const filteredData = dataPoints.filter(
      point => point.timestamp >= startTime && point.timestamp <= endTime
    )

    if (filteredData.length === 0) {
      // 데이터가 없을 때 메시지 표시
      ctx.fillStyle = '#666'
      ctx.font = '16px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('심박수 데이터가 없습니다', width / 2, height / 2)
      return
    }

    // 여백 설정
    const margin = { top: 20, right: 20, bottom: 40, left: 60 }
    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom

    // Y축 범위 설정 (심박수)
    const minHeartRate = Math.max(0, Math.min(...filteredData.map(d => d.heartRate)) - 10)
    const maxHeartRate = Math.min(220, Math.max(...filteredData.map(d => d.heartRate)) + 10)

    // 배경 구간 그리기 (선택사항)
    if (showZones) {
      Object.entries(zoneRanges).forEach(([zone, range]) => {
        const yStart = margin.top + chartHeight - ((range.min - minHeartRate) / (maxHeartRate - minHeartRate)) * chartHeight
        const yEnd = margin.top + chartHeight - ((range.max - minHeartRate) / (maxHeartRate - minHeartRate)) * chartHeight

        if (yStart >= margin.top && yEnd <= margin.top + chartHeight) {
          ctx.fillStyle = zoneColors[zone as keyof typeof zoneColors] + '20' // 투명도 20%
          ctx.fillRect(margin.left, Math.max(margin.top, yEnd), chartWidth, Math.min(yStart - yEnd, chartHeight))
        }
      })
    }

    // 격자 그리기
    ctx.strokeStyle = '#e0e0e0'
    ctx.lineWidth = 1

    // 수평 격자선 (심박수)
    const heartRateStep = 20
    for (let hr = Math.ceil(minHeartRate / heartRateStep) * heartRateStep; hr <= maxHeartRate; hr += heartRateStep) {
      const y = margin.top + chartHeight - ((hr - minHeartRate) / (maxHeartRate - minHeartRate)) * chartHeight

      ctx.beginPath()
      ctx.moveTo(margin.left, y)
      ctx.lineTo(margin.left + chartWidth, y)
      ctx.stroke()

      // Y축 레이블
      ctx.fillStyle = '#666'
      ctx.font = '12px Arial'
      ctx.textAlign = 'right'
      ctx.fillText(hr.toString(), margin.left - 10, y + 4)
    }

    // 수직 격자선 (시간)
    const timeStep = 60 * 1000 // 1분 간격
    for (let time = Math.ceil(startTime / timeStep) * timeStep; time <= endTime; time += timeStep) {
      const x = margin.left + ((time - startTime) / timeWindowMs) * chartWidth

      ctx.beginPath()
      ctx.moveTo(x, margin.top)
      ctx.lineTo(x, margin.top + chartHeight)
      ctx.stroke()

      // X축 레이블 (분:초 형식)
      const date = new Date(time)
      const label = `${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`

      ctx.fillStyle = '#666'
      ctx.font = '12px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(label, x, margin.top + chartHeight + 20)
    }

    // 심박수 라인 그리기
    if (filteredData.length > 1) {
      ctx.strokeStyle = '#2196F3'
      ctx.lineWidth = 2
      ctx.beginPath()

      filteredData.forEach((point, index) => {
        const x = margin.left + ((point.timestamp - startTime) / timeWindowMs) * chartWidth
        const y = margin.top + chartHeight - ((point.heartRate - minHeartRate) / (maxHeartRate - minHeartRate)) * chartHeight

        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })

      ctx.stroke()

      // 데이터 포인트 그리기
      filteredData.forEach(point => {
        const x = margin.left + ((point.timestamp - startTime) / timeWindowMs) * chartWidth
        const y = margin.top + chartHeight - ((point.heartRate - minHeartRate) / (maxHeartRate - minHeartRate)) * chartHeight

        ctx.fillStyle = zoneColors[point.zone]
        ctx.beginPath()
        ctx.arc(x, y, 3, 0, 2 * Math.PI)
        ctx.fill()
      })
    }

    // 축 그리기
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 2

    // Y축
    ctx.beginPath()
    ctx.moveTo(margin.left, margin.top)
    ctx.lineTo(margin.left, margin.top + chartHeight)
    ctx.stroke()

    // X축
    ctx.beginPath()
    ctx.moveTo(margin.left, margin.top + chartHeight)
    ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight)
    ctx.stroke()

    // 축 레이블
    ctx.fillStyle = '#333'
    ctx.font = '14px Arial'
    ctx.textAlign = 'center'

    // X축 레이블
    ctx.fillText('시간', margin.left + chartWidth / 2, height - 5)

    // Y축 레이블 (회전)
    ctx.save()
    ctx.translate(15, margin.top + chartHeight / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('심박수 (BPM)', 0, 0)
    ctx.restore()

  }, [dataPoints, width, height, showZones, timeWindow, currentTime])

  return (
    <div className="heart-rate-chart">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ maxWidth: '100%', height: 'auto' }}
      />

      {showZones && (
        <div className="chart-legend">
          <h4>심박수 구간</h4>
          <div className="legend-items">
            {Object.entries(zoneRanges).map(([zone, range]) => (
              <div key={zone} className="legend-item">
                <div
                  className="legend-color"
                  style={{ backgroundColor: zoneColors[zone as keyof typeof zoneColors] }}
                ></div>
                <span className="legend-label">
                  {zone === 'rest' && '휴식'}
                  {zone === 'fat-burn' && '지방연소'}
                  {zone === 'cardio' && '유산소'}
                  {zone === 'peak' && '최대강도'}
                  {' '}({range.min}-{range.max} BPM)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default HeartRateChart