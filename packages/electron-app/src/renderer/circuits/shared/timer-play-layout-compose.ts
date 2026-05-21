import { createIntroOverlayHtml } from './timer-layout-intro-default.js'
import { createLeftTimerDisplayHtml } from './timer-layout-left-panel.js'
import type { TimerIntroDiagramScreenMode } from './timer-layout-flow-diagram.js'

/** 타이머 모니터 전체 HTML(좌측 + 심박 패널 + 인트로). 조립 전용 — 조각은 같은 디렉터리 및 서킷별 `timer-layout-intro`. */
export const createWorkoutPlayTimerHtml = (
  rightPanelHtml: string,
  introDiagramScreenMode: TimerIntroDiagramScreenMode = 'three',
): string => {
  return `
      <div style="
        display: flex; 
        flex-direction: row;
        height: 100vh; 
        width: 100vw;
        background: #000;
        color: white;
        font-family: 'Arial', sans-serif;
        overflow: hidden;
        gap: 2px;
      ">
        <!-- 좌측 화면: Round + 시간 -->
        ${createLeftTimerDisplayHtml()}
        
        <!-- 우측 화면: 심박수 전체 -->
        ${rightPanelHtml}
      
      <!-- 인트로 전용 전면 오버레이 (대형 화면 반응형) -->
      ${createIntroOverlayHtml(introDiagramScreenMode)}
    </div>
  `
}
