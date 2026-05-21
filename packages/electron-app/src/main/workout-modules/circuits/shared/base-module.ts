import type { ExerciseSequence, WorkoutPlaySession, ActiveSet } from '../../../types'
import { workoutInfoDevLog } from '../../../workout-dev-log.js'

export const log = workoutInfoDevLog

export interface WorkoutModuleContext {
  activePlaySession: WorkoutPlaySession | null
  playTimer: NodeJS.Timeout | null
  preloadedGroupKeys: Set<string>
  _lastStressGroupIndex: number

  /** AMRAP: 직전에 재생한 메인 라운드 번호(동일 6슬롯 2회인 2-6 등에서 라운드 전환 시 슬롯 advance 용) */
  _lastAmrapMainRoundNumber: number | null

  /** 스트레칭(DS/CD) 내 현재 그룹 인덱스 (0-based). 다음/이전 그룹 네비게이션에 사용 */
  stretchingGroupIndex: number

  broadcastToAllWindows: (channel: string, data: any) => void

  isStretchingOrCoolDownRound: (round: number) => boolean
  getPlayableMainExercisesByRound: (round: number) => ExerciseSequence[]
  getNextMainRoundAfter: (round: number) => number | null
  getRoundMajorCategory: (round: number) => string

  setPlayTimer: (timer: NodeJS.Timeout | null) => void
  /** setTimeout + setPlayTimer를 하나로: 콜백·남은시간을 서비스에 저장해 pause/resume에서 재활용 */
  schedulePlayTimer: (callback: () => void, durationMs: number) => void
  setLastStressGroupIndex: (index: number) => void
  setLastAmrapMainRoundNumber: (round: number | null) => void
  setStretchingGroupIndex: (index: number) => void
}

export interface WorkoutModule {
  execute(context: WorkoutModuleContext, onComplete: () => void): void
  stop(): void
}

export interface PlaybackNavigation {
  findNext(sequences: ExerciseSequence[], currentIndex: number, currentRound: number): number | null
  findPrevious(sequences: ExerciseSequence[], currentIndex: number, currentRound: number): number | null
}

export type { ExerciseSequence, WorkoutPlaySession, ActiveSet }
