import type { WorkoutCircuitType } from '../../components/workout-timer-circuit.js'

export const stressMainTrainingHeaderLabel = (): string => 'Main Training (Stress)'

export const stressGridCategoryLine = (_circuit: WorkoutCircuitType, positionOrLabel: string): string => {
  const upper = (positionOrLabel || '').toUpperCase()
  if (upper.startsWith('DS')) return 'Dynamic Stretching'
  if (upper.startsWith('CD')) return 'Cool Down'
  if (/^[LR]\d+$/.test(upper)) return stressMainTrainingHeaderLabel()
  return ''
}
