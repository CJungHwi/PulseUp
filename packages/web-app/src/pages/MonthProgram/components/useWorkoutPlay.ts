/**
 * useWorkoutPlay — 운동 재생/디바이스 선택/Electron IP 다이얼로그 관련 핸들러 훅
 *
 * 반환:
 * - 디바이스/IP 다이얼로그 상태
 * - `handlePlayWorkout`: Play 버튼 클릭 시 라우팅 (서버 중계/직접 연결 분기)
 *   - SINGLE scope: `horizontal`(3분할) / `vertical`(5분할) layout 인자 지원
 * - `handleDeviceSelect`: 디바이스 선택 후 릴레이 재생
 * - `handleElectronIPConfirm`: IP 다이얼로그 확인
 */

import { useRef, useState } from 'react'
import {
  checkDeviceConnected,
  getSelectedDeviceId,
  isServerRelayMode,
  setSelectedDeviceId,
  startWorkoutPlay,
  startWorkoutPlayRelay,
} from '@/services/electronHttp'
import * as deviceService from '@/services/deviceService'
import type { ScreenMode } from '@/services/deviceService'
import { getRemoteControlPopupWindowFeatures } from '@/pages/RemoteControl/components/remoteControlUtils'
import { mergeSequencesWithPlans } from './monthProgramUtils'
import { requestControlToken } from './monthProgramApi'
import type { ExerciseSequence, WorkoutMaster, WorkoutPlan } from './monthProgramTypes'

type Severity = 'success' | 'info' | 'warning' | 'error'

/** SINGLE scope 재생 시 화면 구성 — 가로=3분할, 세로=5분할 */
export type SinglePlayLayout = 'horizontal' | 'vertical'

const LAYOUT_TO_SCREEN_MODE: Record<SinglePlayLayout, ScreenMode> = {
  horizontal: 3,
  vertical: 5,
}

interface UseWorkoutPlayArgs {
  selectedMaster: WorkoutMaster | null
  exerciseSequences: ExerciseSequence[]
  workoutPlans: WorkoutPlan[]
  user: { id: string | number; linkageEnabled?: boolean } | null
  notify: (message: string, severity?: Severity) => void
}

const computePlayMetadata = (
  selectedMaster: WorkoutMaster,
  mergedSequences: ExerciseSequence[],
) => {
  const mainRounds = mergedSequences.filter((s) => s.round > 0 && s.round < 99).map((s) => s.round)
  const uniqueRounds = [...new Set(mainRounds)]
  const maxRound = uniqueRounds.length > 0 ? Math.max(...uniqueRounds) : 1

  const firstExercisePosition = mergedSequences.find(
    (s) => s.round > 0 && s.round < 99 && s.exercise_type === 'exercise',
  )?.position
  let totalSets = 1
  if (firstExercisePosition) {
    totalSets = mergedSequences.filter(
      (s) =>
        s.round > 0 &&
        s.round < 99 &&
        s.exercise_type === 'exercise' &&
        s.position === firstExercisePosition,
    ).length
  }

  const mainExercises = mergedSequences.filter(
    (s) => s.round > 0 && s.round < 99 && s.exercise_type === 'exercise',
  )
  const uniqueExerciseIds = new Set(mainExercises.map((s) => s.exercise_id))
  const exerciseCount = uniqueExerciseIds.size || mainExercises.length

  const totalDuration =
    selectedMaster?.totalSeconds && selectedMaster.totalSeconds > 0
      ? selectedMaster.totalSeconds
      : mergedSequences.reduce((sum, s) => sum + (s.duration || 0), 0)

  return { maxRound, totalSets, exerciseCount, totalDuration }
}

const computeCircuitType = (master: WorkoutMaster): string => {
  const wcId = (master.workoutCategoriesId || '').toString().toUpperCase()
  if (wcId === 'EMOM') return 'emom'
  if (wcId === 'AMRAP') return 'amrap'
  return master.circuitType || 'stress'
}

const tryAutoDetectIP = async (baseIP: string): Promise<string | null> => {
  try {
    const response = await fetch(`http://${baseIP}:3002/info`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    })
    if (response.ok) {
      const data = await response.json()
      if (data.network?.addresses?.length > 0) {
        const ipv4 = data.network.addresses.find((addr: any) => addr.family === 'IPv4')
        return ipv4?.address || null
      }
    }
  } catch {
    // ignore
  }
  return null
}

export const useWorkoutPlay = ({
  selectedMaster,
  exerciseSequences,
  workoutPlans,
  user,
  notify,
}: UseWorkoutPlayArgs) => {
  const [electronIPDialogOpen, setElectronIPDialogOpen] = useState(false)
  const [electronIPInput, setElectronIPInput] = useState<string>('')
  const [pendingPlayAction, setPendingPlayAction] = useState<(() => void) | null>(null)

  const [deviceSelectDialogOpen, setDeviceSelectDialogOpen] = useState(false)
  const [selectedDeviceIdLocal, setSelectedDeviceIdLocal] = useState<string | null>(
    getSelectedDeviceId(),
  )
  const [selectedDeviceLabel, setSelectedDeviceLabel] = useState<string>('')
  const pendingScreenModeRef = useRef<ScreenMode | null>(null)

  const applyScreenModeBeforePlay = async (
    deviceId: string,
    screenMode: ScreenMode,
  ): Promise<boolean> => {
    const result = await deviceService.setScreenMode(deviceId, screenMode)
    if (result.success) {
      if (result.fallbackToThree && screenMode === 5) {
        notify('모니터 수가 부족해 3분할로 재생됩니다.', 'info')
      }
      return true
    }
    if (result.error === 'WORKOUT_ACTIVE') {
      notify('운동 진행 중에는 화면 구성을 변경할 수 없습니다. 종료 후 다시 시도해주세요.', 'warning')
      return false
    }
    notify(result.error || '화면 구성 변경에 실패했습니다.', 'error')
    return false
  }

  const openElectronIPDialog = async (onConfirm: () => void, suggestedIP?: string) => {
    const savedIP = localStorage.getItem('electronIP') || 'localhost'
    let initialIP = suggestedIP || savedIP
    if (savedIP === 'localhost' && !suggestedIP) {
      const detectedIP = await tryAutoDetectIP('localhost')
      if (detectedIP) initialIP = detectedIP
    }
    setElectronIPInput(initialIP)
    setPendingPlayAction(() => onConfirm)
    setElectronIPDialogOpen(true)
  }

  const handleElectronIPConfirm = () => {
    const ip = electronIPInput.trim() || 'localhost'
    localStorage.setItem('electronIP', ip)
    setElectronIPDialogOpen(false)
    if (pendingPlayAction) {
      pendingPlayAction()
      setPendingPlayAction(null)
    }
  }

  const openRemoteControlPopup = (electronIP: string, existingPopup?: Window | null) => {
    const url = `/remote-control?electronIP=${encodeURIComponent(electronIP)}`
    if (existingPopup && !existingPopup.closed) {
      existingPopup.location.href = url
      existingPopup.focus()
      return existingPopup
    }
    const popup = window.open(url, 'RemoteControl', getRemoteControlPopupWindowFeatures())
    if (!popup) {
      notify('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.', 'warning')
    }
    return popup
  }

  const buildPlayData = (mergedSequences: ExerciseSequence[], currentCircuitType: string) => {
    if (!selectedMaster || !user) return null
    const meta = computePlayMetadata(selectedMaster, mergedSequences)
    return {
      masterId: selectedMaster.id,
      userId: user.id,
      sequences: mergedSequences,
      metadata: {
        totalRounds: meta.maxRound,
        totalSets: meta.totalSets,
        workoutCategory: selectedMaster.workoutCategoriesId || '',
        major_category_name: selectedMaster.workoutCategoriesName || '',
        circuitType: currentCircuitType,
        date: selectedMaster.date,
        time: selectedMaster.time,
        workoutPlans,
        exerciseCount: meta.exerciseCount,
        totalDuration: meta.totalDuration,
      },
    }
  }

  const executePlayWorkoutRelay = async (deviceId: string, screenMode?: ScreenMode | null) => {
    if (!selectedMaster || !user) return
    if (screenMode) {
      const ok = await applyScreenModeBeforePlay(deviceId, screenMode)
      if (!ok) return
    }
    const currentCircuitType = computeCircuitType(selectedMaster)
    const mergedSequences = mergeSequencesWithPlans(
      exerciseSequences,
      workoutPlans,
      currentCircuitType,
    )
    const playData = buildPlayData(mergedSequences, currentCircuitType)
    if (!playData) return

    try {
      notify('운동을 시작합니다...', 'info')
      const result = await startWorkoutPlayRelay(deviceId, playData)
      if (result.success) {
        notify('운동이 시작되었습니다!', 'success')
        const remoteControlUrl = `/remote-control?deviceId=${encodeURIComponent(
          deviceId,
        )}&deviceLabel=${encodeURIComponent(selectedDeviceLabel || '링크힛')}&mode=relay`
        window.open(remoteControlUrl, 'RemoteControl', getRemoteControlPopupWindowFeatures())
      } else {
        notify(result.error || '운동 시작에 실패했습니다.', 'error')
      }
    } catch (error) {
      notify(
        error instanceof Error ? error.message : '운동 시작 중 오류가 발생했습니다.',
        'error',
      )
    }
  }

  const executePlayWorkoutDirect = async (electronIP: string): Promise<void> => {
    if (!selectedMaster || !user) return

    const popup = window.open('', 'RemoteControl', getRemoteControlPopupWindowFeatures()) as unknown as Window
    if (popup) {
      popup.document.write(
        `<html><head><title>연결 중...</title></head><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;background-color:#1a1a1a;color:white;"><div style="text-align:center"><h3>Electron 앱에 연결 중입니다...</h3><p>잠시만 기다려주세요.</p></div></body></html>`,
      )
    } else {
      notify('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.', 'warning')
      return
    }

    const currentCircuitType = computeCircuitType(selectedMaster)
    const mergedSequences = mergeSequencesWithPlans(
      exerciseSequences,
      workoutPlans,
      currentCircuitType,
    )
    const playData = buildPlayData(mergedSequences, currentCircuitType)
    if (!playData) return

    try {
      const { controlToken, expiresIn } = await requestControlToken()
      if (!controlToken) throw new Error('control token 발급 실패')
      try {
        localStorage.setItem('electronControlToken', controlToken)
        if (expiresIn)
          localStorage.setItem(
            'electronControlTokenExpiresAt',
            String(Date.now() + expiresIn * 1000),
          )
      } catch {
        // ignore
      }

      const response = await startWorkoutPlay(electronIP, 3002, playData, {
        signal: AbortSignal.timeout(5000),
        authToken: controlToken,
      })
      const result = await response.json()

      if (response.ok && result.success) {
        openRemoteControlPopup(electronIP, popup)
        return
      }
      throw new Error(result.error || '운동 준비 실패')
    } catch (error) {
      console.error('Electron 앱 연결 실패:', error)
      if ((window as any).__LINKHIIT_SESSION_EXPIRED__) return

      openElectronIPDialog(() => {
        const newIP = localStorage.getItem('electronIP') || electronIP
        executePlayWorkoutDirect(newIP)
      })

      const confirmCert = window.confirm(
        `Electron 앱에 연결할 수 없습니다.\n(IP: ${electronIP}:3002)\n\n` +
          `처음 연결하는 경우 보안 인증서 허용이 필요합니다.\n` +
          `확인을 누르면 인증 페이지가 열립니다. 페이지에서 "고급 -> 안전하지 않음으로 이동"을 클릭하여 허용해주세요.`,
      )
      if (confirmCert) {
        window.open(`https://${electronIP}:3002`, '_blank')
      }
    }
  }

  const handlePlayWorkout = async (layout?: SinglePlayLayout) => {
    if (!selectedMaster || exerciseSequences.length === 0) {
      notify('운동 기록을 선택해주세요.', 'warning')
      return
    }
    if (user?.linkageEnabled === false) {
      notify('현재 LINKHIIT앱 사용이 중지되어 있습니다. 관리자에 문의하세요.', 'error')
      return
    }

    const screenMode = layout ? LAYOUT_TO_SCREEN_MODE[layout] : null

    if (isServerRelayMode()) {
      if (selectedDeviceIdLocal) {
        const isConnected = await checkDeviceConnected(selectedDeviceIdLocal)
        if (isConnected) {
          executePlayWorkoutRelay(selectedDeviceIdLocal, screenMode)
          return
        }
        setSelectedDeviceId(null)
        setSelectedDeviceIdLocal(null)
        setSelectedDeviceLabel('')
        notify(
          '선택된 LINKHIIT 앱 연결이 끊어졌습니다. 디바이스를 다시 등록하거나 선택해주세요.',
          'warning',
        )
        pendingScreenModeRef.current = screenMode
        setDeviceSelectDialogOpen(true)
      } else {
        pendingScreenModeRef.current = screenMode
        setDeviceSelectDialogOpen(true)
      }
      return
    }

    if (screenMode) {
      notify('직접 연결 모드에서는 화면 구성 변경 없이 재생합니다.', 'info')
    }

    const electronIP = localStorage.getItem('electronIP') || 'localhost'
    if (electronIP === 'localhost') {
      openElectronIPDialog(() => {
        const ip = localStorage.getItem('electronIP') || 'localhost'
        executePlayWorkoutDirect(ip)
      })
      return
    }
    executePlayWorkoutDirect(electronIP)
  }

  const handleDeviceSelect = (deviceId: string, displayLabel: string) => {
    setSelectedDeviceIdLocal(deviceId)
    setSelectedDeviceLabel(displayLabel)
    setSelectedDeviceId(deviceId)
    const screenMode = pendingScreenModeRef.current
    pendingScreenModeRef.current = null
    executePlayWorkoutRelay(deviceId, screenMode)
  }

  return {
    electronIPDialogOpen,
    setElectronIPDialogOpen,
    electronIPInput,
    setElectronIPInput,
    handleElectronIPConfirm,
    deviceSelectDialogOpen,
    setDeviceSelectDialogOpen,
    selectedDeviceId: selectedDeviceIdLocal,
    handlePlayWorkout,
    handleDeviceSelect,
  }
}
