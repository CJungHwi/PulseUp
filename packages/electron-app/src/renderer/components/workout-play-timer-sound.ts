import { workoutInfoDevLog } from '../workout-dev-log.js'

const FINISH_BELL_SRC = 'assets/sounds/PulseFinishBell.MP3'
const START_BELL_SRC = 'assets/sounds/PulseStartBell.MP3'

/**
 * 동일 src 의 벨이 짧은 시간 내(=같은 카운트다운 tick) 중복 호출되는 것을 막는 임계값.
 * - 모달/타이머 패널/다중 인스턴스 등 어디서 호출되든 한 윈도우에서 한 번만 울리게 보장.
 */
const BELL_DEDUP_WINDOW_MS = 700

type WindowWithBellState = Window & typeof globalThis & {
  __linkhiitBellLastPlayedAt?: Record<string, number>
}

const getBellPlayStateMap = (): Record<string, number> => {
  if (typeof window === 'undefined') return {}
  const w = window as WindowWithBellState
  if (!w.__linkhiitBellLastPlayedAt) {
    w.__linkhiitBellLastPlayedAt = {}
  }
  return w.__linkhiitBellLastPlayedAt
}

/**
 * 워크아웃 타이머용 사운드 매니저.
 *
 * 카운트다운 정책:
 * - 남은 3초: StartBell 1회 (운동/REST/Water Break/처음 시작 카운트다운)
 * - 남은 1초(다음 카운트로 넘어가기 직전): FinishBell 1회
 */
export class WorkoutTimerSound {
  private readonly primedAudios = new Map<string, HTMLAudioElement>()
  private readonly activeAudios = new Set<HTMLAudioElement>()

  constructor() {
    this.setupVisibilityHandler()
  }

  /** 첫 사용자 인터랙션 후 호출 — MP3 파일을 미리 로드 */
  async prime(): Promise<void> {
    this.primeAudio(FINISH_BELL_SRC)
    this.primeAudio(START_BELL_SRC)
  }

  async playFinishBell(): Promise<void> {
    await this.playAudio(FINISH_BELL_SRC, '종료 벨')
  }

  async playStartBell(): Promise<void> {
    await this.playAudio(START_BELL_SRC, '시작 벨')
  }

  /** 다음 구간 진입 시 이전 효과음 즉시 중지 */
  cancelPendingSound(): void {
    this.activeAudios.forEach((audio) => {
      try {
        audio.pause()
        audio.currentTime = 0
      } catch {
      }
    })
    this.activeAudios.clear()
  }

  /** 포커스/가시성 변경 시 외부에서 호출하지 않아도 자동 처리 */
  resumeIfNeeded(): void {
    this.prime().catch(() => {})
    workoutInfoDevLog('🔊 타이머 효과음 preload 확인 (포커스 변경)')
  }

  private setupVisibilityHandler(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' || document.visibilityState === 'hidden') {
        this.resumeIfNeeded()
      }
    })
    window.addEventListener('blur', () => this.resumeIfNeeded())
    window.addEventListener('focus', () => this.resumeIfNeeded())
  }

  private primeAudio(src: string): HTMLAudioElement {
    const cached = this.primedAudios.get(src)
    if (cached) return cached

    const audio = new Audio(src)
    audio.preload = 'auto'
    audio.load()
    this.primedAudios.set(src, audio)
    return audio
  }

  private async playAudio(src: string, label: string): Promise<void> {
    if (this.isDuplicateBellCall(src, label)) return

    try {
      const audio = this.createPlayableAudio(src)
      await audio.play()
    } catch (error) {
      console.error(`${label} 재생 오류:`, error)
    }
  }

  /** 같은 윈도우 안에서 BELL_DEDUP_WINDOW_MS 이내 같은 벨이 재호출되면 두 번째 호출은 무시 */
  private isDuplicateBellCall(src: string, label: string): boolean {
    const playState = getBellPlayStateMap()
    const now = Date.now()
    const last = playState[src] ?? 0
    const elapsed = now - last

    if (elapsed < BELL_DEDUP_WINDOW_MS) {
      workoutInfoDevLog(`🔇 ${label} 중복 호출 무시 (${elapsed}ms < ${BELL_DEDUP_WINDOW_MS}ms)`)
      return true
    }

    playState[src] = now
    return false
  }

  private createPlayableAudio(src: string): HTMLAudioElement {
    const template = this.primeAudio(src)
    const audio = template.cloneNode(true) as HTMLAudioElement
    audio.preload = 'auto'
    audio.volume = 1
    audio.currentTime = 0
    audio.onended = () => this.activeAudios.delete(audio)
    audio.onerror = () => this.activeAudios.delete(audio)
    this.activeAudios.add(audio)
    return audio
  }
}
