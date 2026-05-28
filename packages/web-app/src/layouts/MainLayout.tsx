/**
 * 레이아웃 요약 — 메인 앱 (`MainLayout`, 로그인 후 대부분의 라우트)
 *
 * 기능: 사이드바·헤더·반응형 접기, 본문 `Outlet`으로 각 페이지 렌더.
 *
 * 호출/연동: 없음(자식 페이지가 서비스 호출).
 *
 * 관련 컴포넌트: `Sidebar`, `Header`, `MenuAudienceGuard`, MUI `Box`.
 *
 * 흐름: 레이아웃 셸 고정 → `Outlet`에 `/dashboard` 등 실제 페이지 주입.
 */

import React, { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Box, useTheme, Typography } from '@mui/material'
import { Header } from './components/Header'
import { Sidebar as SidebarMui } from './components/Sidebar'
import { useTheme as useCustomTheme } from '../contexts/ThemeContext'
import { MenuAudienceGuard } from '../components/Auth/MenuAudienceGuard'

export const MainLayout: React.FC = () => {
  const muiTheme = useTheme()
  const { mode } = useCustomTheme()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // 화면 크기 감지
  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) {
        setIsSidebarCollapsed(true)
        setIsSidebarOpen(false)
      }
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  const toggleSidebar = () => {
    if (isMobile) {
      setIsSidebarOpen(!isSidebarOpen)
    } else {
      setIsSidebarCollapsed(!isSidebarCollapsed)
    }
  }

  const closeMobileSidebar = () => {
    if (isMobile) {
      setIsSidebarOpen(false)
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: muiTheme.palette.background.default,
      }}
    >
      {/* 개선된 MUI 사이드바 */}
      <SidebarMui
        isCollapsed={isSidebarCollapsed}
        isMobile={isMobile}
        isOpen={isSidebarOpen}
        onCloseMobile={closeMobileSidebar}
        onToggleCollapse={toggleSidebar}
      />

      {/* 메인 콘텐츠 영역 */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          height: '100vh',
          minWidth: 0,
          transition: 'all 0.2s ease'
        }}
      >
        {/* 상단 헤더 */}
        <Box
          sx={{
            flexShrink: 0,
            height: '70px',
            position: 'relative',
            zIndex: 100
          }}
        >
          <Header onToggleSidebar={toggleSidebar} />
        </Box>

        {/* 스크롤 가능한 콘텐츠 영역 */}
        <Box
          component="main"
          sx={{
            flex: 1,
            backgroundColor: muiTheme.palette.background.default,
            p: 0.5, // 4px (MUI spacing 기본값 8px * 0.5)
            overflowY: 'auto',
            overflowX: 'hidden',
            position: 'relative',
            zIndex: 1,
            height: 'calc(100vh - 140px)' // 전체 페이지 높이
          }}
        >
          <MenuAudienceGuard>
            <Outlet />
          </MenuAudienceGuard>
        </Box>

        {/* 고정 Footer */}
        <Box
          sx={{
            flexShrink: 0,
            height: '60px',
            backgroundColor: muiTheme.palette.background.paper,
            borderTop: `1px solid ${muiTheme.palette.divider}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: 3,
            zIndex: 10
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: muiTheme.palette.text.secondary,
              fontWeight: 600,
              letterSpacing: '1px'
            }}
          >
            © 2025 LINKHIIT. ALL RIGHTS RESERVED.
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}