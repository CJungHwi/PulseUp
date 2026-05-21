import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
import { errorHandler } from './middleware/error.middleware.js'
import { requestLogger } from './middleware/logging.middleware.js'
import { apiRateLimit /*, authRateLimit*/ } from './middleware/rateLimit.middleware.js'
import { testConnection } from './lib/database.js'

// Routes
import authRoutes from './routes/auth.routes.js'
import branchRoutes from './routes/branches.routes.js'
// import userRoutes from './routes/users.routes.js'
// import videoRoutes from './routes/videos.routes.js'
// import playlistRoutes from './routes/playlists.routes.js'
// import workoutRoutes from './routes/workouts.routes.js'
// import heartrateRoutes from './routes/heartrate.routes.js'
import announcementRoutes from './routes/announcements.routes.js'
import { menusRoutes } from './routes/menus.routes.js'
import workoutCategoryRoutes from './routes/workoutCategories.routes.js'
import docsRoutes from './routes/docs.routes.js'
import adminRoutes from './routes/admin.routes.js'
import electronRoutes from './routes/electron.routes.js'
import deviceRoutes from './routes/devices.routes.js'
import electronRelayRoutes from './routes/electronRelay.routes.js'
import { ElectronRelayService } from './services/electronRelay.service.js'
import dashboardRoutes from './routes/dashboard.routes.js'
import userDashboardRoutes from './routes/user-dashboard.routes.js'
import bluetoothRoutes from './routes/bluetooth.routes.js'
import heartrateRoutes from './routes/heartrate.routes.js'
import vimeoRoutes from './routes/vimeo.routes.js'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// 데이터베이스 연결 테스트
testConnection().then(connected => {
  if (!connected) {
    console.error('❌ 데이터베이스 연결 실패 - 서버를 시작할 수 없습니다')
    process.exit(1)
  }
})

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1)

// Core middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}))
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL || 'http://localhost:3000'
    : true, // 개발 환경에서는 모든 origin 허용
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}))
// Electron workout-logs 등 대용량 JSON 본문 허용 (역프록시 nginx는 client_max_body_size 별도 설정)
app.use(express.json({
  limit: process.env.JSON_BODY_LIMIT || '80mb',
  type: ['application/json', 'text/plain']
}))
app.use(express.urlencoded({
  extended: true,
  limit: process.env.URLENCODED_BODY_LIMIT || '80mb'
}))

// Request tracking and logging
app.use((req, res, next) => {
  // 간단한 요청 ID 생성
  const id = req.headers['x-request-id'] as string || Math.random().toString(36).substr(2, 9)
  res.setHeader('X-Request-ID', id)

  // 메뉴 관련 요청 로깅
  if (req.url.includes('/menus/')) {
    //console.log(`📋 메뉴 API 요청: ${req.method} ${req.url}`)
    //console.log('헤더:', req.headers.authorization ? 'Authorization 있음' : 'Authorization 없음')
  }

  next()
})
app.use(requestLogger)

// Rate limiting (개발 환경에서는 완전히 비활성화)
// if (process.env.NODE_ENV === 'production') {
//   app.use('/api', apiRateLimit)
// }

// Simple health check route (no rate limiting)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Multi-Monitor Workout System API Server is running',
    timestamp: new Date().toISOString()
  })
})

// API Documentation
app.use('/api/docs', docsRoutes)

// API Routes with specific rate limiting
// app.use('/api/auth', authRateLimit, authRoutes) // 로그인 시도 제한 비활성화
app.use('/api/auth', authRoutes)
app.use('/api/branches', branchRoutes)
// app.use('/api/users', userRoutes)
// app.use('/api/videos', videoRoutes)
// app.use('/api/playlists', playlistRoutes)
// app.use('/api/workouts', workoutRoutes)
// app.use('/api/heart-rate-data', heartrateRoutes)
app.use('/api/announcements', announcementRoutes)
app.use('/api/menus', menusRoutes)
app.use('/api/workout-categories', workoutCategoryRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/electron', electronRoutes)
app.use('/api/devices', deviceRoutes)
app.use('/api/electron-relay', electronRelayRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/user-dashboard', userDashboardRoutes)
app.use('/api/bluetooth', bluetoothRoutes)
app.use('/api/heart-rate', heartrateRoutes)
app.use('/api/vimeo', vimeoRoutes)

// 정적 파일 서빙 (업로드된 이미지)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: '요청한 API 엔드포인트를 찾을 수 없습니다',
    availableEndpoints: '/api/docs'
  })
})

// 404 handler for all other routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: '요청한 리소스를 찾을 수 없습니다',
    suggestion: 'API 문서는 /api/docs에서 확인할 수 있습니다'
  })
})

// Error handling middleware (must be last)
app.use(errorHandler)

// Graceful shutdown handling
const server = app.listen(PORT, () => {
  console.log(`🚀 API Server running on port ${PORT}`)
  // console.log(`📊 Health check: http://localhost:${PORT}/api/health`)
  // console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`)
  // console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
  // console.log(`🔒 Rate limiting enabled`)
  
  // WebSocket Relay 서비스 초기화
  ElectronRelayService.initialize(server)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  ElectronRelayService.shutdown()
  server.close(() => {
    console.log('Process terminated')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully')
  ElectronRelayService.shutdown()
  server.close(() => {
    console.log('Process terminated')
    process.exit(0)
  })
})