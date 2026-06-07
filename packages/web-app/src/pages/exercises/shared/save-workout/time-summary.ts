import type { SequenceMode } from '../sequenceMode'
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
    sequenceMode?: SequenceMode,
): WorkoutTimeSummaryWithRest {
    const dsSeconds = dynamicExercises.reduce((acc, ex) => acc + (ex.duration || 0), 0)
    const cdSeconds = coolDownExercises.reduce((acc, ex) => acc + (ex.duration || 0), 0)
    let mainSeconds = 0
    let restSeconds = 0
    const circuitMethod = (circuitType || '').toLowerCase()
    const majorCat = (majorCategory || '').toUpperCase()

    if (majorCat === 'AMRAP') {
        const br = getAmrapTimeBreakdownFromPanels(panelRows, exercises, sequenceMode)
        mainSeconds = br.mainSeconds
        restSeconds = br.restSeconds
    } else if (majorCat === 'EMOM') {
        const br = getEmomTimeBreakdownFromPanels(panelRows, exercises, sequenceMode)
        mainSeconds = br.mainSeconds
        restSeconds = br.restSeconds
    } else if (
        majorCat === 'MAIN' &&
        (circuitMethod === 'stress' || circuitMethod === 'loop') &&
        panelRows.length > 0 &&
        exercises.length > 0
    ) {
        const br = getMainCircuitTimeBreakdownFromPanels(panelRows, exercises, sequenceMode)
        mainSeconds = br.mainSeconds
        restSeconds = br.restSeconds
    } else if (workoutExercisesData && workoutExercisesData.length > 0) {
        workoutExercisesData.forEach((item) => {
            if (item.round <= 0 || item.round >= 99) return
            if (item.exercise_type === 'exercise') {
                mainSeconds += item.duration || 0
            } else if (item.exercise_type === 'rest' || item.exercise_type === 'water') {
                restSeconds += item.duration || 0
            }
        })
    } else {
        const br = getMainCircuitTimeBreakdownFromPanels(panelRows, exercises, sequenceMode)
        mainSeconds = br.mainSeconds
        restSeconds = br.restSeconds
    }

    const totalSeconds = dsSeconds + mainSeconds + cdSeconds + restSeconds
    return { dsSeconds, mainSeconds, cdSeconds, totalSeconds, restSeconds }
}
