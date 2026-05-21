import {
  INTRO_VIDEO_GRID_HEIGHT,
  buildIntroVideoCellDividerStyle,
  buildWorkoutGridIntroImageSection,
} from './workout-grid-intro-layout.js'

export const createWorkoutGridCells = (
  prefix: string,
  count: number = 3,
  isIntro: boolean = false,
  isStretching: boolean = false,
): string => {
  const positionAlign = 'left: 15px;'
  return Array.from({ length: count }, (_, i) => i + 1)
    .map((slotNum) => {
      const hidden = isStretching && slotNum > 3
      const cellFrameStyle = isIntro
        ? buildIntroVideoCellDividerStyle(slotNum)
        : 'border: 3px solid #444; border-radius: 12px;'
      return `
      <div 
        id="video-slot-${prefix}${slotNum}" 
        data-slot="${prefix}${slotNum}"
        data-position=""
        data-stretching-group="${isStretching ? Math.ceil(slotNum / 3) : 0}"
        style="
          background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%); 
          display: ${hidden ? 'none' : 'flex'}; 
          align-items: center; 
          justify-content: center;
          color: #666;
          font-size: 24px;
          ${cellFrameStyle}
          position: relative;
          overflow: hidden;
          min-height: 0;
        "
      >
        <div class="placeholder" style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          z-index: 1;
        ">
          <div style="font-size: 64px; font-weight: bold; color: #555;">${prefix}${slotNum}</div>
          <div style="font-size: 18px; margin-top: 15px; color: #777; letter-spacing: 2px;">READY</div>
        </div>
        <div class="video-container" style="width: 100%; height: 100%; display: none; position: relative; z-index: 2;"></div>
        <div class="position-overlay" id="position-overlay-${prefix}${slotNum}" style="
          position: absolute;
          top: 15px;
          ${positionAlign}
          background: transparent;
          color: #000 !important;
          text-shadow: none;
          font-size: 60px;
          font-weight: bold;
          font-family: 'Arial Black', sans-serif;
          z-index: 4;
          ${isIntro ? 'display: block;' : 'display: none;'}
        ">${prefix}${slotNum}</div>
        <div class="reps-badge" id="reps-badge-${prefix}${slotNum}" style="
          position: absolute;
          top: 15px;
          right: 15px;
          background: transparent;
          color: #000;
          text-shadow: none;
          font-weight: bold;
          font-family: 'Arial Black', sans-serif;
          z-index: 4;
          display: none;
          text-align: center;
          line-height: 1.1;
        "></div>
      </div>
    `
    })
    .join('')
}

export type WorkoutGridShellSide = 'left' | 'left-2' | 'right' | 'right-2'

export type WorkoutGridShellParams = {
  side: WorkoutGridShellSide
  isIntro: boolean
  introImageUrl?: string
  stretchingSlotCount: number
}

export const buildWorkoutGridShellHtml = (p: WorkoutGridShellParams): string => {
  const prefix: 'L' | 'R' = p.side === 'left' || p.side === 'left-2' ? 'L' : 'R'
  const gridCols = p.isIntro ? 'repeat(2, 1fr)' : '1fr'
  const introImageSection = buildWorkoutGridIntroImageSection(p.isIntro, p.introImageUrl)
  const slotCount = p.isIntro ? 6 : p.stretchingSlotCount > 0 ? p.stretchingSlotCount : 3
  const gridCellsHtml = createWorkoutGridCells(prefix, slotCount, p.isIntro, p.stretchingSlotCount > 0)

  return `
      <style>
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes logoGlow {
          0%, 100% { 
            filter: drop-shadow(0 0 10px rgba(255, 165, 0, 0.7));
          }
          50% { 
            filter: drop-shadow(0 0 20px rgba(255, 165, 0, 0.9));
          }
        }
        @keyframes pauseBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      </style>
      
      <div style="
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
        background: #000;
        box-sizing: border-box;
        position: relative;
      ">
        <div id="logo-header-${p.side}" style="
          height: 6vh;
          min-height: 48px;
          flex-shrink: 0;
          background: #000;
          display: flex;
          align-items: center;
          padding: 0 20px;
          box-sizing: border-box;
        ">
          <div style="
            flex: 3;
            min-width: 0;
            display: flex;
            align-items: center;
            overflow: hidden;
          ">
            <div id="category-label-${p.side}" style="
              width: 100%;
              color: #fff;
              font-size: clamp(28px, 4vw, 48px);
              font-weight: bold;
              font-family: 'Arial Black', sans-serif;
              white-space: nowrap;
            "></div>
          </div>
          <div style="
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            flex-shrink: 0;
            overflow: hidden;
            height: 100%;
          ">
            <img 
              src="./assets/logo.png" 
              alt="LINKHIIT" 
              style="
                max-height: 100%;
                max-width: 100%;
                object-fit: contain;
                animation: logoGlow 3s ease-in-out infinite;
                will-change: filter;
              "
            />
          </div>
        </div>

        <div id="pause-overlay-${p.side}" style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 100%;
          height: 100%;
          display: none;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          pointer-events: none;
        ">
          <div id="pause-text-${p.side}" style="
            font-size: 500px;
            font-weight: 900;
            color: #FFD700;
            text-shadow: 0 0 100px rgba(255, 215, 0, 1), 0 0 50px rgba(255, 215, 0, 0.8);
            -webkit-text-stroke: 10px #FFA500;
            line-height: 1;
            font-family: monospace;
            animation: pauseBlink 1s ease-in-out infinite;
            will-change: opacity;
          ">||</div>
        </div>
        
        <div id="stretching-grid-${p.side}" style="
          ${p.isIntro ? `height: ${INTRO_VIDEO_GRID_HEIGHT}; flex-shrink: 0; min-height: 0;` : 'flex: 1;'}
          display: grid; 
          grid-template-columns: ${gridCols}; 
          grid-template-rows: ${p.isIntro ? 'repeat(3, minmax(0, 1fr))' : 'repeat(3, 1fr)'};
          ${p.isIntro ? 'grid-auto-flow: column;' : ''}
          gap: 0px;
          padding: 0px;
          overflow: hidden;
          align-content: stretch;
          min-height: 0;
        ">
          ${gridCellsHtml}
        </div>

        ${introImageSection}
      </div>
    `
}
