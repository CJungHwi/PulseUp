import type { Exercise, PanelRow } from './types'

/** AMRAP 메인 블록 1개 (workout_exercises_logic.md §4 예시1~4) */
export type AmrapExerciseGroup = {
    exercises: Exercise[]
    row: PanelRow
    groupRound: number
}

const GROUP_SIZE = 6

const rowForGroup = (panelRows: PanelRow[], g: number, defaultRow: PanelRow): PanelRow =>
    panelRows[g] ?? panelRows[panelRows.length - 1] ?? defaultRow

/**
 * 예시1: 운동설정 2개, 운동종류 12개 — 전반 6(L1→R1)·후반 6(L4→R4), 행 각각 Round1/2
 * DB round 는 전·후반을 1과 2로 고정한다. (panel row 의 round 가 둘 다 1이면 `r?.round ?? 2` 가 1이 되어 후반이 Round1으로 잘못 저장되는 문제 방지)
 */
export const buildAmrapOption1_TwoPanelsTwelveExercises = (
    sortedExercises: Exercise[],
    panelRows: PanelRow[],
    defaultRow: PanelRow,
): AmrapExerciseGroup[] => {
    const r0 = panelRows[0] ?? defaultRow
    const r1 = panelRows[1] ?? defaultRow
    return [
        { exercises: sortedExercises.slice(0, 6), row: r0, groupRound: 1 },
        { exercises: sortedExercises.slice(6, 12), row: r1, groupRound: 2 },
    ]
}

/**
 * 예시2: 운동설정 2개, 운동종류 6개 — 동일 6슬롯을 전반 행·후반 행으로 2회
 */
export const buildAmrapOption2_TwoPanelsSixExercises = (
    sortedExercises: Exercise[],
    panelRows: PanelRow[],
    defaultRow: PanelRow,
): AmrapExerciseGroup[] => {
    const r0 = panelRows[0] ?? defaultRow
    const r1 = panelRows[1] ?? defaultRow
    return [
        { exercises: sortedExercises, row: r0, groupRound: 1 },
        { exercises: sortedExercises, row: r1, groupRound: 2 },
    ]
}

/**
 * 예시3: 운동설정 1개, 운동종류 12개 — 전·후반 6개씩, 동일 설계 행(행 부족 시 마지막 행 폴백은 호출부 panelRows로 보장)
 * 설계 행 1줄의 round 가 1이면 `r0.round ?? 2` 는 1이 되어 후반이 Round1으로 저장되므로 반드시 1 / 2 로 분리한다.
 */
export const buildAmrapOption3_OnePanelTwelveExercises = (
    sortedExercises: Exercise[],
    panelRows: PanelRow[],
    defaultRow: PanelRow,
): AmrapExerciseGroup[] => {
    const r0 = panelRows[0] ?? defaultRow
    return [
        { exercises: sortedExercises.slice(0, 6), row: r0, groupRound: 1 },
        { exercises: sortedExercises.slice(6, 12), row: r0, groupRound: 2 },
    ]
}

/**
 * 예시4: 운동설정 1개, 운동종류 6개(전반 1그룹)
 */
export const buildAmrapOption4_OnePanelSixExercises = (
    sortedExercises: Exercise[],
    panelRows: PanelRow[],
    defaultRow: PanelRow,
): AmrapExerciseGroup[] => {
    const r0 = panelRows[0] ?? defaultRow
    return [{ exercises: sortedExercises, row: r0, groupRound: r0.round ?? 1 }]
}

/**
 * 예시1~4 외: 운동 개수·설계 조합(예: 7~11개, 18개 3그룹 등) — 6개씩 슬라이스, 행은 인덱스 g 또는 마지막 행
 */
export const buildAmrapGroupsFallbackBySixSlice = (
    sortedExercises: Exercise[],
    panelRows: PanelRow[],
    defaultRow: PanelRow,
): AmrapExerciseGroup[] => {
    const n = sortedExercises.length
    const numGroups = Math.max(1, Math.ceil(n / GROUP_SIZE))
    const groups: AmrapExerciseGroup[] = []
    for (let g = 0; g < numGroups; g++) {
        const start = g * GROUP_SIZE
        const slice = sortedExercises.slice(start, Math.min(start + GROUP_SIZE, n))
        const row = rowForGroup(panelRows, g, defaultRow)
        // AMRAP 메인은 전·후반을 round 1,2,… 로 구분해야 함. row.round 가 매 그룹 1이면 ?? (g+1) 로 후반이 또 1이 됨.
        groups.push({ exercises: slice, row, groupRound: g + 1 })
    }
    return groups
}

type AmrapGroupBuilder = (
    sorted: Exercise[],
    panels: PanelRow[],
    def: PanelRow,
) => AmrapExerciseGroup[]

const AMRAP_GROUP_BUILDERS: Record<string, AmrapGroupBuilder> = {
    '2-12': buildAmrapOption1_TwoPanelsTwelveExercises,
    '2-6': buildAmrapOption2_TwoPanelsSixExercises,
    '1-12': buildAmrapOption3_OnePanelTwelveExercises,
    '1-6': buildAmrapOption4_OnePanelSixExercises,
}

/**
 * AMRAP 메인 그룹 구성 (workout_exercises_logic.md §4 예시1~4는 전용 함수, 그 외는 6개 슬라이스 폴백)
 */
export const buildAmrapExerciseGroups = (
    sortedExercises: Exercise[],
    panelRows: PanelRow[],
    defaultRow: PanelRow,
): AmrapExerciseGroup[] => {
    const n = sortedExercises.length
    const p = panelRows.length
    const builder = AMRAP_GROUP_BUILDERS[`${p}-${n}`]
    if (builder) {
        return builder(sortedExercises, panelRows, defaultRow)
    }
    return buildAmrapGroupsFallbackBySixSlice(sortedExercises, panelRows, defaultRow)
}

/** Singleexercises(linear): 패널 행마다 전체 운동을 1그룹으로 구성 */
export const buildAmrapExerciseGroupsLinear = (
    sortedExercises: Exercise[],
    panelRows: PanelRow[],
    defaultRow: PanelRow,
): AmrapExerciseGroup[] => {
    if (sortedExercises.length === 0) return []
    const rows = panelRows.length > 0 ? panelRows : [defaultRow]
    return rows.map((row, idx) => ({
        exercises: sortedExercises,
        row: row ?? defaultRow,
        groupRound: row?.round ?? idx + 1,
    }))
}
