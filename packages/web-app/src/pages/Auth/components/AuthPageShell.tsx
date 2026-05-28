/**
 * AuthPageShell — 인증 페이지 공통 레이아웃
 *
 * 기능: 로그인/회원가입 화면의 전체 배경, 중앙 정렬, 브랜드 로고 영역, 우측 상단 액션 영역을 제공한다.
 *
 * 사용처: `Login.tsx`, `Register.tsx`
 */
import React from 'react'

interface AuthPageShellProps {
  children: React.ReactNode
  logoMaxWidth?: string
  topRightAction?: React.ReactNode
}

export const AuthPageShell: React.FC<AuthPageShellProps> = ({
  children,
  logoMaxWidth = '320px',
  topRightAction,
}) => (
  <div className="relative h-screen w-full overflow-y-auto bg-background font-sans">
    {topRightAction ? (
      <div className="absolute right-4 top-4 z-10">
        {topRightAction}
      </div>
    ) : null}

    <div className="min-h-full flex flex-col items-center p-4 py-6">
      <div className="w-full max-w-sm my-auto">
        <div className="text-center mb-8 animate-in fade-in duration-700">
          <div className="flex justify-center items-center mb-3 bg-background rounded-lg p-2">
            <img
              src="/pulse-up-auth-logo.png"
              alt="PULSE-UP"
              className="w-full h-auto block"
              style={{ maxWidth: logoMaxWidth }}
            />
          </div>
        </div>

        {children}
      </div>
    </div>
  </div>
)
