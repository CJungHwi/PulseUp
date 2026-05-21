/** 타이머 모니터 좌측 패널(SET/MOVE·카운트다운·하단 시계) — 모든 서킷 공용 */
export const createLeftTimerDisplayHtml = (): string => {
  return `
      <div style="
        flex: 1;
        display: flex; 
        flex-direction: column; 
        height: 100vh;
        background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
        overflow: hidden;
      ">
        <!-- 숨겨진 요소들 (데이터 유지용) -->
        <div style="display: none;">
          <span id="workout-category-left"></span>
          <span id="round-label-left" style="text-transform:uppercase">RND</span>
          <span id="current-round-left">1</span>
          <span id="total-rounds-left">2</span>
          <span id="exercise-count">(0)</span>
          <div id="total-workout-time">00:00:00</div>
        </div>

        <!-- RND / MOVE: 좌우 5:5 중앙정렬 (배경색 고정) -->
        <div style="
          flex-shrink: 0;
          width: 100%;
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          padding: clamp(8px, 1vh, 16px) clamp(8px, 1vw, 16px);
          box-sizing: border-box;
        ">
          <div style="
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div id="set-display" style="
              display: inline-flex;
              align-items: baseline;
              justify-content: center;
              flex-wrap: nowrap;
              line-height: 1;
              gap: 0;
            ">
              <span style="line-height:1;display:inline-block;vertical-align:baseline;font-variant-numeric:tabular-nums;text-transform:uppercase;font-size: clamp(34px, 3.36vw, 96px); font-weight: 600; color: rgba(255,255,255,0.45);">SET</span>
              <span class="set-current" style="line-height:1;display:inline-block;vertical-align:baseline;font-variant-numeric:tabular-nums;font-size: clamp(58px, 6vw, 115px); font-weight: bold; color: #FFD700; margin-left: 0.4em;">1</span>
              <span class="set-total" style="line-height:1;display:inline-block;vertical-align:baseline;font-variant-numeric:tabular-nums;font-size: clamp(34px, 3.6vw, 67px); font-weight: 600; color: rgba(255,255,255,0.4); margin-left: 0.12em;">/ 3</span>
            </div>
          </div>
          <div style="
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div id="lap-display" style="
              display: inline-flex;
              align-items: baseline;
              justify-content: center;
              flex-wrap: nowrap;
              line-height: 1;
              gap: 0;
            ">
              <span style="line-height:1;display:inline-block;vertical-align:baseline;font-variant-numeric:tabular-nums;text-transform:uppercase;font-size: clamp(34px, 3.36vw, 96px); font-weight: 600; color: rgba(255,255,255,0.45);">MOVE</span>
              <span class="lap-current" style="line-height:1;display:inline-block;vertical-align:baseline;font-variant-numeric:tabular-nums;font-size: clamp(58px, 6vw, 115px); font-weight: bold; color: #00E5FF; margin-left: 0.4em;">3</span>
              <span class="lap-total" style="line-height:1;display:inline-block;vertical-align:baseline;font-variant-numeric:tabular-nums;font-size: clamp(34px, 3.6vw, 67px); font-weight: 600; color: rgba(255,255,255,0.4); margin-left: 0.12em;">/ 6</span>
            </div>
          </div>
        </div>

        <!-- 운동명 영역 (3) -->
        <div id="activity-section-left" style="
          flex: 3;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 0;
          overflow: hidden;
          padding: 0 20px;
          transition: background-color 0.5s ease;
        ">
          <div id="activity-label-left" style="
            width: 100%;
            font-size: clamp(40px, 8vw, 200px);
            font-weight: 900;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #fff;
            text-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            white-space: nowrap;
            text-align: center;
          ">READY</div>
        </div>

        <!-- 카운트다운 영역 (5) -->
        <div id="timer-container-left" style="
          flex: 5;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 0;
          overflow: hidden;
          padding: 0.6vh 20px 1.2vh;
          box-sizing: border-box;
          transition: background-color 0.5s ease;
        ">
          <div id="countdown-left" style="
            width: 100%;
            font-size: clamp(120px, 35vw, 450px);
            font-weight: 900;
            text-shadow: 0 8px 40px rgba(0, 0, 0, 0.4);
            color: #fff;
            line-height: 1.05;
            text-align: center;
            white-space: nowrap;
          ">--</div>
        </div>
        
        <!-- 하단 시간 영역 (2): 현재시간(좌) | 운동시간(우) -->
        <div id="bottom-time-section-left" style="
          flex: 2;
          display: flex;
          flex-direction: row;
          align-items: center;
          min-height: 0;
          padding: 0 40px;
          transition: background-color 0.5s ease;
        ">
          <div style="
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          ">
            <div style="
              font-size: clamp(18px, 1.5vw, 28px);
              font-weight: 600;
              color: rgba(255, 255, 255, 0.6);
              margin-bottom: 4px;
              white-space: nowrap;
            ">현재시간</div>
            <div id="current-time-display" style="
              font-size: clamp(48px, 5vw, 70px);
              font-weight: bold;
              color: rgba(255, 255, 255, 0.9);
              text-shadow: 0 0 15px rgba(0, 0, 0, 0.5);
              white-space: nowrap;
            ">00:00</div>
          </div>
          <div style="
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          ">
            <div style="
              font-size: clamp(18px, 1.5vw, 28px);
              font-weight: 600;
              color: rgba(255, 255, 255, 0.6);
              margin-bottom: 4px;
              white-space: nowrap;
            ">운동시간</div>
            <div id="total-workout-time-display" style="
              font-size: clamp(48px, 5vw, 70px);
              font-weight: bold;
              color: rgba(255, 255, 255, 0.9);
              text-shadow: 0 0 15px rgba(0, 0, 0, 0.5);
              white-space: nowrap;
            ">00:00</div>
          </div>
        </div>
      </div>
    `
}
