/**
 * 레이아웃 요약 — 인증 구역 (`/` 하위 `AuthLayout`)
 *
 * 기능: 로그인·회원가입·비밀번호 찾기(플레이스홀더) 화면용 전체 화면 배경과 `Outlet`.
 *
 * 호출/연동: 없음.
 *
 * 관련 컴포넌트: `Outlet` — 자식 라우트(`Login`, `Register` 등).
 *
 * 흐름: 라우터가 매칭한 인증 페이지만 본문에 렌더.
 */

import React from 'react'
import { Outlet } from 'react-router-dom'

export const AuthLayout: React.FC = () => {
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      position: 'relative',
      background: 'linear-gradient(135deg, #1a202c 0%, #2d3748 100%)',
      margin: 0,
      padding: 0
    }}>
      <div style={{ flex: 1 }}>
        <Outlet />
      </div>
      
      {/* 저작권 문구 */}
      <div style={{ 
        position: 'absolute',
        bottom: '0',
        left: '0',
        right: '0',
        textAlign: 'center', 
        padding: '20px',
        color: '#FFFFFF',
        fontSize: '15px',
        fontWeight: '600',
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(10px)',
        textShadow: '0 2px 4px rgba(0, 0, 0, 0.8)'
      }}>
        <p style={{ margin: 0, letterSpacing: '1px' }}>© 2025 LINKHIIT. ALL RIGHTS RESERVED.</p>
      </div>
    </div>
  )
}