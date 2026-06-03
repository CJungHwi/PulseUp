import { Exercise, PanelRow } from '../types'

const mapDynamicDetail = (ex: Exercise) => ({
    originalExerciseId: ex.originalExerciseId || ex.id,
    position: ex.position,
    exercise_type: ex.major_category ? String(ex.major_category).toUpperCase() : '',
    duration: ex.duration,
})

const mapCircuitMainDetail = (ex: Exercise) => ({
    originalExerciseId: ex.originalExerciseId || ex.id,
    position: ex.position,
    exercise_type: 'MAIN',
    duration: ex.duration,
    reps: ex.reps ?? 0,
})

const mapAmrapMainDetail = (ex: Exercise) => ({
    originalExerciseId: ex.originalExerciseId || ex.id,
    position: ex.position,
    exercise_type: 'MAIN',
    duration: ex.duration ?? 0,
    reps: ex.reps,
})

const mapEmomMainDetail = (ex: Exercise) => ({
    originalExerciseId: ex.originalExerciseId || ex.id,
    position: ex.position,
    exercise_type: ex.major_category ? String(ex.major_category).toUpperCase() : '',
    duration: ex.duration ?? 0,
    reps: ex.reps,
})

const mapCooldownDetail = (ex: Exercise) => ({
    originalExerciseId: ex.originalExerciseId || ex.id,
    position: ex.position,
    exercise_type: 'CD',
    duration: ex.duration,
})

const mapCooldownDetailKeepMajor = (ex: Exercise) => ({
    originalExerciseId: ex.originalExerciseId || ex.id,
    position: ex.position,
    exercise_type: ex.major_category ? String(ex.major_category).toUpperCase() : '',
    duration: ex.duration,
})

export const buildCircuitPlanData = (panelRows: PanelRow[], circuitType: string) =>
    panelRows.map((row) => ({
        round: row.round,
        time: row.time,
        rest: row.rest,
        hydration: row.waterBreak,
        circuit_type: circuitType,
    }))

/** AMRAP/EMOM: 전·후반(라운드) 사이 간격은 DB `hydration`(초)만 사용, `rest`는 0 */
export const buildAmrapPlanData = (panelRows: PanelRow[]) =>
    panelRows.map((row) => ({
        round: row.round,
        time: row.time * 60,
        rest: 0,
        circuit_type: 'amrap',
        hydration: Math.max(0, Number(row.waterBreak ?? 0)) * 60,
    }))

export const buildEmomPlanData = (panelRows: PanelRow[]) =>
    panelRows.map((row) => ({
        round: row.round,
        time: row.time * 60,
        rest: 0,
        circuit_type: 'emom',
        hydration: Math.max(0, Number(row.waterBreak ?? 0)) * 60,
    }))

export const buildCircuitDetailData = (
    dynamicExercises: Exercise[],
    exercises: Exercise[],
    coolDownExercises: Exercise[],
) => [
    ...dynamicExercises.map(mapDynamicDetail),
    ...exercises.map(mapCircuitMainDetail),
    ...coolDownExercises.map(mapCooldownDetail),
]

export const buildAmrapDetailData = (
    dynamicExercises: Exercise[],
    exercises: Exercise[],
    coolDownExercises: Exercise[],
) => [
    ...dynamicExercises.map(mapDynamicDetail),
    ...exercises.map(mapAmrapMainDetail),
    ...coolDownExercises.map(mapCooldownDetail),
]

export const buildEmomDetailData = (
    dynamicExercises: Exercise[],
    exercises: Exercise[],
    coolDownExercises: Exercise[],
) => [
    ...dynamicExercises.map(mapDynamicDetail),
    ...exercises.map(mapEmomMainDetail),
    ...coolDownExercises.map(mapCooldownDetailKeepMajor),
]
