/**
 * VideoTooltip — Vimeo 영상 호버 툴팁 (포털 기반)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { convertToEmbedUrl } from './userDashboardUtils'

interface VideoTooltipProps {
  videoUrl: string | undefined
  exerciseName: string
  children: React.ReactElement
}

export const VideoTooltip: React.FC<VideoTooltipProps> = ({ videoUrl, exerciseName, children }) => {
  const embedUrl = convertToEmbedUrl(videoUrl)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const anchorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      setOpen(false)
    }
  }, [])

  const updatePosition = useCallback(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      setPosition({ top: rect.top, left: rect.right + 10 })
    }
  }, [])

  const handleMouseEnter = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    updatePosition()
    timeoutRef.current = setTimeout(() => {
      updatePosition()
      setOpen(true)
    }, 300)
  }, [updatePosition])

  useEffect(() => {
    if (!open) return
    const handleScroll = () => updatePosition()
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleScroll)
    }
  }, [open, updatePosition])

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setOpen(false)
  }, [])

  if (!embedUrl) return <>{children}</>

  return (
    <>
      <div
        ref={anchorRef}
        className="w-full h-full inline-flex items-center cursor-pointer"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>
      {open && typeof document !== 'undefined' && document.body && createPortal(
        <div
          className="fixed w-[560px] h-[315px] bg-black rounded-lg overflow-hidden p-1 z-[9999] shadow-2xl pointer-events-auto"
          style={{ top: `${position.top}px`, left: `${position.left}px` }}
          onMouseEnter={() => {
            updatePosition()
            setOpen(true)
          }}
          onMouseLeave={() => setOpen(false)}
        >
          <iframe
            width="100%"
            height="100%"
            src={embedUrl}
            title={exerciseName}
            frameBorder="0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            style={{ borderRadius: '4px' }}
          />
        </div>,
        document.body
      )}
    </>
  )
}
