import type { WorkoutCircuitType } from '../../components/workout-timer-circuit.js'

export const loopMainTrainingHeaderLabel = (): string => 'Main Training (Loop)'

export const loopGridCategoryLine = (_circuit: WorkoutCircuitType, positionOrLabel: string): string => {
  const upper = (positionOrLabel || '').toUpperCase()
  if (upper.startsWith('DS')) return 'Dynamic Stretching'
  if (upper.startsWith('CD')) return 'Cool Down'
  if (/^[LR]\d+$/.test(upper)) return loopMainTrainingHeaderLabel()
  return ''
}
