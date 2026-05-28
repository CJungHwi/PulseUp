import { Exercise, PanelRow } from '../types'
import { WorkoutExerciseItem, WorkoutTimeSummaryWithRest } from './save-types'
import {
    getAmrapTimeBreakdownFromPanels,
    getEmomTimeBreakdownFromPanels,
    getMainCircuitTimeBreakdownFromPanels,
} from './workout-exercise-helpers'

export function calculateWorkoutTimeSummary(
    dynamicExercises: Exercise[],
    coolDownExercises: Exercise[],
    exercises: Exercise[],
    panelRows: PanelRow[],
    majorCategory: string,
    circuitType?: string,
    workoutExercisesData?: WorkoutExerciseItem[],
): WorkoutTimeSummaryWithRest {
    console.log('🔍 [calculateWorkoutTimeSummary] 입력 파라미터:', {
        dynamicExercisesCount: dynamicExercises.length,
        coolDownExercisesCount: coolDownExercises.length,
        exercisesCount: exercises.length,
        panelRowsCount: panelRows.length,
        majorCategory,
        circuitType,
        workoutExercisesDataCount: workoutExercisesData?.length,
        dynamicExercises: dynamicExercises.map((ex) => ({ id: ex.id, duration: ex.duration })),
        coolDownExercises: coolDownExercises.map((ex) => ({ id: ex.id, duration: ex.duration })),
        exercises: exercises.map((ex) => ({ id: ex.id, duration: ex.duration })),
        panelRows: panelRows.map((row) => ({
            round: row.round,
            time: row.time,
            rest: row.rest,
            waterBreak: row.waterBreak,
        })),
    })

    const dsSeconds = dynamicExercises.reduce((acc, ex) => acc + (ex.duration || 0), 0)
    const cdSeconds = coolDownExercises.reduce((acc, ex) => acc + (ex.duration || 0), 0)
    let mainSeconds = 0
    let restSeconds = 0
    const circuitMethod = (circuitType || '').toLowerCase()
    const majorCat = (majorCategory || '').toUpperCase()

    if (majorCat === 'AMRAP') {
        const br = getAmrapTimeBreakdownFromPanels(panelRows, exercises)
        mainSeconds = br.mainSeconds
        restSeconds = br.restSeconds
    } else if (majorCat === 'EMOM') {
        const br = getEmomTimeBreakdownFromPanels(panelRows, exercises)
        mainSeconds = br.mainSeconds
        restSeconds = br.restSeconds
    } else if (
        majorCat === 'MAIN' &&
        (circuitMethod === 'stress' || circuitMethod === 'loop') &&
        panelRows.length > 0 &&
        exercises.length > 0
    ) {
        const br = getMainCircuitTimeBreakdownFromPanels(panelRows, exercises)
        mainSeconds = br.mainSeconds
        restSeconds = br.restSeconds
    } else if (workoutExercisesData && workoutExercisesData.length > 0) {
        workoutExercisesData.forEach((item) => {
            if (item.round <= 0 || item.round >= 99) return
            if (item.exercise_type === 'exercise') {
                mainSeconds += item.duration || 0
            } else if (item.exercise_type === 'rest') {
                restSeconds += item.duration || 0
            } else if (item.exercise_type === 'water') {
                restSeconds += item.duration || 0
            }
        })
    } else {
        const br = getMainCircuitTimeBreakdownFromPanels(panelRows, exercises)
        mainSeconds = br.mainSeconds
        restSeconds = br.restSeconds
    }

    const totalSeconds = dsSeconds + mainSeconds + cdSeconds + restSeconds
    const result = { dsSeconds, mainSeconds, cdSeconds, totalSeconds, restSeconds }
    console.log('🔍 [calculateWorkoutTimeSummary] 계산 결과:', result)
    return result
}
