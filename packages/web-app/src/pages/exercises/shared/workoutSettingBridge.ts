/**
 * workoutSettingBridge — Totalexercises/Singleexercises ↔ WorkoutSettings 설정 연동
 *
 * WorkoutSettings(`/workout-settings`)와 동일한 API·normalizeRows로
 * EMOM-STRESS / EMOM-LOOP (및 MAIN stress/loop) 패널 기본값을 맞춘다.
 */
import api from '@/services/api'
import {
  DEFAULT_ROWS,
  normalizeRows,
  type MethodType,
  type WorkoutSettingApiRow,
} from '@/pages/WorkoutSettings/components/workoutSettingsModel'
import type { PanelRow } from './types'

export const EMOM_STRESS_SETTING_KEY = 'EMOM-STRESS'
export const EMOM_LOOP_SETTING_KEY = 'EMOM-LOOP'
export const COMBO_STRESS_SETTING_KEY = 'COMBO-STRESS'
export const COMBO_LOOP_SETTING_KEY = 'COMBO-LOOP'

export const isComboMajorCategory = (majorCategory: string): boolean =>
  String(majorCategory || '').toUpperCase() === 'COMBO'

export const normalizeCircuitTypeForCategory = (
  majorCategory: string,
  methodType?: string | null,
): 'stress' | 'loop' => {
  const normalized = String(methodType || '').trim().toLowerCase()
  if (majorCategory === 'EMOM' || majorCategory === 'MAIN' || isComboMajorCategory(majorCategory)) {
    return normalized.includes('stress') ? 'stress' : 'loop'
  }
  return normalized === 'loop' ? 'loop' : 'stress'
}

export const resolveWorkoutSettingKey = (
  majorCategory: string,
  circuitType: string,
): MethodType => {
  if (majorCategory === 'MAIN') {
    return circuitType === 'loop' ? 'loop' : 'stress'
  }
  if (majorCategory === 'EMOM') {
    return circuitType === 'stress' ? EMOM_STRESS_SETTING_KEY : EMOM_LOOP_SETTING_KEY
  }
  if (isComboMajorCategory(majorCategory)) {
    return circuitType === 'stress' ? COMBO_STRESS_SETTING_KEY : COMBO_LOOP_SETTING_KEY
  }
  if (majorCategory === 'AMRAP') return 'AMRAP'
  return 'stress'
}

/** 패널 행 `type` — MAIN/EMOM/COMBO만 stress|loop, 그 외(AMRAP 등)는 major 그대로 */
export const resolvePanelRowType = (majorCategory: string, circuitType: string): string => {
  if (majorCategory === 'MAIN' || majorCategory === 'EMOM' || isComboMajorCategory(majorCategory)) {
    return normalizeCircuitTypeForCategory(majorCategory, circuitType)
  }
  return majorCategory
}

export const mapWorkoutSettingToPanelRows = (
  apiRows: WorkoutSettingApiRow[],
  settingKey: MethodType,
  panelType: string,
): PanelRow[] => {
  const normalized = normalizeRows(apiRows, settingKey)
  return normalized.map((row, idx) => ({
    id: `${Date.now()}_${idx + 1}_${panelType}`,
    round: row.round,
    time: row.time,
    rest: row.rest,
    waterBreak: row.waterBreak,
    reps: row.reps,
    type: panelType,
  }))
}

/** WorkoutSettings 화면과 동일 경로·변환으로 설정 행 조회 후 패널 행으로 변환 */
export const fetchWorkoutSettingPanelRows = async (
  majorCategory: string,
  circuitType: string,
): Promise<PanelRow[]> => {
  const panelType = resolvePanelRowType(majorCategory, circuitType)
  const circuitForKey = normalizeCircuitTypeForCategory(majorCategory, circuitType)
  const settingKey = resolveWorkoutSettingKey(majorCategory, circuitForKey)

  try {
    const response = await api.get(
      `/workout-categories/workout-setting/${encodeURIComponent(settingKey)}`,
    )
    const apiRows = (response.data?.data || []) as WorkoutSettingApiRow[]
    if (response.data?.success && apiRows.length > 0) {
      return mapWorkoutSettingToPanelRows(apiRows, settingKey, panelType)
    }
  } catch (error) {
    console.error('[workoutSettingBridge] 설정 조회 실패:', settingKey, error)
  }

  return mapWorkoutSettingToPanelRows([], settingKey, panelType)
}

export const getDefaultPanelRowsForMethod = (
  majorCategory: string,
  circuitType: string,
): PanelRow[] => {
  const panelType = resolvePanelRowType(majorCategory, circuitType)
  const circuitForKey = normalizeCircuitTypeForCategory(majorCategory, circuitType)
  const settingKey = resolveWorkoutSettingKey(majorCategory, circuitForKey)
  const defaults = DEFAULT_ROWS[settingKey] ?? DEFAULT_ROWS.stress
  return defaults.map((row, idx) => ({
    id: `${Date.now()}_${idx + 1}_${panelType}`,
    round: row.round,
    time: row.time,
    rest: row.rest,
    waterBreak: row.waterBreak,
    reps: row.reps,
    type: panelType,
  }))
}
