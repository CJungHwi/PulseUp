import type { WorkoutModuleContext } from '../shared/base-module'
import type { StretchingModule } from '../shared/stretching-module'

export interface AmrapStretchingController {
  stopped: () => boolean
  proceedToNextRound: (round: number, after: () => void) => void
  executeNext: () => void
}

export const runAmrapStretchingRound = (
  ctx: WorkoutModuleContext,
  stretchingModule: StretchingModule,
  ctrl: AmrapStretchingController,
  currentRound: number,
): void => {
  stretchingModule.execute(ctx, () => {
    if (ctrl.stopped() || !ctx.activePlaySession) return

    // DS/CD 라운드 종료 후 별도 5초 휴식 없음 — 다음은 시퀀스의 countdown(Ready)만 진행
    ctrl.proceedToNextRound(currentRound, () => ctrl.executeNext())
  })
}
