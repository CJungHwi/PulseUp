import { describe, it, expect } from 'vitest'
import request from 'supertest'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { requestId } from '../middleware/requestId.middleware.js'
import { requestLogger } from '../middleware/logging.middleware.js'
import { apiRateLimit } from '../middleware/rateLimit.middleware.js'
import { errorHandler } from '../middleware/error.middleware.js'
import docsRoutes from '../routes/docs.routes.js'

describe('API Structure', () => {
  const app = express()

  // Setup middleware like in main app
  app.set('trust proxy', 1)
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }))
  app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
  }))
  app.use(express.json({ limit: '10mb', type: ['application/json', 'text/plain'] }))
  app.use(express.urlencoded({ extended: true, limit: '10mb' }))
  app.use(requestId)
  app.use(requestLogger)

  // Health check route
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'OK', 
      message: 'Multi-Monitor Workout System API Server is running',
      timestamp: new Date().toISOString()
    })
  })

  // API Documentation
  app.use('/api/docs', docsRoutes)

  // 404 handler for API routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: '요청한 API 엔드포인트를 찾을 수 없습니다',
      availableEndpoints: '/api/docs'
    })
  })

  // Error handling middleware
  app.use(errorHandler)

  it('should respond to health check', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200)

    expect(response.body).toHaveProperty('status', 'OK')
    expect(response.body).toHaveProperty('message')
    expect(response.body).toHaveProperty('timestamp')
  })

  it('should provide API documentation', async () => {
    const response = await request(app)
      .get('/api/docs')
      .expect(200)

    expect(response.body).toHaveProperty('title', 'Multi-Monitor Workout System API')
    expect(response.body).toHaveProperty('version', '1.0.0')
    expect(response.body).toHaveProperty('endpoints')
    expect(response.body.endpoints).toHaveProperty('auth')
    expect(response.body.endpoints).toHaveProperty('users')
    expect(response.body.endpoints).toHaveProperty('videos')
    expect(response.body.endpoints).toHaveProperty('playlists')
    expect(response.body.endpoints).toHaveProperty('workouts')
  })

  it('should provide detailed health information', async () => {
    const response = await request(app)
      .get('/api/docs/health')
      .expect(200)

    expect(response.body).toHaveProperty('status', 'OK')
    expect(response.body).toHaveProperty('uptime')
    expect(response.body).toHaveProperty('memory')
    expect(response.body).toHaveProperty('services')
  })

  it('should return 404 for unknown API endpoints', async () => {
    const response = await request(app)
      .get('/api/unknown')
      .expect(404)

    expect(response.body).toHaveProperty('success', false)
    expect(response.body).toHaveProperty('error')
    expect(response.body).toHaveProperty('availableEndpoints', '/api/docs')
  })

  it('should include request ID in responses', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200)

    expect(response.headers).toHaveProperty('x-request-id')
    expect(typeof response.headers['x-request-id']).toBe('string')
  })

  it('should include CORS headers', async () => {
    const response = await request(app)
      .options('/api/health')
      .expect(204)

    expect(response.headers).toHaveProperty('access-control-allow-origin')
    expect(response.headers).toHaveProperty('access-control-allow-methods')
  })

  it('should include security headers', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200)

    expect(response.headers).toHaveProperty('x-content-type-options')
    expect(response.headers).toHaveProperty('x-frame-options')
  })
})