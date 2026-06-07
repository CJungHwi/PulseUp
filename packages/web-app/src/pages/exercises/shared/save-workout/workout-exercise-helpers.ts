/**
 * workout-exercise-helpers — sequenceMode(grid|linear)에 따라 실행순서·저장 payload 생성
 */
import type { SequenceMode } from '../sequenceMode'
import { SEQUENCE_MODE_LINEAR } from '../sequenceMode'
import type { Exercise, PanelRow } from '../types'
import type { WorkoutExerciseItem } from './save-types'
import * as grid from './grid-workout-exercise-helpers'
import * as linear from './linear-workout-exercise-helpers'

const resolveMode = (mode?: SequenceMode): SequenceMode => mode ?? 'grid'

export const sortExercisesForExecution = (
    exercises: Exercise[],
    mode?: SequenceMode,
): Exercise[] => {
    return resolveMode(mode) === SEQUENCE_MODE_LINEAR
        ? linear.sortExercisesForExecutionLinear(exercises)
        : grid.sortExercisesForExecution(exercises)
}

export const getAmrapTimeBreakdownFromPanels = (
    panelRows: PanelRow[],
    exercises: Exercise[],
    mode?: SequenceMode,
) => {
    return resolveMode(mode) === SEQUENCE_MODE_LINEAR
        ? linear.getAmrapTimeBreakdownFromPanelsLinear(panelRows, exercises)
        : grid.getAmrapTimeBreakdownFromPanels(panelRows, exercises)
}

export const generateWorkoutExercises = (
    panelRows: PanelRow[],
    exercises: Exercise[],
    dynamicExercises: Exercise[],
    coolDownExercises: Exercise[],
    circuitType: string,
    mode?: SequenceMode,
): WorkoutExerciseItem[] => {
    if (resolveMode(mode) === SEQUENCE_MODE_LINEAR) {
        return linear.generateWorkoutExercisesLinear(panelRows, exercises, circuitType)
    }
    return grid.generateWorkoutExercises(
        panelRows,
        exercises,
        dynamicExercises,
        coolDownExercises,
        circuitType,
    )
}

export const getMainCircuitTimeBreakdownFromPanels = (
    panelRows: PanelRow[],
    exercises: Exercise[],
    mode?: SequenceMode,
) => {
    return resolveMode(mode) === SEQUENCE_MODE_LINEAR
        ? linear.getMainCircuitTimeBreakdownFromPanelsLinear(panelRows, exercises)
        : grid.getMainCircuitTimeBreakdownFromPanels(panelRows, exercises)
}

export const getMainCircuitTotalSecondsFromPanels = (
    panelRows: PanelRow[],
    exercises: Exercise[],
    mode?: SequenceMode,
): number => {
    return resolveMode(mode) === SEQUENCE_MODE_LINEAR
        ? linear.getMainCircuitTotalSecondsFromPanelsLinear(panelRows, exercises)
        : grid.getMainCircuitTotalSecondsFromPanels(panelRows, exercises)
}

export const generateEmomWorkoutExercises = (
    panelRowsInSeconds: PanelRow[],
    exercises: Exercise[],
    mode?: SequenceMode,
): WorkoutExerciseItem[] => {
    return resolveMode(mode) === SEQUENCE_MODE_LINEAR
        ? linear.generateEmomWorkoutExercisesLinear(panelRowsInSeconds, exercises)
        : grid.generateEmomWorkoutExercises(panelRowsInSeconds, exercises)
}

export const getEmomTimeBreakdownFromPanels = (
    panelRows: PanelRow[],
    exercises: Exercise[],
    mode?: SequenceMode,
) => {
    return resolveMode(mode) === SEQUENCE_MODE_LINEAR
        ? linear.getEmomTimeBreakdownFromPanelsLinear(panelRows, exercises)
        : grid.getEmomTimeBreakdownFromPanels(panelRows, exercises)
}

export const generateWorkoutExercisesForTimeStructured = (
    panelRows: PanelRow[],
    exercises: Exercise[],
    workoutType: 'AMRAP' | 'EMOM',
    circuitType: 'stress' | 'loop' = 'loop',
    mode?: SequenceMode,
): WorkoutExerciseItem[] => {
    return resolveMode(mode) === SEQUENCE_MODE_LINEAR
        ? linear.generateWorkoutExercisesForTimeStructuredLinear(
            panelRows,
            exercises,
            workoutType,
            circuitType,
        )
        : grid.generateWorkoutExercisesForTimeStructured(
            panelRows,
            exercises,
            workoutType,
            circuitType,
        )
}
