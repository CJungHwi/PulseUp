export {
  applyPreviewLoopPositionHint,
  buildPreviewMainFirstRoundOrdered,
  collectIntroPlaySequences,
  createPlaybackNavigation,
  createWorkoutModuleForCircuitType,
  normalizeCircuitTypeFromMetadata,
} from './circuit-registry'
export type { WorkoutModuleContext, WorkoutModule, PlaybackNavigation } from './circuits/shared/base-module'
export type { IntroCircuitKind, IntroSequenceCollectContext } from './circuits/shared/intro-circuit'
export { getIntroPreviewMaxMainPositions, resolveIntroCircuitKind } from './circuits/shared/intro-circuit'
export { collectIntroSequencesFirstMainRound, positionInMainLrGrid } from './circuits/shared/intro-shared'
export { collectIntroPlayGridSequences } from './circuits/shared/intro-play/intro-grid-sequences'
export { collectStressIntroSequences } from './circuits/shared/intro-play/stress-intro'
export { collectLoopIntroSequences, tryAssignLoopPreviewGridPosition } from './circuits/shared/intro-play/loop-intro'
export { collectAmrapIntroSequences } from './circuits/shared/intro-play/amrap-intro'
export { buildEmomPreviewFirstRoundOrdered, collectEmomIntroSequences } from './circuits/shared/intro-play/emom-intro'
export { preloadMainRoundGroup } from './circuits/shared/main-round-preload'
export { preloadStretchingRoundGroup } from './circuits/shared/stretching-preload'
export {
  preloadCoolDownForStress,
  preloadNextStressGroup,
  preloadStressFromTimeline,
  type StressCooldownPreloadDelegate,
} from './circuits/stress/stress-preload'
export { preloadCoolDownForAmrap } from './circuits/amrap/amrap-preload'
export { PreloadManager } from './circuits/shared/preload-manager'
export {
  buildTimeline,
  buildFullTimeline,
  buildTimelineForDS,
  buildTimelineForCD,
  buildTimelineForStress,
  buildTimelineForLoop,
  buildTimelineForAMRAP,
  buildTimelineForEMOM,
  getPreloadWindow,
  type TimelineEntry,
  type TimelineByPosition,
  type TimelineResult,
  type CircuitType,
} from './circuits/shared/timeline-utils'
export { StretchingModule } from './circuits/shared/stretching-module'
export { ReadyModule } from './circuits/shared/ready-module'
export { StressModule } from './circuits/stress/stress-module'
export { LoopModule } from './circuits/loop/loop-module'
export { EmomModule } from './circuits/emom/emom-module'
export { AmrapModule } from './circuits/amrap/amrap-module'
/** @deprecated prefer `./circuits/emom/emom-constants` — kept for existing deep imports */
export {
  EMOM_LAP_ORDER,
  computeEmomLapIndex,
  computeEmomPlanRowInHalf,
  computeEmomRoundNumber,
  computeEmomTotalRounds,
  getActiveSetForEmomRound,
  getEmomHalfGroupIndex,
  sortEmomDisplaySequences,
} from './circuits/emom/emom-constants'
