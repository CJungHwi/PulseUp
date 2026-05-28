/**
 * useResizers — MonthProgram 영역 분할/컬럼 리사이즈 훅
 *
 * - `useMainSplitter`: 좌(기록) / 우(상세) 좌우 폭 조절 (% 단위, 20~60%)
 * - `useDetailColumnResize`: 상세 테이블 각 컬럼 너비 조절 (% 단위)
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export const useMainSplitter = (initialPercent = 28) => {
  const [leftAreaWidth, setLeftAreaWidth] = useState(initialPercent)
  const [isResizingMain, setIsResizingMain] = useState(false)

  const handleMainMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizingMain(true)
  }, [])

  useEffect(() => {
    if (!isResizingMain) return

    const handleMove = (e: MouseEvent) => {
      const containerWidth = window.innerWidth
      const newLeftWidth = (e.clientX / containerWidth) * 100
      setLeftAreaWidth(Math.min(Math.max(newLeftWidth, 20), 60))
    }
    const handleUp = () => setIsResizingMain(false)

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizingMain])

  return { leftAreaWidth, isResizingMain, handleMainMouseDown }
}

export const useDetailColumnResize = (initialWidths: number[]) => {
  const [detailTableColumnWidths, setDetailTableColumnWidths] = useState<number[]>(initialWidths)
  const [resizingDetailColIndex, setResizingDetailColIndex] = useState<number | null>(null)
  const detailTableContainerRef = useRef<HTMLDivElement>(null)

  const handleDetailColResizeStart = useCallback(
    (colIndex: number) => (e: React.MouseEvent) => {
      e.preventDefault()
      setResizingDetailColIndex(colIndex)
    },
    [],
  )

  useEffect(() => {
    if (resizingDetailColIndex === null) return

    const handleMove = (e: MouseEvent) => {
      const tableWidth = detailTableContainerRef.current?.offsetWidth ?? 600
      const percentDelta = tableWidth > 0 ? (e.movementX / tableWidth) * 100 : 0
      setDetailTableColumnWidths((prev) => {
        const next = [...prev]
        const newWidth = Math.max(
          5,
          Math.min(50, prev[resizingDetailColIndex] + percentDelta),
        )
        next[resizingDetailColIndex] = newWidth
        return next
      })
    }
    const handleEnd = () => setResizingDetailColIndex(null)

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleEnd)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleEnd)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [resizingDetailColIndex])

  return {
    detailTableColumnWidths,
    resizingDetailColIndex,
    detailTableContainerRef,
    handleDetailColResizeStart,
  }
}
