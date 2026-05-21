import type { WorkoutModuleContext } from './base-module'
import { preloadMainRoundGroup } from './main-round-preload'
import { preloadStretchingRoundGroup } from './stretching-preload'

/** 메인/스트레칭 프리로드를 한 곳에서 호출할 수 있게 하는 얇은 래퍼 (구현은 유형별 파일에 둠) */
export class PreloadManager {
  requestPreloadForMainRoundGroup(ctx: WorkoutModuleContext, round: number, groupIndex: number): void {
    preloadMainRoundGroup(ctx, round, groupIndex)
  }

  requestPreloadForStretchingGroup(ctx: WorkoutModuleContext, round: number, groupIndex: number): void {
    preloadStretchingRoundGroup(ctx, round, groupIndex)
  }
}
