/**
 * 페이지 요약 — 운동·모니터 설정 (`/workout-settings`)
 *
 * 기능: stress/loop/AMRAP/EMOM별 시간표 설정, 모니터 좌우 이미지(사용자·시스템 기본) 업로드·삭제.
 *
 * 호출/연동:
 * - `GET|PUT /workout-categories/workout-setting/:methodType`
 * - `GET|PUT|POST .../workout-setting-images`, `.../upload`
 * - 관리자: `.../system-default-images` 조회·업로드·삭제
 * - DB/SP는 `packages/api-server` `workout-categories` 관련 라우트 참조.
 *
 * 관련 컴포넌트: `WorkoutMethodSettingsCard`, `WorkoutMonitorImagesCard`, `workoutSettingsModel`.
 *
 * 흐름: 방법 탭 선택 → 서버에서 행 로드 → 저장·이미지 API 순차 호출.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import api from '@/services/api'
import { useSnackbar } from '@/contexts/SnackbarContext'
import { useAppSelector } from '@/hooks/redux'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { normalizeMonitorUploadUrl } from '@/utils/monitorUploadUrl'
import { WorkoutMethodSettingsCard } from './components/WorkoutMethodSettingsCard'
import { WorkoutMonitorImagesCard } from './components/WorkoutMonitorImagesCard'
import {
  DEFAULT_ROWS,
  METHOD_LABELS,
  type MethodType,
  normalizeRows,
  type WorkoutSettingRow
} from './components/workoutSettingsModel'

const WorkoutSettings: React.FC = () => {
  const { showSnackbar } = useSnackbar()
  const user = useAppSelector((state) => state.auth.user)

  const [selectedMethod, setSelectedMethod] = useState<MethodType>('stress')
  const [settingsByMethod, setSettingsByMethod] = useState<Record<MethodType, WorkoutSettingRow[]>>({
    stress: DEFAULT_ROWS.stress,
    loop: DEFAULT_ROWS.loop,
    AMRAP: DEFAULT_ROWS.AMRAP,
    EMOM: DEFAULT_ROWS.EMOM
  })

  const [leftImageUrl, setLeftImageUrl] = useState('')
  const [rightImageUrl, setRightImageUrl] = useState('')
  const [isSavingSetting, setIsSavingSetting] = useState(false)
  const [isSavingImages, setIsSavingImages] = useState(false)
  const [isUploadingLeft, setIsUploadingLeft] = useState(false)
  const [isUploadingRight, setIsUploadingRight] = useState(false)
  const leftFileInputRef = useRef<HTMLInputElement>(null)
  const rightFileInputRef = useRef<HTMLInputElement>(null)

  const isAdmin = user?.role === 'branch_admin' || user?.role === 'super_admin'
  const [systemLeftImageUrl, setSystemLeftImageUrl] = useState('')
  const [systemRightImageUrl, setSystemRightImageUrl] = useState('')
  const [isSavingSystemImages, setIsSavingSystemImages] = useState(false)
  const [isUploadingSystemLeft, setIsUploadingSystemLeft] = useState(false)
  const [isUploadingSystemRight, setIsUploadingSystemRight] = useState(false)
  const [isDeletingUserLeft, setIsDeletingUserLeft] = useState(false)
  const [isDeletingUserRight, setIsDeletingUserRight] = useState(false)
  const [isDeletingSystemLeft, setIsDeletingSystemLeft] = useState(false)
  const [isDeletingSystemRight, setIsDeletingSystemRight] = useState(false)
  const systemLeftFileInputRef = useRef<HTMLInputElement>(null)
  const systemRightFileInputRef = useRef<HTMLInputElement>(null)

  const isTimeStructured = useMemo(
    () => selectedMethod === 'AMRAP' || selectedMethod === 'EMOM',
    [selectedMethod]
  )

  const loadMethodSettings = async (methodType: MethodType) => {
    try {
      const response = await api.get(`/workout-categories/workout-setting/${methodType}`)
      const rows = normalizeRows(response?.data?.data || [], methodType)
      setSettingsByMethod((prev) => ({ ...prev, [methodType]: rows }))
    } catch (error) {
      showSnackbar({ message: `${METHOD_LABELS[methodType]} 설정 조회 실패`, severity: 'error' })
    }
  }

  const loadImageSettings = async () => {
    try {
      const response = await api.get('/workout-categories/workout-setting-images')
      const left = response?.data?.data?.leftImageUrl || ''
      const right = response?.data?.data?.rightImageUrl || ''
      setLeftImageUrl(left ? normalizeMonitorUploadUrl(left) : '')
      setRightImageUrl(right ? normalizeMonitorUploadUrl(right) : '')
    } catch (error) {
      showSnackbar({ message: '모니터 기본 이미지 조회 실패', severity: 'error' })
    }
  }

  const loadSystemImageSettings = async () => {
    try {
      const response = await api.get('/workout-categories/system-default-images')
      const sLeft = response?.data?.data?.leftImageUrl || ''
      const sRight = response?.data?.data?.rightImageUrl || ''
      setSystemLeftImageUrl(sLeft ? normalizeMonitorUploadUrl(sLeft) : '')
      setSystemRightImageUrl(sRight ? normalizeMonitorUploadUrl(sRight) : '')
    } catch (error) {
      showSnackbar({ message: '시스템 기본 이미지 조회 실패', severity: 'error' })
    }
  }

  useEffect(() => {
    loadImageSettings()
    if (isAdmin) {
      loadSystemImageSettings()
    }
    ;(['stress', 'loop', 'AMRAP', 'EMOM'] as MethodType[]).forEach((methodType) => {
      loadMethodSettings(methodType)
    })
  }, [])

  const currentRows = settingsByMethod[selectedMethod]

  const isWaterBreakLastRowOnly =
    selectedMethod === 'stress' || selectedMethod === 'loop' || selectedMethod === 'EMOM'

  const handleCellDirectChange = (index: number, field: keyof WorkoutSettingRow, value: number) => {
    if (field === 'waterBreak' && isWaterBreakLastRowOnly && index !== currentRows.length - 1) {
      return
    }
    if (Number.isNaN(value)) return

    setSettingsByMethod((prev) => {
      const nextRows = [...prev[selectedMethod]]
      nextRows[index] = { ...nextRows[index], [field]: Math.max(0, Math.floor(value)) }
      return { ...prev, [selectedMethod]: nextRows }
    })
  }

  const handleCellAdjust = (index: number, field: keyof WorkoutSettingRow, delta: number) => {
    if (field === 'waterBreak' && isWaterBreakLastRowOnly && index !== currentRows.length - 1) {
      return
    }
    setSettingsByMethod((prev) => {
      const nextRows = [...prev[selectedMethod]]
      const current = nextRows[index][field] as number
      const next = Math.max(0, Math.floor(current + delta))
      nextRows[index] = { ...nextRows[index], [field]: next }
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
      if (selectedMethod === 'stress' || selectedMethod === 'loop' || selectedMethod === 'EMOM') {
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
      if (selectedMethod === 'stress' || selectedMethod === 'loop' || selectedMethod === 'EMOM') {
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
      const isAmrapEmom = selectedMethod === 'AMRAP' || selectedMethod === 'EMOM'
      const payloadRows = currentRows.map((row, index) => {
        let rest = row.rest
        let waterBreak = row.waterBreak
        if (isAmrapEmom) {
          rest = 0
          if (selectedMethod === 'EMOM' && index < currentRows.length - 1) {
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

      await api.put(`/workout-categories/workout-setting/${selectedMethod}`, {
        rows: payloadRows
      })

      showSnackbar({ message: `${METHOD_LABELS[selectedMethod]} 설정 저장 완료`, severity: 'success' })
      await loadMethodSettings(selectedMethod)
    } catch (error) {
      showSnackbar({ message: '운동 설정 저장 실패', severity: 'error' })
    } finally {
      setIsSavingSetting(false)
    }
  }

  /** PC에서 업로드 시 API가 파일을 `uploads/` 루트에 두고 `/uploads/파일명` URL을 돌려줍니다. */
  const handleFileUpload = async (side: 'left' | 'right', file: File) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      showSnackbar({ message: 'JPEG, PNG, WebP 이미지만 업로드 가능합니다', severity: 'warning' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showSnackbar({ message: '파일 크기는 5MB 이하여야 합니다', severity: 'warning' })
      return
    }

    const setUploading = side === 'left' ? setIsUploadingLeft : setIsUploadingRight
    setUploading(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const response = await api.post('/workout-categories/workout-setting-images/upload', {
        side,
        imageBase64: base64
      })

      const imageUrl = response?.data?.data?.imageUrl
      if (imageUrl) {
        const normalized = normalizeMonitorUploadUrl(imageUrl)
        if (side === 'left') setLeftImageUrl(normalized)
        else setRightImageUrl(normalized)
        showSnackbar({ message: `${side === 'left' ? '좌측' : '우측'} 이미지 업로드 완료`, severity: 'success' })
      }
    } catch (error) {
      showSnackbar({ message: '이미지 업로드 실패', severity: 'error' })
    } finally {
      setUploading(false)
    }
  }

  /** 시스템 기본 이미지도 동일하게 `uploads/` 루트 저장. */
  const handleSystemFileUpload = async (side: 'left' | 'right', file: File) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      showSnackbar({ message: 'JPEG, PNG, WebP 이미지만 업로드 가능합니다', severity: 'warning' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showSnackbar({ message: '파일 크기는 5MB 이하여야 합니다', severity: 'warning' })
      return
    }

    const setUploading = side === 'left' ? setIsUploadingSystemLeft : setIsUploadingSystemRight
    setUploading(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const response = await api.post('/workout-categories/system-default-images/upload', {
        side,
        imageBase64: base64
      })

      const imageUrl = response?.data?.data?.imageUrl
      if (imageUrl) {
        const normalized = normalizeMonitorUploadUrl(imageUrl)
        if (side === 'left') setSystemLeftImageUrl(normalized)
        else setSystemRightImageUrl(normalized)
        showSnackbar({
          message: `시스템 ${side === 'left' ? '좌측' : '우측'} 기본 이미지 업로드 완료`,
          severity: 'success'
        })
      }
    } catch (error) {
      showSnackbar({ message: '시스템 기본 이미지 업로드 실패', severity: 'error' })
    } finally {
      setUploading(false)
    }
  }

  const handleSaveSystemImages = async () => {
    try {
      if (systemLeftImageUrl && !/^https?:\/\//i.test(systemLeftImageUrl)) {
        showSnackbar({ message: '좌측 시스템 이미지 URL 형식이 올바르지 않습니다', severity: 'warning' })
        return
      }
      if (systemRightImageUrl && !/^https?:\/\//i.test(systemRightImageUrl)) {
        showSnackbar({ message: '우측 시스템 이미지 URL 형식이 올바르지 않습니다', severity: 'warning' })
        return
      }

      setIsSavingSystemImages(true)
      await api.put('/workout-categories/system-default-images', {
        leftImageUrl: systemLeftImageUrl ? normalizeMonitorUploadUrl(systemLeftImageUrl) : null,
        rightImageUrl: systemRightImageUrl ? normalizeMonitorUploadUrl(systemRightImageUrl) : null
      })
      showSnackbar({ message: '시스템 기본 이미지 저장 완료', severity: 'success' })
      await loadSystemImageSettings()
    } catch (error) {
      showSnackbar({ message: '시스템 기본 이미지 저장 실패', severity: 'error' })
    } finally {
      setIsSavingSystemImages(false)
    }
  }

  const handleSaveImages = async () => {
    try {
      if (leftImageUrl && !/^https?:\/\//i.test(leftImageUrl)) {
        showSnackbar({ message: '좌측 이미지 URL 형식이 올바르지 않습니다', severity: 'warning' })
        return
      }
      if (rightImageUrl && !/^https?:\/\//i.test(rightImageUrl)) {
        showSnackbar({ message: '우측 이미지 URL 형식이 올바르지 않습니다', severity: 'warning' })
        return
      }

      setIsSavingImages(true)
      await api.put('/workout-categories/workout-setting-images', {
        leftImageUrl: leftImageUrl ? normalizeMonitorUploadUrl(leftImageUrl) : null,
        rightImageUrl: rightImageUrl ? normalizeMonitorUploadUrl(rightImageUrl) : null
      })
      showSnackbar({ message: '모니터 기본 이미지 저장 완료', severity: 'success' })
      await loadImageSettings()
    } catch (error) {
      showSnackbar({ message: '모니터 기본 이미지 저장 실패', severity: 'error' })
    } finally {
      setIsSavingImages(false)
    }
  }

  const handleDeleteUserImage = async (side: 'left' | 'right') => {
    const url = side === 'left' ? leftImageUrl.trim() : rightImageUrl.trim()
    if (!url) return
    const setBusy = side === 'left' ? setIsDeletingUserLeft : setIsDeletingUserRight
    setBusy(true)
    try {
      const payload: { leftImageUrl?: string | null; rightImageUrl?: string | null } = {}
      if (side === 'left') {
        payload.leftImageUrl = null
        if (rightImageUrl.trim()) payload.rightImageUrl = normalizeMonitorUploadUrl(rightImageUrl)
      } else {
        payload.rightImageUrl = null
        if (leftImageUrl.trim()) payload.leftImageUrl = normalizeMonitorUploadUrl(leftImageUrl)
      }
      await api.put('/workout-categories/workout-setting-images', payload)
      if (side === 'left') setLeftImageUrl('')
      else setRightImageUrl('')
      showSnackbar({ message: `${side === 'left' ? '좌측' : '우측'} 이미지를 삭제했습니다`, severity: 'success' })
    } catch {
      showSnackbar({ message: '이미지 삭제에 실패했습니다', severity: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteSystemImage = async (side: 'left' | 'right') => {
    if (!isAdmin) return
    const url = side === 'left' ? systemLeftImageUrl.trim() : systemRightImageUrl.trim()
    if (!url) return
    const setBusy = side === 'left' ? setIsDeletingSystemLeft : setIsDeletingSystemRight
    setBusy(true)
    try {
      const payload: { leftImageUrl?: string | null; rightImageUrl?: string | null } = {}
      if (side === 'left') {
        payload.leftImageUrl = null
        if (systemRightImageUrl.trim()) payload.rightImageUrl = normalizeMonitorUploadUrl(systemRightImageUrl)
      } else {
        payload.rightImageUrl = null
        if (systemLeftImageUrl.trim()) payload.leftImageUrl = normalizeMonitorUploadUrl(systemLeftImageUrl)
      }
      await api.put('/workout-categories/system-default-images', payload)
      if (side === 'left') setSystemLeftImageUrl('')
      else setSystemRightImageUrl('')
      showSnackbar({
        message: `시스템 ${side === 'left' ? '좌측' : '우측'} 기본 이미지를 삭제했습니다`,
        severity: 'success'
      })
      await loadSystemImageSettings()
    } catch {
      showSnackbar({ message: '시스템 이미지 삭제에 실패했습니다', severity: 'error' })
    } finally {
      setBusy(false)
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
        <WorkoutMonitorImagesCard
          isAdmin={isAdmin}
          leftImageUrl={leftImageUrl}
          rightImageUrl={rightImageUrl}
          onLeftImageUrlChange={setLeftImageUrl}
          onRightImageUrlChange={setRightImageUrl}
          leftFileInputRef={leftFileInputRef}
          rightFileInputRef={rightFileInputRef}
          onUserFileChange={handleFileUpload}
          onSaveUserImages={handleSaveImages}
          isSavingImages={isSavingImages}
          isUploadingLeft={isUploadingLeft}
          isUploadingRight={isUploadingRight}
          isDeletingUserLeft={isDeletingUserLeft}
          isDeletingUserRight={isDeletingUserRight}
          onDeleteUserImage={handleDeleteUserImage}
          systemLeftImageUrl={systemLeftImageUrl}
          systemRightImageUrl={systemRightImageUrl}
          onSystemLeftImageUrlChange={setSystemLeftImageUrl}
          onSystemRightImageUrlChange={setSystemRightImageUrl}
          systemLeftFileInputRef={systemLeftFileInputRef}
          systemRightFileInputRef={systemRightFileInputRef}
          onSystemFileChange={handleSystemFileUpload}
          onSaveSystemImages={handleSaveSystemImages}
          isSavingSystemImages={isSavingSystemImages}
          isUploadingSystemLeft={isUploadingSystemLeft}
          isUploadingSystemRight={isUploadingSystemRight}
          isDeletingSystemLeft={isDeletingSystemLeft}
          isDeletingSystemRight={isDeletingSystemRight}
          onDeleteSystemImage={handleDeleteSystemImage}
        />
      </div>
    </div>
  )
}

export default WorkoutSettings
