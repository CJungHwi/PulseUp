/**
 * useMonitorDisplaySettings — 운동설정 모니터 표시(기본/인트로/텍스트) 상태·API 훅
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSnackbar } from '@/contexts/SnackbarContext'
import { normalizeMonitorUploadUrl } from '@/utils/monitorUploadUrl'
import type { MonitorDisplayProfileState } from './MonitorDisplayTabs'
import type { MonitorSide } from './MonitorImageTripleUpload'
import type { MonitorImageKind } from '@/services/monitorDisplayApi'
import {
  emptyMonitorProfile,
  fetchSystemMonitorDisplayProfile,
  fetchUserMonitorDisplayProfile,
  saveSystemMonitorDisplayProfile,
  saveUserMonitorDisplayProfile,
  uploadSystemMonitorImage,
  uploadUserMonitorImage
} from '@/services/monitorDisplayApi'

type SideBusy = { isUploading: boolean; isDeleting: boolean }

const emptyBusy = (): Record<MonitorSide, SideBusy> => ({
  left: { isUploading: false, isDeleting: false },
  center: { isUploading: false, isDeleting: false },
  right: { isUploading: false, isDeleting: false }
})

const normalizeSet = (set: MonitorDisplayProfileState['defaultImages']) => ({
  leftImageUrl: set.leftImageUrl ? normalizeMonitorUploadUrl(set.leftImageUrl) : '',
  centerImageUrl: set.centerImageUrl ? normalizeMonitorUploadUrl(set.centerImageUrl) : '',
  rightImageUrl: set.rightImageUrl ? normalizeMonitorUploadUrl(set.rightImageUrl) : ''
})

const normalizeProfile = (p: MonitorDisplayProfileState): MonitorDisplayProfileState => ({
  defaultImages: normalizeSet(p.defaultImages),
  introImages: normalizeSet(p.introImages),
  displayText: p.displayText
})

const validateImageUrl = (url: string): boolean => !url || /^https?:\/\//i.test(url)

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

const isWorkoutSettingsPage = (): boolean =>
  window.location.pathname.toLowerCase().replace(/\/$/, '') === '/workout-settings'

export const useMonitorDisplaySettings = (isSuperAdmin: boolean) => {
  const { showSnackbar } = useSnackbar()
  const isMountedRef = useRef(true)
  const [userProfile, setUserProfile] = useState<MonitorDisplayProfileState>(emptyMonitorProfile())
  const [systemProfile, setSystemProfile] = useState<MonitorDisplayProfileState>(emptyMonitorProfile())
  const [isSavingUser, setIsSavingUser] = useState(false)
  const [isSavingSystem, setIsSavingSystem] = useState(false)
  const [userUploadState, setUserUploadState] = useState({
    default: emptyBusy(),
    intro: emptyBusy()
  })
  const [systemUploadState, setSystemUploadState] = useState({
    default: emptyBusy(),
    intro: emptyBusy()
  })

  const userFileInputRefs = {
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

  const systemFileInputRefs = {
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

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadUser = useCallback(async () => {
    try {
      const data = await fetchUserMonitorDisplayProfile()
      if (!isMountedRef.current) return
      setUserProfile(normalizeProfile(data))
    } catch {
      if (!isMountedRef.current) return
      if (!isWorkoutSettingsPage()) return
      showSnackbar({ message: '모니터 표시 설정 조회 실패', severity: 'error' })
    }
  }, [showSnackbar])

  const loadSystem = useCallback(async () => {
    if (!isSuperAdmin) return
    try {
      const data = await fetchSystemMonitorDisplayProfile()
      if (!isMountedRef.current) return
      setSystemProfile(normalizeProfile(data))
    } catch {
      if (!isMountedRef.current) return
      if (!isWorkoutSettingsPage()) return
      showSnackbar({ message: '시스템 모니터 표시 설정 조회 실패', severity: 'error' })
    }
  }, [isSuperAdmin, showSnackbar])

  useEffect(() => {
    void loadUser()
    void loadSystem()
  }, [loadUser, loadSystem])

  const updateUserImage = (kind: MonitorImageKind, side: MonitorSide, value: string) => {
    const key =
      side === 'left' ? 'leftImageUrl' : side === 'center' ? 'centerImageUrl' : 'rightImageUrl'
    setUserProfile((prev) => ({
      ...prev,
      [kind === 'default' ? 'defaultImages' : 'introImages']: {
        ...prev[kind === 'default' ? 'defaultImages' : 'introImages'],
        [key]: value
      }
    }))
  }

  const updateSystemImage = (kind: MonitorImageKind, side: MonitorSide, value: string) => {
    const key =
      side === 'left' ? 'leftImageUrl' : side === 'center' ? 'centerImageUrl' : 'rightImageUrl'
    setSystemProfile((prev) => ({
      ...prev,
      [kind === 'default' ? 'defaultImages' : 'introImages']: {
        ...prev[kind === 'default' ? 'defaultImages' : 'introImages'],
        [key]: value
      }
    }))
  }

  const handleUserUpload = async (kind: MonitorImageKind, side: MonitorSide, file: File) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      showSnackbar({ message: 'JPEG, PNG, WebP 이미지만 업로드 가능합니다', severity: 'warning' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showSnackbar({ message: '파일 크기는 5MB 이하여야 합니다', severity: 'warning' })
      return
    }

    setUserUploadState((s) => ({
      ...s,
      [kind]: { ...s[kind], [side]: { ...s[kind][side], isUploading: true } }
    }))
    try {
      const base64 = await readFileAsBase64(file)
      const imageUrl = await uploadUserMonitorImage(kind, side, base64)
      if (imageUrl) {
        updateUserImage(kind, side, normalizeMonitorUploadUrl(imageUrl))
        showSnackbar({ message: '이미지 업로드 완료', severity: 'success' })
      }
    } catch {
      showSnackbar({ message: '이미지 업로드 실패', severity: 'error' })
    } finally {
      setUserUploadState((s) => ({
        ...s,
        [kind]: { ...s[kind], [side]: { ...s[kind][side], isUploading: false } }
      }))
    }
  }

  const handleSystemUpload = async (kind: MonitorImageKind, side: MonitorSide, file: File) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      showSnackbar({ message: 'JPEG, PNG, WebP 이미지만 업로드 가능합니다', severity: 'warning' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showSnackbar({ message: '파일 크기는 5MB 이하여야 합니다', severity: 'warning' })
      return
    }

    setSystemUploadState((s) => ({
      ...s,
      [kind]: { ...s[kind], [side]: { ...s[kind][side], isUploading: true } }
    }))
    try {
      const base64 = await readFileAsBase64(file)
      const imageUrl = await uploadSystemMonitorImage(kind, side, base64)
      if (imageUrl) {
        updateSystemImage(kind, side, normalizeMonitorUploadUrl(imageUrl))
        showSnackbar({ message: '시스템 이미지 업로드 완료', severity: 'success' })
      }
    } catch {
      showSnackbar({ message: '시스템 이미지 업로드 실패', severity: 'error' })
    } finally {
      setSystemUploadState((s) => ({
        ...s,
        [kind]: { ...s[kind], [side]: { ...s[kind][side], isUploading: false } }
      }))
    }
  }

  const handleUserDelete = async (kind: MonitorImageKind, side: MonitorSide) => {
    setUserUploadState((s) => ({
      ...s,
      [kind]: { ...s[kind], [side]: { ...s[kind][side], isDeleting: true } }
    }))
    try {
      updateUserImage(kind, side, '')
      const payload = normalizeProfile(userProfile)
      const set = kind === 'default' ? payload.defaultImages : payload.introImages
      const key =
        side === 'left' ? 'leftImageUrl' : side === 'center' ? 'centerImageUrl' : 'rightImageUrl'
      set[key] = ''
      await saveUserMonitorDisplayProfile(payload)
      showSnackbar({ message: '이미지를 삭제했습니다', severity: 'success' })
    } catch {
      showSnackbar({ message: '이미지 삭제 실패', severity: 'error' })
    } finally {
      setUserUploadState((s) => ({
        ...s,
        [kind]: { ...s[kind], [side]: { ...s[kind][side], isDeleting: false } }
      }))
    }
  }

  const handleSystemDelete = async (kind: MonitorImageKind, side: MonitorSide) => {
    setSystemUploadState((s) => ({
      ...s,
      [kind]: { ...s[kind], [side]: { ...s[kind][side], isDeleting: true } }
    }))
    try {
      updateSystemImage(kind, side, '')
      const payload = normalizeProfile(systemProfile)
      const set = kind === 'default' ? payload.defaultImages : payload.introImages
      const key =
        side === 'left' ? 'leftImageUrl' : side === 'center' ? 'centerImageUrl' : 'rightImageUrl'
      set[key] = ''
      await saveSystemMonitorDisplayProfile(payload)
      showSnackbar({ message: '시스템 이미지를 삭제했습니다', severity: 'success' })
    } catch {
      showSnackbar({ message: '시스템 이미지 삭제 실패', severity: 'error' })
    } finally {
      setSystemUploadState((s) => ({
        ...s,
        [kind]: { ...s[kind], [side]: { ...s[kind][side], isDeleting: false } }
      }))
    }
  }

  const validateProfileUrls = (profile: MonitorDisplayProfileState): boolean => {
    for (const set of [profile.defaultImages, profile.introImages]) {
      for (const url of [set.leftImageUrl, set.centerImageUrl, set.rightImageUrl]) {
        if (!validateImageUrl(url)) {
          showSnackbar({ message: '이미지 URL 형식이 올바르지 않습니다', severity: 'warning' })
          return false
        }
      }
    }
    return true
  }

  const handleSaveUser = async () => {
    const payload = normalizeProfile(userProfile)
    if (!validateProfileUrls(payload)) return
    setIsSavingUser(true)
    try {
      await saveUserMonitorDisplayProfile(payload)
      showSnackbar({ message: '모니터 표시 설정 저장 완료', severity: 'success' })
      await loadUser()
    } catch {
      showSnackbar({ message: '모니터 표시 설정 저장 실패', severity: 'error' })
    } finally {
      setIsSavingUser(false)
    }
  }

  const handleSaveSystem = async () => {
    const payload = normalizeProfile(systemProfile)
    if (!validateProfileUrls(payload)) return
    setIsSavingSystem(true)
    try {
      await saveSystemMonitorDisplayProfile(payload)
      showSnackbar({ message: '시스템 모니터 표시 설정 저장 완료', severity: 'success' })
      await loadSystem()
    } catch {
      showSnackbar({ message: '시스템 모니터 표시 설정 저장 실패', severity: 'error' })
    } finally {
      setIsSavingSystem(false)
    }
  }

  return {
    userProfile,
    systemProfile,
    userFileInputRefs,
    systemFileInputRefs,
    userUploadState,
    systemUploadState,
    isSavingUser,
    isSavingSystem,
    onUserDefaultChange: (side: MonitorSide, v: string) => updateUserImage('default', side, v),
    onUserIntroChange: (side: MonitorSide, v: string) => updateUserImage('intro', side, v),
    onUserDisplayTextChange: (v: string) => setUserProfile((p) => ({ ...p, displayText: v })),
    onSystemDefaultChange: (side: MonitorSide, v: string) => updateSystemImage('default', side, v),
    onSystemIntroChange: (side: MonitorSide, v: string) => updateSystemImage('intro', side, v),
    onSystemDisplayTextChange: (v: string) => setSystemProfile((p) => ({ ...p, displayText: v })),
    onUserFileChange: handleUserUpload,
    onSystemFileChange: handleSystemUpload,
    onUserDelete: handleUserDelete,
    onSystemDelete: handleSystemDelete,
    onSaveUser: handleSaveUser,
    onSaveSystem: handleSaveSystem
  }
}
