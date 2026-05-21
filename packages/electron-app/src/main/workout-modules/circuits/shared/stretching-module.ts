import type { WorkoutModuleContext, WorkoutModule, ActiveSet } from './base-module'
import { log } from './base-module'
import { preloadMainRoundGroup } from './main-round-preload'
import { preloadStretchingRoundGroup } from './stretching-preload'

/**
 * StretchingModule - Dynamic Stretching(DS) / Cool Down(CD) 공통 실행 모듈
 *
 * DS(round=0)와 CD(round=99)는 동일한 구조로 동작한다:
 *   1. 해당 라운드의 운동을 3개씩 그룹으로 나눈다 (예: DS1-3, DS4-6)
 *   2. 각 그룹 내에서 좌(L1-L3)/우(R1-R3)에 동일 영상을 미러링하여 표시
 *   3. 그룹 내 운동을 L1→L2→L3 순서대로 하나씩 활성화하며 타이머 진행
 *   4. 그룹 완료 시 다음 그룹으로 전환 (DS4-6 → set2 영상 영역으로 교체)
 *
 * 프리로드 전략:
 *   - 현재 그룹 재생 중에 다음 그룹 또는 다음 라운드 영상을 미리 로드
 */
export class StretchingModule implements WorkoutModule {
  private stopped = false

  /**
   * 현재 시퀀스의 라운드에 해당하는 스트레칭 운동을 그룹 단위로 실행한다.
   *
   * @param ctx - 공유 운동 세션 컨텍스트
   * @param onComplete - 해당 라운드의 모든 스트레칭 완료 후 호출되는 콜백
   */
  execute(ctx: WorkoutModuleContext, onComplete: () => void): void {
    this.stopped = false
    if (!ctx.activePlaySession) { onComplete(); return }

    const currentIndex = ctx.activePlaySession.currentSequenceIndex
    const currentSeq = ctx.activePlaySession.sequences[currentIndex]
    const currentRound = currentSeq.round

    // 현재 라운드의 유효한 스트레칭 운동만 필터링 (플레이스홀더, 0초 제외)
    const stretchingExercises = ctx.activePlaySession.sequences.filter(
      s =>
        Number(s.round) === Number(currentRound) &&
        s.exercise_type === 'exercise' &&
        s.exercise_name !== '임시운동' &&
        s.duration > 0
    )

    log(`🎬 [StretchingModule] Round ${currentRound} 스트레칭 운동:`, {
      count: stretchingExercises.length,
      exercises: stretchingExercises.map(s => ({
        name: s.exercise_name,
        position: s.position,
        duration: s.duration
      }))
    })

    if (stretchingExercises.length === 0) {
      log(`⚠️ [StretchingModule] Round ${currentRound} 스트레칭 운동이 없어서 스킵`)
      if (ctx.activePlaySession) ctx.activePlaySession.currentSequenceIndex++
      onComplete()
      return
    }

    this.executeStretchingGroups(ctx, stretchingExercises, currentRound, () => {
      if (this.stopped) return
      if (!ctx.activePlaySession) return

      // 현재 라운드의 모든 시퀀스를 건너뛰고 다음 라운드의 첫 시퀀스로 이동
      const round = currentSeq.round
      let nextIndex = ctx.activePlaySession.currentSequenceIndex
      while (
        nextIndex < ctx.activePlaySession.sequences.length &&
        Number(ctx.activePlaySession.sequences[nextIndex].round) === Number(round)
      ) {
        nextIndex++
      }
      ctx.activePlaySession.currentSequenceIndex = nextIndex
      log(`🎬 [StretchingModule] Round ${round} 완료, 다음 시퀀스 인덱스: ${nextIndex}`)
      onComplete()
    })
  }

  /** 스트레칭 도중 운동 중지 시 호출 — 타이머 콜백 실행을 차단한다 */
  stop(): void {
    this.stopped = true
  }

  /**
   * Loop/EMOM에서 후반전(L4-L6) 운동은 전반전과 다른 라운드에 저장되므로,
   * round 1 group 1 으로는 선로딩이 안 됨 → 첫 후반전 라운드를 찾아 반환.
   */
  private findFirstBackHalfRound(ctx: WorkoutModuleContext): number | null {
    if (!ctx.activePlaySession) return null
    for (const seq of ctx.activePlaySession.sequences) {
      if (
        seq.round > 0 &&
        seq.round < 99 &&
        seq.exercise_type === 'exercise' &&
        seq.exercise_name !== '임시운동' &&
        seq.duration > 0
      ) {
        const m = String(seq.position || '').match(/^[LR](\d+)$/i)
        if (m && parseInt(m[1], 10) >= 4) {
          return seq.round
        }
      }
    }
    return null
  }

  /**
   * 스트레칭 운동을 3개씩 그룹으로 나눠 순차 실행한다.
   *
   * 예시 (DS 6개 운동):
   *   그룹1: DS1, DS2, DS3 → L1/R1, L2/R2, L3/R3 슬롯에 매핑 (set1 영역)
   *   그룹2: DS4, DS5, DS6 → 동일 슬롯에 새 영상 로드 (set1 영역, 그룹 전환)
   *
   * @param stretchingExercises - 현재 라운드의 유효한 스트레칭 운동 목록
   * @param currentRound - 0(DS) 또는 99(CD) 등 현재 라운드 번호
   */
  private executeStretchingGroups(ctx: WorkoutModuleContext, stretchingExercises: any[], currentRound: number, onComplete: () => void) {
    // 3개씩 그룹화 (DS1-3, DS4-6, ...)
    const groups: any[][] = []
    for (let i = 0; i < stretchingExercises.length; i += 3) {
      groups.push(stretchingExercises.slice(i, i + 3))
    }

    const prefix = currentRound === 0 ? 'DS' : currentRound === 99 ? 'CD' : 'L'

    // 모든 그룹의 운동에 position 부여 (DS1~DS6 등)
    const allNormalized: any[] = []
    groups.forEach((group, gi) => {
      group.forEach((item, idx) => {
        const positionNum = gi * 3 + idx + 1
        allNormalized.push(item?.position ? item : { ...item, position: `${prefix}${positionNum}` })
      })
    })

    log(`🎬 [StretchingModule] 그룹 분할 (Round ${currentRound}):`, {
      총그룹수: groups.length,
      각그룹크기: groups.map(g => g.length),
      전체운동: allNormalized.map(e => ({ name: e.exercise_name, position: e.position }))
    })

    // 첫 그룹 시작 시 모든 그룹 영상을 한번에 broadcast → 렌더러에서 6슬롯에 모두 로드
    const allPositionGroups: { [key: string]: any[] } = {}
    allNormalized.forEach((item, idx) => {
      const slotIndex = idx + 1
      const leftPos = `L${slotIndex}`
      const rightPos = `R${slotIndex}`
      if (!allPositionGroups[leftPos]) allPositionGroups[leftPos] = []
      if (!allPositionGroups[rightPos]) allPositionGroups[rightPos] = []
      allPositionGroups[leftPos].push(item)
      allPositionGroups[rightPos].push(item)
    })

    const activeSet: ActiveSet = { left: 'set1', right: 'set1' }

    const totalStretchingExercises = allNormalized.length

    // DS1-6 전체를 한번에 로드하는 초기 broadcast
    log(`🎬 [StretchingModule] 전체 ${allNormalized.length}개 영상 일괄 로딩 (6슬롯 모드)`)
    ctx.broadcastToAllWindows('workout-play-sequence', {
      sequence: allNormalized[0],
      round: currentRound,
      totalRounds: ctx.activePlaySession!.totalRounds,
      duration: allNormalized[0].duration,
      position: 'ALL',
      activeSet: activeSet,
      sequenceIndex: ctx.activePlaySession!.currentSequenceIndex,
      totalSequences: ctx.activePlaySession!.sequences.length,
      metadata: ctx.activePlaySession!.metadata,
      stretchingMode: true,
      stretchingSlotCount: allNormalized.length,
      positionGroups: allPositionGroups,
      actualPositionGroups: allPositionGroups,
      currentStretchingIndex: 1,
      totalStretchingExercises
    })

    if (!this.stopped && ctx.activePlaySession) {
      if (currentRound === 0) {
        preloadMainRoundGroup(ctx, 1, 0)
        preloadMainRoundGroup(ctx, 1, 1)

        const backHalfRound = this.findFirstBackHalfRound(ctx)
        if (backHalfRound !== null && backHalfRound !== 1) {
          preloadMainRoundGroup(ctx, backHalfRound, 0)
          log(`📹 [StretchingModule] Main set1 + set2(round ${backHalfRound}) 프리로드 요청`)
        } else {
          log('📹 [StretchingModule] Main set1+set2 프리로드 요청')
        }
      } else if (currentRound < 99) {
        preloadStretchingRoundGroup(ctx, 99, 0)
      } else {
        const nextRound = ctx.getNextMainRoundAfter(currentRound)
        if (typeof nextRound === 'number') {
          preloadMainRoundGroup(ctx, nextRound, 0)
        }
      }
    }

    let currentGroupIndex = ctx.stretchingGroupIndex || 0
    if (currentGroupIndex >= groups.length) currentGroupIndex = 0

    // 네비게이션(다음/이전)으로 진입한 경우 seek-queue가 이미 큐를 올바른 위치에 놓았으므로
    // 첫 그룹에서는 advance-slots를 생략해야 한다. 인스턴스 내 그룹 전환만 advance 한다.
    const entryGroupIndex = currentGroupIndex

    const executeNextGroup = () => {
      if (this.stopped) return
      if (currentGroupIndex >= groups.length) {
        log(`🎬 [StretchingModule] 모든 그룹 완료 (Round ${currentRound})`)
        onComplete()
        return
      }

      const currentGroup = groups[currentGroupIndex]
      const groupOffset = currentGroupIndex * 3
      const normalizedGroup = currentGroup.map((item, index) => {
        if (item?.position) return item
        return { ...item, position: `${prefix}${groupOffset + index + 1}` }
      })

      log(`🎬 [StretchingModule] 그룹 ${currentGroupIndex + 1}/${groups.length} 시작:`, {
        그룹크기: normalizedGroup.length,
        운동들: normalizedGroup.map(e => ({ name: e.exercise_name, position: e.position, duration: e.duration }))
      })

      if (currentGroupIndex > 0) {
        // 인스턴스 내 그룹 전환 (자동재생): advance-slots + switch-group
        // 네비게이션 진입 (seek-queue로 이미 위치됨): switch-group만 전송
        if (currentGroupIndex !== entryGroupIndex) {
          log(`🎬 [StretchingModule] 그룹 ${currentGroupIndex + 1}로 슬롯 전환 (advance)`)
          ctx.broadcastToAllWindows('workout-advance-slots', {
            slots: [1, 2, 3]
          })
        } else {
          log(`🎬 [StretchingModule] 그룹 ${currentGroupIndex + 1}로 네비게이션 진입 (advance 생략)`)
        }
        ctx.broadcastToAllWindows('workout-stretching-switch-group', {
          groupIndex: currentGroupIndex,
          round: currentRound
        })
      }

      // 렌더러 호환용: 현재 그룹의 L1-L3/R1-R3 매핑
      const currentLegacyGroups = {
        L1: [] as any[], L2: [] as any[], L3: [] as any[],
        R1: [] as any[], R2: [] as any[], R3: [] as any[]
      }
      normalizedGroup.forEach((item, idx) => {
        const slotIdx = idx % 3
        const lp = `L${slotIdx + 1}` as keyof typeof currentLegacyGroups
        const rp = `R${slotIdx + 1}` as keyof typeof currentLegacyGroups
        currentLegacyGroups[lp].push(item)
        currentLegacyGroups[rp].push(item)
      })

      ctx.setStretchingGroupIndex(currentGroupIndex)

      // 그룹 내 개별 운동을 순차 실행 (L1 → L2 → L3)
      this.executeStretchingGroupSequence(ctx, currentLegacyGroups, currentGroupIndex, groups, totalStretchingExercises, () => {
        if (this.stopped) return
        log(`🎬 [StretchingModule] 그룹 ${currentGroupIndex + 1} 완료`)
        currentGroupIndex++
        ctx.setStretchingGroupIndex(currentGroupIndex)
        executeNextGroup()
      })
    }

    executeNextGroup()
  }

  /**
   * 그룹 내 운동을 L1 → L2 → L3 순서로 한 포지션씩 활성화하며 타이머를 진행한다.
   *
   * 각 포지션 전환 시:
   *   - position: 'KEEP_VIDEO' → 영상을 교체하지 않고 유지
   *   - currentStretchingPosition: 'L1' 등 → 렌더러에서 해당 셀을 하이라이트
   *   - mirroredPosition: 'R1' 등 → 우측 모니터에서 동일 셀을 하이라이트
   *
   * @param positionGroups - L1-L3/R1-R3에 매핑된 운동 배열
   * @param currentGroupIndex - 현재 그룹 인덱스 (0-based)
   * @param groups - 전체 그룹 배열 (그룹당 운동 개수)
   * @param totalStretchingExercises - 총 DS/CD 운동 수
   */
  private executeStretchingGroupSequence(
    ctx: WorkoutModuleContext,
    positionGroups: { L1: any[], L2: any[], L3: any[], R1: any[], R2: any[], R3: any[] },
    currentGroupIndex: number,
    groups: any[][],
    totalStretchingExercises: number,
    onComplete: () => void
  ) {
    let currentPositionIndex = 0
    const positions = ['L1', 'L2', 'L3'] as const

    const executeNextPosition = () => {
      if (this.stopped) return
      if (currentPositionIndex >= positions.length) {
        onComplete()
        return
      }

      const currentPosition = positions[currentPositionIndex]
      const exercises = positionGroups[currentPosition]

      // 해당 슬롯에 운동이 없으면 건너뛰기 (3개 미만 그룹일 때)
      if (exercises.length === 0) {
        currentPositionIndex++
        executeNextPosition()
        return
      }

      const firstExercise = exercises[0]
      const duration = firstExercise.duration

      log(`🎬 [StretchingModule] ${currentPosition} 진행 (${duration}초):`, {
        exercise: firstExercise.exercise_name,
        position: currentPosition
      })

      const groupOffset = groups.slice(0, currentGroupIndex).reduce((s, g) => s + g.length, 0)
      const currentStretchingIndex = groupOffset + currentPositionIndex + 1

      // 타이머 업데이트 + 활성 포지션 변경 명령 (영상은 유지)
      ctx.broadcastToAllWindows('workout-play-sequence', {
        sequence: firstExercise,
        round: firstExercise.round,
        totalRounds: ctx.activePlaySession!.totalRounds,
        duration: duration,
        position: 'KEEP_VIDEO',
        activeSet: { left: 'set1', right: 'set1' },
        sequenceIndex: ctx.activePlaySession!.currentSequenceIndex,
        totalSequences: ctx.activePlaySession!.sequences.length,
        metadata: ctx.activePlaySession!.metadata,
        stretchingMode: true,
        positionGroups: positionGroups,
        currentStretchingPosition: currentPosition,
        mirroredPosition: `R${currentPosition.charAt(1)}`,
        currentStretchingIndex,
        totalStretchingExercises
      })

      ctx.schedulePlayTimer(() => {
        currentPositionIndex++
        executeNextPosition()
      }, duration * 1000)
    }

    executeNextPosition()
  }
}
