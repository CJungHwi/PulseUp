/**
 * 인트로 → 운동 시작 검증.
 * - http: 실 Electron `127.0.0.1:3002` — `play-intro` 후 짧은 대기 뒤 **인트로 중** `play-start` 한 번.
 * - sim: WorkoutPlayService 직접 호출, HTTP와 동일 시나리오(인트로 종료 notify 없이 시작).
 * 전 서킷 공통: 스플래시·2초·카운트다운 (`intro-dismissed-to-ready` / 두 번째 play-start 없음).
 */
import { generateWorkoutExercises, generateWorkoutExercisesForTimeStructured } from '../packages/web-app/src/pages/exercises/Totalexercises/save-workout/workout-exercise-helpers'
import type { Exercise as WebExercise, PanelRow } from '../packages/web-app/src/pages/exercises/Totalexercises/types'
import type { WorkoutExerciseItem } from '../packages/web-app/src/pages/exercises/Totalexercises/save-workout/save-types'
import { WorkoutPlayService } from '../packages/electron-app/src/main/workout-play-service'
import type { ExerciseSequence } from '../packages/electron-app/src/main/types'

type CircuitKind = 'stress' | 'loop' | 'amrap' | 'emom'

type BroadcastEvent = {
  channel: string
  data: any
}

type RuntimeCase = {
  title: string
  kind: CircuitKind
  metadata: Record<string, any>
  sequences: ExerciseSequence[]
}

const TIME_SCALE = 0.01
const realSetTimeout = global.setTimeout
const realClearTimeout = global.clearTimeout

const sleep = (ms: number) => new Promise((resolve) => realSetTimeout(resolve, ms))

const makePanel = (
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

const makeExercises = (positions: string[], reps = 10): WebExercise[] =>
  positions.map((position, index) => ({
    id: `ex-${index + 1}`,
    originalExerciseId: `ex-${index + 1}`,
    name_ko: position,
    name_en: position,
    level: 'beginner',
    duration: 1,
    major_category: 'MAIN',
    position,
    reps,
  }))

const toElectronMainSequence = (
  item: WorkoutExerciseItem,
  majorCategory: string,
): ExerciseSequence => ({
  id: `main-${item.sequence}`,
  workout_history_master_id: 'runtime-validation',
  sequence: item.sequence,
  round: item.round,
  exercise_type: item.exercise_type,
  exercise_id: item.exercise_id ?? undefined,
  exercise_name: item.name,
  duration: item.duration,
  reps: item.reps,
  position: item.position ?? undefined,
  major_category: majorCategory,
})

const makeStretchingSequences = (
  prefix: 'DS' | 'CD',
  round: 0 | 99,
  startSequence: number,
): ExerciseSequence[] =>
  [1, 2, 3].map((index) => ({
    id: `${prefix}-${index}`,
    workout_history_master_id: 'runtime-validation',
    sequence: startSequence + index - 1,
    round,
    exercise_type: 'exercise',
    exercise_id: `${prefix}-${index}`,
    exercise_name: `${prefix}${index}`,
    duration: 1,
    position: `${prefix}${index}`,
    major_category: prefix === 'DS' ? 'dynamic_stretching' : 'cool_down',
  }))

const normalizeCategory = (input: unknown): string =>
  String(input || '').trim().toLowerCase().replace(/\s+/g, '_')

const isStretchingCategory = (category: string): boolean =>
  ['dynamic_stretching', 'ds', 'stretching', '동적스트레칭', '동적_스트레칭'].includes(
    normalizeCategory(category),
  )

const isCoolDownCategory = (category: string): boolean =>
  ['cool_down', 'cd', 'cooldown', '쿨다운', '정리운동', '정리_운동'].includes(
    normalizeCategory(category),
  )

const buildDeps = (events: BroadcastEvent[]) => ({
  broadcastToAllWindows: (channel: string, data: any) => {
    events.push({ channel, data })
  },
  fetchWithTimeout: async () => new Response(null, { status: 200 }),
  buildAuthHeaders: () => ({}),
  getWebAppUrl: () => 'http://localhost:3001',
  hasVideoUrl: () => true,
  fetchExerciseVideoUrl: async () => null,
  normalizeMajorCategory: normalizeCategory,
  isStretchingCategory,
  isCoolDownCategory,
  isStretchingOrCoolDownRound: (round: number) => round === 0 || round === 99,
  getPlayableMainExercisesByRound: (round: number) => {
    const session = playService.activePlaySession
    if (!session) return []
    return session.sequences.filter(
      (seq) =>
        Number(seq.round) === round &&
        seq.exercise_type === 'exercise' &&
        seq.exercise_name !== '임시운동' &&
        seq.duration > 0 &&
        round > 0 &&
        round < 99,
    )
  },
  getNextMainRoundAfter: (round: number) => {
    const session = playService.activePlaySession
    if (!session) return null
    const rounds = Array.from(
      new Set(
        session.sequences
          .filter((seq) => Number(seq.round) > 0 && Number(seq.round) < 99)
          .map((seq) => Number(seq.round)),
      ),
    ).sort((a, b) => a - b)
    return rounds.find((value) => value > round) ?? null
  },
  getRoundMajorCategory: (round: number) => {
    const session = playService.activePlaySession
    if (!session) return ''
    return normalizeCategory(
      session.sequences.find(
        (seq) => Number(seq.round) === round && seq.exercise_type === 'exercise',
      )?.major_category || '',
    )
  },
})

let playService: WorkoutPlayService

const createRuntimeCase = (kind: CircuitKind): RuntimeCase => {
  const positions6 = ['L1', 'L2', 'L3', 'R1', 'R2', 'R3']
  const positions12 = [...positions6, 'L4', 'L5', 'L6', 'R4', 'R5', 'R6']

  if (kind === 'stress') {
    const main = generateWorkoutExercises(
      [
        makePanel(1, 1, 1, 0, 'stress'),
        makePanel(2, 1, 1, 0, 'stress'),
        makePanel(3, 1, 1, 1, 'stress'),
      ],
      makeExercises(positions12),
      [],
      [],
      'stress',
    ).map((item) => toElectronMainSequence(item, 'main'))

    return {
      title: 'Stress',
      kind,
      metadata: { workoutCategory: 'MAIN', circuitType: 'stress', totalRounds: 6, totalSets: 3, workoutPlans: [{}, {}, {}] },
      sequences: [...makeStretchingSequences('DS', 0, 1), ...main, ...makeStretchingSequences('CD', 99, 1000)],
    }
  }

  if (kind === 'loop') {
    const main = generateWorkoutExercises(
      [
        makePanel(1, 1, 1, 0, 'loop'),
        makePanel(2, 1, 1, 0, 'loop'),
        makePanel(3, 1, 1, 1, 'loop'),
      ],
      makeExercises(positions12),
      [],
      [],
      'loop',
    ).map((item) => toElectronMainSequence(item, 'main'))

    return {
      title: 'Loop',
      kind,
      metadata: { workoutCategory: 'MAIN', circuitType: 'loop', totalRounds: 6, totalSets: 3, workoutPlans: [{}, {}, {}] },
      sequences: [...makeStretchingSequences('DS', 0, 1), ...main, ...makeStretchingSequences('CD', 99, 1000)],
    }
  }

  if (kind === 'amrap') {
    const main = generateWorkoutExercisesForTimeStructured(
      [makePanel(1, 1, 1, 1, 'AMRAP'), makePanel(2, 1, 0, 0, 'AMRAP')],
      makeExercises(positions12, 12),
      'AMRAP',
    ).map((item) => toElectronMainSequence(item, 'amrap'))

    return {
      title: 'AMRAP',
      kind,
      metadata: { workoutCategory: 'AMRAP', circuitType: 'amrap', totalRounds: 2, totalSets: 2, workoutPlans: [{}, {}] },
      sequences: [...makeStretchingSequences('DS', 0, 1), ...main, ...makeStretchingSequences('CD', 99, 1000)],
    }
  }

  const main = generateWorkoutExercisesForTimeStructured(
    [
      makePanel(1, 1, 0, 0, 'EMOM'),
      makePanel(2, 1, 0, 0, 'EMOM'),
      makePanel(3, 1, 0, 1, 'EMOM'),
    ],
    makeExercises(positions12, 10),
    'EMOM',
  ).map((item) => toElectronMainSequence(item, 'emom'))

  return {
    title: 'EMOM',
    kind,
    metadata: { workoutCategory: 'EMOM', circuitType: 'emom', totalRounds: 6, totalSets: 3, workoutPlans: [{}, {}, {}] },
    sequences: [...makeStretchingSequences('DS', 0, 1), ...main, ...makeStretchingSequences('CD', 99, 1000)],
  }
}

const summarizeCase = (title: string, events: BroadcastEvent[], logs: string[]) => {
  const eventSummary = events
    .filter((event) =>
      [
        'intro-started',
        'countdown-started',
        'workout-play-preview',
        'workout-play-preload',
        'workout-play-started',
        'workout-play-sequence',
        'workout-advance-slots',
      ].includes(event.channel),
    )
    .map((event) => {
      const seqs = Array.isArray(event.data?.sequences)
        ? event.data.sequences
            .slice(0, 6)
            .map((seq: any) => seq.position || seq.exercise_name)
            .join(', ')
        : ''
      const seqName =
        event.channel === 'workout-play-sequence'
          ? `${event.data?.sequence?.exercise_type}:${event.data?.sequence?.position || event.data?.sequence?.exercise_name}`
          : ''
      const extra =
        event.channel === 'intro-cancelled-reset-to-ready'
          ? `showSplash=${event.data?.showSplash}`
          : event.channel === 'workout-play-clear-preload'
            ? `preservePreload=${event.data?.preservePreloadCache}`
            : ''
      return `- ${event.channel} | round=${event.data?.round ?? '-'} | ${extra || seqName || seqs}`
    })

  const keyLogs = logs.filter(
    (line) =>
      line.includes('[IntroStart]') ||
      line.includes('인트로 중 운동 시작') ||
      line.includes('인트로 후 운동 시작') ||
      line.includes('[ReadyModule]') ||
      line.includes('[LoopModule]') ||
      line.includes('[EmomModule]') ||
      line.includes('[StressModule]') ||
      line.includes('[AmrapModule]') ||
      line.includes('[WorkoutPlay][circuit]'),
  )

  console.log(`\n## ${title}`)
  console.log('### Broadcasts')
  eventSummary.slice(0, 20).forEach((line) => console.log(line))
  console.log('### Logs')
  keyLogs.slice(0, 20).forEach((line) => console.log(`- ${line}`))
}

const postJson = async (path: string, body?: Record<string, any>) => {
  const response = await fetch(`http://127.0.0.1:3002${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Server-URL': 'http://localhost:3001',
    },
    body: body ? JSON.stringify(body) : JSON.stringify({}),
  })
  const text = await response.text()
  return {
    status: response.status,
    ok: response.ok,
    text,
  }
}

const runHttpCase = async (runtimeCase: RuntimeCase, waitAfterStartMs: number) => {
  const startPlay = await postJson('/start-workout-play', {
    masterId: `http-${runtimeCase.kind}`,
    userId: `user-${runtimeCase.kind}`,
    sequences: runtimeCase.sequences,
    metadata: runtimeCase.metadata,
  })
  console.log(`HTTP ${runtimeCase.title} /start-workout-play`, startPlay.status, startPlay.text)

  const intro = await postJson('/play-intro')
  console.log(`HTTP ${runtimeCase.title} /play-intro`, intro.status, intro.text)

  await sleep(800)

  const firstStart = await postJson('/play-start')
  console.log(
    `HTTP ${runtimeCase.title} /play-start (인트로 중·전 서킷 동일: 스플래시→2초→카운트다운·한 번만 호출)`,
    firstStart.status,
    firstStart.text,
  )
  if (firstStart.text.includes('intro-dismissed-to-ready')) {
    console.warn(
      `[검증 경고] ${runtimeCase.title}: 응답에 intro-dismissed-to-ready 가 남아 있음 — 구현에서 제거됐어야 함`,
    )
  }

  await sleep(waitAfterStartMs)

  const stop = await postJson('/play-stop')
  console.log(`HTTP ${runtimeCase.title} /play-stop`, stop.status, stop.text)
}

const runCase = async (runtimeCase: RuntimeCase, waitAfterStartMs: number) => {
  const events: BroadcastEvent[] = []
  const logs: string[] = []
  playService = new WorkoutPlayService(buildDeps(events))

  const originalLog = console.log
  const originalWarn = console.warn
  const originalError = console.error

  const pushLog =
    (target: (...args: any[]) => void) =>
    (...args: any[]) => {
      const line = args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ')
      logs.push(line)
      target(...args)
    }

  console.log = pushLog(originalLog)
  console.warn = pushLog(originalWarn)
  console.error = pushLog(originalError)

  try {
    await playService.handleWorkoutPlay({
      masterId: `master-${runtimeCase.kind}`,
      userId: `user-${runtimeCase.kind}`,
      sequences: runtimeCase.sequences,
      metadata: runtimeCase.metadata,
    })
    await playService.handlePlayIntro()
    await sleep(800)
    // HTTP 모드와 동일: 인트로 재생 중(handleIntroPlaybackEnded 없이) play-start
    await playService.handlePlayStart()
    await sleep(waitAfterStartMs)
    playService.stopPlaySession()
    await sleep(50)
  } finally {
    console.log = originalLog
    console.warn = originalWarn
    console.error = originalError
  }

  summarizeCase(runtimeCase.title, events, logs)
}

const main = async () => {
  global.setTimeout = ((handler: any, timeout?: any, ...args: any[]) =>
    realSetTimeout(handler, Number(timeout || 0) * TIME_SCALE, ...args)) as typeof setTimeout
  global.clearTimeout = realClearTimeout

  const mode = process.argv[2] === 'http' ? 'http' : 'sim'
  const selectedCase = (mode === 'http' ? process.argv[3] : process.argv[2]) as CircuitKind | undefined
  const waitAfterStartMs = Number(mode === 'http' ? process.argv[4] || '9000' : process.argv[3] || '9000')
  const cases: CircuitKind[] = selectedCase
    ? [selectedCase]
    : ['stress', 'loop', 'amrap', 'emom']
  for (const kind of cases) {
    if (mode === 'http') {
      await runHttpCase(createRuntimeCase(kind), waitAfterStartMs)
    } else {
      await runCase(createRuntimeCase(kind), waitAfterStartMs)
    }
  }

  global.setTimeout = realSetTimeout
  global.clearTimeout = realClearTimeout
}

void main()
