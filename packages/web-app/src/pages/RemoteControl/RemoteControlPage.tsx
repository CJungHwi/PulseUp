/**
 * 페이지 요약 — 리모컨 (`/remote-control`)
 *
 * 기능: 팝업/단독 창에서 Electron 태블릿 운동 제어 UI 표시, opener `sessionStorage` 토큰 복사.
 *
 * 호출/연동:
 * - 자식 `WorkoutControl` → `deviceService` (연결 확인·재생·화면 모드·세션·심박 진단 등 API 서버 경유).
 *
 * 관련 컴포넌트(`./components/`):
 * - `remoteControlUtils.ts`: `REMOTE_CONTROL_POPUP`, `getRemoteControlPopupWindowFeatures`, `copyTokenFromOpener`
 *
 * 흐름: 마운트 시 토큰 동기 → `WorkoutControl` 렌더.
 */

import { useEffect } from 'react'
import { WorkoutControl } from '@/components/WorkoutControl'
import { copyTokenFromOpener } from './components/remoteControlUtils'

export function RemoteControlPage() {
  useEffect(() => {
    copyTokenFromOpener()
  }, [])

  return (
    <div className="w-full h-screen flex flex-col overflow-hidden bg-background">
      <WorkoutControl />
    </div>
  )
}
