import { BrowserWindow } from 'electron'
import type { WorkoutPlayService } from './workout-play-service'
import { createPlaybackNavigation, normalizeCircuitTypeFromMetadata, resolveModuleCircuitType } from './workout-modules'
import { getHalfRoundsCountFromSession } from './workout-modules/circuits/shared/half-rounds-meta'
import { resolveLoopQueueSeekPosition } from './workout-modules/circuits/loop/loop-order'

const DEBUG = false
const log = (...args: any[]) => { if (DEBUG) console.log(...args) }

export interface PlaybackControllerDeps {
  broadcastToAllWindows: (channel: string, data: any) => void
}

export class PlaybackController {
  private playService: WorkoutPlayService
  private deps: PlaybackControllerDeps

  constructor(playService: WorkoutPlayService, deps: PlaybackControllerDeps) {
    this.playService = playService
    this.deps = deps
  }

  async handlePlayPauseToggle(): Promise<{ success: boolean; status?: string; error?: string }> {
    try {
      const session = this.playService.activePlaySession
      if (!session) {
        throw new Error('활성 운동 플레이 세션을 찾을 수 없습니다')
      }

      if (session.status === 'playing') {
        session.status = 'paused'
        this.playService.pausePlayTimer()
        this.deps.broadcastToAllWindows('workout-play-paused', { session })
        log('⏸ 운동 일시정지')
      } else if (session.status === 'paused') {
        session.status = 'playing'
        this.deps.broadcastToAllWindows('workout-play-resumed', { session })
        this.playService.resumePlayTimer()
        log('▶ 운동 재개')
      }

      return { success: true, status: session.status }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' }
    }
  }

  async handlePlayStop(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      if (!this.playService.activePlaySession) {
        return { success: true, message: '종료할 세션이 없습니다' }
      }
      this.playService.stopPlaySession()
      log('⏹ 운동 종료 및 초기화')
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' }
    }
  }

  async handlePlayNext(): Promise<{ success: boolean; message?: string; newIndex?: number; error?: string }> {
    try {
      const session = this.playService.activePlaySession
      if (!session) {
        return { success: false, error: '활성 플레이 세션이 없습니다' }
      }
      if (session.status !== 'playing' && session.status !== 'paused') {
        return { success: false, error: '운동이 진행 중이 아닙니다' }
      }

      const currentIndex = session.currentSequenceIndex
      const currentSeq = session.sequences[currentIndex]
      if (!currentSeq) {
        return { success: false, error: '현재 시퀀스를 찾을 수 없습니다' }
      }

      const currentRound = Number(currentSeq.round)

      // DS/CD 그룹 내 네비게이션 (DS1-3 → DS4-6 등)
      if (currentRound === 0 || currentRound === 99) {
        const groupNav = this.handleStretchingGroupNext(session, currentRound)
        if (groupNav === 'navigated') {
          return { success: true, message: '다음 그룹으로 이동했습니다' }
        }
        // 'fall-through': 더 이상 그룹이 없으므로 일반 네비게이션으로 계속
      }

      const circuitType = resolveModuleCircuitType(session.metadata, session.sequences)
      const nav = createPlaybackNavigation(circuitType)
      const nextIndex = nav.findNext(session.sequences, currentIndex, currentRound)

      if (nextIndex === null) {
        return { success: false, error: '다음 운동이 없습니다.' }
      }

      if (this.playService.playTimer) {
        clearTimeout(this.playService.playTimer)
        this.playService.playTimer = null
      }

      this.playService._lastStressGroupIndex = -1
      this.playService._stretchingGroupIndex = 0

      session.currentSequenceIndex = nextIndex
      log(`⏭️ 다음 운동 단위로 이동: ${currentIndex} -> ${nextIndex}`)

      const targetSeq = session.sequences[nextIndex]
      // countdown 시퀀스는 ReadyModule이 seek-queue로 올바른 위치를 잡으므로 여기서 seek 생략
      if (targetSeq.exercise_type !== 'countdown') {
        this.broadcastQueueSeek(targetSeq)
      }

      // status='paused'면 그대로 유지. WorkoutPlayService.schedulePlayTimer가
      // paused 상태이면 자동진행 타이머를 시작하지 않고, broadcastToAllWindows가
      // workout-play-sequence 직후에 workout-play-paused를 자동 전송한다.
      this.playService.continueSequenceExecution()

      return { success: true, message: '다음 운동 단위로 이동했습니다', newIndex: nextIndex }
    } catch (error) {
      console.error('다음 운동 이동 오류:', error)
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' }
    }
  }

  async handlePlayPrevious(): Promise<{ success: boolean; message?: string; newIndex?: number; error?: string }> {
    try {
      const session = this.playService.activePlaySession
      if (!session) {
        return { success: false, error: '활성 플레이 세션이 없습니다' }
      }
      if (session.status !== 'playing' && session.status !== 'paused') {
        return { success: false, error: '운동이 진행 중이 아닙니다' }
      }

      const currentIndex = session.currentSequenceIndex
      const currentSeq = session.sequences[currentIndex]
      if (!currentSeq) {
        return { success: false, error: '현재 시퀀스를 찾을 수 없습니다' }
      }

      const currentRound = Number(currentSeq.round)

      // DS/CD 그룹 내 이전 네비게이션 (DS4-6 → DS1-3 등)
      if (currentRound === 0 || currentRound === 99) {
        const groupNav = this.handleStretchingGroupPrevious(session, currentRound)
        if (groupNav === 'navigated') {
          return { success: true, message: '이전 그룹으로 이동했습니다' }
        }
      }

      const circuitType = resolveModuleCircuitType(session.metadata, session.sequences)
      const nav = createPlaybackNavigation(circuitType)
      const prevIndex = nav.findPrevious(session.sequences, currentIndex, currentRound)

      if (prevIndex === null) {
        return { success: false, error: '이전 운동이 없습니다.' }
      }

      if (this.playService.playTimer) {
        clearTimeout(this.playService.playTimer)
        this.playService.playTimer = null
      }

      this.playService._lastStressGroupIndex = -1

      const targetSeq = session.sequences[prevIndex]
      const targetRound = Number(targetSeq.round)
      if (targetRound === 0 || targetRound === 99) {
        const totalGroups = this.countStretchingGroups(session, targetRound)
        this.playService._stretchingGroupIndex = Math.max(0, totalGroups - 1)
      } else {
        this.playService._stretchingGroupIndex = 0
      }

      session.currentSequenceIndex = prevIndex
      log(`⏮️ 이전 운동 단위로 이동: ${currentIndex} -> ${prevIndex}`)

      if (targetRound === 0 || targetRound === 99) {
        const prefix = targetRound === 0 ? 'DS' : 'CD'
        const groupStart = this.playService._stretchingGroupIndex * 3 + 1
        this.deps.broadcastToAllWindows('workout-seek-queue', {
          round: targetRound,
          position: `${prefix}${groupStart}`,
        })
      } else {
        this.broadcastQueueSeek(targetSeq)
      }

      this.playService.continueSequenceExecution()

      return { success: true, message: '이전 운동 단위로 이동했습니다', newIndex: prevIndex }
    } catch (error) {
      console.error('이전 운동 이동 오류:', error)
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' }
    }
  }

  private countStretchingGroups(session: any, round: number): number {
    const exercises = session.sequences.filter(
      (s: any) => Number(s.round) === round &&
        s.exercise_type === 'exercise' &&
        s.exercise_name !== '임시운동' &&
        s.duration > 0
    )
    console.log(`📊 [DS/CD GroupCount] round=${round}, exerciseCount=${exercises.length}, groups=${Math.ceil(exercises.length / 3)}`)
    return Math.ceil(exercises.length / 3)
  }

  private handleStretchingGroupNext(session: any, currentRound: number): 'navigated' | 'fall-through' {
    const totalGroups = this.countStretchingGroups(session, currentRound)
    const currentGroup = this.playService._stretchingGroupIndex

    console.log(`⏭️ [DS/CD GroupNav] currentGroup=${currentGroup}, totalGroups=${totalGroups}, check=${currentGroup + 1 >= totalGroups}`)

    if (currentGroup + 1 >= totalGroups) return 'fall-through'

    if (this.playService.playTimer) {
      clearTimeout(this.playService.playTimer)
      this.playService.playTimer = null
    }

    this.playService._stretchingGroupIndex = currentGroup + 1

    const prefix = currentRound === 0 ? 'DS' : 'CD'
    const seekLabel = `${prefix}${(currentGroup + 1) * 3 + 1}`
    this.deps.broadcastToAllWindows('workout-seek-queue', { round: currentRound, position: seekLabel })

    log(`⏭️ ${prefix} 그룹 ${currentGroup + 1} → ${currentGroup + 2} (총 ${totalGroups}그룹)`)
    this.playService.continueSequenceExecution()
    return 'navigated'
  }

  private handleStretchingGroupPrevious(session: any, currentRound: number): 'navigated' | 'fall-through' {
    const currentGroup = this.playService._stretchingGroupIndex

    if (currentGroup <= 0) return 'fall-through'

    if (this.playService.playTimer) {
      clearTimeout(this.playService.playTimer)
      this.playService.playTimer = null
    }

    this.playService._stretchingGroupIndex = currentGroup - 1

    const prefix = currentRound === 0 ? 'DS' : 'CD'
    const seekLabel = `${prefix}${(currentGroup - 1) * 3 + 1}`
    this.deps.broadcastToAllWindows('workout-seek-queue', { round: currentRound, position: seekLabel })

    log(`⏮️ ${prefix} 그룹 ${currentGroup + 1} → ${currentGroup} (이전 그룹)`)
    this.playService.continueSequenceExecution()
    return 'navigated'
  }

  private broadcastQueueSeek(targetSeq: any) {
    if (!targetSeq) return
    const round = Number(targetSeq.round)
    const session = this.playService.activePlaySession
    const circuitType = normalizeCircuitTypeFromMetadata(session?.metadata)
    const position = circuitType === 'loop'
      ? resolveLoopQueueSeekPosition(targetSeq, getHalfRoundsCountFromSession(session))
      : String(targetSeq.position || '')
    this.deps.broadcastToAllWindows('workout-seek-queue', { round, position })
  }

  async handlePausePlay(): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!this.playService.activePlaySession) {
      return { success: false, error: '활성 플레이 세션이 없습니다' }
    }

    this.playService.activePlaySession.status = 'paused'
    if (this.playService.playTimer) {
      clearTimeout(this.playService.playTimer)
      this.playService.playTimer = null
    }

    this.deps.broadcastToAllWindows('workout-play-paused', {
      session: this.playService.activePlaySession
    })

    return { success: true, message: '일시정지되었습니다' }
  }

  async handleGetSessionStatus() {
    let isFullscreen = true
    const allWindows = BrowserWindow.getAllWindows()
    if (allWindows.length > 0) {
      isFullscreen = !allWindows[0].isMovable()
    }

    return {
      hasActiveSession: false,
      session: null,
      heartRateCount: 0,
      hasActivePlaySession: !!this.playService.activePlaySession,
      playSession: this.playService.activePlaySession,
      isFullscreen,
    }
  }

  async handleCreateMonitors(): Promise<{ success: boolean; message?: string; windowCount?: number; error?: string }> {
    try {
      log('🚀 handleCreateMonitors 호출됨')

      const { app } = require('electron')
      if (!app.isReady()) {
        console.error('❌ Electron 앱이 준비되지 않았습니다')
        throw new Error('Electron 앱이 준비되지 않았습니다')
      }

      const existingWindows = BrowserWindow.getAllWindows()
      log(`📊 현재 열려있는 창 수: ${existingWindows.length}`)

      if (existingWindows.length > 1) {
        log('ℹ️ 이미 창들이 열려있습니다')
        return {
          success: true,
          message: `모니터 창이 이미 ${existingWindows.length}개 실행 중입니다`,
          windowCount: existingWindows.length
        }
      }

      const globalApp = (global as any).multiMonitorApp
      log('🔍 전역 앱 인스턴스:', !!globalApp)

      if (globalApp && typeof globalApp.createWindows === 'function') {
        log('✅ createWindows 메서드 호출 중...')
        await globalApp.createWindows()

        const newWindowCount = BrowserWindow.getAllWindows().length
        log(`✨ 모니터 창 생성 완료! 현재 창 수: ${newWindowCount}`)

        return {
          success: true,
          message: '모니터 창 3개가 성공적으로 생성되었습니다',
          windowCount: newWindowCount
        }
      } else {
        console.error('❌ 전역 앱 인스턴스를 찾을 수 없습니다')
        throw new Error('모니터 창 생성 기능을 찾을 수 없습니다')
      }
    } catch (error) {
      console.error('모니터 창 생성 실패:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      }
    }
  }

  async handleToggleFullscreen(): Promise<{ success: boolean; isFullscreen?: boolean; message?: string; error?: string }> {
    try {
      const allWindows = BrowserWindow.getAllWindows()

      if (allWindows.length === 0) {
        return { success: false, error: '활성 창이 없습니다' }
      }

      const firstWindow = allWindows[0]
      const isCurrentlyMovable = firstWindow.isMovable()
      const nextFullscreen = isCurrentlyMovable

      allWindows.forEach(window => {
        try { window.setMovable(!nextFullscreen) } catch { }
        try { window.setResizable(!nextFullscreen) } catch { }
      })

      allWindows.forEach((window) => {
        try {
          window.webContents.send('window-mode-changed', { isFullscreen: nextFullscreen })
        } catch { }
      })

      log(`🖥️ 전체화면 ${nextFullscreen ? '활성화' : '비활성화'} (setBounds 방식)`)

      return {
        success: true,
        isFullscreen: nextFullscreen,
        message: nextFullscreen ? '전체화면으로 전환되었습니다' : '일반 화면으로 전환되었습니다'
      }
    } catch (error) {
      console.error('전체화면 토글 실패:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      }
    }
  }

  handleQuitApp() {
    try {
      log('🛑 앱 종료 요청')
      const allWindows = BrowserWindow.getAllWindows()
      allWindows.forEach(window => { window.close() })
      const { app } = require('electron')
      app.quit()
    } catch (error) {
      console.error('앱 종료 실패:', error)
    }
  }

}
