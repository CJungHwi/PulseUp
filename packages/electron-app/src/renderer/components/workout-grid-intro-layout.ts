const INTRO_GRID_COLUMNS = 2
const INTRO_GRID_ROWS = 3
const VIDEO_ASPECT_WIDTH = 16
const VIDEO_ASPECT_HEIGHT = 9

// 2열 x 3행 전체 그리드가 각 셀의 16:9 비율을 유지하도록 만드는 높이 비율.
export const INTRO_VIDEO_GRID_HEIGHT = `min(
  calc(100% - max(6vh, 48px)),
  calc(100vw * ${INTRO_GRID_ROWS * VIDEO_ASPECT_HEIGHT} / ${INTRO_GRID_COLUMNS * VIDEO_ASPECT_WIDTH})
)`

const INTRO_IMAGE_CONTAINER_STYLE = `
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
  background: #000;
  overflow: hidden;
`

export const buildIntroVideoCellDividerStyle = (slotNum: number): string => {
  const isLeftColumn = slotNum <= INTRO_GRID_ROWS
  const isLastRow = slotNum === INTRO_GRID_ROWS || slotNum === INTRO_GRID_ROWS * INTRO_GRID_COLUMNS

  return `
    border: 0;
    border-radius: 0;
    box-sizing: border-box;
    ${isLeftColumn ? 'border-right: 2px solid #222;' : ''}
    ${isLastRow ? '' : 'border-bottom: 2px solid #222;'}
  `
}

export const buildWorkoutGridIntroImageSection = (
  isIntro: boolean,
  introImageUrl: string | undefined,
): string => {
  if (isIntro && introImageUrl) {
    return `<div style="${INTRO_IMAGE_CONTAINER_STYLE}">
           <img
             src="${introImageUrl}"
             alt="Intro Image"
             style="
               position: absolute;
               inset: 0;
               width: 100%;
               height: 100%;
               object-fit: contain;
             "
           />
         </div>`
  }
  if (isIntro) {
    return `<div style="
             ${INTRO_IMAGE_CONTAINER_STYLE}
             display: flex;
             align-items: center;
             justify-content: center;
           ">
             <span style="color: #555; font-size: 24px; font-family: sans-serif;">No Image</span>
           </div>`
  }
  return ''
}
