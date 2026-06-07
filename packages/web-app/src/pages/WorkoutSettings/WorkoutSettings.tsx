/**
 * 페이지 요약 - 운동/모니터 설정 (`/workout-settings`)
 *
 * 기능: MAIN-STRESS/MAIN-LOOP/AMRAP/EMOM-STRESS/EMOM-LOOP별 시간표 설정, 모니터 표시(기본/인트로 이미지 좌·중·우, 영상앱 문자).
 *
 * 호출/연동:
 * - `GET|PUT /workout-categories/workout-setting/:methodType`
 * - `GET|PUT|POST .../monitor-display-profile`, `.../system-monitor-display-profile`
 *
 * 관련 컴포넌트: `WorkoutMethodSettingsCard`, `MonitorDisplayTabs`, `useMonitorDisplaySettings`.
 *
 * 흐름: 방법 탭 선택 → 서버에서 행 로드 → 모니터 표시 탭 저장.
 * 시스템 기본값 UI/API는 super_admin 전용.
 */

import React, { useEffect, useMemo, useState } from 'react'
import api from '@/services/api'
import { useSnackbar } from '@/contexts/SnackbarContext'
import { useAppSelector } from '@/hooks/redux'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { WorkoutMethodSettingsCard } from './components/WorkoutMethodSettingsCard'
import { MonitorDisplayTabs } from './components/MonitorDisplayTabs'
import { useMonitorDisplaySettings } from './components/useMonitorDisplaySettings'
import {
  DEFAULT_ROWS,
  METHOD_LABELS,
  isEmomMethod,
  isTimeStructuredMethod,
  type MethodType,
  normalizeRows,
  type WorkoutSettingRow
} from './components/workoutSettingsModel'

const WORKOUT_SETTING_METHODS: MethodType[] = ['stress', 'loop', 'AMRAP', 'EMOM-STRESS', 'EMOM-LOOP']

const WorkoutSettings: React.FC = () => {
  const { showSnackbar } = useSnackbar()
  const user = useAppSelector((state) => state.auth.user)
  const isSuperAdmin = user?.role === 'super_admin'

  const [selectedMethod, setSelectedMethod] = useState<MethodType>('stress')
  const [settingsByMethod, setSettingsByMethod] = useState<Record<MethodType, WorkoutSettingRow[]>>({
    stress: DEFAULT_ROWS.stress,
    loop: DEFAULT_ROWS.loop,
    AMRAP: DEFAULT_ROWS.AMRAP,
    'EMOM-STRESS': DEFAULT_ROWS['EMOM-STRESS'],
    'EMOM-LOOP': DEFAULT_ROWS['EMOM-LOOP']
  })
  const [isSavingSetting, setIsSavingSetting] = useState(false)

  const monitorDisplay = useMonitorDisplaySettings(isSuperAdmin)

  const isTimeStructured = useMemo(
    () => isTimeStructuredMethod(selectedMethod),
    [selectedMethod]
  )

  const loadMethodSettings = async (methodType: MethodType) => {
    try {
      const response = await api.get(`/workout-categories/workout-setting/${methodType}`)
      const rows = normalizeRows(response?.data?.data || [], methodType)
      setSettingsByMethod((prev) => ({ ...prev, [methodType]: rows }))
    } catch {
      showSnackbar({ message: `${METHOD_LABELS[methodType]} 설정 조회 실패`, severity: 'error' })
    }
  }

  useEffect(() => {
    WORKOUT_SETTING_METHODS.forEach((methodType) => {
      loadMethodSettings(methodType)
    })
  }, [])

  const currentRows = settingsByMethod[selectedMethod]
  const isWaterBreakLastRowOnly =
    selectedMethod === 'stress' || selectedMethod === 'loop' || isEmomMethod(selectedMethod)

  const handleCellDirectChange = (index: number, field: keyof WorkoutSettingRow, value: number) => {
    if (field === 'waterBreak' && isWaterBreakLastRowOnly && index !== currentRows.length - 1) return
    if (Number.isNaN(value)) return
    setSettingsByMethod((prev) => {
      const nextRows = [...prev[selectedMethod]]
      nextRows[index] = { ...nextRows[index], [field]: Math.max(0, Math.floor(value)) }
      return { ...prev, [selectedMethod]: nextRows }
    })
  }

  const handleCellAdjust = (index: number, field: keyof WorkoutSettingRow, delta: number) => {
    if (field === 'waterBreak' && isWaterBreakLastRowOnly && index !== currentRows.length - 1) return
    setSettingsByMethod((prev) => {
      const nextRows = [...prev[selectedMethod]]
      const current = nextRows[index][field] as number
      nextRows[index] = { ...nextRows[index], [field]: Math.max(0, Math.floor(current + delta)) }
      return { ...prev, [selectedMethod]: nextRows }
    })
  }

  const handleAddRow = () => {
    const prevRows = settingsByMethod[selectedMethod]
    if (selectedMethod === 'AMRAP' && prevRows.length >= 2) {
      showSnackbar({ message: 'AMRAP은 Round를 최대 2개까지 지정할 수 있습니다', severity: 'warning' })
      return
    }
    setSettingsByMethod((prev) => {
      const prevRowsInner = prev[selectedMethod]
      const nextRound =
        prevRowsInner.length > 0 ? Math.max(...prevRowsInner.map((row) => row.round)) + 1 : 1
      let nextRows: WorkoutSettingRow[] = [
        ...prevRowsInner,
        {
          round: nextRound,
          time: isTimeStructured ? 1 : 60,
          rest: isTimeStructured ? 0 : 20,
          waterBreak: 0,
          reps: isTimeStructured ? 10 : 0,
          sortOrder: prevRowsInner.length + 1,
          isActive: true
        }
      ]
      if (selectedMethod === 'stress' || selectedMethod === 'loop' || isEmomMethod(selectedMethod)) {
        nextRows = nextRows.map((row, i) =>
          i < nextRows.length - 1 ? { ...row, waterBreak: 0 } : row
        )
      }
      return { ...prev, [selectedMethod]: nextRows }
    })
  }

  const handleRemoveRow = () => {
    setSettingsByMethod((prev) => {
      const prevRows = prev[selectedMethod]
      if (prevRows.length <= 1) return prev
      let nextRows = prevRows.slice(0, -1).map((row, index) => ({
        ...row,
        round: index + 1,
        sortOrder: index + 1
      }))
      if (selectedMethod === 'stress' || selectedMethod === 'loop' || isEmomMethod(selectedMethod)) {
        nextRows = nextRows.map((row, i) =>
          i < nextRows.length - 1 ? { ...row, waterBreak: 0 } : row
        )
      }
      return { ...prev, [selectedMethod]: nextRows }
    })
  }

  const handleSaveCurrentMethod = async () => {
    try {
      setIsSavingSetting(true)
      const isAmrapEmom = isTimeStructuredMethod(selectedMethod)
      const payloadRows = currentRows.map((row, index) => {
        let rest = row.rest
        let waterBreak = row.waterBreak
        if (isAmrapEmom) {
          rest = 0
          if (isEmomMethod(selectedMethod) && index < currentRows.length - 1) {
            waterBreak = 0
          } else {
            waterBreak = row.waterBreak * 60
          }
        } else if (
          (selectedMethod === 'stress' || selectedMethod === 'loop') &&
          index < currentRows.length - 1
        ) {
          waterBreak = 0
        }
        return {
          round: index + 1,
          time: row.time,
          rest,
          waterBreak,
          reps: row.reps,
          sortOrder: index + 1,
          isActive: true
        }
      })

      await api.put(`/workout-categories/workout-setting/${selectedMethod}`, { rows: payloadRows })
      showSnackbar({ message: `${METHOD_LABELS[selectedMethod]} 설정 저장 완료`, severity: 'success' })
      await loadMethodSettings(selectedMethod)
    } catch {
      showSnackbar({ message: '운동 설정 저장 실패', severity: 'error' })
    } finally {
      setIsSavingSetting(false)
    }
  }

  return (
    <div className="h-[calc(100vh-140px)] p-0 flex flex-col gap-[3px] overflow-hidden bg-background">
      <Card className="border border-[#343637] dark:border-[#6b7280] shadow-md">
        <CardHeader className="h-12 px-4 py-0 border-b bg-[#f9fafb] dark:bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
          <CardTitle className="text-base font-bold text-[#1d1d1d] dark:text-white">
            운동설정관리
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            로그인 사용자: {user?.userid || '-'} ({user?.role || '-'})
          </span>
        </CardHeader>
      </Card>

      <div className="flex flex-1 min-h-0 gap-[3px]">
        <WorkoutMethodSettingsCard
          selectedMethod={selectedMethod}
          onMethodChange={setSelectedMethod}
          currentRows={currentRows}
          isTimeStructured={isTimeStructured}
          isWaterBreakLastRowOnly={isWaterBreakLastRowOnly}
          onCellDirectChange={handleCellDirectChange}
          onCellAdjust={handleCellAdjust}
          onAddRow={handleAddRow}
          onRemoveRow={handleRemoveRow}
          onSave={handleSaveCurrentMethod}
          isSaving={isSavingSetting}
        />
        <MonitorDisplayTabs
          isAdmin={isSuperAdmin}
          userProfile={monitorDisplay.userProfile}
          onUserDefaultChange={monitorDisplay.onUserDefaultChange}
          onUserIntroChange={monitorDisplay.onUserIntroChange}
          onUserDisplayTextChange={monitorDisplay.onUserDisplayTextChange}
          userFileInputRefs={monitorDisplay.userFileInputRefs}
          onUserFileChange={monitorDisplay.onUserFileChange}
          onUserDelete={monitorDisplay.onUserDelete}
          userUploadState={monitorDisplay.userUploadState}
          onSaveUser={monitorDisplay.onSaveUser}
          isSavingUser={monitorDisplay.isSavingUser}
          systemProfile={monitorDisplay.systemProfile}
          onSystemDefaultChange={monitorDisplay.onSystemDefaultChange}
          onSystemIntroChange={monitorDisplay.onSystemIntroChange}
          onSystemDisplayTextChange={monitorDisplay.onSystemDisplayTextChange}
          systemFileInputRefs={monitorDisplay.systemFileInputRefs}
          onSystemFileChange={monitorDisplay.onSystemFileChange}
          onSystemDelete={monitorDisplay.onSystemDelete}
          systemUploadState={monitorDisplay.systemUploadState}
          onSaveSystem={monitorDisplay.onSaveSystem}
          isSavingSystem={monitorDisplay.isSavingSystem}
        />
      </div>
    </div>
  )
}

export default WorkoutSettings
