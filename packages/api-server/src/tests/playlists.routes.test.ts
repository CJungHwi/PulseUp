import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { prisma } from '../lib/prisma.js'
import playlistsRoutes from '../routes/playlists.routes.js'
import authRoutes from '../routes/auth.routes.js'
import { errorHandler } from '../middleware/error.middleware.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRoutes)
app.use('/api/playlists', playlistsRoutes)
app.use(errorHandler)

describe('Playlists Routes', () => {
  let accessToken: string
  let testUser: any
  let testVideo1: any
  let testVideo2: any

  beforeAll(async () => {
    // 테스트 데이터베이스 연결 확인
    await prisma.$connect()
  })

  beforeEach(async () => {
    // 테스트 데이터 정리
    await prisma.playlistVideo.deleteMany()
    await prisma.playlist.deleteMany()
    await prisma.video.deleteMany({
      where: { title: { contains: 'test' } }
    })
    await prisma.user.deleteMany({
      where: { email: { contains: 'test' } }
    })

    // 테스트용 사용자 생성 및 로그인
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

    // 테스트용 비디오 생성
    testVideo1 = await prisma.video.create({
      data: {
        title: 'Test Video 1',
        description: 'Test description 1',
        category: '운동',
        youtubeUrl: 'https://www.youtube.com/watch?v=test1',
        duration: 300,
        thumbnailUrl: 'https://example.com/thumb1.jpg'
      }
    })

    testVideo2 = await prisma.video.create({
      data: {
        title: 'Test Video 2',
        description: 'Test description 2',
        category: '요가',
        youtubeUrl: 'https://www.youtube.com/watch?v=test2',
        duration: 600,
        thumbnailUrl: 'https://example.com/thumb2.jpg'
      }
    })
  })

  afterAll(async () => {
    // 테스트 후 정리
    await prisma.playlistVideo.deleteMany()
    await prisma.playlist.deleteMany()
    await prisma.video.deleteMany({
      where: { title: { contains: 'test' } }
    })
    await prisma.user.deleteMany({
      where: { email: { contains: 'test' } }
    })
    await prisma.$disconnect()
  })

  describe('GET /api/playlists', () => {
    beforeEach(async () => {
      // 테스트용 플레이리스트 생성
      await prisma.playlist.createMany({
        data: [
          {
            name: 'Test Playlist 1',
            userId: testUser.id
          },
          {
            name: 'Test Playlist 2',
            userId: testUser.id
          }
        ]
      })
    })

    it('should get playlists list with authentication', async () => {
      const response = await request(app)
        .get('/api/playlists')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(Array.isArray(response.body.data)).toBe(true)
      expect(response.body.pagination).toBeDefined()
    })

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/playlists')
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('액세스 토큰이 필요합니다')
    })

    it('should filter playlists by search', async () => {
      const response = await request(app)
        .get('/api/playlists?search=Test Playlist 1')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      const playlists = response.body.data
      expect(playlists.some((playlist: any) => playlist.name.includes('Test Playlist 1'))).toBe(true)
    })

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/playlists?page=1&limit=1')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.length).toBeLessThanOrEqual(1)
      expect(response.body.pagination.page).toBe(1)
      expect(response.body.pagination.limit).toBe(1)
    })
  })

  describe('POST /api/playlists', () => {
    it('should create a new playlist', async () => {
      const playlistData = {
        name: 'New Test Playlist'
      }

      const response = await request(app)
        .post('/api/playlists')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(playlistData)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.name).toBe(playlistData.name)
      expect(response.body.data.userId).toBe(testUser.id)
    })

    it('should return validation error for empty name', async () => {
      const invalidData = {
        name: ''
      }

      const response = await request(app)
        .post('/api/playlists')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidData)
        .expect(400)

      expect(response.body.error).toBe('입력 데이터가 유효하지 않습니다')
    })
  })

  describe('GET /api/playlists/:id', () => {
    let testPlaylistId: string

    beforeEach(async () => {
      const playlist = await prisma.playlist.create({
        data: {
          name: 'Test Playlist Detail',
          userId: testUser.id
        }
      })
      testPlaylistId = playlist.id
    })

    it('should get playlist details', async () => {
      const response = await request(app)
        .get(`/api/playlists/${testPlaylistId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.id).toBe(testPlaylistId)
      expect(response.body.data.name).toBe('Test Playlist Detail')
    })

    it('should return 404 for non-existent playlist', async () => {
      const response = await request(app)
        .get('/api/playlists/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('플레이리스트를 찾을 수 없습니다')
    })
  })

  describe('PUT /api/playlists/:id', () => {
    let testPlaylistId: string

    beforeEach(async () => {
      const playlist = await prisma.playlist.create({
        data: {
          name: 'Test Playlist Update',
          userId: testUser.id
        }
      })
      testPlaylistId = playlist.id
    })

    it('should update playlist', async () => {
      const updateData = {
        name: 'Updated Test Playlist'
      }

      const response = await request(app)
        .put(`/api/playlists/${testPlaylistId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.name).toBe(updateData.name)
    })
  })

  describe('DELETE /api/playlists/:id', () => {
    let testPlaylistId: string

    beforeEach(async () => {
      const playlist = await prisma.playlist.create({
        data: {
          name: 'Test Playlist Delete',
          userId: testUser.id
        }
      })
      testPlaylistId = playlist.id
    })

    it('should delete playlist', async () => {
      const response = await request(app)
        .delete(`/api/playlists/${testPlaylistId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('플레이리스트가 성공적으로 삭제되었습니다')

      // 플레이리스트가 실제로 삭제되었는지 확인
      const deletedPlaylist = await prisma.playlist.findUnique({
        where: { id: testPlaylistId }
      })
      expect(deletedPlaylist).toBeNull()
    })
  })

  describe('POST /api/playlists/:id/videos', () => {
    let testPlaylistId: string

    beforeEach(async () => {
      const playlist = await prisma.playlist.create({
        data: {
          name: 'Test Playlist Videos',
          userId: testUser.id
        }
      })
      testPlaylistId = playlist.id
    })

    it('should add video to playlist', async () => {
      const videoData = {
        videoId: testVideo1.id,
        order: 1
      }

      const response = await request(app)
        .post(`/api/playlists/${testPlaylistId}/videos`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(videoData)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.videoId).toBe(testVideo1.id)
      expect(response.body.data.order).toBe(1)
    })

    it('should return error for duplicate video', async () => {
      // 먼저 비디오 추가
      await prisma.playlistVideo.create({
        data: {
          playlistId: testPlaylistId,
          videoId: testVideo1.id,
          order: 1
        }
      })

      const videoData = {
        videoId: testVideo1.id,
        order: 2
      }

      const response = await request(app)
        .post(`/api/playlists/${testPlaylistId}/videos`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(videoData)
        .expect(409)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('이미 플레이리스트에 있는 비디오입니다')
    })
  })

  describe('DELETE /api/playlists/:id/videos/:videoId', () => {
    let testPlaylistId: string

    beforeEach(async () => {
      const playlist = await prisma.playlist.create({
        data: {
          name: 'Test Playlist Remove Video',
          userId: testUser.id
        }
      })
      testPlaylistId = playlist.id

      // 비디오 추가
      await prisma.playlistVideo.create({
        data: {
          playlistId: testPlaylistId,
          videoId: testVideo1.id,
          order: 1
        }
      })
    })

    it('should remove video from playlist', async () => {
      const response = await request(app)
        .delete(`/api/playlists/${testPlaylistId}/videos/${testVideo1.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('비디오가 플레이리스트에서 제거되었습니다')

      // 비디오가 실제로 제거되었는지 확인
      const removedVideo = await prisma.playlistVideo.findUnique({
        where: {
          playlistId_videoId: {
            playlistId: testPlaylistId,
            videoId: testVideo1.id
          }
        }
      })
      expect(removedVideo).toBeNull()
    })
  })

  describe('PUT /api/playlists/:id/reorder', () => {
    let testPlaylistId: string

    beforeEach(async () => {
      const playlist = await prisma.playlist.create({
        data: {
          name: 'Test Playlist Reorder',
          userId: testUser.id
        }
      })
      testPlaylistId = playlist.id

      // 비디오들 추가
      await prisma.playlistVideo.createMany({
        data: [
          {
            playlistId: testPlaylistId,
            videoId: testVideo1.id,
            order: 1
          },
          {
            playlistId: testPlaylistId,
            videoId: testVideo2.id,
            order: 2
          }
        ]
      })
    })

    it('should reorder playlist videos', async () => {
      const reorderData = {
        videoOrders: [
          { videoId: testVideo1.id, order: 2 },
          { videoId: testVideo2.id, order: 1 }
        ]
      }

      const response = await request(app)
        .put(`/api/playlists/${testPlaylistId}/reorder`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(reorderData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('플레이리스트 순서가 업데이트되었습니다')

      // 순서가 실제로 변경되었는지 확인
      const updatedVideos = await prisma.playlistVideo.findMany({
        where: { playlistId: testPlaylistId },
        orderBy: { order: 'asc' }
      })

      expect(updatedVideos[0].videoId).toBe(testVideo2.id)
      expect(updatedVideos[1].videoId).toBe(testVideo1.id)
    })
  })

  describe('POST /api/playlists/:id/duplicate', () => {
    let testPlaylistId: string

    beforeEach(async () => {
      const playlist = await prisma.playlist.create({
        data: {
          name: 'Test Playlist Duplicate',
          userId: testUser.id
        }
      })
      testPlaylistId = playlist.id

      // 비디오 추가
      await prisma.playlistVideo.create({
        data: {
          playlistId: testPlaylistId,
          videoId: testVideo1.id,
          order: 1
        }
      })
    })

    it('should duplicate playlist', async () => {
      const response = await request(app)
        .post(`/api/playlists/${testPlaylistId}/duplicate`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.name).toBe('Test Playlist Duplicate (복사본)')
      expect(response.body.data.userId).toBe(testUser.id)

      // 비디오도 복사되었는지 확인
      const duplicatedVideos = await prisma.playlistVideo.findMany({
        where: { playlistId: response.body.data.id }
      })
      expect(duplicatedVideos.length).toBe(1)
      expect(duplicatedVideos[0].videoId).toBe(testVideo1.id)
    })
  })

  describe('GET /api/playlists/:id/stats', () => {
    let testPlaylistId: string

    beforeEach(async () => {
      const playlist = await prisma.playlist.create({
        data: {
          name: 'Test Playlist Stats',
          userId: testUser.id
        }
      })
      testPlaylistId = playlist.id

      // 비디오들 추가
      await prisma.playlistVideo.createMany({
        data: [
          {
            playlistId: testPlaylistId,
            videoId: testVideo1.id,
            order: 1
          },
          {
            playlistId: testPlaylistId,
            videoId: testVideo2.id,
            order: 2
          }
        ]
      })
    })

    it('should get playlist statistics', async () => {
      const response = await request(app)
        .get(`/api/playlists/${testPlaylistId}/stats`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.totalVideos).toBe(2)
      expect(response.body.data.totalDuration).toBe(900) // 300 + 600
      expect(response.body.data.averageDuration).toBe(450)
      expect(response.body.data.totalDurationFormatted).toBeDefined()
    })
  })

  describe('POST /api/playlists/auto-create', () => {
    it('should create auto playlist based on criteria', async () => {
      const autoPlaylistData = {
        name: 'Auto Test Playlist',
        criteria: {
          categories: ['운동'],
          maxVideos: 10
        }
      }

      const response = await request(app)
        .post('/api/playlists/auto-create')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(autoPlaylistData)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.playlist.name).toBe('Auto Test Playlist')
      expect(response.body.data.addedVideos).toBeGreaterThan(0)
    })

    it('should return error when no videos match criteria', async () => {
      const autoPlaylistData = {
        name: 'Empty Auto Playlist',
        criteria: {
          categories: ['존재하지않는카테고리'],
          maxVideos: 10
        }
      }

      const response = await request(app)
        .post('/api/playlists/auto-create')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(autoPlaylistData)
        .expect(422)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('조건에 맞는 비디오가 없습니다')
    })
  })
})