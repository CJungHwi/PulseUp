import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { createTestApp } from './test-app.js'
import { executeQuery } from '../lib/database.js'
import { AuthService } from '../services/auth.service.js'
import { UserActivityService } from '../services/admin/user-activity.service.js'
import { DashboardStatsService } from '../services/admin/dashboard-stats.service.js'

describe('Admin Management System', () => {
  const app = createTestApp()
  let adminToken: string
  let userToken: string
  let adminUserId: string
  let regularUserId: string

  beforeAll(async () => {
    // 테스트용 관리자 계정 생성
    const adminPassword = await AuthService.hashPassword('admin123!')
    const adminResult = await executeQuery(
      `INSERT INTO users (userid, name, email, password, role) 
       VALUES (?, ?, ?, ?, ?)`,
      ['test_admin', '테스트 관리자', 'test_admin@example.com', adminPassword, 'admin']
    )
    adminUserId = adminResult.insertId

    // 테스트용 일반 사용자 계정 생성
    const userPassword = await AuthService.hashPassword('user123!')
    const userResult = await executeQuery(
      `INSERT INTO users (userid, name, email, password, role) 
       VALUES (?, ?, ?, ?, ?)`,
      ['test_user', '테스트 사용자', 'test_user@example.com', userPassword, 'user']
    )
    regularUserId = userResult.insertId

    // 토큰 생성
    adminToken = AuthService.generateAccessToken(adminUserId, 'test_admin')
    userToken = AuthService.generateAccessToken(regularUserId, 'test_user')
  })

  afterAll(async () => {
    // 테스트 데이터 정리
    await executeQuery('DELETE FROM user_activity_logs WHERE user_id IN (?, ?)', [adminUserId, regularUserId])
    await executeQuery('DELETE FROM users WHERE id IN (?, ?)', [adminUserId, regularUserId])
  })

  describe('Admin Middleware', () => {
    it('should allow admin access to admin routes', async () => {
      const response = await request(app)
        .get('/api/admin/test')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).not.toBe(403)
    })

    it('should deny regular user access to admin routes', async () => {
      const response = await request(app)
        .get('/api/admin/test')
        .set('Authorization', `Bearer ${userToken}`)

      expect(response.status).toBe(403)
      expect(response.body.code).toBe('ADMIN_REQUIRED')
    })

    it('should deny unauthenticated access to admin routes', async () => {
      const response = await request(app)
        .get('/api/admin/test')

      expect(response.status).toBe(401)
      expect(response.body.code).toBe('TOKEN_REQUIRED')
    })
  })

  describe('Admin Activity Logging', () => {
    beforeEach(async () => {
      // 각 테스트 전에 로그 정리
      await executeQuery('DELETE FROM admin_activity_logs WHERE admin_id = ?', [adminUserId])
    })

    it('should log admin activity', async () => {
      await UserActivityService.logActivity({
        userId: adminUserId,
        action: 'TEST_ACTION',
        targetType: 'user',
        targetId: regularUserId,
        details: { test: 'data' },
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      })

      const logs = await UserActivityService.getRecentActivityByUser(adminUserId, 1)
      
      expect(logs).toHaveLength(1)
      expect(logs[0].action).toBe('TEST_ACTION')
      expect(logs[0].targetType).toBe('user')
      expect(logs[0].targetId).toBe(regularUserId)
      expect(logs[0].details).toEqual({ test: 'data' })
    })

    it('should retrieve activity logs with pagination', async () => {
      // 여러 로그 생성
      for (let i = 0; i < 5; i++) {
        await UserActivityService.logActivity({
          userId: adminUserId,
          action: `TEST_ACTION_${i}`,
          targetType: 'user'
        })
      }

      const result = await UserActivityService.getActivityLogs(1, 3, adminUserId)
      
      expect(result.logs).toHaveLength(3)
      expect(result.total).toBe(5)
      expect(result.totalPages).toBe(2)
    })

    it('should get activity statistics', async () => {
      // 테스트 로그 생성
      await UserActivityService.logActivity({
        userId: adminUserId,
        action: 'CREATE_USER',
        targetType: 'user'
      })
      
      await UserActivityService.logActivity({
        userId: adminUserId,
        action: 'UPDATE_USER',
        targetType: 'user'
      })

      const stats = await UserActivityService.getActivityStats()
      
      expect(stats.totalActivities).toBeGreaterThan(0)
      expect(stats.activitiesByAction).toBeInstanceOf(Array)
      expect(stats.activitiesByAdmin).toBeInstanceOf(Array)
      expect(stats.activitiesByDate).toBeInstanceOf(Array)
    })
  })

  describe('Authentication with Roles', () => {
    it('should include role in user token data', async () => {
      const user = await AuthService.getUserFromToken(adminToken)
      
      expect(user).toBeTruthy()
      expect(user?.role).toBe('admin')
    })

    it('should handle login with role information', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test_admin',
          password: 'admin123!'
        })

      expect(loginResponse.status).toBe(200)
      expect(loginResponse.body.user.role).toBe('admin')
    })
  })

  describe('Role-based Access Control', () => {
    it('should validate admin role correctly', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).not.toBe(403)
    })

    it('should reject non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${userToken}`)

      expect(response.status).toBe(403)
      expect(response.body.error).toContain('관리자 권한이 필요합니다')
    })
  })

  describe('Dashboard API Integration', () => {
    it('should return dashboard statistics for admin', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('totalUsers')
      expect(response.body).toHaveProperty('totalVideos')
      expect(response.body).toHaveProperty('totalPlaylists')
      expect(response.body).toHaveProperty('totalSessions')
      expect(response.body).toHaveProperty('userGrowthData')
      expect(response.body).toHaveProperty('recentActivities')
      expect(response.body).toHaveProperty('systemAlerts')
    })

    it('should return user activity chart data', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard/user-activity')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toBeInstanceOf(Array)
    })
  })

  describe('User Management API Integration', () => {
    let testUserId: string

    it('should create a new user', async () => {
      const userData = {
        userid: 'test_new_user',
        name: '새 테스트 사용자',
        email: 'test_new_user@example.com',
        password: 'newuser123!',
        role: 'user'
      }

      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(userData)

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('id')
      expect(response.body.userid).toBe(userData.userid)
      expect(response.body.name).toBe(userData.name)
      expect(response.body.role).toBe(userData.role)
      
      testUserId = response.body.id
    })

    it('should get user list with pagination', async () => {
      const response = await request(app)
        .get('/api/admin/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('users')
      expect(response.body).toHaveProperty('total')
      expect(response.body).toHaveProperty('totalPages')
      expect(response.body.users).toBeInstanceOf(Array)
    })

    it('should update user information', async () => {
      const updateData = {
        name: '업데이트된 사용자',
        role: 'admin'
      }

      const response = await request(app)
        .put(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)

      expect(response.status).toBe(200)
      expect(response.body.name).toBe(updateData.name)
      expect(response.body.role).toBe(updateData.role)
    })

    it('should deactivate user', async () => {
      const response = await request(app)
        .patch(`/api/admin/users/${testUserId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.isActive).toBe(false)
    })

    afterAll(async () => {
      // 테스트 사용자 정리
      if (testUserId) {
        await executeQuery('DELETE FROM users WHERE id = ?', [testUserId])
      }
    })
  })

  describe('Content Management API Integration', () => {
    it('should get all videos with admin access', async () => {
      const response = await request(app)
        .get('/api/admin/content/videos')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('videos')
      expect(response.body).toHaveProperty('total')
    })

    it('should get all playlists with admin access', async () => {
      const response = await request(app)
        .get('/api/admin/content/playlists')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('playlists')
      expect(response.body).toHaveProperty('total')
    })

    it('should search content with filters', async () => {
      const response = await request(app)
        .get('/api/admin/content/search?query=test&type=video')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('results')
      expect(response.body).toHaveProperty('total')
    })
  })

  describe('Activity Logs API Integration', () => {
    it('should get activity logs with pagination', async () => {
      const response = await request(app)
        .get('/api/admin/activity-logs?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('logs')
      expect(response.body).toHaveProperty('total')
      expect(response.body).toHaveProperty('totalPages')
    })

    it('should get activity statistics', async () => {
      const response = await request(app)
        .get('/api/admin/activity-logs/stats')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('totalActivities')
      expect(response.body).toHaveProperty('activitiesByAction')
      expect(response.body).toHaveProperty('activitiesByAdmin')
      expect(response.body).toHaveProperty('activitiesByDate')
    })
  })

  describe('Security Validation', () => {
    it('should prevent SQL injection in user queries', async () => {
      const maliciousQuery = "'; DROP TABLE users; --"
      
      const response = await request(app)
        .get(`/api/admin/users?search=${encodeURIComponent(maliciousQuery)}`)
        .set('Authorization', `Bearer ${adminToken}`)

      // 응답이 정상적으로 처리되어야 함 (SQL 인젝션이 차단됨)
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('users')
    })

    it('should validate input data types and formats', async () => {
      const invalidUserData = {
        userid: '', // 빈 문자열
        name: 'a'.repeat(256), // 너무 긴 이름
        email: 'invalid@example.com',
        password: '123', // 너무 짧은 비밀번호
        role: 'invalid_role' // 잘못된 역할
      }

      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidUserData)

      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error')
    })

    it('should prevent unauthorized token manipulation', async () => {
      const fakeToken = 'fake.token.here'
      
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${fakeToken}`)

      expect(response.status).toBe(401)
      expect(response.body.code).toBe('INVALID_TOKEN')
    })

    it('should handle expired tokens properly', async () => {
      // 만료된 토큰 시뮬레이션 (실제로는 JWT 만료 시간을 조작해야 함)
      const expiredToken = AuthService.generateAccessToken(adminUserId, 'test_admin', -1)
      
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${expiredToken}`)

      expect(response.status).toBe(401)
    })

    it('should rate limit API requests', async () => {
      // 연속적인 요청으로 rate limiting 테스트
      const requests = Array(20).fill(null).map(() => 
        request(app)
          .get('/api/admin/dashboard')
          .set('Authorization', `Bearer ${adminToken}`)
      )

      const responses = await Promise.all(requests)
      
      // 일부 요청이 rate limit에 걸려야 함
      const rateLimitedResponses = responses.filter(res => res.status === 429)
      expect(rateLimitedResponses.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling and Logging', () => {
    it('should handle database connection errors gracefully', async () => {
      // 잘못된 쿼리로 데이터베이스 오류 시뮬레이션
      const response = await request(app)
        .get('/api/admin/users/999999999') // 존재하지 않는 사용자 ID
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(404)
      expect(response.body).toHaveProperty('error')
    })

    it('should log admin activities automatically', async () => {
      // 사용자 생성 요청
      const userData = {
        userid: 'log_test_user',
        name: '로그 테스트 사용자',
        email: 'log_test_user@example.com',
        password: 'logtest123!',
        role: 'user'
      }

      await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(userData)

      // 활동 로그가 생성되었는지 확인
      const logs = await UserActivityService.getRecentActivityByUser(adminUserId, 5)
      const createUserLog = logs.find(log => log.action === 'CREATE_USER')
      
      expect(createUserLog).toBeTruthy()
      expect(createUserLog?.targetType).toBe('user')

      // 테스트 사용자 정리
      await executeQuery('DELETE FROM users WHERE userid = ?', ['log_test_user'])
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle concurrent admin requests', async () => {
      const concurrentRequests = Array(10).fill(null).map(() => 
        request(app)
          .get('/api/admin/dashboard')
          .set('Authorization', `Bearer ${adminToken}`)
      )

      const startTime = Date.now()
      const responses = await Promise.all(concurrentRequests)
      const endTime = Date.now()

      // 모든 요청이 성공해야 함
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })

      // 응답 시간이 합리적이어야 함 (10초 이내)
      expect(endTime - startTime).toBeLessThan(10000)
    })

    it('should paginate large datasets efficiently', async () => {
      const response = await request(app)
        .get('/api/admin/activity-logs?page=1&limit=100')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.logs.length).toBeLessThanOrEqual(100)
      expect(response.body).toHaveProperty('totalPages')
    })
  })
})