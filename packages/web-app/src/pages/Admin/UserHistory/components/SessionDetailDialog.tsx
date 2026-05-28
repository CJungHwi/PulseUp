/**
 * SessionDetailDialog — 사용자 세션 상세 모달
 *
 * 표시 항목:
 * - 현재 활성 세션 카드 목록
 * - 최근 로그인 이력 카드 목록 (최대 10건)
 *
 * 사용처: `UserHistory.tsx`
 */
import React from 'react'
import { Clock, History, LogOut, MapPin, Monitor, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { UserSessionDetailResponse } from '@/services/admin.service'
import { formatAbsoluteDate } from './userHistoryDateUtils'

interface SessionDetailDialogProps {
  open: boolean
  detail: UserSessionDetailResponse | null
  onOpenChange: (open: boolean) => void
}

export const SessionDetailDialog: React.FC<SessionDetailDialogProps> = ({
  open,
  detail,
  onOpenChange,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          세션 상세 정보
          {detail && (
            <span className="text-muted-foreground text-sm font-normal ml-2">
              - {detail.user.name} ({detail.user.userid})
            </span>
          )}
        </DialogTitle>
      </DialogHeader>

      {detail && (
        <div className="space-y-6">
          {detail.activeSessions.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center text-green-600">
                <Wifi className="h-4 w-4 mr-2" />
                현재 활성 세션 ({detail.activeSessions.length}개)
              </h4>
              <div className="grid gap-2">
                {detail.activeSessions.map((session) => (
                  <Card key={session.id}>
                    <CardContent className="p-3 flex justify-between items-center">
                      <div className="space-y-1">
                        <div className="text-sm flex items-center">
                          <Clock className="h-3 w-3 mr-2 text-muted-foreground" />
                          로그인: {formatAbsoluteDate(session.login_time)}
                        </div>
                        <div className="text-sm flex items-center">
                          <MapPin className="h-3 w-3 mr-2 text-muted-foreground" />
                          IP: {session.ip_address || '알 수 없음'}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          // 특정 세션 로그아웃 로직 (Placeholder)
                          console.log('특정 세션 로그아웃:', session.id)
                        }}
                      >
                        <LogOut className="h-3 w-3 mr-1" /> 종료
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center">
              <History className="h-4 w-4 mr-2" />
              최근 로그인 이력
            </h4>
            <div className="grid gap-2">
              {detail.sessionHistory.length > 0 ? (
                detail.sessionHistory.slice(0, 10).map((session) => (
                  <Card key={session.id}>
                    <CardContent className="p-3 flex justify-between items-center">
                      <div className="space-y-1">
                        <div className="text-sm flex items-center">
                          <Clock className="h-3 w-3 mr-2 text-muted-foreground" />
                          로그인: {formatAbsoluteDate(session.login_time)}
                        </div>
                        {session.logout_time && (
                          <div className="text-sm flex items-center text-muted-foreground">
                            <LogOut className="h-3 w-3 mr-2" />
                            로그아웃: {formatAbsoluteDate(session.logout_time)}
                          </div>
                        )}
                        <div className="text-sm flex items-center">
                          <MapPin className="h-3 w-3 mr-2 text-muted-foreground" />
                          IP: {session.ip_address || '알 수 없음'}
                        </div>
                      </div>
                      <Badge variant={session.logout_time ? 'secondary' : 'outline'}>
                        {session.logout_time ? '완료' : '미완료'}
                      </Badge>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  로그인 이력이 없습니다.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          닫기
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
