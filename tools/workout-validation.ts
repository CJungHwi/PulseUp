import type { Exercise as WebExercise, PanelRow } from '../packages/web-app/src/pages/exercises/Totalexercises/types'
import type { WorkoutExerciseItem } from '../packages/web-app/src/pages/exercises/Totalexercises/save-workout/save-types'
import {
  generateWorkoutExercises,
  generateWorkoutExercisesForTimeStructured,
} from '../packages/web-app/src/pages/exercises/Totalexercises/save-workout/workout-exercise-helpers'
import type { ExerciseSequence, WorkoutPlaySession } from '../packages/electron-app/src/main/types'
import type { WorkoutModuleContext } from '../packages/electron-app/src/main/workout-modules/circuits/shared/base-module'
import { PreloadManager } from '../packages/electron-app/src/main/workout-modules/circuits/shared/preload-manager'
import { preloadStressFromTimeline, preloadNextStressGroup, preloadCoolDownForStress } from '../packages/electron-app/src/main/workout-modules/circuits/stress/stress-preload'
import {
  preloadLoopFromTimeline,
  preloadNextLoopGroup,
  preloadCoolDownForLoop,
  preloadNextLoopGroupDuringWater,
} from '../packages/electron-app/src/main/workout-modules/circuits/loop/loop-preload'
import { preloadAmrapFromTimeline } from '../packages/electron-app/src/main/workout-modules/circuits/amrap/amrap-preload'
import {
  preloadEmomFromTimeline,
  preloadNextEmomGroup,
  preloadCoolDownForEmom,
  preloadNextEmomGroupDuringWater,
} from '../packages/electron-app/src/main/workout-modules/circuits/emom/emom-preload'

type BroadcastEvent = {
  channel: string
  data: any
}

type ValidationResult = {
  title: string
  lines: string[]
  failedChecks: string[]
}

const makeExercises = (positions: string[], reps = 10): WebExercise[] =>
  positions.map((position, index) => ({
    id: `ex-${index + 1}`,
    originalExerciseId: `ex-${index + 1}`,
    name_ko: position,
    name_en: position,
    level: 'beginner',
    duration: 30,
    major_category: 'MAIN',
    position,
    reps,
  }))

const makePanelRow = (
  round: number,
  time: number,
  rest: number,
  waterBreak: number,
  type: string,
): PanelRow => ({
  id: `${type}-${round}`,
  round,
  time,
  rest,
  waterBreak,
  type,
})

const toElectronSequence = (item: WorkoutExerciseItem): ExerciseSequence => ({
  id: `seq-${item.sequence}`,
  workout_history_master_id: 'validation',
  sequence: item.sequence,
  round: item.round,
  exercise_type: item.exercise_type,
  exercise_id: item.exercise_id ?? undefined,
  exercise_name: item.name,
  duration: item.duration,
  reps: item.reps,
  position: item.position ?? undefined,
})

const makeCooldownSequences = (): ExerciseSequence[] =>
  ['CD1', 'CD2', 'CD3'].map((position, index) => ({
    id: `cd-${index + 1}`,
    workout_history_master_id: 'validation',
    sequence: 900 + index,
    round: 99,
    exercise_type: 'exercise',
    exercise_id: `cd-${index + 1}`,
    exercise_name: position,
    duration: 30,
    position,
  }))

const makeSession = (
  sequences: ExerciseSequence[],
  circuitType: 'stress' | 'loop' | 'amrap' | 'emom',
  totalSets: number,
): WorkoutPlaySession => ({
  masterId: 'validation-master',
  userId: 'validation-user',
  sequences,
  currentSequenceIndex: 0,
  currentRound: 1,
  totalRounds: Math.max(
    1,
    ...sequences.filter((seq) => seq.round > 0 && seq.round < 99).map((seq) => seq.round),
  ),
  startTime: new Date(),
  elapsedTime: 0,
  status: 'ready',
  metadata: {
    circuitType,
    totalSets,
  },
})

const makeContext = (session: WorkoutPlaySession) => {
  const broadcasts: BroadcastEvent[] = []
  const ctx: WorkoutModuleContext = {
    activePlaySession: session,
    playTimer: null,
    preloadedGroupKeys: new Set<string>(),
    _lastStressGroupIndex: 0,
    _lastAmrapMainRoundNumber: null,
    broadcastToAllWindows: (channel, data) => {
      broadcasts.push({ channel, data })
    },
    isStretchingOrCoolDownRound: (round) => round === 0 || round === 99,
    getPlayableMainExercisesByRound: (round) =>
      session.sequences.filter(
        (seq) =>
          seq.round === round &&
          seq.exercise_type === 'exercise' &&
          seq.exercise_name !== '임시운동' &&
          seq.duration > 0,
      ),
    getNextMainRoundAfter: (round) => {
      const rounds = Array.from(
        new Set(
          session.sequences
            .filter((seq) => seq.round > 0 && seq.round < 99)
            .map((seq) => Number(seq.round)),
        ),
      ).sort((a, b) => a - b)
      return rounds.find((value) => value > round) ?? null
    },
    getRoundMajorCategory: (round) => {
      if (round === 0) return 'DS'
      if (round === 99) return 'CD'
      return 'MAIN'
    },
    setPlayTimer: (timer) => {
      ctx.playTimer = timer
    },
    setLastStressGroupIndex: (index) => {
      ctx._lastStressGroupIndex = index
    },
    setLastAmrapMainRoundNumber: (round) => {
      ctx._lastAmrapMainRoundNumber = round
    },
  }
  return { ctx, broadcasts }
}

const summarizeItems = (items: WorkoutExerciseItem[]): string[] => {
  const lines: string[] = []
  let currentRound = -1
  const chunks: string[] = []

  items.forEach((item) => {
    if (item.round !== currentRound) {
      if (chunks.length > 0) {
        lines.push(`  Round ${currentRound}: ${chunks.join(' -> ')}`)
      }
      currentRound = item.round
      chunks.length = 0
    }
    chunks.push(
      item.exercise_type === 'exercise'
        ? `${item.name}(${item.duration}s)`
        : `${item.name}(${item.duration}s)`,
    )
  })

  if (chunks.length > 0) {
    lines.push(`  Round ${currentRound}: ${chunks.join(' -> ')}`)
  }
  return lines
}

const summarizeBroadcasts = (events: BroadcastEvent[]): string[] =>
  events.map((event, index) => {
    const sequences = Array.isArray(event.data?.sequences)
      ? event.data.sequences.map((seq: any) => seq.position || seq.exercise_name).join(', ')
      : '-'
    return `  [${index + 1}] ${event.channel} | round=${event.data?.round ?? '-'} | group=${event.data?.groupIndex ?? '-'} | sequences=${sequences}`
  })

const assertCheck = (condition: boolean, message: string, failedChecks: string[]) => {
  if (!condition) {
    failedChecks.push(message)
  }
}

const buildSequenceCases = (): ValidationResult[] => {
  const l1ToR1 = ['L1', 'L2', 'L3', 'R1', 'R2', 'R3']
  const l1ToR4 = ['L1', 'L2', 'L3', 'R1', 'R2', 'R3', 'L4', 'L5', 'L6', 'R4', 'R5', 'R6']
  const results: ValidationResult[] = []

  {
    const items = generateWorkoutExercises(
      [
        makePanelRow(1, 60, 20, 0, 'stress'),
        makePanelRow(2, 40, 15, 0, 'stress'),
        makePanelRow(3, 20, 10, 60, 'stress'),
      ],
      makeExercises(l1ToR1),
      [],
      [],
      'stress',
    )
    const failedChecks: string[] = []
    assertCheck(items.some((item) => item.exercise_type === 'water') === false, 'Stress 6개는 water가 없어야 함', failedChecks)
    results.push({
      title: 'Stress 6개 / 3라운드',
      lines: summarizeItems(items),
      failedChecks,
    })
  }

  {
    const items = generateWorkoutExercises(
      [
        makePanelRow(1, 60, 20, 0, 'stress'),
        makePanelRow(2, 40, 15, 0, 'stress'),
        makePanelRow(3, 20, 10, 60, 'stress'),
      ],
      makeExercises(l1ToR4),
      [],
      [],
      'stress',
    )
    const failedChecks: string[] = []
    const waters = items.filter((item) => item.exercise_type === 'water')
    assertCheck(waters.length === 1, 'Stress 12개는 전/후반 사이 water 1회여야 함', failedChecks)
    assertCheck(waters[0]?.round === 3, 'Stress water는 마지막 플랜 round(3)에 붙어야 함', failedChecks)
    results.push({
      title: 'Stress 12개 / 전후반 분리',
      lines: summarizeItems(items),
      failedChecks,
    })
  }

  {
    const items = generateWorkoutExercises(
      [
        makePanelRow(1, 60, 20, 0, 'loop'),
        makePanelRow(2, 60, 20, 0, 'loop'),
        makePanelRow(3, 60, 20, 60, 'loop'),
      ],
      makeExercises(l1ToR1),
      [],
      [],
      'loop',
    )
    const failedChecks: string[] = []
    assertCheck(items.some((item) => item.exercise_type === 'water') === false, 'Loop 6개는 마지막 water가 없어야 함', failedChecks)
    results.push({
      title: 'Loop 6개 / 마지막 water 생략',
      lines: summarizeItems(items),
      failedChecks,
    })
  }

  {
    const items = generateWorkoutExercises(
      [
        makePanelRow(1, 60, 20, 0, 'loop'),
        makePanelRow(2, 60, 20, 0, 'loop'),
        makePanelRow(3, 60, 20, 60, 'loop'),
      ],
      makeExercises(l1ToR4),
      [],
      [],
      'loop',
    )
    const failedChecks: string[] = []
    const water = items.find((item) => item.exercise_type === 'water')
    assertCheck(!!water, 'Loop 12개는 전/후반 사이 water가 있어야 함', failedChecks)
    assertCheck(water?.round === 3, 'Loop water는 round 3에 붙어야 함', failedChecks)
    results.push({
      title: 'Loop 12개 / 전후반 water',
      lines: summarizeItems(items),
      failedChecks,
    })
  }

  {
    const items = generateWorkoutExercisesForTimeStructured(
      [makePanelRow(1, 10, 1, 0, 'AMRAP')],
      makeExercises(l1ToR1, 12),
      'AMRAP',
    )
    const failedChecks: string[] = []
    assertCheck(items.every((item) => item.exercise_type === 'exercise'), 'AMRAP 1패널 6개는 exercise만 있어야 함', failedChecks)
    results.push({
      title: 'AMRAP 1패널 / 운동 6개',
      lines: summarizeItems(items),
      failedChecks,
    })
  }

  {
    const items = generateWorkoutExercisesForTimeStructured(
      [
        makePanelRow(1, 10, 1, 1, 'AMRAP'),
        makePanelRow(2, 5, 0, 0, 'AMRAP'),
      ],
      makeExercises(l1ToR4, 12),
      'AMRAP',
    )
    const failedChecks: string[] = []
    assertCheck(items.some((item) => item.exercise_type === 'water'), 'AMRAP 2패널 12개는 water가 있어야 함', failedChecks)
    results.push({
      title: 'AMRAP 2패널 / 운동 12개',
      lines: summarizeItems(items),
      failedChecks,
    })
  }

  {
    const items = generateWorkoutExercisesForTimeStructured(
      [
        makePanelRow(1, 3, 0, 0, 'EMOM'),
        makePanelRow(2, 2, 0, 0, 'EMOM'),
        makePanelRow(3, 1, 1, 0, 'EMOM'),
      ],
      makeExercises(l1ToR1, 10),
      'EMOM',
    )
    const failedChecks: string[] = []
    assertCheck(items.every((item) => item.exercise_type === 'exercise'), 'EMOM 6개는 마지막 rest/water가 없어야 함', failedChecks)
    results.push({
      title: 'EMOM 6개 / 후반전 없음',
      lines: summarizeItems(items),
      failedChecks,
    })
  }

  {
    const items = generateWorkoutExercisesForTimeStructured(
      [
        makePanelRow(1, 3, 0, 0, 'EMOM'),
        makePanelRow(2, 2, 0, 0, 'EMOM'),
        makePanelRow(3, 1, 0, 1, 'EMOM'),
      ],
      makeExercises(l1ToR4, 10),
      'EMOM',
    )
    const failedChecks: string[] = []
    const water = items.find((item) => item.exercise_type === 'water')
    assertCheck(!!water, 'EMOM 12개 / water 케이스는 round 3 끝 water가 있어야 함', failedChecks)
    assertCheck(water?.round === 3, 'EMOM water는 round 3에 붙어야 함', failedChecks)
    results.push({
      title: 'EMOM 12개 / round 3 water',
      lines: summarizeItems(items),
      failedChecks,
    })
  }

  {
    const items = generateWorkoutExercisesForTimeStructured(
      [
        makePanelRow(1, 3, 0, 0, 'EMOM'),
        makePanelRow(2, 2, 0, 0, 'EMOM'),
        makePanelRow(3, 1, 1, 0, 'EMOM'),
      ],
      makeExercises(l1ToR4, 10),
      'EMOM',
    )
    const failedChecks: string[] = []
    const rest = items.find((item) => item.exercise_type === 'rest')
    assertCheck(!!rest, 'EMOM 12개 / water 없이 rest만 있으면 round 3 끝 rest가 있어야 함', failedChecks)
    assertCheck(rest?.round === 3, 'EMOM rest는 round 3에 붙어야 함', failedChecks)
    results.push({
      title: 'EMOM 12개 / round 3 rest',
      lines: summarizeItems(items),
      failedChecks,
    })
  }

  return results
}

const buildPreloadCases = (): ValidationResult[] => {
  const l1ToR4 = ['L1', 'L2', 'L3', 'R1', 'R2', 'R3', 'L4', 'L5', 'L6', 'R4', 'R5', 'R6']
  const results: ValidationResult[] = []
  const preloadManager = new PreloadManager()

  const loopItems = generateWorkoutExercises(
    [
      makePanelRow(1, 60, 20, 0, 'loop'),
      makePanelRow(2, 60, 20, 0, 'loop'),
      makePanelRow(3, 60, 20, 60, 'loop'),
    ],
    makeExercises(l1ToR4),
    [],
    [],
    'loop',
  )
  const emomItems = generateWorkoutExercisesForTimeStructured(
    [
      makePanelRow(1, 3, 0, 0, 'EMOM'),
      makePanelRow(2, 2, 0, 0, 'EMOM'),
      makePanelRow(3, 1, 0, 1, 'EMOM'),
    ],
    makeExercises(l1ToR4, 10),
    'EMOM',
  )
  const stressItems = generateWorkoutExercises(
    [
      makePanelRow(1, 60, 20, 0, 'stress'),
      makePanelRow(2, 40, 15, 0, 'stress'),
      makePanelRow(3, 20, 10, 60, 'stress'),
    ],
    makeExercises(l1ToR4),
    [],
    [],
    'stress',
  )
  const amrapItems = generateWorkoutExercisesForTimeStructured(
    [
      makePanelRow(1, 10, 1, 1, 'AMRAP'),
      makePanelRow(2, 5, 0, 0, 'AMRAP'),
    ],
    makeExercises(l1ToR4, 12),
    'AMRAP',
  )

  {
    const session = makeSession(stressItems.map(toElectronSequence), 'stress', 3)
    const { ctx, broadcasts } = makeContext(session)
    preloadStressFromTimeline(ctx, 0)
    const failedChecks: string[] = []
    assertCheck(broadcasts.length === 1, 'Stress timeline preload는 1건 broadcast여야 함', failedChecks)
    results.push({
      title: 'Preload / Stress timeline',
      lines: summarizeBroadcasts(broadcasts),
      failedChecks,
    })
  }

  {
    const session = makeSession(amrapItems.map(toElectronSequence), 'amrap', 2)
    const { ctx, broadcasts } = makeContext(session)
    preloadAmrapFromTimeline(ctx, 0)
    const failedChecks: string[] = []
    assertCheck(broadcasts.length === 1, 'AMRAP timeline preload는 1건 broadcast여야 함', failedChecks)
    results.push({
      title: 'Preload / AMRAP timeline',
      lines: summarizeBroadcasts(broadcasts),
      failedChecks,
    })
  }

  {
    const session = makeSession(
      [...loopItems.map(toElectronSequence), ...makeCooldownSequences()],
      'loop',
      3,
    )
    const { ctx, broadcasts } = makeContext(session)
    preloadLoopFromTimeline(ctx, 0)
    preloadNextLoopGroup(ctx, 0, 1)
    preloadCoolDownForLoop(ctx, preloadManager)
    const waterIndex = session.sequences.findIndex((seq) => seq.exercise_type === 'water')
    if (waterIndex >= 0) {
      preloadNextLoopGroupDuringWater(ctx, session.sequences[waterIndex], waterIndex, 3)
    }
    const failedChecks: string[] = []
    assertCheck(broadcasts.some((event) => event.channel === 'workout-play-preload'), 'Loop preload broadcast가 있어야 함', failedChecks)
    assertCheck(
      broadcasts.some((event) =>
        Array.isArray(event.data?.sequences) &&
        event.data.sequences.some((seq: any) => seq.position === 'L4'),
      ),
      'Loop 다음 그룹 preload는 L4 그룹을 포함해야 함',
      failedChecks,
    )
    assertCheck(
      broadcasts.some((event) => event.data?.stretchingMode === true),
      'Loop CD preload는 stretchingMode=true 여야 함',
      failedChecks,
    )
    results.push({
      title: 'Preload / Loop timeline + next group + water + CD',
      lines: summarizeBroadcasts(broadcasts),
      failedChecks,
    })
  }

  {
    const session = makeSession(
      [...emomItems.map(toElectronSequence), ...makeCooldownSequences()],
      'emom',
      3,
    )
    const { ctx, broadcasts } = makeContext(session)
    preloadEmomFromTimeline(ctx, 0)
    preloadNextEmomGroup(ctx, 0, 1)
    preloadCoolDownForEmom(ctx, preloadManager)
    const waterIndex = session.sequences.findIndex((seq) => seq.exercise_type === 'water')
    if (waterIndex >= 0) {
      preloadNextEmomGroupDuringWater(ctx, session.sequences[waterIndex], waterIndex, 3)
    }
    const failedChecks: string[] = []
    assertCheck(broadcasts.some((event) => event.channel === 'workout-play-preload'), 'EMOM preload broadcast가 있어야 함', failedChecks)
    assertCheck(
      broadcasts.some((event) =>
        Array.isArray(event.data?.sequences) &&
        event.data.sequences.some((seq: any) => seq.position === 'L4'),
      ),
      'EMOM 다음 그룹 preload는 L4 그룹을 포함해야 함',
      failedChecks,
    )
    assertCheck(
      broadcasts.some((event) => event.data?.stretchingMode === true),
      'EMOM CD preload는 stretchingMode=true 여야 함',
      failedChecks,
    )
    results.push({
      title: 'Preload / EMOM timeline + next group + water + CD',
      lines: summarizeBroadcasts(broadcasts),
      failedChecks,
    })
  }

  return results
}

const printResult = (result: ValidationResult) => {
  const status = result.failedChecks.length === 0 ? 'PASS' : 'FAIL'
  console.log(`\n## ${status} | ${result.title}`)
  result.lines.forEach((line) => console.log(line))
  if (result.failedChecks.length > 0) {
    console.log('  실패:')
    result.failedChecks.forEach((check) => console.log(`  - ${check}`))
  }
}

const main = () => {
  const sequenceResults = buildSequenceCases()
  const preloadResults = buildPreloadCases()
  const allResults = [...sequenceResults, ...preloadResults]
  allResults.forEach(printResult)

  const totalFailures = allResults.reduce(
    (sum, result) => sum + result.failedChecks.length,
    0,
  )
  console.log(`\n총 검증 케이스: ${allResults.length}, 실패 체크: ${totalFailures}`)

  if (totalFailures > 0) {
    process.exitCode = 1
  }
}

main()
