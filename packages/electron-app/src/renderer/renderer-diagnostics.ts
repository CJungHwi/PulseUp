/**
 * 렌더러 프로세스 진단 로그 — 네트워크 상태, 메모리 사용량을 콘솔에 출력.
 * 메인 프로세스의 FileLogger가 console-message 이벤트로 자동 캡처합니다.
 */

const MEMORY_LOG_INTERVAL_MS = 60_000

const formatMB = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)}MB`

export const initRendererDiagnostics = (): void => {
  setupNetworkMonitor()
  setupMemoryMonitor()
  logInitialState()
}

const logInitialState = (): void => {
  console.log(`🔧 [진단] 렌더러 시작 — online=${navigator.onLine}, userAgent=${navigator.userAgent}`)
  logMemoryUsage()
}

const setupNetworkMonitor = (): void => {
  window.addEventListener('online', () => {
    console.warn('🌐 [네트워크] 인터넷 연결 복구됨')
  })

  window.addEventListener('offline', () => {
    console.error('🌐 [네트워크] 인터넷 연결 끊김!')
  })
}

const setupMemoryMonitor = (): void => {
  setInterval(logMemoryUsage, MEMORY_LOG_INTERVAL_MS)
}

const logMemoryUsage = (): void => {
  const perf = performance as any
  if (perf.memory) {
    const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = perf.memory
    const usagePercent = ((usedJSHeapSize / jsHeapSizeLimit) * 100).toFixed(1)
    console.log(
      `📊 [메모리] JS Heap: ${formatMB(usedJSHeapSize)} / ${formatMB(totalJSHeapSize)} (한도: ${formatMB(jsHeapSizeLimit)}, 사용률: ${usagePercent}%)`
    )

    if (usedJSHeapSize / jsHeapSizeLimit > 0.8) {
      console.warn(`⚠️ [메모리] JS Heap 사용률 ${usagePercent}% — 메모리 부족 위험`)
    }
  }
}
