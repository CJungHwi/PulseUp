/**
 * 타이머 모니터 중앙 상단 Set / Move(또는 AMRAP N MIN) 영역 전용
 */

import { getTimerStripPlanDenominator } from '../circuits/emom/intro-panel-emom.js'
import { resolveWorkoutMethodType } from './workout-timer-circuit.js'

export interface TimerHeaderStripInput {
  currentRound: number
  /** metadata.circuitType 소문자 */
  circuitType: string
  isLoop: boolean
  isEmom: boolean
  /** workout-play-sequence 페이로드 */
  data: any
  /** Stress 등에서 lap 없을 때 Move 행 폴백 */
  totalRoundsFallback: number
  /** 이전 AMRAP 분 값(갱신 시에만 덮어씀) */
  amrapRoundDurationMin: number
}

export interface TimerHeaderStripResult {
  amrapRoundDurationMin: number
  /** 카운트다운용 초 */
  durationSeconds: number
}

const GOLD = '#FFD700'
const CYAN = '#00E5FF'
const AMRAP_ORANGE = '#FF6B35'

const stripCellStyle =
  'line-height:1;display:inline-block;vertical-align:baseline;font-variant-numeric:tabular-nums;'

export const renderSetLapBlock = (
  el: HTMLElement,
  label: string,
  current: number,
  total: number,
  accentColor: string,
): void => {
  const labelText = String(label).toUpperCase()
  el.style.display = 'inline-flex'
  el.style.alignItems = 'baseline'
  el.style.flexWrap = 'nowrap'
  el.style.lineHeight = '1'
  el.innerHTML =
    `<span style="${stripCellStyle}text-transform:uppercase;font-size: clamp(34px, 3.36vw, 96px); font-weight: 600; color: rgba(255,255,255,0.45);">${labelText}</span>` +
    `<span style="${stripCellStyle}font-size: clamp(58px, 6vw, 115px); font-weight: bold; color: ${accentColor}; margin-left: 0.4em;">${current}</span>` +
    `<span style="${stripCellStyle}font-size: clamp(34px, 3.6vw, 67px); font-weight: 600; color: rgba(255,255,255,0.4); margin-left: 0.12em;">/ ${total}</span>`
}

/** 운동 종료·대기 시 Set/Move 기본값 */
export const renderTimerHeaderIdle = (
  setDisplayEl: HTMLElement | null,
  lapDisplayEl: HTMLElement | null,
): void => {
  if (setDisplayEl) renderSetLapBlock(setDisplayEl, 'SET', 0, 0, GOLD)
  if (lapDisplayEl) renderSetLapBlock(lapDisplayEl, 'MOVE', 1, 1, CYAN)
}

export const applyTimerHeaderStrip = (
  setDisplayEl: HTMLElement | null,
  lapDisplayEl: HTMLElement | null,
  input: TimerHeaderStripInput,
): TimerHeaderStripResult => {
  const { currentRound, circuitType, isLoop, isEmom, data, totalRoundsFallback } = input
  let amrapMin = input.amrapRoundDurationMin

  const isDSorCD = currentRound === 0 || currentRound === 99
  const hasStressData = data.lapIndex != null && data.totalLaps != null
  const isMainStress = hasStressData && !isLoop && !isEmom
  const isAmrap = circuitType === 'amrap'
  const isEmomStress = isEmom && resolveWorkoutMethodType(data) === 'stress'

  const durationSeconds = Number(data.duration ?? data.sequence?.duration ?? 0) || 0

  /** 구간 전환 READY(5초): 삽입 countdown은 다음 페이즈 round — DS→Main=1, Main→CD=99 */
  if (
    data.sequence?.exercise_type === 'countdown' &&
    (currentRound === 1 || currentRound === 99) &&
    setDisplayEl &&
    lapDisplayEl
  ) {
    const lapParent = lapDisplayEl.parentElement as HTMLElement | null
    if (lapParent) lapParent.style.display = ''
    if (currentRound === 1) {
      const setTot = getTimerStripPlanDenominator(data.metadata)
      renderSetLapBlock(setDisplayEl, 'SET', 0, setTot, GOLD)
      renderSetLapBlock(lapDisplayEl, 'MOVE', 0, 6, CYAN)
    } else {
      renderSetLapBlock(setDisplayEl, 'SET', 0, 0, GOLD)
      renderSetLapBlock(lapDisplayEl, 'MOVE', 0, 6, CYAN)
    }
    return {
      amrapRoundDurationMin: amrapMin,
      durationSeconds,
    }
  }

  if (
    isAmrap &&
    data.sequence?.exercise_type === 'exercise' &&
    !isDSorCD &&
    durationSeconds > 0
  ) {
    amrapMin = Math.round(durationSeconds / 60)
  }

  if (isAmrap && !isDSorCD && amrapMin > 0 && setDisplayEl && lapDisplayEl) {
    const lapParent = lapDisplayEl.parentElement as HTMLElement | null
    if (lapParent) lapParent.style.display = 'none'

    const setParent = setDisplayEl.parentElement as HTMLElement | null
    if (setParent) {
      setParent.style.justifyContent = 'center'
      setParent.style.alignItems = 'center'
    }
    setDisplayEl.style.justifyContent = 'center'
    setDisplayEl.style.alignItems = 'center'

    setDisplayEl.innerHTML =
      `<span style="display: block; width: 100%; text-align: center; white-space: nowrap; font-size: clamp(27px, 16.5cqw, 84px); font-weight: 900; color: ${AMRAP_ORANGE}; letter-spacing: 0.04em;">AMRAP ${amrapMin} MIN</span>`
  } else {
    if (lapDisplayEl) {
      const lapParent = lapDisplayEl.parentElement as HTMLElement | null
      if (lapParent) lapParent.style.display = ''
    }

    const setParent = setDisplayEl?.parentElement as HTMLElement | null
    if (setParent) {
      setParent.style.justifyContent = 'flex-start'
      setParent.style.alignItems = 'flex-end'
    }
    if (setDisplayEl) {
      setDisplayEl.style.justifyContent = 'flex-start'
      setDisplayEl.style.alignItems = 'baseline'
    }

    if (setDisplayEl) {
      if (isDSorCD) {
        renderSetLapBlock(setDisplayEl, isLoop ? 'RND' : 'SET', 0, 0, GOLD)
      } else if (isLoop && data.currentSet != null && data.totalSets != null) {
        const tr = getTimerStripPlanDenominator(data.metadata)
        const cr = Math.min(tr, Math.max(1, Math.round(Number(data.currentSet))))
        renderSetLapBlock(setDisplayEl, 'RND', cr, tr, GOLD)
      } else if (isEmom) {
        /** EMOM 분모 = workoutPlans.length 만. Stress 방식은 SET, Loop 방식은 RND로 표시. */
        const tr = getTimerStripPlanDenominator(data.metadata)
        let cr = 1
        const curSet = data.currentSet
        if (typeof curSet === 'number' && Number.isFinite(curSet) && curSet > 0) {
          cr = Math.min(tr, Math.max(1, Math.round(curSet)))
        } else {
          const slotOrd = Number(data.emomExerciseOrdinal)
          if (Number.isFinite(slotOrd) && slotOrd > 0) {
            cr = Math.min(tr, Math.floor((slotOrd - 1) / 6) + 1)
          }
        }
        renderSetLapBlock(setDisplayEl, isEmomStress ? 'SET' : 'RND', cr, tr, GOLD)
      } else if (isMainStress) {
        const setIdx = data.setIndex ?? currentRound
        const setTot = getTimerStripPlanDenominator(data.metadata)
        renderSetLapBlock(setDisplayEl, 'SET', setIdx, setTot, GOLD)
      } else {
        const total = getTimerStripPlanDenominator(data.metadata)
        const curr = data.currentSet ?? (currentRound > 0 && currentRound < 99 ? currentRound : 1)
        renderSetLapBlock(setDisplayEl, 'SET', curr, total, GOLD)
      }
    }
    if (lapDisplayEl) {
      if (isDSorCD) {
        const lapCurr = data.currentStretchingIndex ?? 1
        const lapTot = data.totalStretchingExercises ?? 1
        renderSetLapBlock(lapDisplayEl, 'MOVE', lapCurr, lapTot, CYAN)
      } else if (isMainStress) {
        const lapIdx = data.lapIndex ?? 1
        const lapTot = data.totalLaps ?? 6
        renderSetLapBlock(lapDisplayEl, 'MOVE', lapIdx, lapTot, CYAN)
      } else if (isLoop || isEmom || isAmrap) {
        if (
          (isEmom || isAmrap) &&
          (data?.sequence?.exercise_type === 'rest' ||
            data?.sequence?.exercise_type === 'water')
        ) {
          const lapParent = lapDisplayEl.parentElement as HTMLElement | null
          if (lapParent) lapParent.style.display = 'none'
        } else {
          const lapIdx = data.lapIndex ?? currentRound
          const lapTot = data.totalLaps ?? totalRoundsFallback ?? 1
          renderSetLapBlock(lapDisplayEl, 'MOVE', lapIdx, lapTot, CYAN)
        }
      } else {
        const total = totalRoundsFallback || 1
        const curr = currentRound === 99 ? total : currentRound > 0 ? currentRound : 1
        renderSetLapBlock(lapDisplayEl, 'MOVE', curr, total, CYAN)
      }
    }
  }

  return {
    amrapRoundDurationMin: amrapMin,
    durationSeconds,
  }
}
