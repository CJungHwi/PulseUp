import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

vi.mock('../middleware/auth.middleware.js', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = {
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'user'
    }
    next()
  }
}))

vi.mock('../middleware/admin.middleware.js', () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next()
}))

const callProcedureMock = vi.fn()

vi.mock('../lib/database.js', () => ({
  callProcedure: (...args: unknown[]) => callProcedureMock(...args),
  executeQuery: vi.fn(),
  executeTransaction: vi.fn(async (ops: Array<() => Promise<unknown>>) => {
    for (const op of ops) await op()
    return true
  })
}))

vi.mock('../services/monitorDisplay.service.js', async () => {
  const actual = await vi.importActual<typeof import('../services/monitorDisplay.service.js')>(
    '../services/monitorDisplay.service.js'
  )
  return {
    ...actual,
    monitorDisplayService: {
      getUserProfile: vi.fn().mockResolvedValue({
        defaultImages: { leftImageUrl: 'L', centerImageUrl: 'C', rightImageUrl: 'R' },
        introImages: { leftImageUrl: '', centerImageUrl: '', rightImageUrl: '' },
        displayText: 'hello'
      }),
      getSystemProfile: vi.fn(),
      getWorkoutProfile: vi.fn().mockResolvedValue({
        defaultImages: { leftImageUrl: 'L', centerImageUrl: 'C', rightImageUrl: 'R' },
        introImages: { leftImageUrl: '', centerImageUrl: '', rightImageUrl: '' },
        displayText: 'hello'
      }),
      saveWorkoutProfile: vi.fn(),
      getWorkoutExerciseConfigs: vi.fn().mockResolvedValue([]),
      saveWorkoutExerciseConfigs: vi.fn(),
      resolveDisplayConfig: vi.fn().mockResolvedValue({
        leftImageUrl: 'L',
        centerImageUrl: 'C',
        rightImageUrl: 'R',
        displayText: 'hello'
      })
    }
  }
})

import monitorDisplayRoutes from '../routes/monitorDisplay.routes.js'

describe('Monitor Display Routes', () => {
  const app = express()
  app.use(express.json())
  app.use('/api/workout-categories', monitorDisplayRoutes)

  beforeEach(() => {
    callProcedureMock.mockReset()
  })

  it('GET /monitor-display-profile returns profile', async () => {
    const response = await request(app)
      .get('/api/workout-categories/monitor-display-profile')
      .set('Authorization', 'Bearer fake')
      .expect(200)

    expect(response.body.success).toBe(true)
    expect(response.body.data.defaultImages.leftImageUrl).toBe('L')
  })

  it('GET /monitor-display/resolve returns resolved config', async () => {
    const response = await request(app)
      .get('/api/workout-categories/monitor-display/resolve')
      .query({ context: 'default', masterId: 'm1' })
      .set('Authorization', 'Bearer fake')
      .expect(200)

    expect(response.body.data.centerImageUrl).toBe('C')
    expect(response.body.data.displayText).toBe('hello')
  })
})
