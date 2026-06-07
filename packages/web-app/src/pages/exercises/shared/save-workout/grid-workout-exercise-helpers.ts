import { buildAmrapExerciseGroups } from '../amrapGroupBuilders'
import type { Exercise, PanelRow } from '../types'
import { WorkoutExerciseItem } from './save-types'
import {
  GRID_FIRST_HALF_PREFIX,
  GRID_SECOND_HALF_PREFIX,
  STRESS_LAP_ORDER,
  parseGridPosition,
} from '@/utils/gridPositionCodes'

/** 반(prefix A/B) 기준 — 반 내부 STRESS_LAP_ORDER 스네이크 순 */
export const sortExercisesForExecution = (exercises: Exercise[]): Exercise[] => {
  const halfGroups: Map<string, Exercise[]> = new Map()

  exercises.forEach((ex) => {
    const parsed = parseGridPosition(ex.position)
    if (!parsed) return
    if (!halfGroups.has(parsed.prefix)) halfGroups.set(parsed.prefix, [])
    halfGroups.get(parsed.prefix)!.push(ex)
  })

  const sortedExercises: Exercise[] = []
  ;[GRID_FIRST_HALF_PREFIX, GRID_SECOND_HALF_PREFIX].forEach((halfPrefix) => {
    const group = halfGroups.get(halfPrefix)
    if (!group?.length) return

    const orderSlice =
      halfPrefix === GRID_FIRST_HALF_PREFIX
        ? STRESS_LAP_ORDER.slice(0, 6)
        : STRESS_LAP_ORDER.slice(6, 12)

    const byPos = new Map<string, Exercise>()
    group.forEach((ex) => {
      const pos = parseGridPosition(ex.position)
      if (pos) byPos.set(`${pos.prefix}${pos.num}`, ex)
    })

    orderSlice.forEach((pos) => {
      const ex = byPos.get(pos)
      if (ex) sortedExercises.push(ex)
    })
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
                    reps: ex.reps ?? 0,
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

export const generateEmomStressWorkoutExercises = (
    panelRowsInSeconds: PanelRow[],
    exercises: Exercise[],
): WorkoutExerciseItem[] => {
    const workoutExercises: WorkoutExerciseItem[] = []
    let sequence = 1
    const sortedExercises = sortExercisesForExecution(exercises)
    const groupSize = 6
    const lastPanelRow = panelRowsInSeconds[panelRowsInSeconds.length - 1]

    sortedExercises.forEach((ex, exIndex) => {
        const isEndOfGroup = (exIndex + 1) % groupSize === 0
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
                position: ex.position || null,
            })

            const isLastSet = setIndex === panelRowsInSeconds.length - 1
            if (isLastSet && isEndOfGroup && !isLastExercise && lastPanelRow?.waterBreak > 0) {
                workoutExercises.push({
                    sequence: sequence++,
                    round: lastPanelRow.round,
                    exercise_type: 'water',
                    exercise_id: null,
                    name: '물보충',
                    duration: lastPanelRow.waterBreak,
                    position: null,
                })
            }
        })
    })

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
    circuitType: 'stress' | 'loop' = 'loop',
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
    if (circuitType === 'stress') {
        return generateEmomStressWorkoutExercises(panelSeconds, exercises)
    }
    return generateEmomWorkoutExercises(panelSeconds, exercises)
}
