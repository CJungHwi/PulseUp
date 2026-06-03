/**
 * useWorkoutMonitorDisplayEditor — 일자별 운동 기록 모니터 표시 편집 (운동설정과 동일 UI, 저장은 기록과 함께)
 */
import { useRef, useState } from 'react'
import { useSnackbar } from '@/contexts/SnackbarContext'
import { normalizeMonitorUploadUrl } from '@/utils/monitorUploadUrl'
import type { MonitorDisplayProfileState } from '@/pages/WorkoutSettings/components/MonitorDisplayTabs'
import type { MonitorSide } from '@/pages/WorkoutSettings/components/MonitorImageTripleUpload'
import type { MonitorImageKind } from '@/services/monitorDisplayApi'
import { uploadMonitorImageOnly } from '@/services/monitorDisplayApi'

type SideBusy = { isUploading: boolean; isDeleting: boolean }

const emptyBusy = (): Record<MonitorSide, SideBusy> => ({
  left: { isUploading: false, isDeleting: false },
  center: { isUploading: false, isDeleting: false },
  right: { isUploading: false, isDeleting: false }
})

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

export const useWorkoutMonitorDisplayEditor = (
  profile: MonitorDisplayProfileState,
  onProfileChange: (next: MonitorDisplayProfileState) => void
) => {
  const { showSnackbar } = useSnackbar()
  const [uploadState, setUploadState] = useState({
    default: emptyBusy(),
    intro: emptyBusy()
  })

  const fileInputRefs = {
    default: {
      left: useRef<HTMLInputElement>(null),
      center: useRef<HTMLInputElement>(null),
      right: useRef<HTMLInputElement>(null)
    },
    intro: {
      left: useRef<HTMLInputElement>(null),
      center: useRef<HTMLInputElement>(null),
      right: useRef<HTMLInputElement>(null)
    }
  }

  const updateImage = (kind: MonitorImageKind, side: MonitorSide, value: string) => {
    const key =
      side === 'left' ? 'leftImageUrl' : side === 'center' ? 'centerImageUrl' : 'rightImageUrl'
    onProfileChange({
      ...profile,
      [kind === 'default' ? 'defaultImages' : 'introImages']: {
        ...profile[kind === 'default' ? 'defaultImages' : 'introImages'],
        [key]: value
      }
    })
  }

  const handleUpload = async (kind: MonitorImageKind, side: MonitorSide, file: File) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      showSnackbar({ message: 'JPEG, PNG, WebP 이미지만 업로드 가능합니다', severity: 'warning' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showSnackbar({ message: '파일 크기는 5MB 이하여야 합니다', severity: 'warning' })
      return
    }

    setUploadState((s) => ({
      ...s,
      [kind]: { ...s[kind], [side]: { ...s[kind][side], isUploading: true } }
    }))
    try {
      const base64 = await readFileAsBase64(file)
      const imageUrl = await uploadMonitorImageOnly(kind, side, base64)
      if (imageUrl) {
        updateImage(kind, side, normalizeMonitorUploadUrl(imageUrl))
        showSnackbar({ message: '이미지 업로드 완료', severity: 'success' })
      }
    } catch {
      showSnackbar({ message: '이미지 업로드 실패', severity: 'error' })
    } finally {
      setUploadState((s) => ({
        ...s,
        [kind]: { ...s[kind], [side]: { ...s[kind][side], isUploading: false } }
      }))
    }
  }

  const handleDelete = (kind: MonitorImageKind, side: MonitorSide) => {
    updateImage(kind, side, '')
  }

  return {
    fileInputRefs,
    uploadState,
    onDefaultChange: (side: MonitorSide, v: string) => updateImage('default', side, v),
    onIntroChange: (side: MonitorSide, v: string) => updateImage('intro', side, v),
    onDisplayTextChange: (v: string) => onProfileChange({ ...profile, displayText: v }),
    onFileChange: handleUpload,
    onDelete: handleDelete
  }
}
