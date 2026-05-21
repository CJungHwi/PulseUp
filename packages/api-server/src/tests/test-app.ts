import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import authRoutes from '../routes/auth.routes.js'
import adminRoutes from '../routes/admin.routes.js'
import { errorHandler } from '../middleware/error.middleware.js'

// 테스트용 Express 앱 생성 (서버 시작 없이)
export const createTestApp = () => {
  const app = express()

  // 미들웨어 설정
  app.use(helmet())
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }))
  app.use(express.json({ limit: '50mb' }))
  app.use(express.urlencoded({ extended: true, limit: '50mb' }))

  // 헬스 체크 엔드포인트
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    })
  })

  // 라우트 설정
  app.use('/api/auth', authRoutes)
  app.use('/api/admin', adminRoutes)

  // 테스트용 관리자 엔드포인트
  app.get('/api/admin/test', (req, res) => {
    res.json({ message: 'Admin test endpoint' })
  })

  // 에러 핸들링 미들웨어
  app.use(errorHandler)

  return app
}