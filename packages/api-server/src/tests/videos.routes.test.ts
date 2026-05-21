import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { prisma } from '../lib/prisma.js'
import videosRoutes from '../routes/videos.routes.js'
import authRoutes from '../routes/auth.routes.js'
import { errorHandler } from '../middleware/error.middleware.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRoutes)
app.use('/api/videos', videosRoutes)
app.use(errorHandler)

describe('Videos Routes', () => {
  let accessToken: string
  let testUser: any

  beforeAll(async () => {
    // 테스트 데이터베이스 연결 확인
    await prisma.$connect()
  })

  beforeEach(async () => {
    // 테스트 데이터 정리
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
  })

  afterAll(async () => {
    // 테스트 후 정리
    await prisma.video.deleteMany({
      where: { title: { contains: 'test' } }
    })
    await prisma.user.deleteMany({
      where: { email: { contains: 'test' } }
    })
    await prisma.$disconnect()
  })

  describe('GET /api/videos', () => {
    beforeEach(async () => {
      // 테스트용 비디오 생성
      await prisma.video.createMany({
        data: [
          {
            title: 'Test Video 1',
            description: 'Test description 1',
            category: '운동',
            youtubeUrl: 'https://www.youtube.com/watch?v=test1',
            duration: 300,
            thumbnailUrl: 'https://example.com/thumb1.jpg'
          },
          {
            title: 'Test Video 2',
            description: 'Test description 2',
            category: '요가',
            youtubeUrl: 'https://www.youtube.com/watch?v=test2',
            duration: 600,
            thumbnailUrl: 'https://example.com/thumb2.jpg'
          }
        ]
      })
    })

    it('should get videos list with authentication', async () => {
      const response = await request(app)
        .get('/api/videos')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.videos).toBeDefined()
      expect(Array.isArray(response.body.data.videos)).toBe(true)
      expect(response.body.data.pagination).toBeDefined()
    })

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/videos')
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('액세스 토큰이 필요합니다')
    })

    it('should filter videos by category', async () => {
      const response = await request(app)
        .get('/api/videos?category=운동')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      const videos = response.body.data.videos
      expect(videos.every((video: any) => video.category === '운동')).toBe(true)
    })

    it('should search videos by title', async () => {
      const response = await request(app)
        .get('/api/videos?search=Test Video 1')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      const videos = response.body.data.videos
      expect(videos.some((video: any) => video.title.includes('Test Video 1'))).toBe(true)
    })

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/videos?page=1&limit=1')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.videos.length).toBeLessThanOrEqual(1)
      expect(response.body.data.pagination.page).toBe(1)
      expect(response.body.data.pagination.limit).toBe(1)
    })
  })

  describe('POST /api/videos', () => {
    it('should create a new video', async () => {
      const videoData = {
        title: 'Test New Video',
        description: 'Test description',
        category: '운동',
        youtubeUrl: 'https://www.youtube.com/watch?v=newtest',
        duration: 450,
        thumbnailUrl: 'https://example.com/thumb.jpg'
      }

      const response = await request(app)
        .post('/api/videos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(videoData)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.title).toBe(videoData.title)
      expect(response.body.data.youtubeUrl).toBe(videoData.youtubeUrl)
    })

    it('should return validation error for invalid data', async () => {
      const invalidData = {
        title: '',
        youtubeUrl: 'invalid-url',
        duration: -1
      }

      const response = await request(app)
        .post('/api/videos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidData)
        .expect(400)

      expect(response.body.error).toBe('입력 데이터가 유효하지 않습니다')
    })
  })

  describe('GET /api/videos/:id', () => {
    let testVideoId: string

    beforeEach(async () => {
      const video = await prisma.video.create({
        data: {
          title: 'Test Video Detail',
          description: 'Test description',
          category: '운동',
          youtubeUrl: 'https://www.youtube.com/watch?v=detail',
          duration: 300,
          thumbnailUrl: 'https://example.com/thumb.jpg'
        }
      })
      testVideoId = video.id
    })

    it('should get video details', async () => {
      const response = await request(app)
        .get(`/api/videos/${testVideoId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.id).toBe(testVideoId)
      expect(response.body.data.title).toBe('Test Video Detail')
    })

    it('should return 404 for non-existent video', async () => {
      const response = await request(app)
        .get('/api/videos/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404)

      expect(response.body.error).toBe('비디오를 찾을 수 없습니다')
    })
  })

  describe('PUT /api/videos/:id', () => {
    let testVideoId: string

    beforeEach(async () => {
      const video = await prisma.video.create({
        data: {
          title: 'Test Video Update',
          description: 'Test description',
          category: '운동',
          youtubeUrl: 'https://www.youtube.com/watch?v=update',
          duration: 300,
          thumbnailUrl: 'https://example.com/thumb.jpg'
        }
      })
      testVideoId = video.id
    })

    it('should update video', async () => {
      const updateData = {
        title: 'Updated Test Video',
        category: '요가'
      }

      const response = await request(app)
        .put(`/api/videos/${testVideoId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.title).toBe(updateData.title)
      expect(response.body.data.category).toBe(updateData.category)
    })
  })

  describe('DELETE /api/videos/:id', () => {
    let testVideoId: string

    beforeEach(async () => {
      const video = await prisma.video.create({
        data: {
          title: 'Test Video Delete',
          description: 'Test description',
          category: '운동',
          youtubeUrl: 'https://www.youtube.com/watch?v=delete',
          duration: 300,
          thumbnailUrl: 'https://example.com/thumb.jpg'
        }
      })
      testVideoId = video.id
    })

    it('should delete video', async () => {
      const response = await request(app)
        .delete(`/api/videos/${testVideoId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('비디오가 성공적으로 삭제되었습니다')

      // 비디오가 실제로 삭제되었는지 확인
      const deletedVideo = await prisma.video.findUnique({
        where: { id: testVideoId }
      })
      expect(deletedVideo).toBeNull()
    })
  })

  describe('GET /api/videos/categories/list', () => {
    beforeEach(async () => {
      await prisma.video.createMany({
        data: [
          {
            title: 'Test Video 1',
            category: '운동',
            youtubeUrl: 'https://www.youtube.com/watch?v=cat1',
            duration: 300
          },
          {
            title: 'Test Video 2',
            category: '요가',
            youtubeUrl: 'https://www.youtube.com/watch?v=cat2',
            duration: 300
          },
          {
            title: 'Test Video 3',
            category: '운동',
            youtubeUrl: 'https://www.youtube.com/watch?v=cat3',
            duration: 300
          }
        ]
      })
    })

    it('should get unique categories list', async () => {
      const response = await request(app)
        .get('/api/videos/categories/list')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(Array.isArray(response.body.data)).toBe(true)
      expect(response.body.data).toContain('운동')
      expect(response.body.data).toContain('요가')
      // 중복 제거 확인
      expect(response.body.data.filter((cat: string) => cat === '운동').length).toBe(1)
    })
  })

  describe('YouTube Integration', () => {
    describe('POST /api/videos/youtube/metadata', () => {
      it('should validate YouTube URL format', async () => {
        const invalidUrl = {
          url: 'https://www.google.com'
        }

        const response = await request(app)
          .post('/api/videos/youtube/metadata')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(invalidUrl)
          .expect(422)

        expect(response.body.success).toBe(false)
        expect(response.body.error).toBe('유효한 YouTube URL이 아닙니다')
      })

      it('should accept valid YouTube URL format', async () => {
        const validUrl = {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
        }

        const response = await request(app)
          .post('/api/videos/youtube/metadata')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(validUrl)

        // API 키가 없거나 할당량 초과 시 503 에러 예상
        if (response.status === 503) {
          expect(response.body.error).toContain('YouTube API')
        } else if (response.status === 200) {
          expect(response.body.success).toBe(true)
          expect(response.body.data).toBeDefined()
        }
      })
    })

    describe('POST /api/videos/youtube/search', () => {
      it('should validate search parameters', async () => {
        const invalidSearch = {
          query: '',
          maxResults: 100
        }

        const response = await request(app)
          .post('/api/videos/youtube/search')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(invalidSearch)
          .expect(400)

        expect(response.body.error).toBe('입력 데이터가 유효하지 않습니다')
      })

      it('should accept valid search parameters', async () => {
        const validSearch = {
          query: 'workout',
          maxResults: 5
        }

        const response = await request(app)
          .post('/api/videos/youtube/search')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(validSearch)

        // API 키가 없거나 할당량 초과 시 503 에러 예상
        if (response.status === 503) {
          expect(response.body.error).toContain('YouTube API')
        } else if (response.status === 200) {
          expect(response.body.success).toBe(true)
          expect(Array.isArray(response.body.data)).toBe(true)
        }
      })
    })

    describe('POST /api/videos/youtube/import', () => {
      it('should validate YouTube URL for import', async () => {
        const invalidImport = {
          youtubeUrl: 'https://www.google.com',
          category: '운동'
        }

        const response = await request(app)
          .post('/api/videos/youtube/import')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(invalidImport)
          .expect(422)

        expect(response.body.success).toBe(false)
        expect(response.body.error).toBe('유효한 YouTube URL이 아닙니다')
      })
    })

    describe('GET /api/videos/youtube/usage', () => {
      it('should return usage statistics', async () => {
        const response = await request(app)
          .get('/api/videos/youtube/usage')
          .set('Authorization', `Bearer ${accessToken}`)

        if (response.status === 500) {
          // API 키가 없는 경우 에러 예상
          expect(response.body.error).toContain('YOUTUBE_API_KEY')
        } else {
          expect(response.status).toBe(200)
          expect(response.body.success).toBe(true)
          expect(response.body.data).toHaveProperty('requestCount')
          expect(response.body.data).toHaveProperty('quotaLimit')
        }
      })
    })
  })
})