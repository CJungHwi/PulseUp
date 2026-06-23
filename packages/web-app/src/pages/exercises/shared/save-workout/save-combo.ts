import api from '@/services/api'
import { WORKOUT_SCOPE_TOTAL } from '../workoutScope'
import { buildComboDetailData, buildComboPlanData } from './payload-builders'
import type { SaveParamsBase } from './save-types'
import { calculateWorkoutTimeSummary } from './time-summary'
import { generateComboWorkoutExercises } from './combo-workout-helpers'

export const saveCOMBO = async (params: SaveParamsBase) => {
  const {
    rightSelectedDate,
    panelRows,
    exercises,
    dynamicExercises,
    coolDownExercises,
    appliedDynamic,
    appliedCoolDown,
    memo,
    currentEditingMasterId,
    isAdmin,
    onSuccess,
    majorCategory = 'COMBO',
    circuitType = 'stress',
    sequenceMode,
    workoutScope = WORKOUT_SCOPE_TOTAL,
  } = params

  if (!rightSelectedDate) {
    throw new Error('운동일자를 선택해주세요.')
  }

  const comboCircuitType = String(circuitType).toLowerCase() === 'loop' ? 'loop' : 'stress'
  const planData = buildComboPlanData(panelRows, comboCircuitType)
  const detailData = buildComboDetailData(dynamicExercises, exercises, coolDownExercises)
  const workoutExercisesData = generateComboWorkoutExercises(
    panelRows,
    exercises,
    comboCircuitType,
  )
  const timeSummary = calculateWorkoutTimeSummary(
    dynamicExercises,
    coolDownExercises,
    exercises,
    panelRows,
    majorCategory,
    comboCircuitType,
    workoutExercisesData,
    sequenceMode,
  )

  try {
    const payload = {
      date: rightSelectedDate.format('YYYY-MM-DD'),
      time: '1',
      workoutCategory: 'COMBO',
      workoutScope,
      method_type: comboCircuitType,
      memo,
      admin: isAdmin,
      masterId: currentEditingMasterId,
      plans: planData,
      exercises: detailData,
      workoutExercises: workoutExercisesData,
      dynamicMasterId: appliedDynamic?.id,
      staticMasterId: appliedCoolDown?.id,
      dsSeconds: timeSummary.dsSeconds,
      mainSeconds: timeSummary.mainSeconds,
      cdSeconds: timeSummary.cdSeconds,
      totalSeconds: timeSummary.totalSeconds,
      restSeconds: timeSummary.restSeconds,
    }

    const response = await api.post('/workout-categories/HyberStrengthCircuitSave', payload)
    if (response.data?.success) {
      onSuccess(response.data.data.id || currentEditingMasterId)
      return
    }

    const msg =
      (response.data as { message?: string; error?: string })?.message ||
      (response.data as { message?: string; error?: string })?.error ||
      '저장에 실패했습니다.'
    throw new Error(msg)
  } catch (error) {
    console.error('Save COMBO Error:', error)
    throw error
  }
}
