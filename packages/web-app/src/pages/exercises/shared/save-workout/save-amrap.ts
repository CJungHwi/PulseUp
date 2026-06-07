import api from '@/services/api'
import { WORKOUT_SCOPE_TOTAL } from '../workoutScope'
import { buildAmrapDetailData, buildAmrapPlanData } from './payload-builders'
import { SaveParamsBase } from './save-types'
import { calculateWorkoutTimeSummary } from './time-summary'
import { generateWorkoutExercisesForTimeStructured } from './workout-exercise-helpers'

export const saveAMRAP = async (params: SaveParamsBase) => {
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
        majorCategory = 'AMRAP',
        sequenceMode,
        workoutScope = WORKOUT_SCOPE_TOTAL,
    } = params

    if (!rightSelectedDate) {
        throw new Error('운동일자를 선택해주세요.')
    }

    if (panelRows.length < 1 || panelRows.length > 2) {
        console.error('[saveAMRAP] AMRAP은 운동설계(Round) 1~2건만 허용됩니다.')
        throw new Error('AMRAP: 운동설계(Round)는 1개 이상 2개 이하로 등록해 주세요.')
    }

    const planData = buildAmrapPlanData(panelRows)
    const detailData = buildAmrapDetailData(
        dynamicExercises,
        exercises,
        coolDownExercises,
    )
    const workoutExercisesData = generateWorkoutExercisesForTimeStructured(
        panelRows,
        exercises,
        'AMRAP',
        'loop',
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

    console.log('🔍 [saveAMRAP] workoutExercises 생성 결과:', {
        panelRowsCount: panelRows.length,
        exercisesCount: exercises.length,
        workoutExercisesCount: workoutExercisesData.length,
        workoutExercisesData,
    })

    try {
        const payload = {
            date: rightSelectedDate.format('YYYY-MM-DD'),
            time: '1',
            workoutCategory: 'AMRAP',
            workoutScope,
            method_type: 'AMRAP',
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

        const response = await api.post('/workout-categories/Time-StructuredAMRAP', payload)
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
        console.error('Save AMRAP Error:', error)
        throw error
    }
}
