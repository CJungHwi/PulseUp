export type MethodType =
  | 'stress'
  | 'loop'
  | 'AMRAP'
  | 'EMOM-STRESS'
  | 'EMOM-LOOP'
  | 'COMBO-STRESS'
  | 'COMBO-LOOP'

export interface WorkoutSettingRow {
  round: number
  time: number
  rest: number
  waterBreak: number
  reps: number
  sortOrder: number
  isActive: boolean
}

export interface WorkoutSettingApiRow {
  round: number
  time: number
  rest: number
  water_break?: number
  waterBreak?: number
  reps?: number
  sort_order?: number
  sortOrder?: number
  is_active?: boolean
  isActive?: boolean
}

export const METHOD_LABELS: Record<MethodType, string> = {
  stress: 'MAIN - STRESS',
  loop: 'MAIN - LOOP',
  AMRAP: 'AMRAP',
  'EMOM-STRESS': 'EMOM - STRESS',
  'EMOM-LOOP': 'EMOM - LOOP',
  'COMBO-STRESS': 'COMBO - STRESS',
  'COMBO-LOOP': 'COMBO - LOOP'
}

export const DEFAULT_ROWS: Record<MethodType, WorkoutSettingRow[]> = {
  stress: [
    { round: 1, time: 60, rest: 20, waterBreak: 0, reps: 0, sortOrder: 1, isActive: true },
    { round: 2, time: 40, rest: 20, waterBreak: 0, reps: 0, sortOrder: 2, isActive: true },
    { round: 3, time: 20, rest: 20, waterBreak: 60, reps: 0, sortOrder: 3, isActive: true }
  ],
  loop: [
    { round: 1, time: 60, rest: 20, waterBreak: 0, reps: 0, sortOrder: 1, isActive: true },
    { round: 2, time: 60, rest: 20, waterBreak: 0, reps: 0, sortOrder: 2, isActive: true },
    { round: 3, time: 60, rest: 20, waterBreak: 60, reps: 0, sortOrder: 3, isActive: true }
  ],
  AMRAP: [
    { round: 1, time: 12, rest: 0, waterBreak: 1, reps: 30, sortOrder: 1, isActive: true },
    { round: 2, time: 12, rest: 0, waterBreak: 0, reps: 30, sortOrder: 2, isActive: true }
  ],
  'EMOM-STRESS': [
    { round: 1, time: 1, rest: 0, waterBreak: 1, reps: 15, sortOrder: 1, isActive: true },
    { round: 2, time: 1, rest: 0, waterBreak: 0, reps: 15, sortOrder: 2, isActive: true }
  ],
  'EMOM-LOOP': [
    { round: 1, time: 1, rest: 0, waterBreak: 1, reps: 15, sortOrder: 1, isActive: true },
    { round: 2, time: 1, rest: 0, waterBreak: 0, reps: 15, sortOrder: 2, isActive: true }
  ],
  'COMBO-STRESS': [
    { round: 1, time: 0, rest: 0, waterBreak: 0, reps: 10, sortOrder: 1, isActive: true },
    { round: 2, time: 0, rest: 0, waterBreak: 0, reps: 10, sortOrder: 2, isActive: true },
    { round: 3, time: 60, rest: 20, waterBreak: 0, reps: 10, sortOrder: 3, isActive: true }
  ],
  'COMBO-LOOP': [
    { round: 1, time: 0, rest: 0, waterBreak: 0, reps: 10, sortOrder: 1, isActive: true },
    { round: 2, time: 0, rest: 0, waterBreak: 0, reps: 10, sortOrder: 2, isActive: true },
    { round: 3, time: 60, rest: 20, waterBreak: 0, reps: 10, sortOrder: 3, isActive: true }
  ]
}

export const COMBO_ROW_COUNT = 3

export const isTimeStructuredMethod = (methodType: MethodType): boolean =>
  methodType === 'AMRAP' || methodType === 'EMOM-STRESS' || methodType === 'EMOM-LOOP'

export const isEmomMethod = (methodType: MethodType): boolean =>
  methodType === 'EMOM-STRESS' || methodType === 'EMOM-LOOP'

export const isComboMethod = (methodType: MethodType): boolean =>
  methodType === 'COMBO-STRESS' || methodType === 'COMBO-LOOP'

export const normalizeRows = (
  rows: WorkoutSettingApiRow[],
  methodType: MethodType
): WorkoutSettingRow[] => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return DEFAULT_ROWS[methodType]
  }

  const mapped = rows.map((row, index) => ({
    round: Number(row.round || index + 1),
    time: Number(row.time || 0),
    rest: Number(row.rest || 0),
    waterBreak: Number(row.water_break ?? row.waterBreak ?? 0),
    reps: Number(row.reps || 0),
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? (index + 1)),
    isActive: row.is_active ?? row.isActive ?? true
  }))

  if (methodType === 'stress' || methodType === 'loop') {
    return mapped.map((row, index, arr) =>
      index < arr.length - 1 ? { ...row, waterBreak: 0 } : row
    )
  }

  if (isTimeStructuredMethod(methodType)) {
    return mapped.map((row) => {
      const wbSec = row.waterBreak
      const restMin = row.rest
      return {
        ...row,
        rest: 0,
        waterBreak: wbSec > 0 ? Math.floor(wbSec / 60) : restMin
      }
    })
  }

  if (isComboMethod(methodType)) {
    const comboRows =
      mapped.length >= COMBO_ROW_COUNT
        ? mapped.slice(0, COMBO_ROW_COUNT)
        : DEFAULT_ROWS[methodType]
    return comboRows.map((row, index, arr) =>
      index < arr.length - 1
        ? { ...row, round: index + 1, time: 0, rest: 0, waterBreak: 0, sortOrder: index + 1 }
        : { ...row, round: index + 1, waterBreak: 0, sortOrder: index + 1 }
    )
  }

  return mapped
}
