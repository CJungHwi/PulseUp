import React, { useState, useEffect, useCallback } from 'react'
// import HeartRateMonitor from './HeartRateMonitor'
// import HeartRateChart from './HeartRateChart'
// import HeartRateStats from './HeartRateStats'
// import BluetoothHeartRateMonitor from './BluetoothHeartRateMonitor'
// import { useHeartRateData } from '../hooks/useHeartRateData'
// import './HeartRateDashboard.css'

interface HeartRateDashboardProps {
  workoutSessionId?: string
  autoStartRecording?: boolean
  onSessionComplete?: (sessionData: any) => void
}

const HeartRateDashboard: React.FC<HeartRateDashboardProps> = ({
  workoutSessionId,
  autoStartRecording = false,
  onSessionComplete
}) => {
  return (
    <div className="heart-rate-dashboard">
      <div className="dashboard-header">
        <h2>💓 심박수 모니터링</h2>
        <p>심박수 모니터링 기능이 곧 제공될 예정입니다.</p>
      </div>
    </div>
  )
}

export default HeartRateDashboard