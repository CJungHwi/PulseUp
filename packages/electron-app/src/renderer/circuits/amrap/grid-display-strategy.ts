import type { WorkoutCircuitType } from '../../components/workout-timer-circuit.js'
import { isMainGridPosition } from '../../../common/grid-position-codes.js'

export const amrapMainTrainingHeaderLabel = (): string => 'AMRAP'

export const amrapGridCategoryLine = (_circuit: WorkoutCircuitType, positionOrLabel: string): string => {
  const upper = (positionOrLabel || '').toUpperCase()
  if (upper.startsWith('DS')) return 'Dynamic Stretching'
  if (upper.startsWith('CD')) return 'Cool Down'
  if (isMainGridPosition(upper)) return amrapMainTrainingHeaderLabel()
  return ''
}
