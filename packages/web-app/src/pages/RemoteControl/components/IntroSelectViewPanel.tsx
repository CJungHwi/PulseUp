/**
 * 컴포넌트 요약 — 리모컨 「선택보기」 탭
 *
 * 기능: 인트로 재생 중 A/B/C/D + 1~3 선택 후 보기/취소 명령 전송.
 *
 * 호출/연동:
 * - `deviceService.sendIntroFocus` / `sendIntroFocusCancel` → Electron `intro-focus` / `intro-focus-cancel`
 *
 * 관련: `introPositionCodes.ts`, `RemoteControlPage.tsx`
 *
 * 흐름: 구역·번호 선택 → 보기 → 해당 슬롯 영상이 Electron 하단 이미지 영역에 확대 재생 → 취소 시 복원.
 */

import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Eye, XCircle } from 'lucide-react'
import { useSnackbar } from '@/contexts/SnackbarContext'
import * as deviceService from '@/services/deviceService'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  INTRO_NUMBERS,
  INTRO_ZONES,
  buildIntroPositionCode,
  getIntroZoneLabel,
  isIntroSelectionComplete,
  type IntroSelection,
  type IntroZone,
} from './introPositionCodes'

type IntroSelectViewPanelProps = {
  canControl: boolean
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
}

export const IntroSelectViewPanel = ({
  canControl,
  isLoading,
  setIsLoading,
}: IntroSelectViewPanelProps) => {
  const { showSnackbar } = useSnackbar()
  const [searchParams] = useSearchParams()
  const [selection, setSelection] = useState<IntroSelection>({ zone: null, number: null })
  const [isFocused, setIsFocused] = useState(false)

  const deviceId = searchParams.get('deviceId') || localStorage.getItem('selectedDeviceId') || ''

  const handleSelectZone = (zone: IntroZone) => {
    setSelection((prev) => ({ ...prev, zone }))
  }

  const handleSelectNumber = (number: number) => {
    setSelection((prev) => ({ ...prev, number }))
  }

  const handleClearSelection = () => {
    setSelection({ zone: null, number: null })
    setIsFocused(false)
  }

  const handleView = async () => {
    if (!deviceId) {
      showSnackbar({ message: '디바이스가 선택되지 않았습니다.', severity: 'error' })
      return
    }
    if (!isIntroSelectionComplete(selection)) {
      showSnackbar({ message: 'A/B/C/D와 1~3 번호를 모두 선택해주세요.', severity: 'warning' })
      return
    }

    setIsLoading(true)
    try {
      const result = await deviceService.sendIntroFocus(deviceId, {
        zone: selection.zone,
        number: selection.number,
      })
      setIsFocused(true)
      showSnackbar({
        message: `${result.positionCode || buildIntroPositionCode(selection.zone, selection.number)} 영상을 하단에 표시합니다`,
        severity: 'success',
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : '선택보기 실패'
      showSnackbar({ message: msg, severity: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!deviceId) {
      showSnackbar({ message: '디바이스가 선택되지 않았습니다.', severity: 'error' })
      return
    }

    setIsLoading(true)
    try {
      await deviceService.sendIntroFocusCancel(deviceId)
      handleClearSelection()
      showSnackbar({ message: '선택보기를 취소했습니다', severity: 'info' })
    } catch (error) {
      const msg = error instanceof Error ? error.message : '취소 실패'
      showSnackbar({ message: msg, severity: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  const selectionPreview = isIntroSelectionComplete(selection)
    ? buildIntroPositionCode(selection.zone, selection.number)
    : '—'

  const controlsDisabled = !canControl || isLoading

  return (
    <Card className="p-3 bg-[#2d2d2d] text-white flex-1 flex flex-col border-[#333] overflow-hidden">
      <CardContent className="flex-1 flex flex-col justify-center gap-4 p-0">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">인트로 선택보기</h2>
          <p className="text-xs text-white/50">
            인트로 재생 중 A/B/C/D와 번호를 고른 뒤 「보기」를 누르면 해당 영상이 Electron 하단 이미지 영역에서 크게 재생됩니다.
          </p>
        </div>

        <div className="space-y-2">
          <div className="text-sm text-white/70">1. 구역 선택 (A / B / C / D)</div>
          <div className="grid grid-cols-4 gap-2">
            {INTRO_ZONES.map((zone) => (
              <Button
                key={zone}
                type="button"
                size="lg"
                disabled={controlsDisabled}
                aria-label={getIntroZoneLabel(zone)}
                aria-pressed={selection.zone === zone}
                onClick={() => handleSelectZone(zone)}
                className={cn(
                  'min-h-16 text-2xl font-bold',
                  selection.zone === zone
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-white/10 hover:bg-white/20 text-white/80'
                )}
              >
                {zone}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm text-white/70">2. 번호 선택 (1 ~ 3)</div>
          <div className="grid grid-cols-3 gap-2">
            {INTRO_NUMBERS.map((number) => (
              <Button
                key={number}
                type="button"
                size="lg"
                disabled={controlsDisabled}
                aria-label={`번호 ${number}`}
                aria-pressed={selection.number === number}
                onClick={() => handleSelectNumber(number)}
                className={cn(
                  'min-h-14 text-xl font-semibold',
                  selection.number === number
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-white/10 hover:bg-white/20 text-white/80'
                )}
              >
                {number}
              </Button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-center">
          <span className="text-xs text-white/50">선택: </span>
          <span className="text-2xl font-bold text-white">{selectionPreview}</span>
          {isFocused && (
            <span className="ml-2 text-xs text-emerald-400">표시 중</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="lg"
            disabled={controlsDisabled || !isIntroSelectionComplete(selection)}
            onClick={handleView}
            className="min-h-16 text-lg font-semibold bg-sky-600 hover:bg-sky-700 disabled:opacity-50"
          >
            <Eye className="w-5 h-5 mr-2" />
            보기
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            disabled={controlsDisabled}
            onClick={handleCancel}
            className="min-h-16 text-lg font-semibold bg-slate-700 hover:bg-slate-600 border-slate-500 disabled:opacity-50"
          >
            <XCircle className="w-5 h-5 mr-2" />
            취소
          </Button>
        </div>

        <p className="text-[11px] text-white/40 leading-relaxed">
          A/B는 좌측 1·2열, C/D는 우측 1·2열이며 번호는 각 열의 1~3 슬롯입니다.
        </p>
      </CardContent>
    </Card>
  )
}
