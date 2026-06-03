import api from '@/services/api'
import { normalizeMonitorUploadUrl } from '@/utils/monitorUploadUrl'
import type { MonitorDisplayProfileState } from '@/pages/WorkoutSettings/components/MonitorDisplayTabs'
import type { MonitorSide } from '@/pages/WorkoutSettings/components/MonitorImageTripleUpload'

export type MonitorImageKind = 'default' | 'intro'

const emptyImageSet = () => ({
  leftImageUrl: '',
  centerImageUrl: '',
  rightImageUrl: ''
})

export const emptyMonitorProfile = (): MonitorDisplayProfileState => ({
  defaultImages: emptyImageSet(),
  introImages: emptyImageSet(),
  displayText: ''
})

const normalizeImageSet = (set: Record<string, string>) => ({
  leftImageUrl: set.leftImageUrl ? normalizeMonitorUploadUrl(set.leftImageUrl) : '',
  centerImageUrl: set.centerImageUrl ? normalizeMonitorUploadUrl(set.centerImageUrl) : '',
  rightImageUrl: set.rightImageUrl ? normalizeMonitorUploadUrl(set.rightImageUrl) : ''
})

const normalizeProfile = (data: unknown): MonitorDisplayProfileState => {
  const d = data as Record<string, unknown> | null | undefined
  const def = (d?.defaultImages ?? {}) as Record<string, string>
  const intro = (d?.introImages ?? {}) as Record<string, string>
  return {
    defaultImages: normalizeImageSet(def),
    introImages: normalizeImageSet(intro),
    displayText: String(d?.displayText ?? '')
  }
}

export const fetchUserMonitorDisplayProfile = async (): Promise<MonitorDisplayProfileState> => {
  const response = await api.get('/workout-categories/monitor-display-profile')
  return normalizeProfile(response?.data?.data)
}

export const saveUserMonitorDisplayProfile = async (
  profile: MonitorDisplayProfileState
): Promise<void> => {
  await api.put('/workout-categories/monitor-display-profile', profile)
}

export const uploadUserMonitorImage = async (
  imageKind: MonitorImageKind,
  side: MonitorSide,
  imageBase64: string
): Promise<string> => {
  const response = await api.post('/workout-categories/monitor-display-profile/upload', {
    imageKind,
    side,
    imageBase64
  })
  return response?.data?.data?.imageUrl || ''
}

export const fetchSystemMonitorDisplayProfile = async (): Promise<MonitorDisplayProfileState> => {
  const response = await api.get('/workout-categories/system-monitor-display-profile')
  return normalizeProfile(response?.data?.data)
}

export const saveSystemMonitorDisplayProfile = async (
  profile: MonitorDisplayProfileState
): Promise<void> => {
  await api.put('/workout-categories/system-monitor-display-profile', profile)
}

export const uploadMonitorImageOnly = async (
  imageKind: MonitorImageKind,
  side: MonitorSide,
  imageBase64: string
): Promise<string> => {
  const response = await api.post('/workout-categories/monitor-display/upload-image', {
    imageKind,
    side,
    imageBase64
  })
  return response?.data?.data?.imageUrl || ''
}

export const fetchWorkoutMonitorDisplayProfile = async (
  masterId: string
): Promise<MonitorDisplayProfileState> => {
  const response = await api.get(
    `/workout-categories/workout/${masterId}/monitor-display-profile`
  )
  return normalizeProfile(response?.data?.data)
}

export const saveWorkoutMonitorDisplayProfile = async (
  masterId: string,
  profile: MonitorDisplayProfileState
): Promise<void> => {
  await api.put(`/workout-categories/workout/${masterId}/monitor-display-profile`, profile)
}

export const uploadSystemMonitorImage = async (
  imageKind: MonitorImageKind,
  side: MonitorSide,
  imageBase64: string
): Promise<string> => {
  const response = await api.post('/workout-categories/system-monitor-display-profile/upload', {
    imageKind,
    side,
    imageBase64
  })
  return response?.data?.data?.imageUrl || ''
}
