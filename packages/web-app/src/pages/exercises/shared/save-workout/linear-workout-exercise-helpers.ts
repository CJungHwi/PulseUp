/**
 * linear-workout-exercise-helpers — Singleexercises용 1,2,3… 순서 저장·시간 계산
 */
import { buildAmrapExerciseGroupsLinear } from '../amrapGroupBuilders'
import { Exercise, PanelRow } from '../types'
import { sortExercisesLinear } from '../sequencePositions'
import { WorkoutExerciseItem } from './save-types'

export const sortExercisesForExecutionLinear = sortExercisesLinear

export const getAmrapTimeBreakdownFromPanelsLinear = (
    panelRows: PanelRow[],
    exercises: Exercise[],
): { mainSeconds: number; restSeconds: number } => {
    const sorted = sortExercisesLinear(exercises)
    if (panelRows.length === 0 || sorted.length === 0) {
        return { mainSeconds: 0, restSeconds: 0 }
    }

    const defaultRow: PanelRow = {
        id: 'amrap-linear-default',
        round: 1,
        time: 10,
        rest: 0,
        waterBreak: 0,
        type: 'default',
    }
    const groups = buildAmrapExerciseGroupsLinear(sorted, panelRows, defaultRow)
    let mainSeconds = 0
    let restSeconds = 0

    for (let groupIdx = 0; groupIdx < groups.length; groupIdx++) {
        const { row } = groups[groupIdx]
        mainSeconds += (row.time || 0) * 60
        if (groupIdx < groups.length - 1) {
            restSeconds += (row.waterBreak || 0) * 60
        }
    }

    return { mainSeconds, restSeconds }
}

export const getMainCircuitTimeBreakdownFromPanelsLinear = (
    panelRows: PanelRow[],
    exercises: Exercise[],
): { mainSeconds: number; restSeconds: number } => {
    const exerciseCount = exercises.length
    if (panelRows.length === 0 || exerciseCount === 0) {
        return { mainSeconds: 0, restSeconds: 0 }
    }

    let mainSeconds = 0
    let restSeconds = 0

    panelRows.forEach((row, idx) => {
        const isLastRound = idx === panelRows.length - 1
        mainSeconds += row.time * exerciseCount

        if (!isLastRound) {
            restSeconds += row.rest * exerciseCount
            return
        }

        restSeconds += row.rest * Math.max(0, exerciseCount - 1)
    })

    return { mainSeconds, restSeconds }
}

export const getMainCircuitTotalSecondsFromPanelsLinear = (
    panelRows: PanelRow[],
    exercises: Exercise[],
): number => {
    const { mainSeconds, restSeconds } = getMainCircuitTimeBreakdownFromPanelsLinear(
        panelRows,
        exercises,
    )
    return mainSeconds + restSeconds
}

export const generateWorkoutExercisesLinear = (
    panelRows: PanelRow[],
    exercises: Exercise[],
    circuitType: string,
): WorkoutExerciseItem[] => {
    const workoutExercises: WorkoutExerciseItem[] = []
    let sequence = 1
    const sortedExercises = sortExercisesLinear(exercises)
    const ct = (circuitType || 'stress').toLowerCase()

    if (ct === 'stress') {
        sortedExercises.forEach((ex, exIndex) => {
            const isLastExercise = exIndex === sortedExercises.length - 1

            panelRows.forEach((row, setIndex) => {
                workoutExercises.push({
                    sequence: sequence++,
                    round: row.round,
                    exercise_type: 'exercise',
                    exercise_id: ex.originalExerciseId || ex.id,
                    name: ex.name_ko || ex.name_en || '운동',
                    duration: row.time,
                    position: ex.position || null,
                    reps: ex.reps ?? 0,
                    is_bilateral: !!ex.is_bilateral,
                })

                const isLastSet = setIndex === panelRows.length - 1
                if (isLastSet) {
                    if (!isLastExercise && row.rest > 0) {
                        workoutExercises.push({
                            sequence: sequence++,
                            round: row.round,
                            exercise_type: 'rest',
                            exercise_id: null,
                            name: '휴식',
                            duration: row.rest,
                            position: null,
                        })
                    }
                    return
                }

                if (row.rest > 0) {
                    workoutExercises.push({
                        sequence: sequence++,
                        round: row.round,
                        exercise_type: 'rest',
                        exercise_id: null,
                        name: '휴식',
                        duration: row.rest,
                        position: null,
                    })
                }
            })
        })
        return workoutExercises
    }

    panelRows.forEach((row, roundIndex) => {
        const round = roundIndex + 1
        const isLastRound = roundIndex === panelRows.length - 1

        sortedExercises.forEach((ex, exIndex) => {
            workoutExercises.push({
                sequence: sequence++,
                round,
                exercise_type: 'exercise',
                exercise_id: ex.originalExerciseId || ex.id,
                name: ex.name_ko || ex.name_en || '운동',
                duration: row.time,
                position: ex.position || null,
                reps: ex.reps ?? 0,
                is_bilateral: !!ex.is_bilateral,
            })

            const isLastExerciseInRound = exIndex === sortedExercises.length - 1
            if (!isLastExerciseInRound && row.rest > 0) {
                workoutExercises.push({
                    sequence: sequence++,
                    round,
                    exercise_type: 'rest',
                    exercise_id: null,
                    name: '휴식',
                    duration: row.rest,
                    position: null,
                })
            }
        })

        if (!isLastRound && row.waterBreak > 0) {
            workoutExercises.push({
                sequence: sequence++,
                round,
                exercise_type: 'water',
                exercise_id: null,
                name: '물보충',
                duration: row.waterBreak,
                position: null,
            })
        }
    })

    return workoutExercises
}

export const generateEmomWorkoutExercisesLinear = (
    panelRowsInSeconds: PanelRow[],
    exercises: Exercise[],
): WorkoutExerciseItem[] => {
    const workoutExercises: WorkoutExerciseItem[] = []
    let sequence = 1
    const sortedExercises = sortExercisesLinear(exercises)

    panelRowsInSeconds.forEach((row, roundIndex) => {
        const round = roundIndex + 1
        const isLastRound = roundIndex === panelRowsInSeconds.length - 1

        sortedExercises.forEach((ex) => {
            workoutExercises.push({
                sequence: sequence++,
                round,
                exercise_type: 'exercise',
                exercise_id: ex.originalExerciseId || ex.id,
                name: ex.name_ko || ex.name_en || '운동',
                duration: row.time,
                reps: ex.reps ?? 0,
                is_bilateral: !!ex.is_bilateral,
                position: ex.position || null,
            })
        })

        if (!isLastRound && row.waterBreak > 0) {
            workoutExercises.push({
                sequence: sequence++,
                round,
                exercise_type: 'water',
                exercise_id: null,
                name: '물보충',
                duration: row.waterBreak,
                position: null,
            })
        }
    })

    return workoutExercises
}

export const generateEmomStressWorkoutExercisesLinear = (
    panelRowsInSeconds: PanelRow[],
    exercises: Exercise[],
): WorkoutExerciseItem[] => {
    const workoutExercises: WorkoutExerciseItem[] = []
    let sequence = 1
    const sortedExercises = sortExercisesLinear(exercises)

    sortedExercises.forEach((ex, exIndex) => {
        const isLastExercise = exIndex === sortedExercises.length - 1

        panelRowsInSeconds.forEach((row, setIndex) => {
            workoutExercises.push({
                sequence: sequence++,
                round: row.round,
                exercise_type: 'exercise',
                exercise_id: ex.originalExerciseId || ex.id,
                name: ex.name_ko || ex.name_en || '운동',
                duration: row.time,
                reps: ex.reps ?? 0,
                is_bilateral: !!ex.is_bilateral,
                position: ex.position || null,
            })

            const isLastSet = setIndex === panelRowsInSeconds.length - 1
            if (isLastSet && !isLastExercise && row.rest > 0) {
                workoutExercises.push({
                    sequence: sequence++,
                    round: row.round,
                    exercise_type: 'rest',
                    exercise_id: null,
                    name: '휴식',
                    duration: row.rest,
                    position: null,
                })
            }
        })
    })

    return workoutExercises
}

export const getEmomTimeBreakdownFromPanelsLinear = (
    panelRows: PanelRow[],
    exercises: Exercise[],
): { mainSeconds: number; restSeconds: number } => {
    if (panelRows.length === 0 || exercises.length === 0) {
        return { mainSeconds: 0, restSeconds: 0 }
    }

    let mainSeconds = 0
    let restSeconds = 0

    panelRows.forEach((row, index) => {
        const timeSeconds = Math.max(0, Number(row.time ?? 0)) * 60
        const waterTimeSeconds = Math.max(0, Number(row.waterBreak ?? 0)) * 60
        const isLastRound = index === panelRows.length - 1

        mainSeconds += timeSeconds * exercises.length
        if (!isLastRound) {
            restSeconds += waterTimeSeconds
        }
    })

    return { mainSeconds, restSeconds }
}

export const generateWorkoutExercisesForTimeStructuredLinear = (
    panelRows: PanelRow[],
    exercises: Exercise[],
    workoutType: 'AMRAP' | 'EMOM',
    circuitType: 'stress' | 'loop' = 'loop',
): WorkoutExerciseItem[] => {
    const workoutExercises: WorkoutExerciseItem[] = []
    let sequence = 1
    const sortedExercises = sortExercisesLinear(exercises)

    const defaultRow: PanelRow = {
        id: 'amrap-emom-linear-default',
        round: 1,
        time: 10,
        rest: 0,
        waterBreak: 0,
        type: 'default',
    }

    if (workoutType === 'AMRAP') {
        const groups = buildAmrapExerciseGroupsLinear(sortedExercises, panelRows, defaultRow)
        for (let groupIdx = 0; groupIdx < groups.length; groupIdx++) {
            const { exercises: groupExercises, row, groupRound } = groups[groupIdx]
            const isLastGroup = groupIdx === groups.length - 1

            groupExercises.forEach((ex) => {
                workoutExercises.push({
                    sequence: sequence++,
                    round: groupRound,
                    exercise_type: 'exercise',
                    exercise_id: ex.originalExerciseId || ex.id,
                    name: ex.name_ko || ex.name_en || '운동',
                    duration: row.time * 60,
                    reps: ex.reps || 0,
                    is_bilateral: !!ex.is_bilateral,
                    position: ex.position || null,
                })
            })

            if (!isLastGroup) {
                const waterMin = Number(row.waterBreak ?? 0)
                if (waterMin > 0) {
                    workoutExercises.push({
                        sequence: sequence++,
                        round: groupRound,
                        exercise_type: 'water',
                        exercise_id: null,
                        name: '물보충',
                        duration: waterMin * 60,
                        position: null,
                    })
                }
            }
        }
        return workoutExercises
    }

    const panelSeconds = panelRows.map((row) => ({
        ...row,
        time: Math.max(0, Number(row.time ?? 0)) * 60,
        rest: Math.max(0, Number(row.rest ?? 0)) * 60,
        waterBreak: Math.max(0, Number(row.waterBreak ?? 0)) * 60,
    }))
    if (circuitType === 'stress') {
        return generateEmomStressWorkoutExercisesLinear(panelSeconds, exercises)
    }
    return generateEmomWorkoutExercisesLinear(panelSeconds, exercises)
}
