import type { WorkoutCircuitType } from '../../components/workout-timer-circuit.js'

export const emomMainTrainingHeaderLabel = (): string => 'EMOM'

export const emomGridCategoryLine = (_circuit: WorkoutCircuitType, positionOrLabel: string): string => {
  const upper = (positionOrLabel || '').toUpperCase()
  if (upper.startsWith('DS')) return 'Dynamic Stretching'
  if (upper.startsWith('CD')) return 'Cool Down'
  if (/^[LR]\d+$/.test(upper)) return emomMainTrainingHeaderLabel()
  return ''
}
