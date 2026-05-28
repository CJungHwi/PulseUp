/**
 * MonthProgram — 헬퍼 유틸
 *
 * - `mergeSequencesWithPlans`: workout_history_plan 값을 ExerciseSequence에 병합 (재생/표시 데이터 보정)
 * - `fmtSeconds`: 초 → mm:ss
 * - `isDS`/`isCD`: major_category 분류 헬퍼
 * - `isAMRAPorEMOM`: 카테고리 ID/Name으로 AMRAP/EMOM 판단
 */

import type { ExerciseSequence, WorkoutPlan } from './monthProgramTypes'

export const mergeSequencesWithPlans = (
  sequences: ExerciseSequence[],
  plans: WorkoutPlan[],
  circuitType: string,
): ExerciseSequence[] => {
  if (!plans || plans.length === 0) return sequences

  const sortedPlans = [...plans].sort((a, b) => a.round - b.round)
  const planCount = sortedPlans.length
  const planMap = new Map<number, WorkoutPlan>()
  plans.forEach((plan) => planMap.set(plan.round, plan))

  if (circuitType === 'stress') {
    const positionSetCounter = new Map<string, number>()
    let lastExercisePlanIndex = 0

    return sequences.map((seq) => {
      if (seq.round <= 0 || seq.round >= 99) return seq

      if (seq.exercise_type === 'exercise') {
        const posKey = seq.position || seq.exercise_id || 'unknown'
        const count = positionSetCounter.get(posKey) || 0
        const planIndex = count % planCount
        positionSetCounter.set(posKey, count + 1)
        lastExercisePlanIndex = planIndex
        const plan = sortedPlans[planIndex]
        if (!plan) return seq
        return { ...seq, duration: plan.exerciseTime }
      }

      if (seq.exercise_type === 'rest') {
        const plan = sortedPlans[lastExercisePlanIndex]
        if (!plan) return seq
        return { ...seq, duration: plan.restTime }
      }

      if (seq.exercise_type === 'water') {
        const lastPlan = sortedPlans[planCount - 1]
        if (!lastPlan) return seq
        return { ...seq, duration: lastPlan.waterBreakTime ?? seq.duration }
      }

      return seq
    })
  }

  return sequences.map((seq) => {
    if (seq.round <= 0 || seq.round >= 99) return seq

    let planRound = seq.round
    if (seq.round > planCount) {
      planRound = ((seq.round - 1) % planCount) + 1
    }

    const plan = planMap.get(planRound)
    if (!plan) return seq

    let newDuration = seq.duration
    switch (seq.exercise_type) {
      case 'exercise':
        newDuration = plan.exerciseTime
        break
      case 'rest':
        newDuration = plan.restTime
        break
      case 'water':
        newDuration = plan.waterBreakTime ?? seq.duration
        break
    }
    return { ...seq, duration: newDuration }
  })
}

export const fmtSeconds = (sec: number): string =>
  `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`

export const isDS = (mc: string | undefined | null): boolean => {
  const u = (mc || '').toUpperCase()
  return u === 'DS' || u === 'DYNAMIC-STRETCHING' || u === 'DYNAMIC_STRETCHING'
}

export const isCD = (mc: string | undefined | null): boolean => {
  const u = (mc || '').toUpperCase()
  return (
    u === 'CD' ||
    u === 'COOL-DOWN' ||
    u === 'COOL_DOWN' ||
    u === 'STATIC-STRETCHING' ||
    u === 'STATIC_STRETCHING'
  )
}

export const isAMRAPorEMOMCategory = (
  workoutCategoriesId?: string,
  workoutCategory?: string,
  workoutCategoriesName?: string,
): boolean => {
  const mcId = (workoutCategoriesId || workoutCategory || '').toString().toUpperCase()
  const mcName = (workoutCategoriesName || '').toString().toUpperCase()
  return mcId === 'AMRAP' || mcId === 'EMOM' || mcName === 'AMRAP' || mcName === 'EMOM'
}

export const fmtPlanTime = (val: number, isMinute: boolean): string => {
  if (isMinute) {
    const asMin = val >= 60 ? Math.floor(val / 60) : val
    return `${asMin}분`
  }
  return `${val}s`
}
