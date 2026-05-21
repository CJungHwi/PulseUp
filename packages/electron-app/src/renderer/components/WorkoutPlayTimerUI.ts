/// <reference path="../../types/electron.d.ts" />

import {
  applyTimerHeaderStrip,
  renderSetLapBlock,
  renderTimerHeaderIdle,
} from './timer-header-display.js'
import { WorkoutHeartRatePanel } from '../heart-rate-modules/workout-heart-rate-panel.js'
import { getTimerStripPlanDenominator } from '../circuits/emom/intro-panel-emom.js'
import { getTimerUiStrategy } from '../circuits/timer-ui-registry.js'
import {
  resolveTimerCircuitType,
  resolveWorkoutCircuitType,
  type WorkoutCircuitType,
} from './workout-timer-circuit.js'
import { createWorkoutPlayTimerHtml } from './workout-play-timer-layout.js'
import type { TimerIntroDiagramScreenMode } from '../circuits/shared/timer-layout-flow-diagram.js'
import { WorkoutTimerSound } from './workout-play-timer-sound.js'
import { workoutInfoDevLog } from '../workout-dev-log.js'
import {
  adjustActivityLabelFontSize,
  adjustCategoryFontSize,
} from './workout-play-timer-dom-fit.js'
import { showWorkoutTimerIntroMode } from './workout-play-timer-intro-mode.js'
import { updateWorkoutTimerActivityLabel } from './workout-play-timer-activity-label.js'
import {
  resumeSequenceCountdown,
  startPreWorkoutCountdown,
  startSequenceCountdown,
  updateTimerCountdownDisplay,
  type WorkoutTimerCountdownDeps,
} from './workout-play-timer-countdown.js'

export class WorkoutPlayTimerUI {
  private container: HTMLElement
  private readonly heartRatePanel = new WorkoutHeartRatePanel()
  private currentRound: number = 1
  private totalRounds: number = 1
  private countdown: number = 0
  private countdownInterval: NodeJS.Timeout | null = null
  private activityType: string = 'MAIN'
  private isStartCountdown: boolean = false // 시작 카운트다운 플래그
  private exerciseCount: number = 0 // 운동 카운트수
  private totalWorkoutTime: number = 0 // 전체 운동시간 (초)
  private workoutStartTime: Date | null = null // 운동 시작 시간
  private pauseStartedAt: number = 0 // 일시정지가 시작된 시각 (ms)
  private lastCountedExercise: string = '' // 마지막 카운트한 운동 추적 (중복 방지)
  private currentTimeInterval: NodeJS.Timeout | null = null // 현재시간 업데이트 인터벌
  private mainCategorySet: boolean = false // Main 운동 카테고리가 설정되었는지 추적
  private readonly sound = new WorkoutTimerSound()
  private readonly defaultCountdownFontSize = 'clamp(120px, 35vw, 450px)'
  private amrapRoundDurationMin: number = 0
  /** IPC에 circuitType이 빠질 때 MM:SS/서킷 표시가 깨지지 않도록 유지 */
  private stickyCircuitType: WorkoutCircuitType | null = null
  private currentCircuitType: string = ''
  private currentSequenceType: string = ''
  /** DS(0) / CD(99) 여부 — EMOM·AMRAP도 해당 구간은 초 단위 표시 */
  private countdownViewRound: number = 0
  /** workout-play-sequence / 인트로 메타 — 타이머 RND·SET 분모(workoutPlans.length)용 */
  private playSessionMetadata: Record<string, unknown> | null = null
  /** EMOM·AMRAP 메인 구간 MM:SS용 (기본 대비 약 30% 축소) */
  private readonly mmSsCountdownFontSize = 'clamp(70px, 19.6vw, 266px)'
  /** 인트로 플로우 다이어그램(3·5분할) — main `get-screen-mode` 와 동기 */
  private introDiagramScreenMode: TimerIntroDiagramScreenMode = 'three'

  constructor(container: HTMLElement) {
    this.container = container
    void this.bootstrap()
  }

  private async syncIntroDiagramScreenModeFromMain(): Promise<void> {
    try {
      const r = await window.electronAPI?.getScreenMode?.()
      this.introDiagramScreenMode = r?.mode === 'five' ? 'five' : 'three'
    } catch {
      this.introDiagramScreenMode = 'three'
    }
  }

  private async bootstrap() {
    await this.syncIntroDiagramScreenModeFromMain()
    this.render()
    this.heartRatePanel.setupListeners()
    this.startCurrentTimeClock()
    void this.heartRatePanel.loadThresholdFromSettings()
    void this.sound.prime()
  }

  /** 인트로 직전: 최신 화면 모드로 DOM 재구성 후 오버레이 표시 가능 상태 */
  async prepareTimerIntroDom(): Promise<void> {
    await this.syncIntroDiagramScreenModeFromMain()
    this.render()
  }

  // 현재시간 표시 시작
  private startCurrentTimeClock() {
    this.updateCurrentTime() // 즉시 한 번 업데이트
    this.currentTimeInterval = setInterval(() => {
      this.updateCurrentTime()
    }, 1000) // 1초마다 업데이트
  }

  // 현재시간 업데이트 (시:분 형식)
  private updateCurrentTime() {
    const now = new Date()
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const timeString = `${hours}:${minutes}`

    const currentTimeEl = document.getElementById('current-time-display')
    if (currentTimeEl) {
      currentTimeEl.textContent = timeString
    }
  }

  // 초기화 메서드 (운동 종료 시 호출)
  reset() {
    const side = 'left'

    // Main 카테고리 설정 플래그 초기화
    this.mainCategorySet = false
    this.amrapRoundDurationMin = 0
    this.stickyCircuitType = null
    this.countdownViewRound = 0
    this.playSessionMetadata = null

    // 운동 카테고리(상단 타이틀) 초기화: 대기 안내 문구 표시
    const categoryEl = document.getElementById('workout-category-left')
    if (categoryEl) {
      categoryEl.textContent = '운동을 시작하세요'
      categoryEl.style.color = '#FFD700'
      categoryEl.style.textShadow = '0 0 20px rgba(255, 215, 0, 0.5)'
    }

    // Round 1로 초기화
    this.currentRound = 1
    const currentRoundEl = document.getElementById(`current-round-${side}`)
    if (currentRoundEl) currentRoundEl.textContent = '1'

    // 상단 Set / Lap 초기화 (대기 상태)
    const setDisplayEl = document.getElementById('set-display')
    const lapDisplayEl = document.getElementById('lap-display')
    renderTimerHeaderIdle(setDisplayEl, lapDisplayEl)

    // 운동 카운트수 초기화
    this.exerciseCount = 0
    this.lastCountedExercise = ''
    const exerciseCountEl = document.getElementById('exercise-count')
    if (exerciseCountEl) {
      exerciseCountEl.textContent = '(0)'
    }

    // 전체 운동시간 초기화
    this.workoutStartTime = null
    this.totalWorkoutTime = 0
    const totalTimeEl = document.getElementById('total-workout-time')
    if (totalTimeEl) totalTimeEl.textContent = '00:00:00'
    const totalTimeDisplayEl = document.getElementById('total-workout-time-display')
    if (totalTimeDisplayEl) totalTimeDisplayEl.textContent = '00:00'

    // 시간 초기화
    const countdownEl = document.getElementById(`countdown-${side}`)
    if (countdownEl) {
      countdownEl.textContent = '--'
      countdownEl.style.fontSize = this.defaultCountdownFontSize
      countdownEl.style.color = '#888'
    }

    // 활동 라벨 초기화
    const activityLabel = document.getElementById(`activity-label-${side}`)
    if (activityLabel) {
      activityLabel.textContent = 'READY'
      activityLabel.style.color = '#888'
      activityLabel.style.textShadow = 'none'
      adjustActivityLabelFontSize(activityLabel)
    }

    // 타이머 배경 초기화
    const activitySection = document.getElementById('activity-section-left')
    if (activitySection) activitySection.style.background = 'transparent'
    const timerContainer = document.getElementById('timer-container-left')
    if (timerContainer) timerContainer.style.background = 'transparent'
    const bottomSection = document.getElementById('bottom-time-section-left')
    if (bottomSection) bottomSection.style.background = 'transparent'

    // 타이머 정리
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval)
      this.countdownInterval = null
    }

    this.isStartCountdown = false
  }

  /** 운동 시작 버튼 후 세션 카운트다운(6초) 구간 — DS→Main READY와 동일하게 Set/Move 표시 */
  applySessionStartCountdownHeader(): void {
    const setDisplayEl = document.getElementById('set-display')
    const lapDisplayEl = document.getElementById('lap-display')
    const lapParent = lapDisplayEl?.parentElement as HTMLElement | null
    if (lapParent) lapParent.style.display = ''
    const setTot = getTimerStripPlanDenominator(this.playSessionMetadata)
    if (setDisplayEl) renderSetLapBlock(setDisplayEl, 'SET', 0, setTot, '#FFD700')
    if (lapDisplayEl) renderSetLapBlock(lapDisplayEl, 'MOVE', 0, 6, '#00E5FF')
  }

  // 시작 카운트다운: 5, 4, 3, 2, 1, START (총 6초)
  startCountdownBeforeStart(callback: () => void) {
    startPreWorkoutCountdown(this.createCountdownDeps(), callback)
  }

  // 인트로 모드 표시
  showIntroMode(metadata?: any) {
    showWorkoutTimerIntroMode(metadata, {
      reset: () => this.reset(),
      setPlaySessionMetadata: (value) => {
        this.playSessionMetadata = value
      },
    })
  }

  // 인트로 모드 종료 (실제 운동 시작 시 호출 필요)
  hideIntroMode() {
    const overlay = document.getElementById('intro-overlay')
    if (overlay) {
      overlay.style.display = 'none'
    }
  }

  render() {
    this.container.innerHTML = createWorkoutPlayTimerHtml(
      this.heartRatePanel.renderRightPanelHtml(),
      this.introDiagramScreenMode,
    )
  }

  updateDisplay(data: any) {
    // 좌측 화면만 업데이트 (Round + 시간)
    const side = 'left'

    const currentRound = data.round || 0
    this.countdownViewRound = currentRound

    // 운동 카테고리 업데이트
    this.updateWorkoutCategory(data)

    // 운동 시작 시간 기록 (첫 실행 시 - Round 0/1 시작 시)
    if (!this.workoutStartTime && data.sequence.exercise_type === 'exercise' && currentRound >= 0) {
      workoutInfoDevLog(`⏱️ 전체 운동 타이머 시작: Round ${currentRound}, Exercise: ${data.sequence.exercise_name}`)
      this.workoutStartTime = new Date()
      this.startTotalWorkoutTimer()
    }

    const metadata = data.metadata || {}
    if (Object.keys(metadata).length > 0) {
      this.playSessionMetadata = metadata as Record<string, unknown>
    }
    const category = metadata.workoutCategory || ''
    const { circuitType, sticky } = resolveTimerCircuitType(data, this.stickyCircuitType)
    this.stickyCircuitType = sticky
    const timerStrategy = getTimerUiStrategy(circuitType)
    const isLoopCircuit = timerStrategy.exerciseCountMode === 'loop-sets'
    const isEmom = circuitType === 'emom'

    if (isEmom && typeof data.totalRounds === 'number' && data.totalRounds > 0) {
      this.totalRounds = data.totalRounds
    }

    // 운동 카운트수 업데이트
    // 1. Round 0, 99 제외
    // 2. Loop 서킷: Set가 끝날 때 카운트 (마지막 Set 운동만)
    // 3. 기타: 운동 타입인 경우 카운트
    // 4. 각 Round 시작 시 1로 초기화

    // Round가 바뀌면 카운트 초기화 (모든 경우에 적용)
    if (currentRound !== this.currentRound) {
      // Round 0에서 Round 1로 변경되거나, Round가 바뀔 때
      if (currentRound >= 1 && currentRound < 99) {
        this.exerciseCount = 0
        this.lastCountedExercise = ''
        workoutInfoDevLog(`🔄 Round 변경으로 카운트 리셋: Round ${this.currentRound} → ${currentRound}`)
      }
    }

    if (data.sequence.exercise_type === 'exercise') {
      if (currentRound >= 1 && currentRound < 99) {
        // Loop 서킷인 경우: 각 운동 위치의 첫 번째 Set에서 카운트 증가
        if (isLoopCircuit) {
          const currentSet = data.currentSet || 0
          const totalSets = data.totalSets || 0
          const position = data.sequence.position || ''

          // Set가 0인 경우는 Round 0/99 스트레칭이므로 카운트하지 않음
          if (currentSet > 0) {
            // 운동 고유 식별자 (round + position)
            const exerciseKey = `${currentRound}-${position}`

            // Set가 1/X인 시점 감지 (각 운동 위치의 시작)
            if (currentSet === 1 && this.lastCountedExercise !== exerciseKey) {
              this.exerciseCount++
              this.lastCountedExercise = exerciseKey

              workoutInfoDevLog(`✅ Loop 카운트 증가: ${this.exerciseCount} (Round ${currentRound}, Position ${position}, Set ${currentSet}/${totalSets})`)

              const exerciseCountEl = document.getElementById('exercise-count')
              if (exerciseCountEl) {
                exerciseCountEl.textContent = `(${this.exerciseCount})`
              }
            }
          }
        }
        // 기타 서킷 (Stress 등): 운동이 나올 때마다 카운트
        else {
          // 운동 고유 식별자 생성 (round + sequenceIndex)
          const exerciseKey = `${currentRound}-${data.sequenceIndex}`

          // 아직 카운트하지 않은 운동인 경우에만 카운트 증가
          if (this.lastCountedExercise !== exerciseKey) {
            this.exerciseCount++
            this.lastCountedExercise = exerciseKey

            const exerciseCountEl = document.getElementById('exercise-count')
            if (exerciseCountEl) {
              exerciseCountEl.textContent = `(${this.exerciseCount})`
            }
          }
        }
      }
      // Round 0 (Dynamic Stretching) 또는 99 (Cool Down)는 카운트하지 않음
    }

    // Round/Set 라벨 업데이트
    const roundLabelEl = document.getElementById(`round-label-${side}`)
    if (roundLabelEl) {
      // metadata와 circuitType은 위에서 이미 선언됨

      // Main Training 체크
      const isMainTraining = category === 'MAIN'

      // Main Training: 서킷별 Set / RND — timerStrategy
      if (isMainTraining) {
        roundLabelEl.textContent = String(timerStrategy.mainTrainingRoundColumnLabel).toUpperCase()
      } else {
        roundLabelEl.textContent = 'RND'
      }
    }

    // Round/Set 정보 업데이트
    const currentRoundEl = document.getElementById(`current-round-${side}`)
    const totalRoundsEl = document.getElementById(`total-rounds-${side}`)

    const isLoop = circuitType === 'loop'

    const roundCells = timerStrategy.fillRoundCells({
      data,
      currentRound,
      selfTotalRounds: this.totalRounds,
      selfCurrentRound: this.currentRound,
    })
    if (roundCells.debugLog) workoutInfoDevLog(roundCells.debugLog)
    if (roundCells.nextSelfTotalRounds !== undefined) this.totalRounds = roundCells.nextSelfTotalRounds
    if (roundCells.nextSelfCurrentRound !== undefined) this.currentRound = roundCells.nextSelfCurrentRound
    if (currentRoundEl && roundCells.currentText !== null) {
      currentRoundEl.textContent = roundCells.currentText
    }
    if (totalRoundsEl && roundCells.totalText !== null) {
      totalRoundsEl.textContent = roundCells.totalText
    }

    // 상단 Set / Lap 표시 업데이트
    const setDisplayEl = document.getElementById('set-display')
    const lapDisplayEl = document.getElementById('lap-display')
    const headerResult = applyTimerHeaderStrip(setDisplayEl, lapDisplayEl, {
      currentRound,
      circuitType,
      isLoop,
      isEmom,
      data,
      totalRoundsFallback: this.totalRounds,
      amrapRoundDurationMin: this.amrapRoundDurationMin,
    })
    this.currentCircuitType = circuitType
    this.amrapRoundDurationMin = headerResult.amrapRoundDurationMin
    const dur = headerResult.durationSeconds

    // 활동 라벨 업데이트
    this.activityType = updateWorkoutTimerActivityLabel({
      sequence: data.sequence,
      side,
      currentRound,
      metadata: data.metadata,
    })

    // 카운트다운 시작
    this.startCountdown(dur > 0 ? dur : 60, data.sequence?.exercise_type)
  }

  // 전체 운동시간 타이머 시작
  private startTotalWorkoutTimer() {
    setInterval(() => {
      if (!this.workoutStartTime) return

      const now = new Date()
      const diff = Math.floor((now.getTime() - this.workoutStartTime.getTime()) / 1000)

      const hours = Math.floor(diff / 3600)
      const minutes = Math.floor((diff % 3600) / 60)
      const seconds = diff % 60

      const timeStrFull = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      const timeStrShort = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

      const totalTimeEl = document.getElementById('total-workout-time')
      if (totalTimeEl) totalTimeEl.textContent = timeStrFull
      const displayEl = document.getElementById('total-workout-time-display')
      if (displayEl) displayEl.textContent = timeStrShort
    }, 1000)
  }

  // 운동 카테고리 업데이트
  // Round/Set과 상관없이 workout_history_master의 major_category에 해당하는 major_category_name 표시
  private updateWorkoutCategory(data: any) {
    const categoryEl = document.getElementById('workout-category-left')
    if (!categoryEl) return

    // Main 운동 카테고리가 이미 설정되어 있으면 더 이상 업데이트하지 않음
    if (this.mainCategorySet) {
      return
    }

    // metadata에서 major_category_name과 circuitType 가져오기
    // workout_history_master의 major_category에 해당하는 major_category_name 사용
    const metadata = data.metadata || {}
    let majorCategoryName = metadata.major_category_name || ''
    const circuitType = resolveWorkoutCircuitType(data)

    // UUID 형식 체크 함수
    const isUUID = (str: string) => {
      if (!str || typeof str !== 'string') return false
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
    }

    // major_category_name이 없거나 UUID인 경우, 다른 경로에서 찾기 시도
    if (!majorCategoryName || isUUID(majorCategoryName)) {
      majorCategoryName =
        data.major_category_name ||
        data.sequence?.major_category_name ||
        ''
    }

    // major_category_name이 여전히 없거나 UUID이면 표시하지 않음 (다음 업데이트까지 대기)
    if (!majorCategoryName || isUUID(majorCategoryName)) {
      return
    }

    workoutInfoDevLog('🏷️ 운동 카테고리 업데이트:', {
      metadata: metadata,
      majorCategoryName: majorCategoryName,
      circuitType: circuitType,
      data: data
    })

    let displayCategory = ''

    // major_category_name이 있고 UUID가 아닌 경우 사용
    const circuitTypeMap: { [key: string]: string } = {
      stress: '스트레스 서킷',
      loop: '루프 서킷',
      amrap: 'AMRAP',
      emom: 'EMOM',
    }

    const circuitTypeName = circuitTypeMap[circuitType] || circuitType

    const ct = circuitType.toLowerCase()
    if (ct === 'amrap' || ct === 'emom') {
      displayCategory = majorCategoryName
    } else {
      displayCategory = `${majorCategoryName} ${circuitTypeName}`
    }

    categoryEl.textContent = displayCategory

    // 텍스트가 넘치면 자동으로 폰트 크기 조정
    adjustCategoryFontSize(categoryEl)

    // Main 운동 카테고리 설정 완료 플래그 설정
    this.mainCategorySet = true
  }

  private createCountdownDeps(): WorkoutTimerCountdownDeps {
    return {
      sound: this.sound,
      defaultCountdownFontSize: this.defaultCountdownFontSize,
      mmSsCountdownFontSize: this.mmSsCountdownFontSize,
      getCountdown: () => this.countdown,
      setCountdown: (value) => { this.countdown = value },
      getCountdownInterval: () => this.countdownInterval,
      setCountdownInterval: (value) => { this.countdownInterval = value },
      getCurrentSequenceType: () => this.currentSequenceType,
      setCurrentSequenceType: (value) => { this.currentSequenceType = value },
      getCurrentCircuitType: () => this.currentCircuitType,
      getCountdownViewRound: () => this.countdownViewRound,
      setStartCountdownActive: (value) => { this.isStartCountdown = value },
      applySessionStartCountdownHeader: () => this.applySessionStartCountdownHeader(),
    }
  }

  private startCountdown(duration: number, nextSequenceType: string = '') {
    startSequenceCountdown(this.createCountdownDeps(), duration, nextSequenceType)
  }

  // 타이머 일시정지
  pauseTimer() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval)
      this.countdownInterval = null
      workoutInfoDevLog('⏸ 타이머 일시정지, 남은 시간:', this.countdown)
    }
    // 일시정지 중 다음/이전 등으로 재호출되어도 최초 일시정지 시각을 유지해야
    // resume 시 총 운동시간 보정(workoutStartTime + pausedMs)이 정확하다.
    if (this.pauseStartedAt === 0) {
      this.pauseStartedAt = Date.now()
    }
  }

  // 타이머 재개
  resumeTimer() {
    if (this.countdownInterval) {
      return // 이미 실행 중
    }

    // 전체 운동시간 보정: 일시정지 동안의 시간만큼 시작 시각을 앞으로 이동
    if (this.pauseStartedAt > 0 && this.workoutStartTime) {
      const pausedMs = Date.now() - this.pauseStartedAt
      this.workoutStartTime = new Date(this.workoutStartTime.getTime() + pausedMs)
      this.pauseStartedAt = 0
    }

    workoutInfoDevLog('▶ 타이머 재개, 남은 시간:', this.countdown)
    resumeSequenceCountdown(this.createCountdownDeps())
  }

  private updateCountdownDisplay() {
    updateTimerCountdownDisplay(this.createCountdownDeps())
  }

  destroy() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval)
      this.countdownInterval = null
    }
  }

  // 심박수 업데이트 메서드 (더 이상 사용하지 않음 - setupHeartRateListener에서 처리)
  updateHeartRate(data: { userId?: number, deviceId?: number, heartRate: number }) {
    // 이 메서드는 더 이상 사용하지 않습니다
    // setupHeartRateListener에서 직접 처리합니다
  }

  /** 테스트용: 랜덤 심박수 (개발 중) — WorkoutHeartRatePanel 위임 */
  startMockHeartRate() {
    this.heartRatePanel.startMockHeartRate()
  }
}


