/**
 * 페이지 요약 — 리모컨 (`/remote-control`)
 *
 * 기능: 팝업/단독 창에서 Electron 태블릿 운동 제어 UI 표시, opener `sessionStorage` 토큰 복사.
 * 탭: 「기본」= 기존 `WorkoutControl`, 「선택보기」= 인트로 영상 확대 제어.
 *
 * 호출/연동:
 * - 자식 `WorkoutControl` / `IntroSelectViewPanel` → `deviceService`
 *
 * 관련 컴포넌트(`./components/`):
 * - `remoteControlUtils.ts`: 팝업 유틸
 * - `IntroSelectViewPanel.tsx`: 인트로 A/B/C/D 선택보기
 * - `introPositionCodes.ts`: 인트로 구역(A~D)·번호(1~3) 상수
 *
 * 흐름: 마운트 시 토큰 동기 → 탭 선택 → 해당 패널 렌더.
 */

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { WorkoutControl } from '@/components/WorkoutControl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import * as deviceService from '@/services/deviceService'
import { copyTokenFromOpener } from './components/remoteControlUtils'
import { IntroSelectViewPanel } from './components/IntroSelectViewPanel'

export function RemoteControlPage() {
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<'basic' | 'select'>('basic')
  const [isElectronConnected, setIsElectronConnected] = useState(false)
  const [isControlOwner, setIsControlOwner] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const deviceId = searchParams.get('deviceId') || localStorage.getItem('selectedDeviceId') || ''

  useEffect(() => {
    copyTokenFromOpener()
  }, [])

  const refreshControlState = useCallback(async () => {
    if (!deviceId) {
      setIsElectronConnected(false)
      setIsControlOwner(false)
      return
    }

    try {
      const connected = await deviceService.checkDeviceStatus(deviceId)
      setIsElectronConnected(connected)
      if (!connected) {
        setIsControlOwner(false)
        return
      }
      const lockStatus = await deviceService.getControlLockStatus(deviceId)
      setIsControlOwner(!!lockStatus?.isOwner)
    } catch {
      setIsElectronConnected(false)
      setIsControlOwner(false)
    }
  }, [deviceId])

  useEffect(() => {
    refreshControlState()
    const interval = setInterval(refreshControlState, 5000)
    return () => clearInterval(interval)
  }, [refreshControlState])

  const canControl = isElectronConnected && isControlOwner

  return (
    <div className="w-full h-screen flex flex-col overflow-hidden bg-background">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'basic' | 'select')}
        className="flex flex-col flex-1 min-h-0"
      >
        <TabsList className="mx-4 mt-2 mb-0 grid w-auto grid-cols-2 bg-[#222]">
          <TabsTrigger value="basic" className="text-sm">
            기본
          </TabsTrigger>
          <TabsTrigger value="select" className="text-sm">
            선택보기
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden">
          <WorkoutControl />
        </TabsContent>

        <TabsContent value="select" className="flex-1 min-h-0 mt-0 p-4 data-[state=inactive]:hidden">
          <IntroSelectViewPanel
            canControl={canControl}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
