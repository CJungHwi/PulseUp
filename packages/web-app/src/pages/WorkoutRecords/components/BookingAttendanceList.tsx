/**
 * 소스 요약 — 수업 예약/출석 목록
 *
 * 기능: 회원 본인의 월간 수업 예약 목록과 출석 결과를 타임라인 형태로 표시한다.
 *
 * 호출/연동: API 없음. `MemberWorkoutRecords`에서 조회한 bookings props 사용.
 *
 * 관련 컴포넌트: `MemberWorkoutRecords`.
 *
 * 흐름: bookings props → 상태 배지/일시 포맷 → 스크롤 목록 렌더링.
 */

import { CalendarDays } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { MemberClassBookingRecord } from '@/types/memberWorkoutRecords'
import {
  formatDateTime,
  getBookingStatusClassName,
  getBookingStatusLabel,
} from './memberWorkoutRecordsUtils'

interface BookingAttendanceListProps {
  bookings: MemberClassBookingRecord[]
}

export const BookingAttendanceList = ({ bookings }: BookingAttendanceListProps) => {
  return (
    <Card className="h-full min-h-0 flex flex-col border-[#343637] dark:border-[#6b7280] shadow-md">
      <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
        <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
          <CalendarDays className="h-5 w-5" aria-hidden="true" />
          수업 예약 및 출석
        </CardTitle>
        <span className="text-xs text-muted-foreground">{bookings.length}건</span>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0 overflow-y-auto scrollbar-hide">
        {bookings.length > 0 ? (
          <div className="divide-y divide-[#343637] dark:divide-[#6b7280]">
            {bookings.map((booking) => (
              <div key={booking.id} className="p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{booking.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground truncate">
                      {booking.major_category_name || '수업'} · {formatDateTime(booking.start_at)}
                    </p>
                  </div>
                  <Badge variant="outline" size="sm" className={getBookingStatusClassName(booking.status)}>
                    {getBookingStatusLabel(booking.status)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full min-h-[180px] flex items-center justify-center p-4 text-sm text-muted-foreground">
            해당 월의 수업 예약 기록이 없습니다.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
