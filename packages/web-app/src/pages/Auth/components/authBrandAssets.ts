/**
 * Auth 브랜드 에셋 — 테마별 PULSE 로고 경로
 *
 * 기능: light/dark 모드에 맞는 사이드바·인증 화면 공용 로고 public 경로를 반환한다.
 *
 * 사용처: `Login.tsx`, `Register.tsx`, `AuthPageShell`.
 */

export const getPulseBrandLogoSrc = (mode: 'light' | 'dark') => (
  mode === 'dark'
    ? '/pulse-sidebar-logo-dark.png'
    : '/pulse-sidebar-logo-light.png'
)
