import { describe, it, expect } from 'vitest'
import request from 'supertest'
import express from 'express'
import vimeoRoutes from '../routes/vimeo.routes.js'
import { errorHandler } from '../middleware/error.middleware.js'

const app = express()
app.use(express.json())
app.use('/api/vimeo', vimeoRoutes)
app.use(errorHandler)

describe('POST /api/vimeo/videos/purge-inactive', () => {
    it('should return 401 without authentication', async () => {
        const res = await request(app).post('/api/vimeo/videos/purge-inactive')
        expect(res.status).toBe(401)
    })
})
