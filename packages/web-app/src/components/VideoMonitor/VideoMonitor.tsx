import React, { useState, useEffect, useRef } from 'react'
import { Box, Typography, Paper, LinearProgress } from '@mui/material'

// 운동 정보 타입
interface Exercise {
  id: string
  originalExerciseId?: string
  name_ko: string
  name_en: string
  duration: number
  video_url?: string
  video_start_time?: number
  video_end_time?: number
  position?: string
}

// 영상 모니터 Props
interface VideoMonitorProps {
  // Dynamic Stretching 운동들
  dynamicExercises: Exercise[]
  // Main 운동들 (Power Circuit 등)
  mainExercises: Exercise[]
  // Cool Down (Static Stretching) 운동들
  cooldownExercises: Exercise[]
  // 모니터 닫기 콜백
  onClose: () => void
}

// 운동 단계
type WorkoutPhase = 'intro' | 'dynamic' | 'main' | 'static' | 'complete'

const VideoMonitor: React.FC<VideoMonitorProps> = ({
  dynamicExercises,
  mainExercises,
  cooldownExercises,
  onClose
}) => {
  const [phase, setPhase] = useState<WorkoutPhase>('intro')
  const [currentTime, setCurrentTime] = useState(0)
  const [phaseDuration, setPhaseDuration] = useState(0)
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0) // Stretching 그룹 인덱스 (0, 1, ...)

  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // 초기 데이터 로그
  useEffect(() => {
    console.log('=== VideoMonitor 시작 ===')
    console.log('Dynamic Exercises:', dynamicExercises)
    console.log('Main Exercises:', mainExercises)
    console.log('Cool Down Exercises:', cooldownExercises)
  }, [])

  // 운동 단계별 시간 계산
  const getPhaseInfo = () => {
    switch (phase) {
      case 'intro':
        return { duration: 240, title: '영상 설명' } // 4분
      case 'dynamic':
        const dynamicGroup = getDynamicGroup(currentGroupIndex)
        // Stretching은 동시 재생이므로 최대값 사용 (A1~A6 중 가장 긴 시간)
        const dynamicDuration = dynamicGroup.length > 0
          ? Math.max(...dynamicGroup.map(ex => ex.duration))
          : 0
        return { duration: dynamicDuration, title: 'Dynamic Stretching' }
      case 'main':
        const mainDuration = mainExercises.reduce((sum, ex) => sum + ex.duration, 0)
        return { duration: mainDuration, title: 'Power Circuit' }
      case 'static':
        const staticGroup = getStaticGroup(currentGroupIndex)
        // Stretching은 동시 재생이므로 최대값 사용 (A1~A6 중 가장 긴 시간)
        const staticDuration = staticGroup.length > 0
          ? Math.max(...staticGroup.map(ex => ex.duration))
          : 0
        return { duration: staticDuration, title: 'Cool Down (Static Stretching)' }
      case 'complete':
        return { duration: 0, title: '운동 완료' }
      default:
        return { duration: 0, title: '' }
    }
  }

  // Dynamic Stretching 그룹 가져오기 (3개씩)
  const getDynamicGroup = (groupIndex: number): Exercise[] => {
    const start = groupIndex * 3
    return dynamicExercises.slice(start, start + 3)
  }

  // Static Stretching 그룹 가져오기 (3개씩)
  const getStaticGroup = (groupIndex: number): Exercise[] => {
    const start = groupIndex * 3
    return cooldownExercises.slice(start, start + 3)
  }

  // 타이머 시작
  useEffect(() => {
    const phaseInfo = getPhaseInfo()
    setPhaseDuration(phaseInfo.duration)
    setCurrentTime(0)

    if (phase === 'complete') {
      // 운동 완료 후 3초 뒤 닫기
      setTimeout(() => {
        onClose()
      }, 3000)
      return
    }

    // 1초마다 타이머 업데이트
    timerRef.current = setInterval(() => {
      setCurrentTime(prev => {
        const newTime = prev + 1

        // 현재 단계 완료 체크
        if (newTime >= phaseInfo.duration) {
          moveToNextPhase()
          return 0
        }

        return newTime
      })
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [phase, currentGroupIndex])

  // 다음 단계로 이동
  const moveToNextPhase = () => {
    if (phase === 'intro') {
      // 영상 설명 → Dynamic Stretching (첫 번째 그룹)
      setPhase('dynamic')
      setCurrentGroupIndex(0)
    } else if (phase === 'dynamic') {
      const totalGroups = Math.ceil(dynamicExercises.length / 3)
      if (currentGroupIndex < totalGroups - 1) {
        // Dynamic Stretching 다음 그룹
        setCurrentGroupIndex(prev => prev + 1)
      } else {
        // Dynamic Stretching 완료 → Main 운동
        setPhase('main')
        setCurrentGroupIndex(0)
      }
    } else if (phase === 'main') {
      // Main 운동 → Static Stretching (첫 번째 그룹)
      setPhase('static')
      setCurrentGroupIndex(0)
    } else if (phase === 'static') {
      const totalGroups = Math.ceil(cooldownExercises.length / 3)
      if (currentGroupIndex < totalGroups - 1) {
        // Static Stretching 다음 그룹
        setCurrentGroupIndex(prev => prev + 1)
      } else {
        // Static Stretching 완료 → 운동 완료
        setPhase('complete')
      }
    }
  }

  // 시간 포맷팅 (초 → MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // 진행률 계산
  const progress = phaseDuration > 0 ? (currentTime / phaseDuration) * 100 : 0

  // 영상 URL에서 embed URL 추출 (YouTube/Vimeo 지원)
  const getVideoEmbedUrl = (exercise: Exercise) => {
    if (!exercise.video_url) return null

    // Vimeo URL 체크 (video_url이 ID만 있는 경우도 지원)
    const vimeoIdOnly = exercise.video_url.match(/^(\d+)$/)
    const vimeoMatch = exercise.video_url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/)

    if (vimeoIdOnly || vimeoMatch) {
      const videoId = vimeoIdOnly ? vimeoIdOnly[1] : (vimeoMatch ? vimeoMatch[1] : null)
      if (!videoId) return null

      let embedUrl = `https://player.vimeo.com/video/${videoId}?autoplay=1&muted=1&loop=1&controls=0&title=0&byline=0&portrait=0&badge=0&dnt=1`

      return embedUrl
    }

    // YouTube URL 체크
    const youtubeMatch = exercise.video_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
    if (youtubeMatch) {
      const videoId = youtubeMatch[1]
      let embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0&modestbranding=1`

      if (exercise.video_start_time && exercise.video_start_time > 0) {
        embedUrl += `&start=${exercise.video_start_time}`
      }

      if (exercise.video_end_time && exercise.video_end_time > 0) {
        embedUrl += `&end=${exercise.video_end_time}`
      }

      return embedUrl
    }

    return null
  }

  // 현재 표시할 운동들 가져오기
  const getCurrentExercises = (): Exercise[] => {
    if (phase === 'intro') {
      return mainExercises // 영상 설명에서는 Main 운동들 표시
    } else if (phase === 'dynamic') {
      return getDynamicGroup(currentGroupIndex)
    } else if (phase === 'main') {
      return mainExercises
    } else if (phase === 'static') {
      return getStaticGroup(currentGroupIndex)
    }
    return []
  }

  // 위치별로 운동 정렬
  const getExercisesByPosition = () => {
    const exercises = getCurrentExercises()
    const positionMap: { [key: string]: Exercise } = {}

    exercises.forEach(ex => {
      if (ex.position) {
        positionMap[ex.position] = ex

        // Stretching: DS1-3 → 좌측 num1-3 슬롯에 우측 num4-6 미러 (동일 half 내)
        if ((phase === 'dynamic' || phase === 'static') && ex.position.startsWith('DS')) {
          const dsNum = parseInt(ex.position.replace('DS', ''), 10)
          if (dsNum >= 1 && dsNum <= 3) {
            positionMap[`DS${dsNum + 3}`] = ex
          }
        }
      }
    })

    return positionMap
  }

  const exercisesByPosition = getExercisesByPosition()
  const phaseInfo = getPhaseInfo()

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* 헤더 - 현재 단계 및 타이머 */}
      <Box
        sx={{
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          p: 2,
          textAlign: 'center'
        }}
      >
        <Typography variant="h4" sx={{ mb: 1, fontWeight: 'bold' }}>
          {phaseInfo.title}
        </Typography>
        <Typography variant="h5" sx={{ mb: 1 }}>
          {formatTime(currentTime)} / {formatTime(phaseDuration)}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 8,
            borderRadius: 4,
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
            '& .MuiLinearProgress-bar': {
              backgroundColor: '#4caf50'
            }
          }}
        />
      </Box>

      {/* 영상 그리드 */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          gap: 2,
          p: 2
        }}
      >
        {/* 모니터 1 (좌측) - num 1-3: A1~A3, B1~B3 */}
        <Box
          sx={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridTemplateRows: 'repeat(2, 1fr)',
            gap: 2
          }}
        >
          {['A1', 'A2', 'A3', 'B1', 'B2', 'B3'].map(position => {
            const exercise = exercisesByPosition[position]
            const embedUrl = exercise ? getVideoEmbedUrl(exercise) : null

            return (
              <Paper
                key={position}
                sx={{
                  backgroundColor: '#1a1a1a',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden'
                }}
              >
                <Box
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    p: 1,
                    textAlign: 'center'
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {position}
                  </Typography>
                  {exercise && (
                    <Typography variant="caption" sx={{ display: 'block' }}>
                      {exercise.name_ko}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ flex: 1, position: 'relative' }}>
                  {embedUrl ? (
                    <iframe
                      width="100%"
                      height="100%"
                      src={embedUrl}
                      title={`${position} video`}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%'
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'rgba(255, 255, 255, 0.3)'
                      }}
                    >
                      <Typography variant="body2">영상 없음</Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
            )
          })}
        </Box>

        {/* 모니터 3 (우측) - num 4-6: A4~A6, B4~B6 */}
        <Box
          sx={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridTemplateRows: 'repeat(2, 1fr)',
            gap: 2
          }}
        >
          {['A4', 'A5', 'A6', 'B4', 'B5', 'B6'].map(position => {
            const exercise = exercisesByPosition[position]
            const embedUrl = exercise ? getVideoEmbedUrl(exercise) : null

            return (
              <Paper
                key={position}
                sx={{
                  backgroundColor: '#1a1a1a',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden'
                }}
              >
                <Box
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    p: 1,
                    textAlign: 'center'
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {position}
                  </Typography>
                  {exercise && (
                    <Typography variant="caption" sx={{ display: 'block' }}>
                      {exercise.name_ko}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ flex: 1, position: 'relative' }}>
                  {embedUrl ? (
                    <iframe
                      width="100%"
                      height="100%"
                      src={embedUrl}
                      title={`${position} video`}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%'
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'rgba(255, 255, 255, 0.3)'
                      }}
                    >
                      <Typography variant="body2">영상 없음</Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}

export default VideoMonitor


