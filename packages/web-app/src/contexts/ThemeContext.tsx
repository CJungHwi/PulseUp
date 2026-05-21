import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { ThemeMode } from '../themes/designTokens'

interface ThemeContextType {
  mode: ThemeMode
  toggleTheme: () => void
  setTheme: (mode: ThemeMode) => void
  cycleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  children: ReactNode
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>(() => {
    // 초기값 설정
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('app-theme') as ThemeMode
      return saved || 'light'
    }
    return 'light'
  })

  // 테마 변경시 localStorage 저장 및 body class 업데이트
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('app-theme', mode)

      // body에 클래스 추가/제거
      document.body.classList.remove('light-theme', 'dark-theme', 'dark')

      if (mode === 'dark') {
        document.body.classList.add('dark-theme', 'dark')
      } else {
        document.body.classList.add('light-theme')
      }
    }
  }, [mode])

  const toggleTheme = () => {
    setMode(prev => prev === 'light' ? 'dark' : 'light')
  }

  const cycleTheme = () => {
    setMode(prev => prev === 'light' ? 'dark' : 'light')
  }

  const setTheme = (newMode: ThemeMode) => {
    setMode(newMode)
  }

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

