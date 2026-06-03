/**
 * monitor-display-resolver-client — API resolve 호출 (electron main)
 */
export type ResolvedMonitorDisplay = {
  leftImageUrl: string
  centerImageUrl: string
  rightImageUrl: string
  displayText: string
}

export type MonitorDisplayResolveParams = {
  webAppUrl: string
  authHeaders: Record<string, string>
  fetchWithTimeout: (input: string, init: RequestInit, timeoutMs: number) => Promise<Response>
  masterId?: string
  exerciseId?: string
  context: 'default' | 'intro'
}

const emptyResolved = (): ResolvedMonitorDisplay => ({
  leftImageUrl: '',
  centerImageUrl: '',
  rightImageUrl: '',
  displayText: ''
})

export const fetchResolvedMonitorDisplay = async (
  params: MonitorDisplayResolveParams
): Promise<ResolvedMonitorDisplay> => {
  const { webAppUrl, authHeaders, fetchWithTimeout, masterId, exerciseId, context } = params

  const qs = new URLSearchParams({ context })
  if (masterId && masterId !== 'remote-control') qs.set('masterId', masterId)
  if (exerciseId) qs.set('exerciseId', exerciseId)

  try {
    const url = `${webAppUrl}/api/workout-categories/monitor-display/resolve?${qs.toString()}`
    const response = await fetchWithTimeout(
      url,
      { method: 'GET', headers: { 'Content-Type': 'application/json', ...authHeaders } },
      4000
    )
    if (!response.ok) {
      console.warn('[monitor-display] resolve failed:', response.status, url)
      return emptyResolved()
    }
    const result = await response.json().catch(() => null)
    const data = result?.data
    if (!data || typeof data !== 'object') {
      console.warn('[monitor-display] resolve empty payload:', url)
      return emptyResolved()
    }
    return {
      leftImageUrl: String(data.leftImageUrl ?? ''),
      centerImageUrl: String(data.centerImageUrl ?? ''),
      rightImageUrl: String(data.rightImageUrl ?? ''),
      displayText: String(data.displayText ?? '')
    }
  } catch (error) {
    console.warn('[monitor-display] resolve error:', error)
    return emptyResolved()
  }
}
