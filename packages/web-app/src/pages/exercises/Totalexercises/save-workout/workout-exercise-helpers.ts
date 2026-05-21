import { buildAmrapExerciseGroups } from '../amrapGroupBuilders'
import { Exercise, PanelRow } from '../types'
import { WorkoutExerciseItem } from './save-types'

export const sortExercisesForExecution = (exercises: Exercise[]): Exercise[] => {
    const parsePosition = (pos?: string): { prefix: string; num: number } => {
        if (!pos) return { prefix: '', num: 999 }
        const match = pos.match(/^([LR])(\d+)$/)
        if (!match) return { prefix: '', num: 999 }
        return { prefix: match[1], num: parseInt(match[2], 10) }
    }

    const getGroupIndex = (num: number): number => Math.floor((num - 1) / 3)
    const groups: Map<number, { left: Exercise[]; right: Exercise[] }> = new Map()

    exercises.forEach((ex) => {
        const { prefix, num } = parsePosition(ex.position)
        if (prefix !== 'L' && prefix !== 'R') return

        const groupIdx = getGroupIndex(num)
        if (!groups.has(groupIdx)) {
            groups.set(groupIdx, { left: [], right: [] })
        }
        const group = groups.get(groupIdx)!
        if (prefix === 'L') {
            group.left.push(ex)
            return
        }
        group.right.push(ex)
    })

    const sortedExercises: Exercise[] = []
    const sortedGroupKeys = Array.from(groups.keys()).sort((a, b) => a - b)

    sortedGroupKeys.forEach((groupIdx) => {
        const group = groups.get(groupIdx)!
        group.left.sort(
            (a, b) => parsePosition(a.position).num - parsePosition(b.position).num,
        )
        group.right.sort(
            (a, b) => parsePosition(b.position).num - parsePosition(a.position).num,
        )
        sortedExercises.push(...group.left, ...group.right)
    })

    return sortedExercises
}

export const getAmrapTimeBreakdownFromPanels = (
    panelRows: PanelRow[],
    exercises: Exercise[],
): { mainSeconds: number; restSeconds: number } => {
    const sorted = sortExercisesForExecution(exercises)
    if (panelRows.length === 0 || sorted.length === 0) {
        return { mainSeconds: 0, restSeconds: 0 }
    }

    const defaultRow: PanelRow = {
        id: 'amrap-default',
        round: 1,
        time: 10,
        rest: 0,
        waterBreak: 0,
        type: 'default',
    }
    const groups = buildAmrapExerciseGroups(sorted, panelRows, defaultRow)
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

export const generateWorkoutExercises = (
    panelRows: PanelRow[],
    exercises: Exercise[],
    _dynamicExercises: Exercise[],
    _coolDownExercises: Exercise[],
    circuitType: string,
): WorkoutExerciseItem[] => {
    const workoutExercises: WorkoutExerciseItem[] = []
    let sequence = 1
    const sortedExercises = sortExercisesForExecution(exercises)
    const ct = (circuitType || 'stress').toLowerCase()

    if (ct === 'stress') {
        sortedExercises.forEach((ex, exIndex) => {
            const isEndOfGroup = (exIndex + 1) % 6 === 0
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
                })

                const isLastSet = setIndex === panelRows.length - 1
                if (isLastSet) {
                    if (isEndOfGroup && !isLastExercise) {
                        const lastRow = panelRows[panelRows.length - 1]
                        if (lastRow?.waterBreak && lastRow.waterBreak > 0) {
                            workoutExercises.push({
                                sequence: sequence++,
                                round: lastRow.round,
                                exercise_type: 'water',
                                exercise_id: null,
                                name: '물보충',
                                duration: lastRow.waterBreak,
                                position: null,
                            })
                        }
                    } else if (!isLastExercise && row.rest > 0) {
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

    const groupSize = 6
    const numGroups = Math.ceil(sortedExercises.length / groupSize)
    const roundsPerGroup = panelRows.length
    const lastPanelRow = panelRows[panelRows.length - 1]

    for (let groupIdx = 0; groupIdx < numGroups; groupIdx++) {
        const groupStart = groupIdx * groupSize
        const groupEnd = Math.min(groupStart + groupSize, sortedExercises.length)
        const groupExercises = sortedExercises.slice(groupStart, groupEnd)
        const isLastGroup = groupIdx === numGroups - 1
        const groupRoundBase = groupIdx * roundsPerGroup

        panelRows.forEach((row, roundIndex) => {
            const round = groupRoundBase + roundIndex + 1
            const isLastRound = roundIndex === panelRows.length - 1

            groupExercises.forEach((ex, exIndex) => {
                workoutExercises.push({
                    sequence: sequence++,
                    round,
                    exercise_type: 'exercise',
                    exercise_id: ex.originalExerciseId || ex.id,
                    name: ex.name_ko || ex.name_en || '운동',
                    duration: row.time,
                    position: ex.position || null,
                    reps: ex.reps ?? 0,
                })

                const isLastExerciseInRound = exIndex === groupExercises.length - 1
                if (!isLastExerciseInRound) {
                    if (row.rest > 0) {
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
                    return
                }

                if (isLastRound) {
                    if (!isLastGroup && lastPanelRow?.waterBreak && lastPanelRow.waterBreak > 0) {
                        workoutExercises.push({
                            sequence: sequence++,
                            round,
                            exercise_type: 'water',
                            exercise_id: null,
                            name: '물보충',
                            duration: lastPanelRow.waterBreak,
                            position: null,
                        })
                    }
                    return
                }

                if (row.rest > 0) {
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
        })
    }

    return workoutExercises
}

export const getMainCircuitTimeBreakdownFromPanels = (
    panelRows: PanelRow[],
    exercises: Exercise[],
): { mainSeconds: number; restSeconds: number } => {
    const exerciseCount = exercises.length
    if (panelRows.length === 0 || exerciseCount === 0) {
        return { mainSeconds: 0, restSeconds: 0 }
    }

    const numGroups = Math.ceil(exerciseCount / 6)
    let mainSeconds = 0
    let restSeconds = 0

    panelRows.forEach((row, idx) => {
        const isLastRound = idx === panelRows.length - 1
        mainSeconds += row.time * exerciseCount

        if (!isLastRound) {
            restSeconds += row.rest * exerciseCount
            return
        }

        restSeconds += row.rest * (exerciseCount - numGroups)
        mainSeconds += (row.waterBreak || 0) * (numGroups - 1)
    })

    return { mainSeconds, restSeconds }
}

export const getMainCircuitTotalSecondsFromPanels = (
    panelRows: PanelRow[],
    exercises: Exercise[],
): number => {
    const { mainSeconds, restSeconds } = getMainCircuitTimeBreakdownFromPanels(
        panelRows,
        exercises,
    )
    return mainSeconds + restSeconds
}

export const generateEmomWorkoutExercises = (
    panelRowsInSeconds: PanelRow[],
    exercises: Exercise[],
): WorkoutExerciseItem[] => {
    const workoutExercises: WorkoutExerciseItem[] = []
    let sequence = 1
    const sortedExercises = sortExercisesForExecution(exercises)
    const groupSize = 6
    const numGroups = Math.ceil(sortedExercises.length / groupSize)

    for (let groupIdx = 0; groupIdx < numGroups; groupIdx++) {
        const groupStart = groupIdx * groupSize
        const groupEnd = Math.min(groupStart + groupSize, sortedExercises.length)
        const groupExercises = sortedExercises.slice(groupStart, groupEnd)
        const isLastGroup = groupIdx === numGroups - 1

        panelRowsInSeconds.forEach((row, roundIndex) => {
            const round = groupIdx * panelRowsInSeconds.length + roundIndex + 1
            const isLastRoundInGroup = roundIndex === panelRowsInSeconds.length - 1

            groupExercises.forEach((ex) => {
                workoutExercises.push({
                    sequence: sequence++,
                    round,
                    exercise_type: 'exercise',
                    exercise_id: ex.originalExerciseId || ex.id,
                    name: ex.name_ko || ex.name_en || '운동',
                    duration: row.time,
                    reps: ex.reps ?? 0,
                    position: ex.position || null,
                })
            })

            if (isLastRoundInGroup) {
                if (!isLastGroup && row.waterBreak > 0) {
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
                return
            }

            if (row.waterBreak > 0) {
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
    }

    return workoutExercises
}

export const getEmomTimeBreakdownFromPanels = (
    panelRows: PanelRow[],
    exercises: Exercise[],
): { mainSeconds: number; restSeconds: number } => {
    if (panelRows.length === 0 || exercises.length === 0) {
        return { mainSeconds: 0, restSeconds: 0 }
    }

    const numGroups = Math.ceil(exercises.length / 6)
    let mainSeconds = 0
    let restSeconds = 0

    panelRows.forEach((row, index) => {
        const timeSeconds = Math.max(0, Number(row.time ?? 0)) * 60
        const waterTimeSeconds = Math.max(0, Number(row.waterBreak ?? 0)) * 60
        const isLastRound = index === panelRows.length - 1

        mainSeconds += timeSeconds * exercises.length
        if (!isLastRound) {
            restSeconds += waterTimeSeconds * numGroups
            return
        }

        if (numGroups > 1) {
            restSeconds += waterTimeSeconds * (numGroups - 1)
        }
    })

    return { mainSeconds, restSeconds }
}

export const generateWorkoutExercisesForTimeStructured = (
    panelRows: PanelRow[],
    exercises: Exercise[],
    workoutType: 'AMRAP' | 'EMOM',
): WorkoutExerciseItem[] => {
    const workoutExercises: WorkoutExerciseItem[] = []
    let sequence = 1
    const sortedExercises = sortExercisesForExecution(exercises)

    const defaultRow: PanelRow = {
        id: 'amrap-emom-default',
        round: 1,
        time: 10,
        rest: 0,
        waterBreak: 0,
        type: 'default',
    }

    if (workoutType === 'AMRAP') {
        const groups = buildAmrapExerciseGroups(sortedExercises, panelRows, defaultRow)
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
    return generateEmomWorkoutExercises(panelSeconds, exercises)
}
