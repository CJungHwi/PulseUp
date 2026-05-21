export type DisplayType =
  | 'workout-left'
  | 'workout-left-2'
  | 'workout-right'
  | 'workout-right-2'
  | 'timer'
  | 'background'
  | 'workout'
  | 'control'

/** 5-screen 모드 패널 식별자 */
export type FiveScreenPanel = 'L1' | 'L2' | 'R1' | 'R2'

/** DisplayType → 5-screen 패널 매핑 (3-screen / 비매핑은 null) */
export function displayTypeToFivePanel(displayType: DisplayType): FiveScreenPanel | null {
  switch (displayType) {
    case 'workout-left':
      return 'L1'
    case 'workout-left-2':
      return 'L2'
    case 'workout-right':
      return 'R1'
    case 'workout-right-2':
      return 'R2'
    default:
      return null
  }
}

/** 운동 그리드 화면(좌1/좌2/우1/우2) 여부 */
export function isWorkoutGridDisplayType(display: DisplayType): boolean {
  return (
    display === 'workout-left' ||
    display === 'workout-left-2' ||
    display === 'workout-right' ||
    display === 'workout-right-2'
  )
}

/** 좌측 모니터 화면(좌1/좌2) 여부 */
export function isLeftMonitorDisplay(display: DisplayType): boolean {
  return display === 'workout-left' || display === 'workout-left-2'
}
