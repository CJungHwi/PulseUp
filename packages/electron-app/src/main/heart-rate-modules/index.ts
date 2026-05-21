/**
 * 심박수 관련 main 모듈 — workout-modules와 동일하게 한 디렉터리에서 export
 */
export type { HeartRateReading, HeartRateManagerDeps } from './types'
export type {
  HeartRateAntDiagnostics,
  HeartRateAntState,
  HeartRateDiagnosticsSnapshot,
  HeartRateSlotDiagnostics,
  HeartRateSlotState,
  HeartRateUploadStatus,
} from './diagnostics-types'
export { calculateHeartRateZoneForApi } from './heart-rate-zones'
export { HeartRateManager } from './heart-rate-manager'
export { HeartRateANTManager } from './ant-heart-rate-manager'
