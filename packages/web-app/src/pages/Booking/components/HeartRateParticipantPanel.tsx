/**
 * 소스 요약 — 수업 참가자 심박계 배정 패널
 *
 * 기능: 예약자 목록을 기준으로 운동기록 마스터별 회원-심박계(deviceId/slot) 매핑을 등록, 해제하고 참가자별 심박 요약을 표시한다.
 *
 * 호출/연동: `heartRateParticipantsApi.getParticipants/upsertParticipants/deactivateParticipant/getParticipantSummary`.
 *
 * 관련 컴포넌트: `AttendanceDialog`, shadcn `Input`, `Button`, `Badge`, `Table`.
 *
 * 흐름: 운동기록 ID 입력 → 기존 매핑 조회 → 예약자별 deviceId/slot 입력 → 매핑 저장 → summary 재조회.
 */

import { useCallback, useMemo, useState } from 'react'
import { Activity, Loader2, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useSnackbar } from '@/contexts/SnackbarContext'
import { cn } from '@/lib/utils'
import { heartRateParticipantsApi } from '@/services/heartRateParticipantsApi'
import type { ClassSlotBooking } from '@/services/bookingApi'
import type { HeartRateParticipant } from '@/types/heartRateParticipants'
import { getApiErrorMessage } from './bookingCalendarUtils'

interface HeartRateParticipantPanelProps {
  bookings: ClassSlotBooking[]
}

interface DraftRow {
  deviceId: string
  deviceName: string
  slotNumber: string
}

const HEADER_CELL =
  'h-[45px] text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] text-xs'
const HEADER_CELL_LAST =
  'h-[45px] text-center font-bold px-2 border-b-0 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] text-xs'
const BODY_CELL =
  'h-[35px] py-0 px-2 text-xs border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors'
const BODY_CELL_LAST =
  'h-[35px] py-0 px-2 text-xs group-hover:text-inherit transition-colors'

const toNumber = (value: unknown) => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

const isActiveParticipant = (participant?: HeartRateParticipant) => (
  participant?.is_active === true || participant?.is_active === 1
)

const buildInitialDraft = (participant?: HeartRateParticipant): DraftRow => ({
  deviceId: participant?.device_id || '',
  deviceName: participant?.device_name || '',
  slotNumber: participant?.slot_number ? String(participant.slot_number) : '',
})

export const HeartRateParticipantPanel = ({ bookings }: HeartRateParticipantPanelProps) => {
  const { showSnackbar } = useSnackbar()
  const [workoutHistoryMasterId, setWorkoutHistoryMasterId] = useState('')
  const [participants, setParticipants] = useState<HeartRateParticipant[]>([])
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({})
  const [loading, setLoading] = useState(false)
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const activeParticipantsByUserId = useMemo(() => {
    const map = new Map<string, HeartRateParticipant>()
    for (const participant of participants) {
      if (isActiveParticipant(participant)) map.set(participant.user_id, participant)
    }
    return map
  }, [participants])

  const loadParticipants = useCallback(async () => {
    if (!workoutHistoryMasterId.trim()) {
      showSnackbar({ message: '운동기록 ID를 입력해 주세요.', severity: 'warning' })
      return
    }

    setLoading(true)
    try {
      const nextParticipants = await heartRateParticipantsApi.getParticipantSummary(workoutHistoryMasterId.trim())
      setParticipants(nextParticipants)
      const nextDrafts: Record<string, DraftRow> = {}
      for (const participant of nextParticipants) {
        if (isActiveParticipant(participant)) {
          nextDrafts[participant.user_id] = buildInitialDraft(participant)
        }
      }
      setDrafts((current) => ({ ...current, ...nextDrafts }))
    } catch (error) {
      showSnackbar({
        message: getApiErrorMessage(error, '심박 참가자 매핑을 불러오지 못했습니다.'),
        severity: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [showSnackbar, workoutHistoryMasterId])

  const handleDraftChange = (userId: string, key: keyof DraftRow, value: string) => {
    setDrafts((current) => ({
      ...current,
      [userId]: {
        ...buildInitialDraft(activeParticipantsByUserId.get(userId)),
        ...current[userId],
        [key]: value,
      },
    }))
  }

  const handleSaveParticipant = async (booking: ClassSlotBooking) => {
    const masterId = workoutHistoryMasterId.trim()
    const draft = drafts[booking.user_id] || buildInitialDraft(activeParticipantsByUserId.get(booking.user_id))
    const deviceId = draft.deviceId.trim()

    if (!masterId) {
      showSnackbar({ message: '운동기록 ID를 입력해 주세요.', severity: 'warning' })
      return
    }
    if (!deviceId) {
      showSnackbar({ message: '심박계 기기 ID를 입력해 주세요.', severity: 'warning' })
      return
    }

    setSavingUserId(booking.user_id)
    try {
      const slotNumber = draft.slotNumber ? Number(draft.slotNumber) : null
      const nextParticipants = await heartRateParticipantsApi.upsertParticipants(masterId, [{
        userId: booking.user_id,
        deviceId,
        deviceName: draft.deviceName.trim() || null,
        slotNumber: Number.isFinite(slotNumber) ? slotNumber : null,
      }])
      setParticipants(nextParticipants)
      showSnackbar({ message: '심박계 배정이 저장되었습니다.', severity: 'success' })
    } catch (error) {
      showSnackbar({
        message: getApiErrorMessage(error, '심박계 배정 저장에 실패했습니다.'),
        severity: 'error',
      })
    } finally {
      setSavingUserId(null)
    }
  }

  const handleRemoveParticipant = async (participant: HeartRateParticipant) => {
    const masterId = workoutHistoryMasterId.trim()
    if (!masterId) return

    setRemovingId(participant.id)
    try {
      await heartRateParticipantsApi.deactivateParticipant(masterId, participant.id)
      setParticipants((current) => current.map((item) => (
        item.id === participant.id ? { ...item, is_active: false, unassigned_at: new Date().toISOString() } : item
      )))
      showSnackbar({ message: '심박계 배정이 해제되었습니다.', severity: 'success' })
    } catch (error) {
      showSnackbar({
        message: getApiErrorMessage(error, '심박계 배정 해제에 실패했습니다.'),
        severity: 'error',
      })
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="rounded-md border border-[#343637] dark:border-[#6b7280] bg-muted/10 p-3 space-y-3">
      <div className="flex flex-col gap-[3px] sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" aria-hidden="true" />
            <h3 className="text-sm font-bold">개인별 심박계 배정</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            운동기록 ID 기준으로 회원과 ANT+ 심박계를 연결합니다. 예: deviceId `ant-10771`
          </p>
        </div>
        <div className="flex items-center gap-[3px]">
          <Input
            value={workoutHistoryMasterId}
            onChange={(event) => setWorkoutHistoryMasterId(event.target.value)}
            className="h-9 w-[260px] text-xs bg-card border-[#343637] dark:border-[#6b7280]"
            placeholder="workout_history_master_id"
            aria-label="운동기록 ID"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 text-xs"
            disabled={loading}
            onClick={loadParticipants}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
            조회
          </Button>
        </div>
      </div>

      <div className="max-h-[280px] overflow-auto scrollbar-hide bg-[#f9fafb] dark:bg-[#1d1d1d] border border-[#343637] dark:border-[#6b7280]">
        <Table className="w-full table-fixed border-separate border-spacing-0">
          <TableHeader className="sticky top-0 z-10 shadow-sm">
            <TableRow className="hover:bg-transparent border-b-0">
              <TableHead className={cn(HEADER_CELL, 'w-[110px]')}>회원</TableHead>
              <TableHead className={cn(HEADER_CELL, 'w-[130px]')}>기기 ID</TableHead>
              <TableHead className={cn(HEADER_CELL, 'w-[110px]')}>기기명</TableHead>
              <TableHead className={cn(HEADER_CELL, 'w-[70px]')}>슬롯</TableHead>
              <TableHead className={cn(HEADER_CELL, 'w-[90px]')}>현재</TableHead>
              <TableHead className={cn(HEADER_CELL, 'w-[130px]')}>요약</TableHead>
              <TableHead className={cn(HEADER_CELL_LAST, 'w-[140px]')}>관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking) => {
              const participant = activeParticipantsByUserId.get(booking.user_id)
              const draft = drafts[booking.user_id] || buildInitialDraft(participant)
              const isSaving = savingUserId === booking.user_id
              const isRemoving = participant && removingId === participant.id

              return (
                <TableRow
                  key={booking.id}
                  className="h-[35px] border-b-0 group transition-colors bg-[#f9fafb] dark:bg-[#1d1d1d] hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30"
                >
                  <TableCell className={cn(BODY_CELL, 'truncate')}>{booking.name}</TableCell>
                  <TableCell className={BODY_CELL}>
                    <Input
                      value={draft.deviceId}
                      onChange={(event) => handleDraftChange(booking.user_id, 'deviceId', event.target.value)}
                      className="h-8 text-xs bg-card border-[#343637] dark:border-[#6b7280]"
                      placeholder="ant-00000"
                      aria-label={`${booking.name} 심박계 기기 ID`}
                    />
                  </TableCell>
                  <TableCell className={BODY_CELL}>
                    <Input
                      value={draft.deviceName}
                      onChange={(event) => handleDraftChange(booking.user_id, 'deviceName', event.target.value)}
                      className="h-8 text-xs bg-card border-[#343637] dark:border-[#6b7280]"
                      placeholder="HR-00000"
                      aria-label={`${booking.name} 심박계 이름`}
                    />
                  </TableCell>
                  <TableCell className={BODY_CELL}>
                    <Input
                      value={draft.slotNumber}
                      onChange={(event) => handleDraftChange(booking.user_id, 'slotNumber', event.target.value.replace(/\D/g, ''))}
                      className="h-8 text-xs bg-card border-[#343637] dark:border-[#6b7280]"
                      placeholder="1"
                      aria-label={`${booking.name} 심박계 슬롯 번호`}
                    />
                  </TableCell>
                  <TableCell className={cn(BODY_CELL, 'text-center')}>
                    {participant?.current_heart_rate ? (
                      <Badge variant="outline" className="border-rose-500 text-rose-500">
                        {participant.current_heart_rate} bpm
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className={cn(BODY_CELL, 'text-center')}>
                    <span>
                      평균 {Math.round(toNumber(participant?.avg_heart_rate)) || '-'} / 최고 {toNumber(participant?.max_heart_rate) || '-'}
                    </span>
                  </TableCell>
                  <TableCell className={BODY_CELL_LAST}>
                    <div className="flex items-center gap-[3px]">
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        disabled={isSaving || Boolean(isRemoving)}
                        onClick={() => handleSaveParticipant(booking)}
                      >
                        {isSaving ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
                        저장
                      </Button>
                      {participant ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          disabled={Boolean(isRemoving) || isSaving}
                          onClick={() => handleRemoveParticipant(participant)}
                        >
                          해제
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default HeartRateParticipantPanel
