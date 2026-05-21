import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createTestApp } from './test-app.js'
import { executeQuery } from '../lib/database.js'
import { AuthService } from '../services/auth.service.js'

describe('Admin Management System - E2E Tests', () => {
  const app = createTestApp()
  let adminToken: string
  let adminUserId: string
  let testUserIds: string[] = []

  beforeAll(async () => {
    // E2E 테스트용 관리자 계정 생성
    const adminPassword = await AuthService.hashPassword('e2e_admin123!')
    const adminResult = await executeQuery(
      `INSERT INTO users (userid, name, email, password, role) 
       VALUES (?, ?, ?, ?, ?)`,
      ['e2e_admin', 'E2E 테스트 관리자', 'e2e_admin@example.com', adminPassword, 'admin']
    )
    adminUserId = adminResult.insertId
    adminToken = AuthService.generateAccessToken(adminUserId, 'e2e_admin')
  })

  afterAll(async () => {
    // 테스트 데이터 정리
    if (testUserIds.length > 0) {
      await executeQuery(
        `DELETE FROM user_activity_logs WHERE user_id IN (${testUserIds.map(() => '?').join(',')})`,
        testUserIds
      )
      await executeQuery(
        `DELETE FROM users WHERE id IN (${testUserIds.map(() => '?').join(',')})`,
        testUserIds
      )
    }
    await executeQuery('DELETE FROM user_activity_logs WHERE user_id = ?', [adminUserId])
    await executeQuery('DELETE FROM users WHERE id = ?', [adminUserId])
  })

  describe('Complete Admin Workflow', () => {
    it('should complete full user management workflow', async () => {
      // 1. 대시보드 접근
      const dashboardResponse = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(dashboardResponse.status).toBe(200)
      const initialUserCount = dashboardResponse.body.totalUsers

      // 2. 새 사용자 생성
      const newUserData = {
        userid: 'e2e_workflow_user',
        name: 'E2E 워크플로우 사용자',
        email: 'e2e_workflow_user@example.com',
        password: 'workflow123!',
        role: 'user'
      }

      const createResponse = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newUserData)

      expect(createResponse.status).toBe(201)
      const newUserId = createResponse.body.id
      testUserIds.push(newUserId)

      // 3. 사용자 목록에서 새 사용자 확인
      const usersResponse = await request(app)
        .get('/api/admin/users?search=e2e_workflow_user')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(usersResponse.status).toBe(200)
      expect(usersResponse.body.users).toHaveLength(1)
      expect(usersResponse.body.users[0].userid).toBe(newUserData.userid)

      // 4. 사용자 정보 수정
      const updateData = {
        name: '수정된 E2E 사용자',
        role: 'admin'
      }

      const updateResponse = await request(app)
        .put(`/api/admin/users/${newUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)

      expect(updateResponse.status).toBe(200)
      expect(updateResponse.body.name).toBe(updateData.name)
      expect(updateResponse.body.role).toBe(updateData.role)

      // 5. 활동 로그 확인
      const logsResponse = await request(app)
        .get('/api/admin/activity-logs?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(logsResponse.status).toBe(200)
      const logs = logsResponse.body.logs
      
      // CREATE_USER와 UPDATE_USER 로그가 있어야 함
      const createLog = logs.find((log: any) => 
        log.action === 'CREATE_USER' && log.targetId === newUserId
      )
      const updateLog = logs.find((log: any) => 
        log.action === 'UPDATE_USER' && log.targetId === newUserId
      )

      expect(createLog).toBeTruthy()
      expect(updateLog).toBeTruthy()

      // 6. 대시보드 통계 업데이트 확인
      const updatedDashboardResponse = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(updatedDashboardResponse.status).toBe(200)
      expect(updatedDashboardResponse.body.totalUsers).toBe(initialUserCount + 1)

      // 7. 사용자 비활성화
      const deactivateResponse = await request(app)
        .patch(`/api/admin/users/${newUserId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(deactivateResponse.status).toBe(200)
      expect(deactivateResponse.body.isActive).toBe(false)
    })

    it('should handle content management workflow', async () => {
      // 1. 모든 비디오 조회
      const videosResponse = await request(app)
        .get('/api/admin/content/videos?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(videosResponse.status).toBe(200)
      expect(videosResponse.body).toHaveProperty('videos')
      expect(videosResponse.body).toHaveProperty('total')

      // 2. 모든 플레이리스트 조회
      const playlistsResponse = await request(app)
        .get('/api/admin/content/playlists?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(playlistsResponse.status).toBe(200)
      expect(playlistsResponse.body).toHaveProperty('playlists')
      expect(playlistsResponse.body).toHaveProperty('total')

      // 3. 콘텐츠 검색
      const searchResponse = await request(app)
        .get('/api/admin/content/search?query=workout&type=video')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(searchResponse.status).toBe(200)
      expect(searchResponse.body).toHaveProperty('results')
      expect(searchResponse.body).toHaveProperty('total')

      // 4. 운동 정보 조회
      const exerciseInfoResponse = await request(app)
        .get('/api/admin/content/exercise-info')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(exerciseInfoResponse.status).toBe(200)
      expect(exerciseInfoResponse.body).toBeInstanceOf(Array)
    })

    it('should handle system settings workflow', async () => {
      // 1. 현재 시스템 설정 조회
      const settingsResponse = await request(app)
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(settingsResponse.status).toBe(200)
      expect(settingsResponse.body).toHaveProperty('maxFileSize')
      expect(settingsResponse.body).toHaveProperty('allowedFileTypes')
      expect(settingsResponse.body).toHaveProperty('maintenanceMode')

      // 2. 설정 업데이트
      const newSettings = {
        maxFileSize: 104857600, // 100MB
        allowedFileTypes: ['mp4', 'avi', 'mov'],
        maintenanceMode: false,
        registrationEnabled: true
      }

      const updateSettingsResponse = await request(app)
        .put('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newSettings)

      expect(updateSettingsResponse.status).toBe(200)
      expect(updateSettingsResponse.body.maxFileSize).toBe(newSettings.maxFileSize)

      // 3. 공지사항 생성
      const announcementData = {
        title: 'E2E 테스트 공지사항',
        content: '이것은 E2E 테스트용 공지사항입니다.',
        type: 'info',
        isActive: true
      }

      const createAnnouncementResponse = await request(app)
        .post('/api/admin/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(announcementData)

      expect(createAnnouncementResponse.status).toBe(201)
      expect(createAnnouncementResponse.body.title).toBe(announcementData.title)

      const announcementId = createAnnouncementResponse.body.id

      // 4. 공지사항 목록 조회
      const announcementsResponse = await request(app)
        .get('/api/admin/announcements')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(announcementsResponse.status).toBe(200)
      expect(announcementsResponse.body).toBeInstanceOf(Array)
      
      const createdAnnouncement = announcementsResponse.body.find(
        (a: any) => a.id === announcementId
      )
      expect(createdAnnouncement).toBeTruthy()

      // 5. 공지사항 삭제
      const deleteAnnouncementResponse = await request(app)
        .delete(`/api/admin/announcements/${announcementId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(deleteAnnouncementResponse.status).toBe(200)
    })

    it('should handle statistics and reporting workflow', async () => {
      // 1. 사용자 활동 차트 데이터 조회
      const userActivityResponse = await request(app)
        .get('/api/admin/dashboard/user-activity')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(userActivityResponse.status).toBe(200)
      expect(userActivityResponse.body).toBeInstanceOf(Array)

      // 2. 통계 데이터 조회
      const statsResponse = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(statsResponse.status).toBe(200)
      expect(statsResponse.body).toHaveProperty('userStats')
      expect(statsResponse.body).toHaveProperty('contentStats')
      expect(statsResponse.body).toHaveProperty('sessionStats')

      // 3. 기간별 리포트 요청
      const reportData = {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        reportType: 'user_activity',
        format: 'json'
      }

      const reportResponse = await request(app)
        .post('/api/admin/reports/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(reportData)

      expect(reportResponse.status).toBe(200)
      expect(reportResponse.body).toHaveProperty('reportId')
      expect(reportResponse.body).toHaveProperty('status')

      // 4. 실시간 통계 조회
      const realtimeStatsResponse = await request(app)
        .get('/api/admin/stats/realtime')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(realtimeStatsResponse.status).toBe(200)
      expect(realtimeStatsResponse.body).toHaveProperty('activeUsers')
      expect(realtimeStatsResponse.body).toHaveProperty('ongoingSessions')
    })
  })

  describe('Error Recovery and Edge Cases', () => {
    it('should handle network interruption gracefully', async () => {
      // 큰 데이터셋 요청으로 네트워크 부하 시뮬레이션
      const response = await request(app)
        .get('/api/admin/activity-logs?page=1&limit=1000')
        .set('Authorization', `Bearer ${adminToken}`)
        .timeout(5000) // 5초 타임아웃

      // 타임아웃이 발생하거나 정상 응답이 와야 함
      expect([200, 408, 504]).toContain(response.status)
    })

    it('should maintain data consistency during concurrent operations', async () => {
      // 동시에 여러 사용자 생성
      const userCreationPromises = Array(5).fill(null).map((_, index) => 
        request(app)
          .post('/api/admin/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            userid: `concurrent_user_${index}`,
            name: `동시 생성 사용자 ${index}`,
            email: `concurrent_user_${index}@example.com`,
            password: 'concurrent123!',
            role: 'user'
          })
      )

      const responses = await Promise.all(userCreationPromises)
      
      // 모든 사용자가 성공적으로 생성되어야 함
      responses.forEach(response => {
        expect(response.status).toBe(201)
        testUserIds.push(response.body.id)
      })

      // 생성된 사용자 수 확인
      const usersResponse = await request(app)
        .get('/api/admin/users?search=concurrent_user')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(usersResponse.status).toBe(200)
      expect(usersResponse.body.users).toHaveLength(5)
    })

    it('should handle database transaction rollback', async () => {
      // 잘못된 데이터로 사용자 생성 시도 (트랜잭션 롤백 테스트)
      const invalidUserData = {
        userid: '', // 빈 userid (제약 조건 위반)
        name: '트랜잭션 테스트 사용자',
        email: 'transaction_test@example.com',
        password: 'transaction123!',
        role: 'user'
      }

      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidUserData)

      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error')

      // 데이터베이스 상태가 일관성을 유지하는지 확인
      const usersResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(usersResponse.status).toBe(200)
      // 실패한 사용자가 생성되지 않았는지 확인
      const failedUser = usersResponse.body.users.find(
        (user: any) => user.name === '트랜잭션 테스트 사용자'
      )
      expect(failedUser).toBeFalsy()
    })
  })

  describe('Performance Under Load', () => {
    it('should maintain response times under load', async () => {
      const startTime = Date.now()
      
      // 50개의 동시 요청
      const loadTestPromises = Array(50).fill(null).map(() => 
        request(app)
          .get('/api/admin/dashboard')
          .set('Authorization', `Bearer ${adminToken}`)
      )

      const responses = await Promise.all(loadTestPromises)
      const endTime = Date.now()
      const totalTime = endTime - startTime

      // 모든 요청이 성공해야 함
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })

      // 평균 응답 시간이 합리적이어야 함 (요청당 1초 이내)
      const averageResponseTime = totalTime / responses.length
      expect(averageResponseTime).toBeLessThan(1000)
    })

    it('should handle memory efficiently with large datasets', async () => {
      // 큰 페이지 크기로 데이터 요청
      const response = await request(app)
        .get('/api/admin/users?page=1&limit=500')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('users')
      expect(response.body.users.length).toBeLessThanOrEqual(500)
      
      // 응답 크기가 합리적이어야 함
      const responseSize = JSON.stringify(response.body).length
      expect(responseSize).toBeLessThan(10 * 1024 * 1024) // 10MB 이하
    })
  })
})