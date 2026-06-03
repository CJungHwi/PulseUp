import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

vi.mock('../middleware/auth.middleware.js', () => {
  return {
    authenticateToken: (req: any, _res: any, next: any) => {
      req.user = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: '테스트',
        role: 'user',
        userid: 'test'
      }
      next()
    }
  }
})

const callProcedureMock = vi.fn()

vi.mock('../lib/database.js', () => {
  return {
    callProcedure: (...args: any[]) => callProcedureMock(...args),
    executeQuery: vi.fn(),
    executeTransaction: vi.fn(),
  }
})

import workoutCategoryRoutes from '../routes/workoutCategories.routes.js'

describe('Workout Categories Exercise Favorite Routes', () => {
  const app = express()
  app.use(express.json())
  app.use('/api/workout-categories', workoutCategoryRoutes)

  beforeEach(() => {
    callProcedureMock.mockReset()
  })

  it('GET /api/workout-categories/exercises/favorites should call procedure and return rows', async () => {
    callProcedureMock.mockResolvedValueOnce([
      [{ exercise_id: 'ex-1' }, { exercise_id: 'ex-2' }]
    ])

    const response = await request(app)
      .get('/api/workout-categories/exercises/favorites')
      .set('Authorization', 'Bearer fake-token')
      .expect(200)

    expect(callProcedureMock).toHaveBeenCalledWith('sp_GetUserExerciseFavorites', ['test-user-id'])
    expect(response.body.success).toBe(true)
    expect(response.body.data).toHaveLength(2)
  })

  it('POST /api/workout-categories/exercises/favorites/toggle should call procedure and return action', async () => {
    callProcedureMock.mockResolvedValueOnce([
      [{ is_favorite: 1, action: 'added' }]
    ])

    const response = await request(app)
      .post('/api/workout-categories/exercises/favorites/toggle')
      .set('Authorization', 'Bearer fake-token')
      .send({ exercise_id: 'ex-1' })
      .expect(200)

    expect(callProcedureMock).toHaveBeenCalledWith('sp_ToggleUserExerciseFavorite', ['test-user-id', 'ex-1'])
    expect(response.body.success).toBe(true)
    expect(response.body.data[0].action).toBe('added')
  })

  it('POST /api/workout-categories/exercises/favorites/toggle should validate exercise_id', async () => {
    const response = await request(app)
      .post('/api/workout-categories/exercises/favorites/toggle')
      .set('Authorization', 'Bearer fake-token')
      .send({})
      .expect(400)

    expect(response.body).toHaveProperty('error')
    expect(callProcedureMock).not.toHaveBeenCalled()
  })
})
