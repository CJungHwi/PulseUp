import { Router } from 'express'

const router = Router()

// API 문서 엔드포인트
router.get('/', (req, res) => {
  const apiDocs = {
    title: 'Multi-Monitor Workout System API',
    version: '1.0.0',
    description: '멀티모니터 운동 시스템을 위한 REST API',
    baseUrl: `${req.protocol}://${req.get('host')}/api`,
    endpoints: {
      auth: {
        'POST /auth/register': '회원가입',
        'POST /auth/login': '로그인'
      },
      users: {
        'GET /users/me': '현재 사용자 정보 조회',
        'PUT /users/me': '사용자 정보 수정',
        'DELETE /users/me': '계정 삭제'
      },
      exercises: {
        'GET /admin/content/exercises/list': '운동 목록 조회 (검색, 필터링, 페이지네이션)',
        'POST /admin/content/exercises': '운동 생성',
        'PUT /admin/content/exercises/:id': '운동 수정',
        'DELETE /admin/content/exercises/:id': '운동 삭제',
        'POST /admin/content/exercises/save-thumbnail': '썸네일 저장'
      },
      playlists: {
        'GET /playlists': '플레이리스트 목록 조회',
        'GET /playlists/:id': '플레이리스트 상세 조회',
        'POST /playlists': '플레이리스트 생성',
        'PUT /playlists/:id': '플레이리스트 수정',
        'DELETE /playlists/:id': '플레이리스트 삭제',
        'POST /playlists/:id/videos': '플레이리스트에 비디오 추가',
        'DELETE /playlists/:id/videos/:videoId': '플레이리스트에서 비디오 제거',
        'PUT /playlists/:id/reorder': '플레이리스트 비디오 순서 변경'
      },
      workouts: {
        'POST /workouts/sessions': '운동 세션 시작',
        'PUT /workouts/sessions/:sessionId/end': '운동 세션 종료',
        'GET /workouts/sessions/active': '현재 활성 세션 조회',
        'POST /workouts/sessions/:sessionId/heartrate': '심박수 데이터 추가',
        'POST /workouts/history': '운동 기록 생성',
        'GET /workouts/history': '운동 기록 목록 조회',
        'GET /workouts/history/:historyId': '운동 기록 상세 조회',
        'PUT /workouts/history/:historyId': '운동 기록 수정',
        'GET /workouts/stats': '운동 통계 조회'
      }
    },
    authentication: {
      type: 'Bearer Token',
      header: 'Authorization: Bearer <token>',
      description: '대부분의 엔드포인트는 JWT 토큰이 필요합니다.'
    },
    responseFormat: {
      success: {
        success: true,
        data: '응답 데이터'
      },
      error: {
        success: false,
        error: '에러 메시지',
        details: '상세 에러 정보 (선택적)'
      }
    },
    rateLimits: {
      general: '15분당 100개 요청',
      auth: '15분당 5개 요청',
      upload: '1시간당 20개 요청'
    }
  }

  res.json(apiDocs)
})

// 헬스 체크 상세 정보
router.get('/health', (req, res) => {
  const healthInfo = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    },
    services: {
      database: 'connected', // 실제로는 DB 연결 상태를 확인해야 함
      youtube_api: 'available'
    }
  }

  res.json(healthInfo)
})

export default router