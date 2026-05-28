/**
 * DynamicStretchingPreviewPanel — 우측 하단: 영상 미리보기 + 메모
 *
 * 표시:
 * - 좌(2): 선택된 운동의 Vimeo 영상 (재생/일시정지/구간반복 버튼)
 * - 우(1): 메모 입력
 *
 * 사용처: `DynamicStretching.tsx`
 */
import React, { RefObject } from 'react'
import { MessageCircle, Pause, Play, RotateCcw, Video as VideoIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { VimeoFitIframe } from '@/components/VimeoFitIframe/VimeoFitIframe'

interface DynamicStretchingPreviewPanelProps {
  videoUrl?: string
  iframeRef: RefObject<HTMLIFrameElement>
  isPlayerReady: boolean
  isPlaying: boolean
  memo: string
  onChangeMemo: (value: string) => void
  onPlayPause: () => void
  onReplay: () => void
}

export const DynamicStretchingPreviewPanel: React.FC<DynamicStretchingPreviewPanelProps> = ({
  videoUrl,
  iframeRef,
  isPlayerReady,
  isPlaying,
  memo,
  onChangeMemo,
  onPlayPause,
  onReplay,
}) => (
  <div className="flex flex-col lg:flex-row gap-[3px] flex-[1.0] min-h-0">
    <div className="flex-[2] order-2 lg:order-1">
      <Card className="h-full flex flex-col bg-card shadow-md">
        <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2 min-w-0">
            <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
              <VideoIcon className="h-5 w-5 text-orange-500" />
              영상 미리보기
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onPlayPause}
              disabled={!isPlayerReady}
              title={isPlaying ? '일시정지' : '재생'}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onReplay}
              disabled={!isPlayerReady}
              title="구간 반복 확인"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
          <div />
        </CardHeader>
        <CardContent className="flex-1 min-h-0 flex flex-col gap-[3px] p-4">
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <div className="w-full max-w-full max-h-full aspect-video rounded-lg border border-[#343637] dark:border-[#6b7280] overflow-hidden relative bg-black">
              {!videoUrl ? (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  <div className="flex flex-col items-center">
                    <VideoIcon className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-sm">운동을 선택하면 영상이 표시됩니다</p>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0">
                  <VimeoFitIframe videoId={videoUrl} iframeRef={iframeRef} />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <div className="flex-1 order-1 lg:order-2">
      <Card className="h-full flex flex-col bg-card shadow-md">
        <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-orange-500" />
            메모
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-auto p-0">
          <Input
            placeholder="운동에 대한 메모를 입력하세요..."
            value={memo}
            onChange={(e) => onChangeMemo(e.target.value)}
            className="h-12 bg-card border-[#343637] dark:border-[#6b7280]"
          />
        </CardContent>
      </Card>
    </div>
  </div>
)
