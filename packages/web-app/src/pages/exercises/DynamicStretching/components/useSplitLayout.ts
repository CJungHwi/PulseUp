/**
 * useSplitLayout — 좌우/상하 스플리터 레이아웃 훅
 *
 * - 마우스 드래그로 left-panel 영역과 그 내부 top 영역의 크기를 비율로 변경
 * - leftWidth: 0~100(%) 좌측 패널 너비
 * - topHeight: 0~100(%) 좌측 패널 내부 상단 영역 높이
 *
 * 사용처: `CoolDown.tsx`, `DynamicStretching.tsx`
 */
import { useCallback, useEffect, useRef, useState } from 'react'

interface UseSplitLayoutArgs {
  initialLeftWidth?: number
  initialTopHeight?: number
  minPercent?: number
  maxPercent?: number
}

export const useSplitLayout = ({
  initialLeftWidth = 25,
  initialTopHeight = 40,
  minPercent = 10,
  maxPercent = 90,
}: UseSplitLayoutArgs = {}) => {
  const [leftWidth, setLeftWidth] = useState(initialLeftWidth)
  const [topHeight, setTopHeight] = useState(initialTopHeight)
  const [isDraggingHorizontal, setIsDraggingHorizontal] = useState(false)
  const [isDraggingVertical, setIsDraggingVertical] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      if (isDraggingHorizontal) {
        const newWidth = ((e.clientX - rect.left) / rect.width) * 100
        setLeftWidth(Math.min(Math.max(newWidth, minPercent), maxPercent))
        return
      }
      if (isDraggingVertical) {
        const leftPanel = containerRef.current.querySelector('.left-panel')
        if (leftPanel) {
          const lpRect = leftPanel.getBoundingClientRect()
          const newHeight = ((e.clientY - lpRect.top) / lpRect.height) * 100
          setTopHeight(Math.min(Math.max(newHeight, minPercent), maxPercent))
        }
      }
    },
    [isDraggingHorizontal, isDraggingVertical, minPercent, maxPercent]
  )

  const handleMouseUp = useCallback(() => {
    setIsDraggingHorizontal(false)
    setIsDraggingVertical(false)
  }, [])

  useEffect(() => {
    if (!isDraggingHorizontal && !isDraggingVertical) return
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingHorizontal, isDraggingVertical, handleMouseMove, handleMouseUp])

  return {
    containerRef,
    leftWidth,
    topHeight,
    startHorizontalDrag: () => setIsDraggingHorizontal(true),
    startVerticalDrag: () => setIsDraggingVertical(true),
  }
}
