import api from '@/services/api'
import { WORKOUT_SCOPE_TOTAL } from '../workoutScope'
import { buildEmomDetailData, buildEmomPlanData } from './payload-builders'
import { SaveParamsBase } from './save-types'
import { calculateWorkoutTimeSummary } from './time-summary'
import { generateWorkoutExercisesForTimeStructured } from './workout-exercise-helpers'

export const saveEMOM = async (params: SaveParamsBase) => {
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
        majorCategory = 'EMOM',
        circuitType = 'loop',
        sequenceMode,
        workoutScope = WORKOUT_SCOPE_TOTAL,
    } = params

    if (!rightSelectedDate) {
        throw new Error('운동일자를 선택해주세요.')
    }

    const emomCircuitType = String(circuitType).toLowerCase() === 'stress' ? 'stress' : 'loop'
    const planData = buildEmomPlanData(panelRows)
    const detailData = buildEmomDetailData(
        dynamicExercises,
        exercises,
        coolDownExercises,
    )
    const workoutExercisesData = generateWorkoutExercisesForTimeStructured(
        panelRows,
        exercises,
        'EMOM',
        emomCircuitType,
        sequenceMode,
    )
    const timeSummary = calculateWorkoutTimeSummary(
        dynamicExercises,
        coolDownExercises,
        exercises,
        panelRows,
        majorCategory,
        'none',
        workoutExercisesData,
        sequenceMode,
    )

    console.log('🔍 [saveEMOM] workoutExercises 생성 결과:', {
        panelRowsCount: panelRows.length,
        exercisesCount: exercises.length,
        workoutExercisesCount: workoutExercisesData.length,
        workoutExercisesData,
    })

    try {
        const payload = {
            date: rightSelectedDate.format('YYYY-MM-DD'),
            time: '1',
            workoutCategory: 'EMOM',
            workoutScope,
            method_type: emomCircuitType,
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

        const response = await api.post('/workout-categories/Time-StructuredEMOM', payload)
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
        console.error('Save EMOM Error:', error)
        throw error
    }
}
