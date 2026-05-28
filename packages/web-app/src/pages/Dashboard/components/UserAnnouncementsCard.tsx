/**
 * UserAnnouncementsCard — 사용자 공지사항 카드 (테이블)
 */

import React from 'react'
import { Megaphone, Paperclip } from 'lucide-react'
import dayjs from 'dayjs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  parseNotificationAttachments,
} from '@/types/notification'
import type { UserAnnouncement } from '@/services/userDashboard.service'
import {
  getAnnouncementTypeLabel,
  getAnnouncementTypeVariant,
} from './userDashboardUtils'

interface UserAnnouncementsCardProps {
  announcements: UserAnnouncement[]
  onSelect: (a: UserAnnouncement) => void
  onMore: () => void
}

export const UserAnnouncementsCard: React.FC<UserAnnouncementsCardProps> = ({
  announcements,
  onSelect,
  onMore,
}) => (
  <div className="flex-[1.68] lg:order-1 order-2 min-w-0">
    <Card className="flex flex-col h-full shadow-md overflow-hidden">
      <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-orange-500" />
          공지사항
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onMore}>
          더보기
        </Button>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 p-0 overflow-hidden flex flex-col">
        <div className="flex-1 min-h-0 border border-[#343637] dark:border-[#6b7280] overflow-auto relative scrollbar-hide bg-[#f9fafb] dark:bg-[#1d1d1d]">
          <Table className="w-full table-fixed border-separate border-spacing-0">
            <TableHeader className="sticky top-0 z-10 shadow-sm bg-[#b9adb5] dark:bg-gray-800">
              <TableRow className="hover:bg-transparent border-b-0 h-[45px]">
                <TableHead className="w-[100px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">유형</TableHead>
                <TableHead className="w-[200px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">제목</TableHead>
                <TableHead className="w-[300px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">내용</TableHead>
                <TableHead className="w-[100px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 text-[#27272a] dark:text-[#94a3b8]">작성일</TableHead>
                <TableHead className="w-[80px] text-center font-bold px-2 border-b-0 text-[#27272a] dark:text-[#94a3b8]">조회수</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {announcements.map((row) => {
                const attachments = parseNotificationAttachments(row.attachments)
                return (
                  <TableRow
                    key={row.id}
                    className="h-[35px] border-b-0 group transition-colors bg-[#f9fafb] dark:bg-[#1d1d1d] hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30 cursor-pointer"
                    onClick={() => onSelect(row)}
                  >
                    <TableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">
                      <Badge variant={getAnnouncementTypeVariant(row.type)} className="text-[10px] py-0 h-5">
                        {getAnnouncementTypeLabel(row.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 truncate font-semibold group-hover:text-inherit group-hover:font-inherit transition-colors">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1 min-w-0 w-full">
                            {attachments.length > 0 && (
                              <span
                                className="inline-flex shrink-0 text-primary"
                                title="첨부파일 있음"
                                aria-label="첨부파일 있음"
                              >
                                <Paperclip className="h-3.5 w-3.5" aria-hidden />
                              </span>
                            )}
                            <div className="truncate flex-1 min-w-0">{row.title}</div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            {row.title}
                            {attachments.length > 0 ? ' (첨부 있음)' : ''}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 truncate text-muted-foreground group-hover:text-inherit group-hover:font-inherit transition-colors">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="truncate w-full">{row.content || '-'}</div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs whitespace-pre-wrap">{row.content || '-'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-center h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 truncate group-hover:text-inherit group-hover:font-inherit transition-colors">
                      {dayjs(row.created_at).format('YYYY-MM-DD')}
                    </TableCell>
                    <TableCell className="text-center h-[35px] py-0 px-2 text-xs truncate group-hover:text-inherit group-hover:font-inherit transition-colors">
                      {row.view_count || 0}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  </div>
)
