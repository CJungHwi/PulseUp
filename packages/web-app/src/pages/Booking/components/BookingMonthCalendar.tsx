/**
 * 소스 요약 — 수업예약 월간 캘린더 컴포넌트
 *
 * 기능: 월별 날짜 그리드에 수업 슬롯과 내 예약 이벤트를 표시하고 선택 이벤트를 전달한다.
 *
 * 호출/연동: `ClassBookingManagement`, `ClassBookingCalendar`, `MyBookings`.
 *
 * 관련 컴포넌트: shadcn `Card`, `Input`, `Badge`.
 *
 * 흐름: 월 선택 → 날짜별 슬롯/예약 그룹핑 → 날짜/슬롯/예약 클릭 이벤트 전달.
 */

import React, { useMemo } from 'react'
import { CalendarDays } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { ClassBooking, ClassSlot } from '../../../services/bookingApi'
import {
  buildCalendarDays,
  formatTimeRange,
  getBookingCategoryLabel,
  getRemainingCapacity,
  getSlotCategoryLabel,
  toDateKey,
} from './bookingCalendarUtils'

const WEEK_DAYS = ['일', '월', '화', '수', '목', '금', '토']

export interface SlotBadge {
  label: string
  color?: 'default' | 'primary' | 'success' | 'info' | 'warning' | 'destructive'
}

interface BookingMonthCalendarProps {
  title: string
  month: string
  slots?: ClassSlot[]
  bookings?: ClassBooking[]
  loading?: boolean
  onMonthChange: (month: string) => void
  onDayClick?: (date: Date) => void
  onSlotClick?: (slot: ClassSlot) => void
  onBookingClick?: (booking: ClassBooking) => void
  renderToolbarActions?: () => React.ReactNode
  renderSlotActions?: (slot: ClassSlot) => React.ReactNode
  getSlotBadge?: (slot: ClassSlot) => SlotBadge | null
  emptyMessage?: string
}

const groupByDate = <T extends { start_at: string }>(items: T[]) => {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = toDateKey(item.start_at)
    acc[key] = acc[key] ? [...acc[key], item] : [item]
    return acc
  }, {})
}

const getBadgeClassName = (color: SlotBadge['color']) => {
  switch (color) {
    case 'primary':
      return 'border-primary text-primary'
    case 'success':
      return 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
    case 'info':
      return 'border-sky-500 text-sky-600 dark:text-sky-400'
    case 'warning':
      return 'border-amber-500 text-amber-600 dark:text-amber-400'
    case 'destructive':
      return 'border-destructive text-destructive'
    default:
      return 'border-[#343637] dark:border-[#6b7280] text-muted-foreground'
  }
}

export const BookingMonthCalendar: React.FC<BookingMonthCalendarProps> = ({
  title,
  month,
  slots = [],
  bookings = [],
  loading = false,
  onMonthChange,
  onDayClick,
  onSlotClick,
  onBookingClick,
  renderToolbarActions,
  renderSlotActions,
  getSlotBadge,
  emptyMessage = '표시할 수업이 없습니다.',
}) => {
  const days = useMemo(() => buildCalendarDays(month), [month])
  const slotsByDate = useMemo(() => groupByDate(slots), [slots])
  const bookingsByDate = useMemo(() => groupByDate(bookings), [bookings])
  const hasItems = slots.length > 0 || bookings.length > 0

  const handleDayKeyDown = (event: React.KeyboardEvent, date: Date) => {
    if (!onDayClick) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onDayClick(date)
  }

  return (
    <Card className="h-full flex flex-col bg-card shadow-md border border-[#343637] dark:border-[#6b7280] overflow-hidden">
      <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="size-5 shrink-0" />
          <div className="min-w-0">
            <CardTitle className="text-lg font-bold leading-none truncate">{title}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
              날짜를 기준으로 수업 시간과 예약 현황을 확인합니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-[3px]">
          <Input
            type="month"
            value={month}
            onChange={(event) => onMonthChange(event.target.value)}
            aria-label="조회 월 선택"
            className="w-[150px] border-[#343637] dark:border-[#6b7280] bg-card h-9 text-xs"
          />
          {renderToolbarActions?.()}
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 flex flex-col gap-[3px] p-[3px]">
        <div className="flex-1 min-h-0 overflow-auto scrollbar-hide bg-[#f9fafb] dark:bg-[#1d1d1d] border border-[#343637] dark:border-[#6b7280]">
          <div className="grid min-w-[980px] grid-cols-7 border-separate border-spacing-0">
            {WEEK_DAYS.map((day, index) => (
              <div
                key={day}
                className={cn(
                  'h-[45px] flex items-center justify-center text-xs font-bold bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]',
                  index < WEEK_DAYS.length - 1 && 'border-r border-[#343637] dark:border-[#6b7280]'
                )}
              >
                {day}
              </div>
            ))}

            {days.map((day, index) => {
              const daySlots = slotsByDate[day.key] || []
              const dayBookings = bookingsByDate[day.key] || []
              const isClickable = Boolean(onDayClick)

              return (
                <div
                  key={day.key}
                  role={isClickable ? 'button' : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  aria-label={isClickable ? `${day.key} 수업 등록` : undefined}
                  onClick={isClickable ? () => onDayClick?.(day.date) : undefined}
                  onKeyDown={isClickable ? (event) => handleDayKeyDown(event, day.date) : undefined}
                  className={cn(
                    'min-h-[148px] p-2 border-t border-[#343637] dark:border-[#6b7280] outline-none transition-colors',
                    index % 7 !== 6 && 'border-r border-[#343637] dark:border-[#6b7280]',
                    day.isCurrentMonth ? 'bg-[#f9fafb] dark:bg-[#1d1d1d]' : 'bg-muted/30 text-muted-foreground',
                    isClickable && 'cursor-pointer hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset'
                  )}
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className={cn('text-xs', day.isToday ? 'font-bold text-primary' : 'font-medium')}>
                      {day.dayOfMonth}
                    </span>
                    {day.isToday ? (
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-primary text-primary">
                        오늘
                      </Badge>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-[3px]">
                    {daySlots.map((slot) => {
                      const badge = getSlotBadge?.(slot)
                      const remaining = getRemainingCapacity(slot)

                      return (
                        <button
                          key={slot.id}
                          type="button"
                          aria-label={`${slot.title} ${formatTimeRange(slot.start_at, slot.end_at)} 선택`}
                          onClick={(event) => {
                            event.stopPropagation()
                            onSlotClick?.(slot)
                          }}
                          className="w-full rounded-md border border-[#343637] dark:border-[#6b7280] bg-card p-2 text-left text-xs outline-none transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="min-w-0 truncate font-bold">{slot.title}</span>
                            {badge ? (
                              <Badge
                                variant="outline"
                                className={cn('h-5 shrink-0 px-1.5 text-[10px]', getBadgeClassName(badge.color))}
                              >
                                {badge.label}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-muted-foreground">{formatTimeRange(slot.start_at, slot.end_at)}</p>
                          <p className="mt-0.5 truncate text-muted-foreground">
                            {getSlotCategoryLabel(slot)} · 잔여 {remaining}/{slot.capacity}
                          </p>
                          {renderSlotActions ? (
                            <div className="mt-1.5" onClick={(event) => event.stopPropagation()}>
                              {renderSlotActions(slot)}
                            </div>
                          ) : null}
                        </button>
                      )
                    })}

                    {dayBookings.map((booking) => (
                      <button
                        key={booking.id}
                        type="button"
                        aria-label={`${booking.title} 예약 선택`}
                        onClick={(event) => {
                          event.stopPropagation()
                          onBookingClick?.(booking)
                        }}
                        className="w-full rounded-md border border-primary/60 bg-primary/10 p-2 text-left text-xs outline-none transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <p className="truncate font-bold">내 예약 · {booking.title}</p>
                        <p className="mt-1 text-muted-foreground">{formatTimeRange(booking.start_at, booking.end_at)}</p>
                        <p className="mt-0.5 truncate text-muted-foreground">{getBookingCategoryLabel(booking)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {!loading && !hasItems ? (
          <div className="shrink-0 border border-[#343637] dark:border-[#6b7280] bg-card p-3 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default BookingMonthCalendar
