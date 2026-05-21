import type { WorkoutModuleContext } from '../shared/base-module'
import type { ReadyModule } from '../shared/ready-module'

export const runLoopCountdown = (
  ctx: WorkoutModuleContext,
  readyModule: ReadyModule,
  onDone: () => void,
): void => {
  readyModule.execute(ctx, onDone)
}
