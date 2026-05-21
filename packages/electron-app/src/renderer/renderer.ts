/// <reference path="../types/electron.d.ts" />

import { ElectronRendererDevice } from './electron-renderer-device.js'
import { initRendererDiagnostics } from './renderer-diagnostics.js'

export class ElectronRenderer extends ElectronRendererDevice {
  protected registerEventListeners() {
    // 🎬 카운트다운 시작 이벤트 (모든 창에서 모달 표시)
    window.electronAPI.onCountdownStarted((data) => {
      console.log('🎬 카운트다운 시작!', data)
      this.introPlaybackActive = false
      this.hideSplashScreen()
      if (this.workoutPlayTimerUI) {
        this.workoutPlayTimerUI.hideIntroMode()
        if (data?.phase === 'session-start') {
          this.workoutPlayTimerUI.applySessionStartCountdownHeader()
        }
      }
      if (data?.phase === 'session-start' && this.workoutGridDisplay?.isQueueMode()) {
        this.workoutGridDisplay.revealFirstEntries()
      }
      this.showCountdownModal(data)
    })

    // 🎬 인트로 시작 이벤트
    window.electronAPI.onIntroStarted((data: any) => {
      console.log('🎬 인트로 시작!')
      this.hideSplashScreen()
      this.handleIntroStarted(data)
    })

    window.electronAPI.onIntroCancelledResetToReady((data?: { showSplash?: boolean }) => {
      this.handleIntroCancelledResetToReady(data)
    })

    // 🎬 운동 시작 직전 프리뷰(카운트다운 중 영상 미리 출력)
    window.electronAPI.onWorkoutPlayPreview((data: any) => {
      this.handleWorkoutPlayPreview(data)
    })

    // 🎬 다음 set 프리로드 (세트 전환 로딩 최소화)
    window.electronAPI.onWorkoutPlayPreload((data: any) => {
      this.handleWorkoutPlayPreload(data)
    })

    window.electronAPI.onWorkoutPlayClearPreload((data) => {
      this.handleWorkoutPlayClearPreloadFromMain(data)
    })

    // 운동 플레이 이벤트 리스너
    window.electronAPI.onWorkoutPlayStarted((data: any) => {
      console.log('🏋️ 운동 플레이 시작됨:', data)
      this.isWorkoutCompletedSequence = false
      this.hideSplashScreen()
      this.handleWorkoutPlayStarted(data)
    })

    window.electronAPI.onWorkoutPlaySequence((data: any) => {
      console.log('🎬 시퀀스 실행:', data)
      this.handleWorkoutPlaySequence(data)
    })

    window.electronAPI.onWorkoutPlayCompleted((data: any) => {
      console.log('✅ 운동 플레이 완료:', data)
      this.isWorkoutCompletedSequence = true
      this.handleWorkoutPlayCompleted(data)
      this.hasCountdownPreview = false
    })

    // 운동 플레이 대기 상태 (웹에서 데이터 전송 완료) — 리모컨에서 시작/인트로 전까지 스플래시 유지
    window.electronAPI.onWorkoutPlayReady((data: any) => {
      console.log('🔵 운동 플레이 대기:', data)
    })

    // 운동 플레이 일시정지
    window.electronAPI.onWorkoutPlayPaused((data: any) => {
      console.log('⏸ 운동 플레이 일시정지:', data)
      // 비디오 일시정지
      if (this.isWorkoutGridDisplay(this.currentDisplay)) {
        if (this.workoutGridDisplay) {
          this.workoutGridDisplay.pauseAllVideos()
        }
      }
      // 타이머 일시정지
      if (this.currentDisplay === 'timer') {
        if (this.workoutPlayTimerUI) {
          this.workoutPlayTimerUI.pauseTimer()
        }
      }
    })

    // 운동 플레이 재개
    window.electronAPI.onWorkoutPlayResumed((data: any) => {
      console.log('▶️ 운동 플레이 재개:', data)
      // 비디오 재개
      if (this.isWorkoutGridDisplay(this.currentDisplay)) {
        if (this.workoutGridDisplay) {
          this.workoutGridDisplay.resumeAllVideos()
        }
      }
      // 타이머 재개
      if (this.currentDisplay === 'timer') {
        if (this.workoutPlayTimerUI) {
          this.workoutPlayTimerUI.resumeTimer()
        }
      }
    })

    // 운동 플레이 종료
    window.electronAPI.onWorkoutPlayStopped((data: any) => {
      console.log('⏹ 운동 플레이 종료:', data)
      this.hasCountdownPreview = false
      this.introPlaybackActive = false
      this.clearIntroEndNotifyTimer()

      // 카운트다운 중이면 즉시 중단 (모달 제거, 인터벌 취소)
      this.stopCountdownModal()

      // Round 초기화
      this.currentRound = 0

      // 타이머 화면 초기화
      if (this.workoutPlayTimerUI) {
        this.workoutPlayTimerUI.reset()
      }

      // 운동 종료 시 Splash 화면 복귀 (정상 완료 시퀀스가 아닐 때만 즉시 복귀)
      // 정상 완료 시에는 showCongratsOverlay 후 showSplashScreen이 호출됨
      if (!this.isWorkoutCompletedSequence) {
        this.showSplashScreen()
      }

      // 좌우 운동 화면 초기화
      if (this.workoutGridDisplay) {
        this.workoutGridDisplay.hideArrowOverlay()
        this.workoutGridDisplay.hidePauseOverlay()
        this.workoutGridDisplay.cleanupQueues()
        this.workoutGridDisplay.clearPreloadCache()
        this.workoutGridDisplay.clearAllVideoCells()
      }
    })

    // 스트레칭 그룹 전환 (영상 재로드 없이 보이는 슬롯만 토글)
    window.electronAPI.onWorkoutStretchingSwitchGroup((data: any) => {
      console.log(`🔄 스트레칭 그룹 전환: groupIndex=${data.groupIndex}`)
      if (this.workoutGridDisplay) {
        this.workoutGridDisplay.switchStretchingGroup(data.groupIndex)
      }
    })

    // 슬롯별 영상 큐 설정
    window.electronAPI.onWorkoutSetupQueue((data: any) => {
      this.handleSetupVideoQueue(data)
    })

    // 슬롯 전환 (다음 영상으로)
    window.electronAPI.onWorkoutAdvanceSlots((data: any) => {
      this.handleAdvanceSlots(data)
    })

    // 큐 seek (내비게이션 다음/이전)
    window.electronAPI.onWorkoutSeekQueue((data: { round: number; position: string }) => {
      this.handleSeekQueue(data)
    })

    // 메인 프로세스로부터의 이벤트 리스너
    window.electronAPI.onWorkoutStarted((data: any) => {
      console.log('운동 시작됨:', data)
      this.isWorkoutActive = true
      this.startWorkoutTimer()

      if (this.multiMonitorManager) {
        this.multiMonitorManager.startWorkout()
      }

      this.updateDisplay()
    })

    window.electronAPI.onWorkoutStopped(() => {
      console.log('운동 종료됨')
      this.isWorkoutActive = false
      this.stopWorkoutTimer()

      if (this.multiMonitorManager) {
        this.multiMonitorManager.stopWorkout()
      }

      this.updateDisplay()
    })

    window.electronAPI.onPlaylistLoaded((data: any) => {
      console.log('플레이리스트 로드됨:', data)
      this.currentPlaylist = data

      if (this.multiMonitorManager) {
        this.multiMonitorManager.loadWorkoutPlaylist(data)
      }

      this.updateDisplay()
    })

    // 심박 IPC는 renderer-heart-ipc → WorkoutHeartRatePanel / 디바이스 연결 화면에서 구독

    window.electronAPI.onMenuStartWorkout(() => {
      if (this.currentDisplay === 'control') {
        this.startWorkout()
      }
    })

    window.electronAPI.onMenuStopWorkout(() => {
      if (this.currentDisplay === 'control') {
        this.stopWorkout()
      }
    })

    // 창 크기 변경 이벤트
    window.addEventListener('resize', () => {
      this.handleResize()
    })

    // 키보드 단축키
    window.addEventListener('keydown', (event) => {
      this.handleKeyPress(event)
    })
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initRendererDiagnostics()
  new ElectronRenderer()
})

