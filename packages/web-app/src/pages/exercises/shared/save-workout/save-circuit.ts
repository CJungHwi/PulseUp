import api from '@/services/api'
import { WORKOUT_SCOPE_TOTAL } from '../workoutScope'
import { calculateWorkoutTimeSummary } from './time-summary'
import { buildCircuitDetailData, buildCircuitPlanData } from './payload-builders'
import { SaveCircuitParams } from './save-types'
import { generateWorkoutExercises } from './workout-exercise-helpers'

export const saveCircuit = async (params: SaveCircuitParams) => {
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
        workoutCategory,
        circuitType,
        isAdmin,
        onSuccess,
        majorCategory = 'MAIN',
        sequenceMode,
        workoutScope = WORKOUT_SCOPE_TOTAL,
    } = params

    if (!rightSelectedDate) {
        throw new Error('운동일자를 선택해주세요.')
    }

    const planData = buildCircuitPlanData(panelRows, circuitType)
    const detailData = buildCircuitDetailData(
        dynamicExercises,
        exercises,
        coolDownExercises,
    )
    const workoutExercisesData = generateWorkoutExercises(
        panelRows,
        exercises,
        dynamicExercises,
        coolDownExercises,
        circuitType,
        sequenceMode,
    )
    const timeSummary = calculateWorkoutTimeSummary(
        dynamicExercises,
        coolDownExercises,
        exercises,
        panelRows,
        majorCategory,
        circuitType,
        workoutExercisesData,
        sequenceMode,
    )

    console.log('🔍 [saveCircuit] 계산된 시간 요약:', timeSummary)
    console.log('🔍 [saveCircuit] workoutExercises 생성 결과:', {
        panelRowsCount: panelRows.length,
        exercisesCount: exercises.length,
        dynamicCount: dynamicExercises.length,
        coolDownCount: coolDownExercises.length,
        circuitType,
        workoutExercisesCount: workoutExercisesData.length,
        workoutExercisesData,
    })

    try {
        const payload = {
            date: rightSelectedDate.format('YYYY-MM-DD'),
            time: '1',
            workoutCategory,
            workoutScope,
            method_type: circuitType,
            memo,
            admin: isAdmin,
            masterId: currentEditingMasterId,
            plans: planData,
            exercises: detailData,
            workoutExercises: workoutExercisesData,
            dynamicMasterId: appliedDynamic?.id,
            cooldownMasterId: appliedCoolDown?.id,
            dsSeconds: timeSummary.dsSeconds,
            mainSeconds: timeSummary.mainSeconds,
            cdSeconds: timeSummary.cdSeconds,
            totalSeconds: timeSummary.totalSeconds,
            restSeconds: timeSummary.restSeconds,
        }

        console.log('🔍 [saveCircuit] API 전송 payload 시간 값:', {
            dsSeconds: payload.dsSeconds,
            mainSeconds: payload.mainSeconds,
            cdSeconds: payload.cdSeconds,
            totalSeconds: payload.totalSeconds,
            restSeconds: payload.restSeconds,
        })

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
        console.error('Save Circuit Error:', error)
        throw error
    }
}
