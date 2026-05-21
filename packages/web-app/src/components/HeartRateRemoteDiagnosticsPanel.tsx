import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, ChevronDown, ChevronUp, HeartPulse, RefreshCw } from 'lucide-react'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { cn } from '../lib/utils'
import * as deviceService from '../services/deviceService'
import type { HeartRateDiagnostics, HeartRateSlotDiagnostics } from '../services/deviceService'

interface HeartRateRemoteDiagnosticsPanelProps {
  deviceId: string
  enabled: boolean
}

const getAntStateText = (state: HeartRateDiagnostics['ant']['state']) => {
  switch (state) {
    case 'ready':
      return 'ANT+ 준비됨'
    case 'initializing':
      return 'ANT+ 초기화 중'
    case 'failed':
      return 'ANT+ 동글 오류'
    case 'disabled':
      return 'ANT+ 비활성'
    default:
      return '상태 알 수 없음'
  }
}

const getSlotStateText = (slot: HeartRateSlotDiagnostics) => {
  if (slot.state === 'connected') return `${slot.heartRate || '--'} BPM`
  if (slot.reconnecting) return '재연결 대기'
  return '오프라인'
}

const formatGeneratedAt = (value: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export const HeartRateRemoteDiagnosticsPanel = ({
  deviceId,
  enabled,
}: HeartRateRemoteDiagnosticsPanelProps) => {
  const [diagnostics, setDiagnostics] = useState<HeartRateDiagnostics | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  const handleToggleExpanded = () => setIsExpanded((prev) => !prev)

  const visibleSlots = useMemo(() => {
    if (!diagnostics) return []
    return diagnostics.ant.slots.filter((slot) => slot.state !== 'empty' || slot.reconnecting)
  }, [diagnostics])

  const handleRefresh = useCallback(async () => {
    if (!enabled || !deviceId) return

    setIsLoading(true)
    try {
      const nextDiagnostics = await deviceService.getHeartRateDiagnostics(deviceId)
      setDiagnostics(nextDiagnostics)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '심박 진단 상태 조회 실패')
    } finally {
      setIsLoading(false)
    }
  }, [deviceId, enabled])

  useEffect(() => {
    if (!enabled || !deviceId) {
      setDiagnostics(null)
      setError(null)
      return
    }

    void handleRefresh()
    const interval = window.setInterval(() => {
      void handleRefresh()
    }, 5000)

    return () => window.clearInterval(interval)
  }, [deviceId, enabled, handleRefresh])

  if (!enabled) {
    return null
  }

  const antState = diagnostics?.ant.state || 'initializing'
  const hasIssue = !!error || antState === 'failed' || !!diagnostics?.summary.primaryIssue
  const generatedAt = formatGeneratedAt(diagnostics?.generatedAt || null)

  return (
    <Card className="mb-3 flex-shrink-0 border-[#333] bg-[#222] p-3 text-white">
      <div className={cn('flex items-center justify-between gap-2', isExpanded && 'mb-2')}>
        <button
          type="button"
          onClick={handleToggleExpanded}
          aria-expanded={isExpanded}
          aria-controls="heart-rate-diagnostics-body"
          aria-label={isExpanded ? '심박계 진단 접기' : '심박계 진단 펼치기'}
          className="flex flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          <HeartPulse className="h-4 w-4 text-rose-400" />
          <span className="text-sm font-semibold">심박계 진단</span>
          <span className={cn('text-[11px]', hasIssue ? 'text-amber-300' : 'text-emerald-300')}>
            {getAntStateText(antState)}
          </span>
          {!isExpanded && diagnostics && (
            <span className="text-[11px] text-white/50">
              · 연결 {diagnostics.summary.connectedSlots}대
              {diagnostics.summary.reconnectingSlots ? ` · 재연결 ${diagnostics.summary.reconnectingSlots}대` : ''}
            </span>
          )}
          {isExpanded && generatedAt && (
            <span className="text-[10px] text-white/40">{generatedAt}</span>
          )}
          {isExpanded ? (
            <ChevronUp className="ml-auto h-4 w-4 text-white/60" />
          ) : (
            <ChevronDown className="ml-auto h-4 w-4 text-white/60" />
          )}
        </button>
        {isExpanded && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 border-white/20 bg-white/10 px-2 text-xs text-white hover:bg-white/20 hover:text-white"
            onClick={handleRefresh}
            disabled={isLoading}
            aria-label="심박계 진단 새로고침"
          >
            <RefreshCw className={cn('mr-1 h-3 w-3', isLoading && 'animate-spin')} />
            새로고침
          </Button>
        )}
      </div>

      {isExpanded && (
      <div className="max-h-[260px] overflow-y-auto pr-1">
      <div id="heart-rate-diagnostics-body" className="rounded-lg border border-white/10 bg-black/20 p-2">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className={cn('font-semibold', hasIssue ? 'text-amber-300' : 'text-emerald-300')}>
            {getAntStateText(antState)}
          </span>
          <span className="text-white/50">
            연결 {diagnostics?.summary.connectedSlots ?? 0}대
            {diagnostics?.summary.reconnectingSlots ? ` · 재연결 ${diagnostics.summary.reconnectingSlots}대` : ''}
          </span>
        </div>

        {error && (
          <div className="mt-2 flex gap-2 rounded-md bg-red-900/30 p-2 text-xs text-red-100">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!error && diagnostics?.summary.primaryIssue && (
          <div className="mt-2 flex gap-2 rounded-md bg-amber-900/25 p-2 text-xs text-amber-100">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{diagnostics.summary.primaryIssue}</span>
          </div>
        )}

        {!error && diagnostics?.summary.hints.length ? (
          <div className="mt-2 space-y-1 text-[11px] text-white/55">
            {diagnostics.summary.hints.slice(0, 2).map((hint) => (
              <div key={hint}>• {hint}</div>
            ))}
          </div>
        ) : null}
      </div>

      {visibleSlots.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {visibleSlots.slice(0, 6).map((slot) => (
            <div
              key={slot.slotNumber}
              className="rounded-md border border-white/10 bg-white/[0.04] p-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white/80">슬롯 {slot.slotNumber}</span>
                <Activity className={cn('h-3 w-3', slot.state === 'connected' ? 'text-emerald-400' : 'text-amber-400')} />
              </div>
              <div className="mt-1 text-white/70">{getSlotStateText(slot)}</div>
              <div className="mt-0.5 text-[10px] text-white/40">
                {slot.deviceId ? `ID ${slot.deviceId}` : '기기 미감지'}
                {typeof slot.secondsSinceLastUpdate === 'number' ? ` · ${slot.secondsSinceLastUpdate}초 전` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
      )}
    </Card>
  )
}
