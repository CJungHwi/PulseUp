/**
 * 컴포넌트 요약 — 원격 운동 제어 UI (`RemoteControlPage` 및 재사용처)
 *
 * 기능: 디바이스 연결·제어 잠금·재생/일시정지/스킵·화면 모드·심박 원격 진단·세션 상태 폴링.
 *
 * 호출/연동:
 * - `deviceService` 전반: `checkDeviceStatus`, `getControlLockStatus`, `getScreenMode`, `setScreenMode`, `getSessionStatus`, `playStart`/`playPause`/`playStop`/`playNext`/`playPrevious`, `getHeartRateDiagnostics` 등
 * - API 경로·DB는 `deviceService` → `packages/api-server` Electron 릴레이 라우트 참조.
 *
 * 관련 컴포넌트: `HeartRateRemoteDiagnosticsPanel`, `ConfirmDialog`, shadcn `Button`/`Card`/`Alert`.
 *
 * 흐름: `deviceId`(URL·localStorage) 확정 → 연결 폴링 → 버튼으로 명령 전송.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSnackbar } from '../contexts/SnackbarContext'
import { Play, Pause, Square, SkipBack, SkipForward, Power, Tv, RefreshCw, Monitor, FileText } from 'lucide-react'
import * as deviceService from '../services/deviceService'
import type { DeviceControlLockInfo, ScreenMode } from '../services/deviceService'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { ConfirmDialog } from './ui/confirm-dialog'
import { cn } from '../lib/utils'
import { HeartRateRemoteDiagnosticsPanel } from './HeartRateRemoteDiagnosticsPanel'

type WorkoutStatus = 'ready' | 'playing' | 'paused'

export function WorkoutControl() {
  const { showSnackbar } = useSnackbar()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<WorkoutStatus>('ready')
  const [isIntroPlaying, setIsIntroPlaying] = useState(false)
  const [isElectronConnected, setIsElectronConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [quitDialogOpen, setQuitDialogOpen] = useState(false)
  const [displayLabel, setDisplayLabel] = useState<string>(() => {
    return localStorage.getItem('displayLabel') || '링크힛 운동 시스템'
  })
  const [screenMode, setScreenMode] = useState<ScreenMode>(3)
  const [screenModeLoaded, setScreenModeLoaded] = useState(false)
  const [serverPlayStatus, setServerPlayStatus] = useState<deviceService.PlaySessionStatus | null>(null)
  const [controlLock, setControlLock] = useState<DeviceControlLockInfo | null>(null)
  const [hasEndedWorkout, setHasEndedWorkout] = useState(false)
  
  // URL 파라미터 또는 localStorage에서 deviceId 가져오기
  const deviceId = searchParams.get('deviceId') || localStorage.getItem('selectedDeviceId') || ''
  const deviceLabel = searchParams.get('deviceLabel') || localStorage.getItem('selectedDeviceLabel') || '링크힛'

  const addLog = useCallback((msg: string) => {
    if (import.meta.env.DEV) console.log(`[Remote] ${msg}`)
  }, [])

  // 디바이스 연결 상태 확인
  const checkDeviceConnection = useCallback(async () => {
    if (!deviceId) {
      setIsElectronConnected(false)
      return
    }
    
    try {
      const isConnected = await deviceService.checkDeviceStatus(deviceId)
      setIsElectronConnected(isConnected)
      if (isConnected) {
        const lockStatus = await deviceService.getControlLockStatus(deviceId)
        setControlLock(lockStatus)
      } else {
        setControlLock(null)
      }
    } catch {
      setIsElectronConnected(false)
      setControlLock(null)
    }
  }, [deviceId])

  // 초기 연결 상태 확인 및 주기적 폴링
  useEffect(() => {
    checkDeviceConnection()
    const interval = setInterval(checkDeviceConnection, 5000)
    return () => clearInterval(interval)
  }, [checkDeviceConnection])

  // 디바이스가 연결되면 현재 화면 구성 모드 조회 + 세션 상태 폴링
  useEffect(() => {
    if (!isElectronConnected || !deviceId) {
      setScreenModeLoaded(false)
      setServerPlayStatus(null)
      return
    }
    let cancelled = false

    const fetchScreenMode = async () => {
      try {
        const mode = await deviceService.getScreenMode(deviceId)
        if (!cancelled) {
          setScreenMode(mode)
          setScreenModeLoaded(true)
        }
      } catch {
        if (!cancelled) setScreenModeLoaded(false)
      }
    }

    const fetchSessionStatus = async () => {
      try {
        const sessionStatus = await deviceService.getSessionStatus(deviceId)
        if (!cancelled) setServerPlayStatus(sessionStatus.playSessionStatus)
      } catch {
        if (!cancelled) setServerPlayStatus(null)
      }
    }

    fetchScreenMode()
    fetchSessionStatus()
    const interval = setInterval(fetchSessionStatus, 3000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [isElectronConnected, deviceId])

  const isControlOwner = !!controlLock?.isOwner
  const canControl = isElectronConnected && isControlOwner
  const controlBlockedMessage = controlLock?.locked
    ? `다른 태블릿에서 제어 중입니다. (${controlLock.lock?.userid || '사용자'})`
    : '제어 연결이 설정되어 있지 않습니다. 월간프로그램에서 Play를 다시 실행해주세요.'

  const handleSelectScreenMode = async (mode: ScreenMode) => {
    if (!deviceId) {
      showSnackbar({ message: '디바이스가 선택되지 않았습니다.', severity: 'error' })
      return
    }
    setIsLoading(true)
    try {
      const result = await deviceService.setScreenMode(deviceId, mode)
      if (!result.success) {
        if (result.error === 'WORKOUT_ACTIVE') {
          showSnackbar({
            message: '운동 진행 중에는 화면 구성을 변경할 수 없습니다. 운동 종료 후 다시 시도해 주세요.',
            severity: 'warning'
          })
        } else {
          showSnackbar({ message: `화면 구성 변경 실패 (${result.error || '알 수 없음'})`, severity: 'error' })
        }
        return
      }
      setScreenMode(result.mode)
      if (result.fallbackToThree) {
        const countText = typeof result.monitorCount === 'number' ? ` (감지된 모니터 ${result.monitorCount}대)` : ''
        showSnackbar({
          message: `5분할 영상 표시는 모니터가 2대 이상 필요합니다${countText}. 현재는 타이머만 표시됩니다.`,
          severity: 'warning'
        })
      } else {
        showSnackbar({ message: `화면 구성을 ${result.mode}분할로 변경했습니다`, severity: 'success' })
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '알 수 없는 오류'
      showSnackbar({ message: `화면 구성 변경 실패: ${msg}`, severity: 'error' })
      await checkDeviceConnection()
    } finally {
      setIsLoading(false)
    }
  }

  // 서버 중계 명령 실행 헬퍼
  const executeCommand = async (
    commandFn: () => Promise<any>,
    successMessage?: string,
    errorMessage?: string
  ) => {
    if (!deviceId) {
      showSnackbar({ message: '디바이스가 선택되지 않았습니다.', severity: 'error' })
      return false
    }

    setIsLoading(true)
    try {
      await commandFn()
      if (successMessage) {
        showSnackbar({ message: successMessage, severity: 'success' })
      }
      return true
    } catch (error) {
      const msg = error instanceof Error ? error.message : '알 수 없는 오류'
      showSnackbar({ message: errorMessage || msg, severity: 'error' })
      await checkDeviceConnection()
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const handleIntro = async () => {
    const success = await executeCommand(
      () => deviceService.sendDeviceCommand(deviceId, 'play-intro', {}),
      '인트로를 시작합니다',
      '인트로 시작 실패'
    )
    if (success) {
      setHasEndedWorkout(false)
      setIsIntroPlaying(true)
    }
  }

  const handleStart = async () => {
    if (!deviceId) {
      showSnackbar({ message: '디바이스가 선택되지 않았습니다.', severity: 'error' })
      return
    }
    setIsLoading(true)
    try {
      const result = await deviceService.playStart(deviceId)
      if (result && typeof result === 'object' && 'introCancelled' in result && result.introCancelled) {
        showSnackbar({
          message:
            typeof result.message === 'string'
              ? result.message
              : '인트로 재생 중에는 운동을 시작할 수 없습니다. 초기 화면에서 다시 운동 시작을 눌러 주세요.',
          severity: 'info'
        })
        setIsIntroPlaying(false)
        setStatus('ready')
        return
      }
      setStatus('playing')
      setIsIntroPlaying(false)
      setHasEndedWorkout(false)
    } catch (error) {
      const msg = error instanceof Error ? error.message : '알 수 없는 오류'
      showSnackbar({ message: msg, severity: 'error' })
      await checkDeviceConnection()
    } finally {
      setIsLoading(false)
    }
  }

  const handlePause = async () => {
    const success = await executeCommand(
      () => deviceService.playPause(deviceId),
      undefined,
      '일시정지/재개 실패'
    )
    if (success) {
      setStatus(status === 'playing' ? 'paused' : 'playing')
    }
  }

  const handleStop = async () => {
    const success = await executeCommand(
      () => deviceService.playStop(deviceId),
      '운동을 종료했습니다',
      '운동 종료 실패'
    )
    if (success) {
      setStatus('ready')
      setIsIntroPlaying(false)
      setHasEndedWorkout(true)
    }
  }

  /* 제어 연결 끊기 — 버튼 비활성화, 필요 시 복구
  const handleDisconnectControl = async () => {
    if (!deviceId) {
      showSnackbar({ message: '디바이스가 선택되지 않았습니다.', severity: 'error' })
      return
    }

    setIsLoading(true)
    try {
      await deviceService.releaseControlLock(deviceId)
      setControlLock(null)
      showSnackbar({ message: 'LINKHIIT 앱 제어 연결을 끊었습니다.', severity: 'success' })
      setTimeout(() => window.close(), 300)
    } catch (error) {
      const msg = error instanceof Error ? error.message : '제어 연결 해제 실패'
      showSnackbar({ message: msg, severity: 'error' })
    } finally {
      setIsLoading(false)
    }
  }
  */

  const handleNext = async () => {
    await executeCommand(
      () => deviceService.playNext(deviceId),
      '다음 운동으로 이동했습니다',
      '다음 운동이 없습니다.'
    )
  }

  const handlePrevious = async () => {
    await executeCommand(
      () => deviceService.playPrevious(deviceId),
      '이전 운동으로 이동했습니다',
      '이전 운동 이동 실패'
    )
  }

  const handleSendWorkoutLogs = async () => {
    await executeCommand(
      async () => {
        const result = await deviceService.sendWorkoutLogs(deviceId)
        addLog(`로그 전송 완료: ${result.fileCount}개 파일, ${result.totalBytes} bytes`)
        const savedPath = result.relativePath || result.serverFileName || ''
        showSnackbar({
          message: savedPath
            ? `현재 운동 로그를 서버로 전송했습니다. (${savedPath})`
            : '현재 운동 로그를 서버로 전송했습니다',
          severity: 'success'
        })
      }
    )
  }

  const handleApplyDisplayLabel = async () => {
    const success = await executeCommand(
      () => deviceService.sendDeviceCommand(deviceId, 'set-display-label', { displayLabel }),
      '화면 표시 텍스트가 반영되었습니다',
      '텍스트 반영 실패'
    )
    if (success) {
      localStorage.setItem('displayLabel', displayLabel)
    }
  }

  const handleQuitAppClick = () => {
    setQuitDialogOpen(true)
  }

  const handleQuitAppConfirm = async () => {
    setQuitDialogOpen(false)
    setIsLoading(true)
    
    try {
      await deviceService.sendDeviceCommand(deviceId, 'quit-app', {})
      showSnackbar({ message: '앱을 종료했습니다', severity: 'success' })
    } catch {
      // 앱이 종료되면 연결이 끊기므로 에러는 정상
      showSnackbar({ message: '앱 종료 명령을 전송했습니다', severity: 'info' })
    }
    
    try {
      await deviceService.releaseControlLock(deviceId)
    } catch {
      // 앱 종료와 함께 연결이 끊기는 흐름이므로 해제 실패는 무시
    }

    setControlLock(null)
    setIsElectronConnected(false)
    setIsLoading(false)
    
    // 1초 후 리모컨 창 닫기
    setTimeout(() => {
      window.close()
    }, 1000)
  }


  const statusColorMap: Record<string, string> = {
    ready: 'blue-500',
    playing: 'green-500',
    paused: 'orange-500'
  }

  const getStatusText = () => {
    switch (status) {
      case 'ready': return '대기중'
      case 'playing': return '진행중'
      case 'paused': return '일시정지'
      default: return '알 수 없음'
    }
  }

  const getStatusColorClass = (prefix: 'bg' | 'text' = 'bg') => {
    const color = statusColorMap[status] || 'gray-500'
    return `${prefix}-${color}`
  }

  return (
    <div className="p-4 w-full h-[100dvh] bg-[#1a1a1a] flex flex-col overflow-hidden">
      {/* 디바이스 정보 */}
      <div className="text-[10px] text-gray-500 mb-1 flex justify-between opacity-50">
        <span>링크힛: {deviceLabel} | {status}</span>
        <span>{isElectronConnected ? '🟢 연결됨' : '🔴 연결 안됨'}</span>
      </div>

      {/* 연결 오류 패널 */}
      {!isElectronConnected && (
        <Card className="p-3 mb-3 bg-[#222] text-white flex-shrink-0 border-[#333]">
          <Alert variant="destructive" className="py-2 bg-red-900/20 border-red-500">
            <AlertTitle className="text-sm">연결 오류</AlertTitle>
            <AlertDescription className="text-xs text-white">
              디바이스에 연결할 수 없습니다.
              <div className="mt-1 opacity-70">
                Electron 앱이 실행 중인지 확인해주세요.
              </div>
            </AlertDescription>
          </Alert>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full"
            onClick={checkDeviceConnection}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            다시 연결
          </Button>
        </Card>
      )}

      {isElectronConnected && !isControlOwner && (
        <Card className="p-3 mb-3 bg-[#222] text-white flex-shrink-0 border-[#333]">
          <Alert variant="destructive" className="py-2 bg-amber-900/20 border-amber-500">
            <AlertTitle className="text-sm">제어 잠금</AlertTitle>
            <AlertDescription className="text-xs text-white">
              {controlBlockedMessage}
            </AlertDescription>
          </Alert>
        </Card>
      )}

      {isElectronConnected && isControlOwner && hasEndedWorkout && (
        <Card className="p-3 mb-3 bg-[#222] text-white flex-shrink-0 border-[#333]">
          <Alert className="py-2 bg-blue-900/20 border-blue-500">
            <AlertTitle className="text-sm">운동 종료</AlertTitle>
            <AlertDescription className="text-xs text-white">
              운동이 종료되었습니다. 새 운동은 월간프로그램에서 다시 시작해주세요.
            </AlertDescription>
          </Alert>
        </Card>
      )}

      <HeartRateRemoteDiagnosticsPanel
        deviceId={deviceId}
        enabled={isElectronConnected}
      />

      <Card className="p-3 bg-[#2d2d2d] text-white flex-1 flex flex-col border-[#333] overflow-hidden">
        {/* 운동 상태 */}
        <div className="flex-1 flex flex-col justify-center overflow-y-auto">
          <div className="flex items-center gap-2 mb-3">
            <div
              className={cn(
                "w-3 h-3 rounded-full",
                getStatusColorClass('bg'),
                status === 'playing' && "animate-pulse"
              )}
            />
            <h2 className="text-xl text-white">
              운동 상태:{' '}
              <span className={cn("font-bold", getStatusColorClass('text'))}>
                {getStatusText()}
              </span>
            </h2>
          </div>

          {/* 화면 표시 텍스트 설정 */}
          <div className="mb-3 pb-3 border-b border-white/10">
            <label htmlFor="display-label" className="block text-sm font-medium text-white/80 mb-2">
              📺 Electron 화면 표시 텍스트
            </label>
            <div className="flex gap-2">
              <input
                id="display-label"
                type="text"
                value={displayLabel}
                onChange={(e) => setDisplayLabel(e.target.value)}
                placeholder="예: 링크힛 스튜디오 강남점"
                className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <Button
                onClick={handleApplyDisplayLabel}
                variant="outline"
                size="sm"
                className="whitespace-nowrap bg-blue-600/20 border-blue-500/50 hover:bg-blue-600/40 text-blue-400"
                disabled={!canControl || isLoading}
              >
                반영
              </Button>
            </div>
          </div>

          {/* 화면 구성 (3분할 / 5분할) */}
          {(() => {
            const isWorkoutPlaying = serverPlayStatus === 'playing' || serverPlayStatus === 'paused'
            const screenModeDisabled = !canControl || isLoading || isWorkoutPlaying
            return (
              <div className="mb-3 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Monitor className="w-4 h-4 text-white/80" />
                  <label className="block text-sm font-medium text-white/80">
                    화면 구성
                  </label>
                  {screenModeLoaded && (
                    <span className="text-xs text-white/40">
                      현재 {screenMode}분할
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleSelectScreenMode(3)}
                    disabled={screenModeDisabled}
                    className={cn(
                      'flex-1 text-sm min-h-14 py-4 h-auto leading-snug',
                      screenMode === 3
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-white/10 hover:bg-white/20 text-white/80'
                    )}
                  >
                    3분할 (좌·중·우)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleSelectScreenMode(5)}
                    disabled={screenModeDisabled}
                    className={cn(
                      'flex-1 text-sm min-h-14 py-4 h-auto leading-snug',
                      screenMode === 5
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-white/10 hover:bg-white/20 text-white/80'
                    )}
                  >
                    5분할 (좌외·좌내·중·우내·우외)
                  </Button>
                </div>
                {isWorkoutPlaying && (
                  <div className="text-[11px] text-white/40 mt-1">
                    운동 진행 중에는 화면 구성을 변경할 수 없습니다. 종료 후 다시 시도해 주세요.
                  </div>
                )}
              </div>
            )
          })()}

          {/* 제어 버튼 — 대기: 인트로·운동시작 / 진행·일시정지: 이전·다음 (동일 크기 슬롯) + 일시정지·종료 */}
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              {status === 'ready' ? (
                <>
                  <Button
                    size="lg"
                    className="w-full text-xl font-semibold py-6 min-h-[132px] bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
                    onClick={handleIntro}
                    disabled={!canControl || isIntroPlaying || isLoading}
                  >
                    <Tv className="w-5 h-5 shrink-0" />
                    인트로
                  </Button>

                  <Button
                    size="lg"
                    className="w-full text-xl font-semibold py-6 min-h-[132px] bg-green-600 hover:bg-green-700 disabled:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
                    onClick={handleStart}
                    disabled={!canControl || isLoading}
                  >
                    <Play className="w-5 h-5 shrink-0" />
                    운동 시작
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="lg"
                    className="w-full text-xl font-semibold py-5 min-h-[106px] bg-slate-600 hover:bg-slate-700 disabled:bg-slate-600 disabled:opacity-50 flex items-center justify-center gap-2"
                    onClick={handlePrevious}
                    disabled={!canControl || isLoading}
                  >
                    <SkipBack className="w-5 h-5 shrink-0" />
                    이전
                  </Button>
                  <Button
                    size="lg"
                    className="w-full text-xl font-semibold py-5 min-h-[106px] bg-slate-600 hover:bg-slate-700 disabled:bg-slate-600 disabled:opacity-50 flex items-center justify-center gap-2"
                    onClick={handleNext}
                    disabled={!canControl || isLoading}
                  >
                    <SkipForward className="w-5 h-5 shrink-0" />
                    다음
                  </Button>
                </>
              )}

              <Button
                size="lg"
                className="w-full text-xl font-semibold py-5 min-h-[106px] bg-orange-600 hover:bg-orange-700 disabled:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
                onClick={handlePause}
                disabled={!canControl || status === 'ready' || isLoading}
              >
                <Pause className="w-5 h-5 shrink-0" />
                {status === 'paused' ? '재개' : '일시정지'}
              </Button>

              <Button
                size="lg"
                variant="destructive"
                className="w-full text-xl font-semibold py-5 min-h-[106px] disabled:opacity-50 flex items-center justify-center gap-2"
                onClick={handleStop}
                disabled={!canControl || status === 'ready' || isLoading}
              >
                <Square className="w-5 h-5 shrink-0" />
                운동 종료
              </Button>
            </div>

            {/* 구분선 */}
            <div className="border-t border-white/10 my-1" />

            {/* Electron 제어 버튼 */}
            {/* 제어 연결 끊기 — 불필요로 비활성화 (핸들러 handleDisconnectControl 동일 주석)
            <Button
              variant="outline"
              size="lg"
              className="w-full text-base py-3 bg-slate-600 hover:bg-slate-700 disabled:bg-slate-600 disabled:opacity-50"
              onClick={handleDisconnectControl}
              disabled={!canControl || isLoading}
            >
              <Unplug className="w-4 h-4" />
              제어 연결 끊기
            </Button>
            */}

            <Button
              variant="outline"
              size="lg"
              className="w-full text-base py-4 min-h-[72px] bg-sky-600 hover:bg-sky-700 disabled:bg-sky-600 disabled:opacity-50"
              onClick={handleSendWorkoutLogs}
              disabled={!canControl || isLoading}
            >
              <FileText className="w-4 h-4" />
              로그 보내기
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full text-base py-6 min-h-[88px] bg-amber-600 hover:bg-amber-700 disabled:bg-amber-600 disabled:opacity-50"
              onClick={handleQuitAppClick}
              disabled={!canControl || isLoading}
            >
              <Power className="w-4 h-4" />
              앱 종료
            </Button>
          </div>
        </div>
      </Card>

      {/* 앱 종료 확인 다이얼로그 */}
      <ConfirmDialog
        open={quitDialogOpen}
        onClose={() => setQuitDialogOpen(false)}
        onConfirm={handleQuitAppConfirm}
        title="앱 종료 확인"
        description="Electron 앱을 종료하시겠습니까? 모든 운동 세션이 중단됩니다."
        confirmText="종료"
        cancelText="취소"
        variant="destructive"
      />
    </div>
  )
}

