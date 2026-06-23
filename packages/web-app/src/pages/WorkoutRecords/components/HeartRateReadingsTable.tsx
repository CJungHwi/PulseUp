/**
 * 소스 요약 — 심박 측정값 상세 테이블
 *
 * 기능: 운동일별 심박 시계열 포인트를 시간·심박·zone·기기 단위로 상세 표시한다.
 *
 * 호출/연동: API 없음. `WorkoutHeartRateDetail.series` props 사용.
 *
 * 관련 컴포넌트: `MemberWorkoutHeartRateDetail`.
 *
 * 흐름: series props → 고정 헤더 테이블 → truncate 셀 tooltip.
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { HeartRatePoint } from '@/types/memberWorkoutRecords'
import { formatDateTime, getHeartRateZoneLabel } from './memberWorkoutRecordsUtils'

interface HeartRateReadingsTableProps {
  series: HeartRatePoint[]
}

const TruncateCell = ({ text }: { text: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <div className="truncate w-full">{text}</div>
    </TooltipTrigger>
    <TooltipContent>
      <p className="max-w-xs">{text}</p>
    </TooltipContent>
  </Tooltip>
)

export const HeartRateReadingsTable = ({ series }: HeartRateReadingsTableProps) => (
  <Card className="h-full min-h-0 flex flex-col border-[#343637] dark:border-[#6b7280] shadow-md">
    <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
      <CardTitle className="text-lg font-bold leading-none">측정 상세</CardTitle>
      <span className="text-xs text-muted-foreground">{series.length}건</span>
    </CardHeader>
    <CardContent className="flex-1 min-h-0 p-0">
      {series.length > 0 ? (
        <TooltipProvider>
          <div className="h-full overflow-y-auto scrollbar-hide">
            <Table className="w-full table-fixed border-separate border-spacing-0 text-xs">
              <TableHeader className="sticky top-0 z-10 bg-[#b9adb5] dark:bg-gray-800">
                <TableRow>
                  <TableHead className="h-[45px] text-center text-xs border-r border-[#343637] dark:border-[#6b7280] text-[#27272a] dark:text-[#94a3b8]">
                    경과
                  </TableHead>
                  <TableHead className="h-[45px] text-center text-xs border-r border-[#343637] dark:border-[#6b7280] text-[#27272a] dark:text-[#94a3b8]">
                    시각
                  </TableHead>
                  <TableHead className="h-[45px] text-center text-xs border-r border-[#343637] dark:border-[#6b7280] text-[#27272a] dark:text-[#94a3b8]">
                    심박
                  </TableHead>
                  <TableHead className="h-[45px] text-center text-xs border-r border-[#343637] dark:border-[#6b7280] text-[#27272a] dark:text-[#94a3b8]">
                    zone
                  </TableHead>
                  <TableHead className="h-[45px] text-center text-xs text-[#27272a] dark:text-[#94a3b8]">
                    기기
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {series.map((point) => (
                  <TableRow
                    key={point.id}
                    className="group h-[35px] bg-[#f9fafb] dark:bg-[#1d1d1d] hover:bg-muted/30"
                  >
                    <TableCell className="h-[35px] px-2 text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-blue-600 dark:group-hover:text-yellow-400 transition-colors">
                      {point.elapsed_label}
                    </TableCell>
                    <TableCell className="h-[35px] px-2 text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-blue-600 dark:group-hover:text-yellow-400 transition-colors">
                      <TruncateCell text={formatDateTime(point.timestamp)} />
                    </TableCell>
                    <TableCell className="h-[35px] px-2 text-center border-r border-[#343637] dark:border-[#6b7280] font-bold text-rose-500 group-hover:text-blue-600 dark:group-hover:text-yellow-400 transition-colors">
                      {point.heart_rate}
                    </TableCell>
                    <TableCell className="h-[35px] px-2 text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-blue-600 dark:group-hover:text-yellow-400 transition-colors">
                      {getHeartRateZoneLabel(point.zone)}
                    </TableCell>
                    <TableCell className="h-[35px] px-2 text-center group-hover:text-blue-600 dark:group-hover:text-yellow-400 transition-colors">
                      <TruncateCell text={point.device_name || point.device_id || '-'} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TooltipProvider>
      ) : (
        <div className="h-full min-h-[160px] flex items-center justify-center text-sm text-muted-foreground">
          표시할 측정값이 없습니다.
        </div>
      )}
    </CardContent>
  </Card>
)
