/** 기기/제어 화면용 HTML 조각 (렌더러에서 innerHTML에 주입) */

export const buildMainControlPanelHtml = (isWorkoutActive: boolean): string => `
        <div class="control-panel" style="padding: 30px; max-width: 500px; margin: 0 auto;">
          <div class="control-section" style="margin-bottom: 30px; background: rgba(255, 255, 255, 0.05); border: 1px solid #333;">
            <div class="control-title" style="font-size: 24px; margin-bottom: 20px; color: #fff;">
              <span class="status-indicator ${isWorkoutActive ? 'status-active' : 'status-inactive'}" id="status-indicator"></span>
              운동 상태: <span id="workout-status-text" style="color: #4CAF50; font-weight: bold;">${isWorkoutActive ? '진행중' : '대기중'}</span>
            </div>
            <div style="display: flex; gap: 15px; flex-direction: column;">
              <button class="control-button" id="start-workout-btn" style="font-size: 18px; padding: 15px 30px; background-color: #4CAF50;">
                ▶ 운동 시작
              </button>
              <button class="control-button" id="pause-workout-btn" style="font-size: 18px; padding: 15px 30px; background-color: #ff9800;">
                ⏸ 일시정지
              </button>
              <button class="control-button danger" id="stop-workout-btn" style="font-size: 18px; padding: 15px 30px;">
                ⏹ 운동 종료
              </button>
            </div>
          </div>
          
          <div class="control-section" style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #333; background: rgba(255, 255, 255, 0.05); border: 1px solid #333;">
            <div class="control-title" style="font-size: 20px; margin-bottom: 15px; color: #fff;">설정</div>
            <div style="display: flex; gap: 10px; flex-direction: row;">
              <button class="control-button" id="toggle-fullscreen-btn" style="flex: 1; font-size: 16px; padding: 12px 20px; background-color: #2196F3; white-space: nowrap;">
                <span id="fullscreen-btn-text">🖥 전체보기</span>
              </button>
              <button class="control-button" id="logout-btn" style="flex: 1; font-size: 16px; padding: 12px 20px; background-color: #FF9800;">로그아웃</button>
              <button class="control-button danger" id="quit-app-btn" style="flex: 1; font-size: 16px; padding: 12px 20px;">앱 종료</button>
            </div>
          </div>
        </div>
      `
