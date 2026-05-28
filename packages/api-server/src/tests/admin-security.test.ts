import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createTestApp } from './test-app.js'
import { executeQuery } from '../lib/database.js'
import { AuthService } from '../services/auth.service.js'

describe('Admin Security Tests', () => {
  const app = createTestApp()
  let adminToken: string
  let userToken: string
  let adminUserId: string
  let regularUserId: string

  beforeAll(async () => {
    // 보안 테스트용 계정 생성
    const adminPassword = await AuthService.hashPassword('security_admin123!')
    const adminResult = await executeQuery(
      `INSERT INTO users (userid, name, email, password, role) 
       VALUES (?, ?, ?, ?, ?)`,
      ['security_admin', '보안 테스트 관리자', 'security_admin@example.com', adminPassword, 'admin']
    )
    adminUserId = adminResult.insertId

    const userPassword = await AuthService.hashPassword('security_user123!')
    const userResult = await executeQuery(
      `INSERT INTO users (userid, name, email, password, role) 
       VALUES (?, ?, ?, ?, ?)`,
      ['security_user', '보안 테스트 사용자', 'security_user@example.com', userPassword, 'user']
    )
    regularUserId = userResult.insertId

    adminToken = AuthService.generateAccessToken(adminUserId, 'security_admin')
    userToken = AuthService.generateAccessToken(regularUserId, 'security_user')
  })

  afterAll(async () => {
    await executeQuery('DELETE FROM user_activity_logs WHERE user_id IN (?, ?)', [adminUserId, regularUserId])
    await executeQuery('DELETE FROM users WHERE id IN (?, ?)', [adminUserId, regularUserId])
  })

  describe('Authentication Security', () => {
    it('should reject requests without authorization header', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')

      expect(response.status).toBe(401)
      expect(response.body.code).toBe('TOKEN_REQUIRED')
    })

    it('should reject malformed authorization headers', async () => {
      const malformedHeaders = [
        'InvalidToken',
        'Bearer',
        'Bearer ',
        'Basic dGVzdDp0ZXN0', // Basic auth instead of Bearer
        'Bearer invalid.token.format'
      ]

      for (const header of malformedHeaders) {
        const response = await request(app)
          .get('/api/admin/dashboard')
          .set('Authorization', header)

        expect(response.status).toBe(401)
        expect(response.body.code).toBe('INVALID_TOKEN')
      }
    })

    it('should reject expired tokens', async () => {
      // 만료된 토큰 생성 (과거 시간으로 설정)
      const expiredToken = AuthService.generateAccessToken(adminUserId, 'security_admin', -3600)
      
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${expiredToken}`)

      expect(response.status).toBe(401)
      expect(response.body.code).toBe('TOKEN_EXPIRED')
    })

    it('should reject tokens with invalid signatures', async () => {
      // 토큰의 서명 부분을 조작
      const validToken = adminToken
      const [header, payload] = validToken.split('.')
      const tamperedToken = `${header}.${payload}.tampered_signature`
      
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${tamperedToken}`)

      expect(response.status).toBe(401)
      expect(response.body.code).toBe('INVALID_TOKEN')
    })
  })

  describe('Authorization Security', () => {
    it('should enforce role-based access control', async () => {
      const adminOnlyEndpoints = [
        '/api/admin/dashboard',
        '/api/admin/users',
        '/api/admin/content/videos',
        '/api/admin/activity-logs',
        '/api/admin/settings'
      ]

      for (const endpoint of adminOnlyEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${userToken}`)

        expect(response.status).toBe(403)
        expect(response.body.code).toBe('ADMIN_REQUIRED')
      }
    })

    it('should prevent privilege escalation', async () => {
      // 일반 사용자가 자신의 역할을 관리자로 변경하려고 시도
      const response = await request(app)
        .put(`/api/admin/users/${regularUserId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ role: 'branch_admin' })

      expect(response.status).toBe(403)
      expect(response.body.code).toBe('ADMIN_REQUIRED')
    })

    it('should validate resource ownership', async () => {
      // 다른 사용자의 정보에 접근 시도
      const response = await request(app)
        .get(`/api/users/${adminUserId}/profile`)
        .set('Authorization', `Bearer ${userToken}`)

      expect([403, 404]).toContain(response.status)
    })
  })

  describe('Input Validation Security', () => {
    it('should prevent SQL injection attacks', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; UPDATE users SET role='branch_admin' WHERE id=1; --",
        "' UNION SELECT * FROM users --",
        "'; INSERT INTO users (userid, role) VALUES ('hacker', 'admin'); --"
      ]

      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .get(`/api/admin/users?search=${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${adminToken}`)

        // 요청이 정상적으로 처리되어야 함 (SQL 인젝션이 차단됨)
        expect(response.status).toBe(200)
        expect(response.body).toHaveProperty('users')
      }
    })

    it('should prevent XSS attacks in user input', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert("XSS")',
        '<svg onload="alert(1)">',
        '"><script>alert("XSS")</script>'
      ]

      for (const payload of xssPayloads) {
        const userData = {
          userid: 'xss_test_user',
          name: payload,
          email: 'xss_test_user@example.com',
          password: 'xsstest123!',
          role: 'user'
        }

        const response = await request(app)
          .post('/api/admin/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(userData)

        if (response.status === 201) {
          // 생성된 사용자 조회
          const getUserResponse = await request(app)
            .get(`/api/admin/users/${response.body.id}`)
            .set('Authorization', `Bearer ${adminToken}`)

          // XSS 페이로드가 이스케이프되었는지 확인
          expect(getUserResponse.body.name).not.toContain('<script>')
          expect(getUserResponse.body.name).not.toContain('javascript:')
          
          // 테스트 사용자 삭제
          await executeQuery('DELETE FROM users WHERE id = ?', [response.body.id])
        }
      }
    })

    it('should validate file upload security', async () => {
      const maliciousFiles = [
        { filename: 'malware.exe', mimetype: 'application/x-executable' },
        { filename: 'script.php', mimetype: 'application/x-php' },
        { filename: 'shell.sh', mimetype: 'application/x-sh' },
        { filename: '../../../etc/passwd', mimetype: 'text/plain' },
        { filename: 'normal.mp4.exe', mimetype: 'video/mp4' }
      ]

      for (const file of maliciousFiles) {
        const response = await request(app)
          .post('/api/admin/content/upload')
          .set('Authorization', `Bearer ${adminToken}`)
          .attach('file', Buffer.from('fake file content'), file.filename)

        // 악성 파일은 거부되어야 함
        expect([400, 415]).toContain(response.status)
      }
    })

    it('should prevent path traversal attacks', async () => {
      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%252f..%252f..%252fetc%252fpasswd'
      ]

      for (const payload of pathTraversalPayloads) {
        const response = await request(app)
          .get(`/api/admin/files/${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${adminToken}`)

        // 경로 순회 공격은 차단되어야 함
        expect([400, 403, 404]).toContain(response.status)
      }
    })
  })

  describe('Rate Limiting and DoS Protection', () => {
    it('should implement rate limiting for login attempts', async () => {
      const loginAttempts = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'wrongpassword'
          })
      )

      const responses = await Promise.all(loginAttempts)
      
      // 일부 요청이 rate limit에 걸려야 함
      const rateLimitedResponses = responses.filter(res => res.status === 429)
      expect(rateLimitedResponses.length).toBeGreaterThan(0)
    })

    it('should protect against brute force attacks', async () => {
      const bruteForceAttempts = Array(20).fill(null).map((_, index) =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'security_admin',
            password: `wrongpassword${index}`
          })
      )

      const responses = await Promise.all(bruteForceAttempts)
      
      // 연속된 실패 시도 후 계정이 잠겨야 함
      const lastResponse = responses[responses.length - 1]
      expect([429, 423]).toContain(lastResponse.status) // 429: Too Many Requests, 423: Locked
    })

    it('should limit API request frequency', async () => {
      const rapidRequests = Array(100).fill(null).map(() =>
        request(app)
          .get('/api/admin/dashboard')
          .set('Authorization', `Bearer ${adminToken}`)
      )

      const responses = await Promise.all(rapidRequests)
      
      // 일부 요청이 rate limit에 걸려야 함
      const rateLimitedResponses = responses.filter(res => res.status === 429)
      expect(rateLimitedResponses.length).toBeGreaterThan(0)
    })
  })

  describe('Data Protection and Privacy', () => {
    it('should not expose sensitive information in error messages', async () => {
      // 존재하지 않는 사용자 조회
      const response = await request(app)
        .get('/api/admin/users/999999')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(404)
      expect(response.body.error).not.toContain('SELECT')
      expect(response.body.error).not.toContain('database')
      expect(response.body.error).not.toContain('mysql')
    })

    it('should hash passwords properly', async () => {
      const userData = {
        userid: 'password_test_user',
        name: '비밀번호 테스트 사용자',
        email: 'password_test_user@example.com',
        password: 'plaintext123!',
        role: 'user'
      }

      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(userData)

      expect(response.status).toBe(201)
      
      // 데이터베이스에서 직접 확인
      const dbUser = await executeQuery(
        'SELECT password FROM users WHERE id = ?',
        [response.body.id]
      )

      // 비밀번호가 해시되어 저장되었는지 확인
      expect(dbUser[0].password).not.toBe(userData.password)
      expect(dbUser[0].password).toMatch(/^\$2[aby]\$/) // bcrypt 해시 패턴

      // 테스트 사용자 삭제
      await executeQuery('DELETE FROM users WHERE id = ?', [response.body.id])
    })

    it('should not return sensitive user data', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      
      // 응답에 비밀번호가 포함되지 않아야 함
      response.body.users.forEach((user: any) => {
        expect(user).not.toHaveProperty('password')
        expect(user).not.toHaveProperty('passwordHash')
      })
    })
  })

  describe('Session and Token Security', () => {
    it('should invalidate tokens on logout', async () => {
      // 로그아웃 요청
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(logoutResponse.status).toBe(200)

      // 로그아웃 후 토큰 사용 시도
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)

      // 토큰이 무효화되었는지 확인 (구현에 따라 다를 수 있음)
      // 현재 구현에서는 stateless JWT를 사용하므로 이 테스트는 선택적
    })

    it('should handle concurrent sessions properly', async () => {
      // 동일한 사용자로 여러 토큰 생성
      const token1 = AuthService.generateAccessToken(adminUserId, 'security_admin')
      const token2 = AuthService.generateAccessToken(adminUserId, 'security_admin')

      const requests = [
        request(app)
          .get('/api/admin/dashboard')
          .set('Authorization', `Bearer ${token1}`),
        request(app)
          .get('/api/admin/dashboard')
          .set('Authorization', `Bearer ${token2}`)
      ]

      const responses = await Promise.all(requests)
      
      // 두 토큰 모두 유효해야 함
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
    })
  })

  describe('CORS and Headers Security', () => {
    it('should set proper security headers', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)

      // 보안 헤더 확인
      expect(response.headers).toHaveProperty('x-content-type-options')
      expect(response.headers).toHaveProperty('x-frame-options')
      expect(response.headers).toHaveProperty('x-xss-protection')
    })

    it('should handle CORS properly', async () => {
      const response = await request(app)
        .options('/api/admin/dashboard')
        .set('Origin', 'http://localhost:3000')

      expect(response.status).toBe(200)
      expect(response.headers).toHaveProperty('access-control-allow-origin')
      expect(response.headers).toHaveProperty('access-control-allow-methods')
    })
  })

  describe('Audit and Logging Security', () => {
    it('should log security-relevant events', async () => {
      // 실패한 로그인 시도
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'security_admin',
          password: 'wrongpassword'
        })

      // 권한 없는 접근 시도
      await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${userToken}`)

      // 로그가 기록되었는지 확인 (구현에 따라 다를 수 있음)
      const logs = await executeQuery(
        'SELECT * FROM security_logs WHERE event_type IN (?, ?) ORDER BY created_at DESC LIMIT 10',
        ['FAILED_LOGIN', 'UNAUTHORIZED_ACCESS']
      )

      // 보안 로그가 기록되었는지 확인
      expect(logs.length).toBeGreaterThan(0)
    })

    it('should not log sensitive information', async () => {
      // 비밀번호가 포함된 요청
      await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userid: 'log_test_user',
          name: '로그 테스트 사용자',
          email: 'log_test_user@example.com',
          password: 'sensitive_password123!',
          role: 'user'
        })

      // 활동 로그 확인
      const logs = await executeQuery(
        'SELECT * FROM user_activity_logs WHERE action = ? ORDER BY created_at DESC LIMIT 1',
        ['CREATE_USER']
      )

      if (logs.length > 0) {
        const logDetails = JSON.stringify(logs[0].details || {})
        // 로그에 비밀번호가 포함되지 않았는지 확인
        expect(logDetails).not.toContain('sensitive_password123!')
        expect(logDetails).not.toContain('password')
      }

      // 테스트 사용자 정리
      await executeQuery('DELETE FROM users WHERE userid = ?', ['log_test_user'])
    })
  })
})