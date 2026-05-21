import {
  createWorkoutFlowDiagramHtml,
  type TimerIntroDiagramScreenMode,
} from './timer-layout-flow-diagram.js'

/**
 * 인트로 전면 오버레이 마크업 — DOM id 는 WorkoutPlayTimerUI 와 고정 계약.
 * 서킷 전용 변형은 `circuits/<stress|loop|amrap|emom>/timer-layout-intro.ts` 에서 이 함수를 대체해 export.
 */
export const createIntroOverlayHtml = (screenMode: TimerIntroDiagramScreenMode = 'three'): string => {
  return `
      <div id="intro-overlay" style="
        position: absolute;
        inset: 0;
        background: #000;
        display: none;
        flex-direction: column;
        z-index: 2000;
        color: #fff;
        overflow: hidden;
        padding: min(2vh, 20px) min(2vw, 40px);
        box-sizing: border-box;
      ">
        <style>
          @keyframes introLogoGlow {
            0%, 100% { 
              filter: drop-shadow(0 0 8px rgba(255, 165, 0, 0.8)) 
                      drop-shadow(0 0 15px rgba(255, 165, 0, 0.6)) 
                      drop-shadow(0 0 25px rgba(255, 165, 0, 0.4));
            }
            50% { 
              filter: drop-shadow(0 0 15px rgba(255, 165, 0, 1)) 
                      drop-shadow(0 0 30px rgba(255, 165, 0, 0.8)) 
                      drop-shadow(0 0 45px rgba(255, 165, 0, 0.6));
            }
          }
        </style>
        <div style="
          display: flex;
          flex-direction: row;
          align-items: center;
          height: 20%;
        ">
          <div style="
            width: 20%;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            padding-left: 30px;
          ">
            <img src="./assets/logo.png" alt="LINKHIIT" style="height: 100px; object-fit: contain; animation: introLogoGlow 2s ease-in-out infinite;" />
          </div>
          <div style="
            flex: 1;
            min-width: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          ">
            <div id="intro-workout-title" style="
              width: 100%;
              font-size: clamp(40px, 8vw, 120px);
              font-weight: 1000;
              font-style: italic;
              color: #fff;
              letter-spacing: 5px;
              text-transform: uppercase;
              text-align: center;
              white-space: nowrap;
            ">MAIN TRAINING</div>
          </div>
          <div style="
            width: 20%;
            flex-shrink: 0;
          "></div>
        </div>
        
        <div style="
          flex: 1;
          display: flex;
          flex-direction: row;
          align-items: stretch;
          gap: 20px;
          height: 80%;
        ">
          <div style="
            width: 60%;
            min-width: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #196093;
            border-radius: 15px;
            padding: 15px 15px 30px 15px;
            overflow: hidden;
          ">
            ${createWorkoutFlowDiagramHtml(screenMode)}
          </div>
          
          <div id="intro-bottom-section" style="
            width: 40%;
            min-width: 0;
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: 1fr 1fr;
            gap: 12px;
            padding: 10px;
            box-sizing: border-box;
          ">
            <!-- 좌측 상단: 운동시간 -->
            <div data-intro-cell style="
              display: flex;
              align-items: center;
              justify-content: center;
              background: rgba(255, 255, 255, 0.06);
              border-radius: 12px;
              padding: 10px;
              overflow: hidden;
            ">
              <div data-intro-cell-inner style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <div id="intro-total-time" style="
                  font-size: clamp(48px, 7.2vw, 120px);
                  font-weight: 900;
                  font-style: italic;
                  color: #fff;
                  line-height: 1;
                  white-space: nowrap;
                ">00:00</div>
                <div id="intro-total-time-caption" style="
                  font-size: clamp(19px, 2.4vw, 34px);
                  font-weight: 700;
                  color: rgba(255, 255, 255, 0.7);
                  text-transform: uppercase;
                  letter-spacing: 3px;
                  margin-top: 6px;
                  white-space: nowrap;
                ">TIME</div>
              </div>
            </div>

            <!-- 우측 상단: 운동갯수 -->
            <div data-intro-cell style="
              display: flex;
              align-items: center;
              justify-content: center;
              background: rgba(255, 255, 255, 0.06);
              border-radius: 12px;
              padding: 10px;
              overflow: hidden;
            ">
              <div data-intro-cell-inner style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <div id="intro-exercise-count" style="
                  font-size: clamp(48px, 7.2vw, 120px);
                  font-weight: 900;
                  font-style: italic;
                  color: #fff;
                  line-height: 1;
                  white-space: nowrap;
                ">0</div>
                <div style="
                  font-size: clamp(19px, 2.4vw, 34px);
                  font-weight: 700;
                  color: rgba(255, 255, 255, 0.7);
                  text-transform: uppercase;
                  letter-spacing: 3px;
                  margin-top: 6px;
                  white-space: nowrap;
                ">Exercises</div>
              </div>
            </div>

            <!-- 좌측 하단: 운동설정 (WORK / REST) -->
            <div data-intro-cell style="
              display: flex;
              align-items: center;
              justify-content: center;
              background: rgba(255, 255, 255, 0.06);
              border-radius: 12px;
              padding: 10px;
              overflow: hidden;
            ">
              <div data-intro-cell-inner style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <div id="intro-workout-plans" style="
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  gap: 0;
                  width: 100%;
                ">
                </div>
                <div style="
                  display: flex;
                  gap: clamp(20px, 4vw, 60px);
                  justify-content: center;
                  margin-top: 6px;
                ">
                  <span style="
                    font-size: clamp(19px, 2.4vw, 34px);
                    font-weight: 700;
                    color: rgba(255, 255, 255, 0.7);
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    white-space: nowrap;
                  ">WORK</span>
                  <span style="
                    font-size: clamp(19px, 2.4vw, 34px);
                    font-weight: 700;
                    color: rgba(255, 255, 255, 0.7);
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    white-space: nowrap;
                  ">REST</span>
                </div>
              </div>
            </div>

            <!-- 우측 하단: ROUND / SET -->
            <div data-intro-cell style="
              display: flex;
              align-items: center;
              justify-content: center;
              background: rgba(255, 255, 255, 0.06);
              border-radius: 12px;
              padding: 10px;
              overflow: hidden;
            ">
              <div data-intro-cell-inner style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;">
                <div id="intro-sets-wrapper" style="display: flex; flex-direction: column; align-items: center;">
                  <div id="intro-sets" style="
                    font-size: clamp(48px, 7.2vw, 120px);
                    font-weight: 900;
                    font-style: italic;
                    color: #fff;
                    line-height: 1;
                  ">0</div>
                  <div style="
                    font-size: clamp(19px, 2.4vw, 34px);
                    font-weight: 700;
                    color: rgba(255, 255, 255, 0.7);
                    text-transform: uppercase;
                    letter-spacing: 3px;
                    white-space: nowrap;
                  ">SET</div>
                </div>

                <div id="intro-rounds-wrapper" style="display: flex; flex-direction: column; align-items: center;">
                  <div id="intro-rounds" style="
                    font-size: clamp(48px, 7.2vw, 120px);
                    font-weight: 900;
                    font-style: italic;
                    color: #fff;
                    line-height: 1;
                  ">0</div>
                  <div style="
                    font-size: clamp(19px, 2.4vw, 34px);
                    font-weight: 700;
                    color: rgba(255, 255, 255, 0.7);
                    text-transform: uppercase;
                    letter-spacing: 3px;
                    white-space: nowrap;
                  ">ROUND</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>
        @keyframes introTitleIn {
          0% { transform: scale(0.5) translateY(100px); opacity: 0; filter: blur(20px); }
          100% { transform: scale(1) translateY(0); opacity: 1; filter: blur(0); }
        }
        @keyframes introSubtitleIn {
          0% { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes introPulse {
          0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 30px rgba(0, 191, 255, 0.3); }
          50% { opacity: 0.7; transform: scale(0.98); box-shadow: 0 0 50px rgba(0, 191, 255, 0.6); }
        }
      </style>
    `
}
