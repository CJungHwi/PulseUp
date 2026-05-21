import type { WorkoutCircuitType } from '../components/workout-timer-circuit.js'
import { amrapGridCategoryLine } from './amrap/grid-display-strategy.js'
import { emomGridCategoryLine } from './emom/grid-display-strategy.js'
import { loopGridCategoryLine } from './loop/grid-display-strategy.js'
import { stressGridCategoryLine } from './stress/grid-display-strategy.js'

export const getGridCategoryDisplayName = (
  circuit: WorkoutCircuitType,
  positionOrLabel: string,
): string => {
  switch (circuit) {
    case 'loop':
      return loopGridCategoryLine(circuit, positionOrLabel)
    case 'amrap':
      return amrapGridCategoryLine(circuit, positionOrLabel)
    case 'emom':
      return emomGridCategoryLine(circuit, positionOrLabel)
    case 'stress':
    default:
      return stressGridCategoryLine(circuit, positionOrLabel)
  }
}

/** WorkoutGridDisplay.setCircuitType 와 동일한 정규화 */
export const normalizePanelCircuitType = (ct: string | undefined): WorkoutCircuitType | null => {
  if (ct == null || typeof ct !== 'string') return null
  const raw = ct.trim()
  if (!raw) return null
  const upper = raw.toUpperCase()
  let val = raw.toLowerCase()
  if (upper === 'EMOM') val = 'emom'
  if (upper === 'AMRAP') val = 'amrap'
  if (val !== 'loop' && val !== 'stress' && val !== 'amrap' && val !== 'emom') return null
  return val as WorkoutCircuitType
}
