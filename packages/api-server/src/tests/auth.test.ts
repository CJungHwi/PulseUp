import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { prisma } from '../lib/prisma.js'
import authRoutes from '../routes/auth.routes.js'
import { errorHandler } from '../middleware/error.middleware.js'
import { AuthService } from '../services/auth.service.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRoutes)
app.use(errorHandler)

describe('Auth Routes', () => {
  let testUser: any
  let accessToken: string
  let refreshToken: string

  beforeAll(async () => {
    // 테스트 데이터베이스 연결 확인
    await prisma.$connect()
  })

  beforeEach(async () => {
    // 각 테스트 전에 테스트 데이터 정리
    await prisma.user.deleteMany({
      where: { email: { contains: 'test' } }
    })
  })

  afterAll(async () => {
    // 테스트 후 정리
    await prisma.user.deleteMany({
      where: { email: { contains: 'test' } }
    })
    await prisma.$disconnect()
  })

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        name: '테스트 사용자',
        password: 'password123'
      }

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.user.email).toBe(userData.email)
      expect(response.body.data.user.name).toBe(userData.name)
      expect(response.body.data.accessToken).toBeDefined()
      expect(response.body.data.refreshToken).toBeDefined()
      expect(response.body.data.expiresIn).toBeDefined()
      expect(response.body.data.user.password).toBeUndefined()
    })

    it('should return error for duplicate email', async () => {
      const userData = {
        email: 'test@example.com',
        name: '테스트 사용자',
        password: 'password123'
      }

      // 첫 번째 사용자 등록
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201)

      // 같은 이메일로 두 번째 등록 시도
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...userData, name: '테스트 사용자2' })
        .expect(409)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('이미 존재하는 이메일입니다')
    })

    it('should return validation error for invalid data', async () => {
      const userData = {
        email: 'invalid-email',
        name: '',
        password: '123'
      }

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400)

      expect(response.body.error).toBe('입력 데이터가 유효하지 않습니다')
      expect(response.body.details).toBeDefined()
    })
  })

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // 테스트용 사용자 생성
      const userData = {
        email: 'test@example.com',
        name: '테스트 사용자',
        password: 'password123'
      }

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData)

      testUser = registerResponse.body.data.user
      accessToken = registerResponse.body.data.accessToken
      refreshToken = registerResponse.body.data.refreshToken
    })

    it('should login successfully with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      }

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.user.email).toBe(loginData.email)
      expect(response.body.data.accessToken).toBeDefined()
      expect(response.body.data.refreshToken).toBeDefined()
      expect(response.body.data.expiresIn).toBeDefined()
    })

    it('should return error for invalid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      }

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('이메일 또는 비밀번호가 올바르지 않습니다')
    })

    it('should return error for non-existent user', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'password123'
      }

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('이메일 또는 비밀번호가 올바르지 않습니다')
    })
  })

  describe('POST /api/auth/refresh', () => {
    beforeEach(async () => {
      // 테스트용 사용자 생성
      const userData = {
        email: 'test@example.com',
        name: '테스트 사용자',
        password: 'password123'
      }

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData)

      refreshToken = registerResponse.body.data.refreshToken
    })

    it('should refresh tokens successfully with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.accessToken).toBeDefined()
      expect(response.body.data.refreshToken).toBeDefined()
      expect(response.body.data.expiresIn).toBeDefined()
    })

    it('should return error for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('유효하지 않은 리프레시 토큰입니다')
    })
  })

  describe('GET /api/auth/me', () => {
    beforeEach(async () => {
      // 테스트용 사용자 생성
      const userData = {
        email: 'test@example.com',
        name: '테스트 사용자',
        password: 'password123'
      }

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData)

      accessToken = registerResponse.body.data.accessToken
    })

    it('should return user info with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.user.email).toBe('test@example.com')
      expect(response.body.data.tokenExpiringSoon).toBeDefined()
    })

    it('should return error without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('액세스 토큰이 필요합니다')
    })

    it('should return error with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('유효하지 않은 토큰입니다')
    })
  })

  describe('POST /api/auth/verify', () => {
    beforeEach(async () => {
      // 테스트용 사용자 생성
      const userData = {
        email: 'test@example.com',
        name: '테스트 사용자',
        password: 'password123'
      }

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData)

      accessToken = registerResponse.body.data.accessToken
    })

    it('should verify token successfully', async () => {
      const response = await request(app)
        .post('/api/auth/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.valid).toBe(true)
      expect(response.body.data.user.email).toBe('test@example.com')
      expect(response.body.data.tokenExpiringSoon).toBeDefined()
      expect(response.body.data.expirationTime).toBeDefined()
    })

    it('should return error for invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/verify')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('토큰 검증에 실패했습니다')
    })
  })

  describe('POST /api/auth/logout', () => {
    beforeEach(async () => {
      // 테스트용 사용자 생성
      const userData = {
        email: 'test@example.com',
        name: '테스트 사용자',
        password: 'password123'
      }

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData)

      accessToken = registerResponse.body.data.accessToken
    })

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('로그아웃이 완료되었습니다')
    })
  })
})

describe('AuthService', () => {
  describe('Token operations', () => {
    it('should generate and verify tokens correctly', () => {
      const userId = 'test-user-id'
      const email = 'test@example.com'

      const tokens = AuthService.generateTokens(userId, email)

      expect(tokens.accessToken).toBeDefined()
      expect(tokens.refreshToken).toBeDefined()
      expect(tokens.expiresIn).toBe(90 * 60) // 1시간 30분
      expect(tokens.refreshExpiresIn).toBe(7 * 24 * 60 * 60) // 7일

      // 액세스 토큰 검증
      const accessPayload = AuthService.verifyToken(tokens.accessToken)
      expect(accessPayload.userId).toBe(userId)
      expect(accessPayload.email).toBe(email)
      expect(accessPayload.type).toBe('access')

      // 리프레시 토큰 검증
      const refreshPayload = AuthService.verifyToken(tokens.refreshToken, true)
      expect(refreshPayload.userId).toBe(userId)
      expect(refreshPayload.email).toBe(email)
      expect(refreshPayload.type).toBe('refresh')
    })

    it('should hash and verify passwords correctly', async () => {
      const password = 'testpassword123'
      const hashedPassword = await AuthService.hashPassword(password)

      expect(hashedPassword).not.toBe(password)
      expect(hashedPassword.length).toBeGreaterThan(50)

      const isValid = await AuthService.verifyPassword(password, hashedPassword)
      expect(isValid).toBe(true)

      const isInvalid = await AuthService.verifyPassword('wrongpassword', hashedPassword)
      expect(isInvalid).toBe(false)
    })
  })
})