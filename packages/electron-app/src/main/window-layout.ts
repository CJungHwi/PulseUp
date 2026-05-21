import type { ScreenMode } from './screen-mode-store.js'

/**
 * 창 종류
 *   - 'workout-left'    : 좌측 영상 창 (3분할/5분할 공통)
 *   - 'workout-left-2'  : 좌측 영상 창 (5분할 전용 — 좌측 두 번째)
 *   - 'workout-right'   : 우측 영상 창 (3분할/5분할 공통)
 *   - 'workout-right-2' : 우측 영상 창 (5분할 전용 — 우측 두 번째)
 *   - 'timer'           : 가운데 카운터/타이머 창 (모드 무관, 항상 단일)
 *   - 'background'      : 잉여 모니터 안내 화면 (현재 미사용)
 *   - 'workout'         : 레거시(과거 단일 워크아웃 창). load-playlist IPC 호환을 위해 유지
 */
export type WindowType =
  | 'workout-left'
  | 'workout-left-2'
  | 'workout-right'
  | 'workout-right-2'
  | 'timer'
  | 'background'
  | 'workout'

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface WindowPlanItem {
  type: WindowType
  display: Electron.Display
  bounds: WindowBounds
}

export interface WindowPlan {
  items: WindowPlanItem[]
  /** 5분할 요청이 모니터 부족(1대) 등으로 영상창을 표시할 수 없을 때 true */
  fallbackToThree: boolean
  monitorCount: number
}

const fullBounds = (b: Electron.Rectangle): WindowBounds => ({
  x: b.x,
  y: b.y,
  width: b.width,
  height: b.height,
})

const leftHalf = (b: Electron.Rectangle): WindowBounds => {
  const w = Math.ceil(b.width / 2)
  return { x: b.x, y: b.y, width: w, height: b.height }
}

const rightHalf = (b: Electron.Rectangle): WindowBounds => {
  const w = Math.ceil(b.width / 2)
  return { x: b.x + w, y: b.y, width: b.width - w, height: b.height }
}

const quarter = (b: Electron.Rectangle, idx: 0 | 1 | 2 | 3): WindowBounds => {
  const w = Math.floor(b.width / 4)
  const x = b.x + w * idx
  const width = idx === 3 ? b.width - w * 3 : w
  return { x, y: b.y, width, height: b.height }
}

/**
 * 모니터 수 × 화면 모드 조합에 따른 창 배치 계획.
 * 정렬된 displays 배열을 기준으로 한다(좌→우, 상→하).
 *
 * 핵심 규칙:
 *   - 타이머 창은 항상 1개. 모니터가 2개 이상이면 가장 마지막 또는 가운데 모니터를 단독 사용.
 *   - 3분할: 영상창 2개(workout-left, workout-right)
 *   - 5분할: 영상창 4개(workout-left, workout-left-2, workout-right, workout-right-2)
 *   - 모니터가 부족하면 영상창들을 같은 모니터 안에 가로 분할로 배치.
 *
 * 매트릭스(displays.length / screenMode):
 *   1 / *      : 타이머만 (영상 없음). five 요청은 fallbackToThree=true 로 알림.
 *   2 / three  : M0(좌/우 1/2분할) + M1(타이머)
 *   2 / five   : M0(좌1/좌2/우1/우2 1/4분할) + M1(타이머)
 *   3 / three  : M0(좌) + M1(타이머) + M2(우)
 *   3 / five   : M0(좌1/좌2 1/2분할) + M1(타이머) + M2(우1/우2 1/2분할)
 *   4 / *      : 3 모니터와 동일 패턴 (4번째 모니터는 사용 안 함)
 *   5+ / three : M0(좌) + M1(타이머) + M2(우)
 *   5+ / five  : M0(좌1) + M1(좌2) + M2(타이머) + M3(우1) + M4(우2)
 */
export const buildWindowPlan = (
  displays: Electron.Display[],
  screenMode: ScreenMode
): WindowPlan => {
  const monitorCount = displays.length
  const items: WindowPlanItem[] = []

  if (monitorCount === 0) {
    return { items, fallbackToThree: false, monitorCount }
  }

  if (monitorCount === 1) {
    items.push({
      type: 'timer',
      display: displays[0],
      bounds: fullBounds(displays[0].bounds),
    })
    return {
      items,
      fallbackToThree: screenMode === 'five',
      monitorCount,
    }
  }

  if (screenMode === 'five') {
    if (monitorCount === 2) {
      const m0 = displays[0]
      const m1 = displays[1]
      items.push({ type: 'workout-left',    display: m0, bounds: quarter(m0.bounds, 0) })
      items.push({ type: 'workout-left-2',  display: m0, bounds: quarter(m0.bounds, 1) })
      items.push({ type: 'workout-right',   display: m0, bounds: quarter(m0.bounds, 2) })
      items.push({ type: 'workout-right-2', display: m0, bounds: quarter(m0.bounds, 3) })
      items.push({ type: 'timer',           display: m1, bounds: fullBounds(m1.bounds) })
      return { items, fallbackToThree: false, monitorCount }
    }

    if (monitorCount === 3 || monitorCount === 4) {
      const [m0, m1, m2] = displays
      items.push({ type: 'workout-left',    display: m0, bounds: leftHalf(m0.bounds) })
      items.push({ type: 'workout-left-2',  display: m0, bounds: rightHalf(m0.bounds) })
      items.push({ type: 'timer',           display: m1, bounds: fullBounds(m1.bounds) })
      items.push({ type: 'workout-right',   display: m2, bounds: leftHalf(m2.bounds) })
      items.push({ type: 'workout-right-2', display: m2, bounds: rightHalf(m2.bounds) })
      return { items, fallbackToThree: false, monitorCount }
    }

    // 5+ 모니터
    const [m0, m1, m2, m3, m4] = displays
    items.push({ type: 'workout-left',    display: m0, bounds: fullBounds(m0.bounds) })
    items.push({ type: 'workout-left-2',  display: m1, bounds: fullBounds(m1.bounds) })
    items.push({ type: 'timer',           display: m2, bounds: fullBounds(m2.bounds) })
    items.push({ type: 'workout-right',   display: m3, bounds: fullBounds(m3.bounds) })
    items.push({ type: 'workout-right-2', display: m4, bounds: fullBounds(m4.bounds) })
    return { items, fallbackToThree: false, monitorCount }
  }

  // 3-screen 모드
  if (monitorCount === 2) {
    const m0 = displays[0]
    const m1 = displays[1]
    items.push({ type: 'workout-left',  display: m0, bounds: leftHalf(m0.bounds) })
    items.push({ type: 'workout-right', display: m0, bounds: rightHalf(m0.bounds) })
    items.push({ type: 'timer',         display: m1, bounds: fullBounds(m1.bounds) })
    return { items, fallbackToThree: false, monitorCount }
  }

  // 3+ 모니터 (4번째 모니터는 미사용)
  const [m0, m1, m2] = displays
  items.push({ type: 'workout-left',  display: m0, bounds: fullBounds(m0.bounds) })
  items.push({ type: 'timer',         display: m1, bounds: fullBounds(m1.bounds) })
  items.push({ type: 'workout-right', display: m2, bounds: fullBounds(m2.bounds) })
  return { items, fallbackToThree: false, monitorCount }
}

/**
 * 창 종류별 로컬 HTTP 서버 URL 매핑.
 */
export const urlForWindowType = (baseUrl: string, type: WindowType): string => {
  switch (type) {
    case 'workout-left':    return `${baseUrl}#/workout-display-left`
    case 'workout-left-2':  return `${baseUrl}#/workout-display-left-2`
    case 'workout-right':   return `${baseUrl}#/workout-display-right`
    case 'workout-right-2': return `${baseUrl}#/workout-display-right-2`
    case 'timer':           return `${baseUrl}#/timer-display`
    case 'background':      return `${baseUrl}#/background-display`
    case 'workout':         return baseUrl
  }
}
