/**
 * 리모컨 팝업 유틸리티
 *
 * 기능:
 * - 리모컨 팝업의 기본 크기 상수 (`REMOTE_CONTROL_POPUP`)
 * - `window.open()` 특성 문자열 빌더 (`getRemoteControlPopupWindowFeatures`)
 * - opener 창에서 sessionStorage 토큰 복사 (`copyTokenFromOpener`)
 *
 * 사용처:
 * - `RemoteControl/RemoteControlPage.tsx`: 페이지 마운트 시 토큰 복사
 * - `MonthProgram/MonthProgram.tsx` 등: 팝업 호출 시 윈도우 특성 문자열로 사용
 */

/** 리모컨 팝업 기본 크기 (MonthProgram 등에서 window.open 특성 문자열로 재사용) */
export const REMOTE_CONTROL_POPUP = Object.freeze({
  width: 620,
  height: 880,
})

export const getRemoteControlPopupWindowFeatures = (): string => {
  if (typeof window === 'undefined') {
    return `width=${REMOTE_CONTROL_POPUP.width},height=${REMOTE_CONTROL_POPUP.height},resizable=yes,scrollbars=yes`
  }
  const { width, height } = REMOTE_CONTROL_POPUP
  const left = Math.max(0, window.screen.width / 2 - width / 2)
  const top = Math.max(0, window.screen.height / 2 - height / 2)
  return `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
}

/**
 * opener 창에서 sessionStorage 토큰 복사
 * - window.open()으로 열린 새 창은 Chrome 89+에서 sessionStorage가 비어 있음
 * - API 호출 시 401 발생 → checkDeviceStatus 실패 → "연결할 수 없습니다" 표시
 */
export const copyTokenFromOpener = (): void => {
  if (typeof window === 'undefined') return
  const token = sessionStorage.getItem('token') || sessionStorage.getItem('accessToken')
  if (token) return // 이미 토큰 있음

  try {
    const opener = window.opener
    if (opener && opener.sessionStorage) {
      const openerToken =
        opener.sessionStorage.getItem('token') || opener.sessionStorage.getItem('accessToken')
      if (openerToken) {
        sessionStorage.setItem('token', openerToken)
        sessionStorage.setItem('accessToken', openerToken)
      }
    }
  } catch {
    // cross-origin 등으로 접근 불가 시 무시
  }
}
