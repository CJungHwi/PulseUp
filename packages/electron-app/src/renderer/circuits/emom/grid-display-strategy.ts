import type { WorkoutCircuitType } from '../../components/workout-timer-circuit.js'
import { isMainGridPosition } from '../../../common/grid-position-codes.js'

export const emomMainTrainingHeaderLabel = (): string => 'EMOM'
export const emomStressHeaderLabel = (): string => 'EMOM (Stress)'

export const emomGridCategoryLine = (
  _circuit: WorkoutCircuitType,
  positionOrLabel: string,
  method?: string | null,
): string => {
  const upper = (positionOrLabel || '').toUpperCase()
  if (upper.startsWith('DS')) return 'Dynamic Stretching'
  if (upper.startsWith('CD')) return 'Cool Down'
  if (isMainGridPosition(upper)) {
    return String(method || '').toLowerCase() === 'stress'
      ? emomStressHeaderLabel()
      : emomMainTrainingHeaderLabel()
  }
  return ''
}
