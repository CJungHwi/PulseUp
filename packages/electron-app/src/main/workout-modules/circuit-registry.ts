import type { WorkoutModuleContext, PlaybackNavigation } from './circuits/shared/base-module'

import type { PreloadManager } from './circuits/shared/preload-manager'

import type { WorkoutModule } from './circuits/shared/base-module'

import { AmrapModule } from './circuits/amrap/amrap-module'

import { EmomModule } from './circuits/emom/emom-module'

import { EmomStressModule } from './circuits/emom-stress/emom-stress-module'

import { LoopModule } from './circuits/loop/loop-module'

import { StressModule } from './circuits/stress/stress-module'

import { StressNavigation } from './circuits/stress/stress-navigation'

import { LoopNavigation } from './circuits/loop/loop-navigation'

import { EmomNavigation } from './circuits/emom/emom-navigation'

import { EmomStressNavigation } from './circuits/emom-stress/emom-stress-navigation'

import { AmrapNavigation } from './circuits/amrap/amrap-navigation'

import { isEmomStressPlayback } from './circuits/emom-stress/emom-stress-detect'

import type { IntroCircuitKind, IntroSequenceCollectContext } from './circuits/shared/intro-circuit'

import {

  buildEmomPreviewFirstRoundOrdered,

  orderEmomPreviewSequences,

  primeEmomIntroStartPreload,

} from './circuits/shared/intro-play/emom-intro'

import {

  buildAmrapPreviewFirstRoundOrdered,

  primeAmrapIntroStartPreload,

} from './circuits/shared/intro-play/amrap-intro'

import { collectIntroPlayGridSequences } from './circuits/shared/intro-play/intro-grid-sequences'

import {

  buildLoopPreviewFirstRoundOrdered,

  orderLoopPreviewSequences,

  primeLoopIntroStartPreload,

  tryAssignLoopPreviewGridPosition,

} from './circuits/shared/intro-play/loop-intro'

import {

  buildStressPreviewFirstRoundOrdered,

  primeStressIntroStartPreload,

} from './circuits/shared/intro-play/stress-intro'

import { sortIntroMainPreviewSequences } from './circuits/shared/intro-shared'

import { getIntroPreviewMaxMainPositions, resolveIntroCircuitKind } from './circuits/shared/intro-circuit'



export type { IntroCircuitKind, IntroSequenceCollectContext } from './circuits/shared/intro-circuit'



/** 세션 메타데이터에서 circuitType 문자열 정규화(workoutCategory 보정 포함). */

export const normalizeCircuitTypeFromMetadata = (

  metadata: { workoutCategory?: unknown; circuitType?: unknown } | null | undefined,

): string => {

  const wc = (metadata?.workoutCategory || '').toString().toUpperCase()

  let circuitType = String(metadata?.circuitType || 'stress').toLowerCase()

  if (wc === 'EMOM') circuitType = 'emom'

  else if (wc === 'AMRAP') circuitType = 'amrap'

  return circuitType

}



/**
 * 모듈/네비게이션 선택용 circuitType 해석.
 * EMOM 운동이 stress 방식이면 'emom-stress'를 반환한다(화면 표시/큐 빌더용 'emom'과 구분).
 * sequences가 주어지면 metadata 유실 시에도 저장 순서로 stress 여부를 추론한다.
 */
export const resolveModuleCircuitType = (
  metadata: { workoutCategory?: unknown; circuitType?: unknown } | null | undefined,
  sequences?: any[],
): string => {
  const base = normalizeCircuitTypeFromMetadata(metadata)
  if (base !== 'emom') return base
  return isEmomStressPlayback(metadata as Record<string, unknown>, sequences ?? [])
    ? 'emom-stress'
    : 'emom'
}



export const createWorkoutModuleForCircuitType = (circuitType: string): WorkoutModule => {

  switch (circuitType) {

    case 'loop':

      return new LoopModule()

    case 'emom':

      return new EmomModule()

    case 'emom-stress':

      return new EmomStressModule()

    case 'amrap':

      return new AmrapModule()

    case 'stress':

    default:

      return new StressModule()

  }

}

export const createPlaybackNavigation = (circuitType: string): PlaybackNavigation => {
  switch (circuitType) {
    case 'loop':
      return new LoopNavigation()
    case 'emom':
      return new EmomNavigation()
    case 'emom-stress':
      return new EmomStressNavigation()
    case 'amrap':
      return new AmrapNavigation()
    case 'stress':
    default:
      return new StressNavigation()
  }
}



export const collectIntroPlaySequences = (circuit: IntroCircuitKind, ctx: IntroSequenceCollectContext): any[] =>

  collectIntroPlayGridSequences(circuit, ctx)



export const buildPreviewMainFirstRoundOrdered = (

  circuit: IntroCircuitKind,

  exercises: any[],

  minRound: number,

  isStretchingRound: boolean,

  firstRoundExercises: any[],

  isStretchingOrCoolDownRound: (r: number) => boolean,

  halfRoundsCount?: number,

): any[] => {

  if (circuit === 'emom') {

    return buildEmomPreviewFirstRoundOrdered(

      exercises,

      minRound,

      isStretchingRound,

      firstRoundExercises,

      isStretchingOrCoolDownRound,

      halfRoundsCount ?? 3,

    )

  }

  if (circuit === 'loop') {

    return buildLoopPreviewFirstRoundOrdered(

      exercises,

      minRound,

      isStretchingRound,

      firstRoundExercises,

      isStretchingOrCoolDownRound,

      halfRoundsCount ?? 3,

    )

  }

  if (circuit === 'amrap') {

    return buildAmrapPreviewFirstRoundOrdered(

      exercises,

      minRound,

      isStretchingRound,

      firstRoundExercises,

    )

  }

  return buildStressPreviewFirstRoundOrdered(

    exercises,

    minRound,

    isStretchingRound,

    firstRoundExercises,

  )

}



export const orderPreviewMainRoundSequences = (

  circuit: IntroCircuitKind,

  round: number,

  roundExercises: any[],

  halfRoundsCount?: number,

): any[] => {

  switch (circuit) {

    case 'loop':

      return orderLoopPreviewSequences(round, roundExercises, halfRoundsCount ?? 3)

    case 'emom':

      return orderEmomPreviewSequences(round, roundExercises, halfRoundsCount ?? 3)

    case 'amrap':

    case 'stress':

    default:

      return sortIntroMainPreviewSequences(roundExercises)

  }

}



export const primeIntroStartPreloadForCircuit = (

  circuit: IntroCircuitKind,

  ctx: WorkoutModuleContext,

  preloadManager: PreloadManager,

  round: number,

): void => {

  switch (circuit) {

    case 'loop':

      primeLoopIntroStartPreload(ctx, preloadManager, round)

      return

    case 'emom':

      primeEmomIntroStartPreload(ctx, preloadManager, round)

      return

    case 'amrap':

      primeAmrapIntroStartPreload(ctx, preloadManager, round)

      return

    case 'stress':

    default:

      primeStressIntroStartPreload(ctx, preloadManager, round)

  }

}



export const applyPreviewLoopPositionHint = (

  circuit: IntroCircuitKind,

  seq: any,

  selectedLength: number,

): void => {

  if (circuit === 'loop') tryAssignLoopPreviewGridPosition(seq, selectedLength)

}



export { getIntroPreviewMaxMainPositions, resolveIntroCircuitKind }

