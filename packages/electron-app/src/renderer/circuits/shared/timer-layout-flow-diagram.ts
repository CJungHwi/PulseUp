export type TimerIntroDiagramScreenMode = 'three' | 'five'

const diagramAssetForMode = (mode: TimerIntroDiagramScreenMode): string =>
  mode === 'five' ? './assets/workout-diagram5.png' : './assets/workout-diagram.png'

/** 인트로 좌측(다이어그램 + WATER BREAK) — 모든 서킷 공용 */
export const createWorkoutFlowDiagramHtml = (screenMode: TimerIntroDiagramScreenMode = 'three'): string => {
  const diagramSrc = diagramAssetForMode(screenMode)
  return `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: stretch;
        height: 100%;
        width: 100%;
      ">
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          width: 100%;
          min-height: 0;
          overflow: hidden;
        ">
          <img 
            src="${diagramSrc}" 
            alt="Workout Flow Diagram"
            style="
              width: 100%;
              height: 100%;
              object-fit: contain;
            "
          />
        </div>
        <!-- WATER BREAK 영역 -->
        <div style="
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 8px 24px;
          background: #fff;
          border-radius: 6px;
          min-width: 180px;
          min-height: 70px;
          box-sizing: border-box;
        ">
          <span style="
            font-size: 18px;
            font-weight: 800;
            color: #196093;
            letter-spacing: 1.5px;
            line-height: 1;
          ">WATER BREAK</span>
          <span id="intro-water-break-time" style="
            font-size: 48px;
            font-weight: 900;
            color: #196093;
            line-height: 1;
            margin-top: 2px;
          "></span>
        </div>
      </div>
    `
}
