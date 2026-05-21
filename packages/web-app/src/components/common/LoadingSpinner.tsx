import React from 'react'
import './LoadingSpinner.css'

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large'
  color?: string
  className?: string
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium', 
  color = '#007bff',
  className = ''
}) => {
  return (
    <div className={`loading-spinner ${size} ${className}`}>
      <div 
        className="spinner"
        style={{ borderTopColor: color }}
      ></div>
    </div>
  )
}

// Named export 추가
export { LoadingSpinner }

export default LoadingSpinner