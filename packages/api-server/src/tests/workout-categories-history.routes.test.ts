import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// 라우트 import 전에 의존성을 mock 해야 함
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
const executeQueryMock = vi.fn()

vi.mock('../lib/database.js', () => {
  return {
    callProcedure: (...args: any[]) => callProcedureMock(...args),
    executeQuery: (...args: any[]) => executeQueryMock(...args),
    executeTransaction: vi.fn(),
    unwrapProcedureRows: (result: any) => (Array.isArray(result?.[0]) ? result[0] : []),
    unwrapProcedureFirstRow: (result: any) => (Array.isArray(result?.[0]) ? result[0][0] ?? null : null),
    unwrapProcedureResultSetAt: (result: any, index: number) => (
      Array.isArray(result?.[index]) ? result[index] : []
    )
  }
})

import workoutCategoryRoutes from '../routes/workoutCategories.routes.js'

describe('Workout Categories History Routes', () => {
  const app = express()
  app.use(express.json())
  app.use('/api/workout-categories', workoutCategoryRoutes)

  beforeEach(() => {
    callProcedureMock.mockReset()
    executeQueryMock.mockReset()
  })

  it('GET /api/workout-categories/workout-history-master should query and return rows', async () => {
    executeQueryMock.mockResolvedValueOnce([
      { id: 'm1', date: '2025-12-01', memo: 'a', is_admin: 0 },
      { id: 'm2', date: '2025-12-02', memo: 'b', is_admin: 0 }
    ])

    const response = await request(app)
      .get('/api/workout-categories/workout-history-master')
      .query({ yearMonth: '2025-12' })
      .set('Authorization', 'Bearer fake-token')
      .expect(200)

    expect(executeQueryMock).toHaveBeenCalledTimes(1)
    const [sql, params] = executeQueryMock.mock.calls[0]
    expect(sql).toContain('FROM workout_history_master whm')
    expect(params).toEqual(['test-user-id', '2025-12'])

    expect(response.body.success).toBe(true)
    expect(Array.isArray(response.body.data)).toBe(true)
    expect(response.body.data).toHaveLength(2)
  })

  it('GET /api/workout-categories/workout-history-master should validate yearMonth format', async () => {
    const response = await request(app)
      .get('/api/workout-categories/workout-history-master')
      .query({ yearMonth: '25-12' })
      .set('Authorization', 'Bearer fake-token')
      .expect(400)

    expect(response.body).toHaveProperty('error')
    expect(executeQueryMock).not.toHaveBeenCalled()
  })

  it('GET /api/workout-categories/workout-exercises/:masterId should call procedure and return rows', async () => {
    callProcedureMock.mockResolvedValueOnce([
      [
        { workout_history_master_id: 'm1', sequence: 1, round: 1, exercise_type: 'exercise', exercise_name: 'A', duration: 30 },
        { workout_history_master_id: 'm1', sequence: 2, round: 1, exercise_type: 'rest', exercise_name: '휴식', duration: 10 }
      ]
    ])

    const response = await request(app)
      .get('/api/workout-categories/workout-exercises/64cb9e62-e792-11f0-b4a8-380025563be0')
      .set('Authorization', 'Bearer fake-token')
      .expect(200)

    expect(callProcedureMock).toHaveBeenCalledTimes(1)
    expect(callProcedureMock).toHaveBeenCalledWith('sp_GetWorkoutExercises', ['64cb9e62-e792-11f0-b4a8-380025563be0'])
    expect(response.body.success).toBe(true)
    expect(Array.isArray(response.body.data)).toBe(true)
    expect(response.body.data).toHaveLength(2)
  })

  it('POST /api/workout-categories/HyberStrengthCircuitSave should update when date/category unchanged', async () => {
    executeQueryMock.mockResolvedValueOnce([{ date: '2025-12-01', workoutCategory: 'MAIN' }])
    callProcedureMock.mockResolvedValueOnce([[{ id: 'saved-master-id' }]])

    const response = await request(app)
      .post('/api/workout-categories/HyberStrengthCircuitSave')
      .set('Authorization', 'Bearer fake-token')
      .send({
        date: '2025-12-01',
        time: '1',
        workoutCategory: 'MAIN',
        masterId: 'existing-master-id',
        plans: [],
        exercises: [{ originalExerciseId: 'ex1', exercise_type: 'MAIN', duration: 10 }],
        workoutExercises: [],
        admin: true
      })
      .expect(200)

    // masterId 유지(update)
    expect(callProcedureMock).toHaveBeenCalled()
    const calledParams = callProcedureMock.mock.calls[0][1] as any[]
    expect(calledParams).toContain('existing-master-id')
    expect(response.body.success).toBe(true)
    expect(response.body.data).toHaveProperty('id')
  })

  it('POST /api/workout-categories/HyberStrengthCircuitSave should insert when date/category changed', async () => {
    executeQueryMock.mockResolvedValueOnce([{ date: '2025-12-01', workoutCategory: 'MAIN' }])
    callProcedureMock.mockResolvedValueOnce([[{ id: 'new-master-id' }]])

    const response = await request(app)
      .post('/api/workout-categories/HyberStrengthCircuitSave')
      .set('Authorization', 'Bearer fake-token')
      .send({
        date: '2025-12-02', // 날짜 변경
        time: '1',
        workoutCategory: 'MAIN',
        masterId: 'existing-master-id',
        plans: [],
        exercises: [{ originalExerciseId: 'ex1', exercise_type: 'MAIN', duration: 10 }],
        workoutExercises: [],
        admin: false
      })
      .expect(200)

    const calledParams = callProcedureMock.mock.calls[0][1] as any[]
    // insert: effectiveMasterId = null
    expect(calledParams).toContain(null)
    expect(response.body.success).toBe(true)
    expect(response.body.data.id).toBe('new-master-id')
  })

  it('POST /api/workout-categories/Time-StructuredAMRAP should not 404 and should call sp_SaveWorkout', async () => {
    callProcedureMock.mockResolvedValueOnce([[{ id: 'amrap-id' }]])

    const response = await request(app)
      .post('/api/workout-categories/Time-StructuredAMRAP')
      .set('Authorization', 'Bearer fake-token')
      .send({
        date: '2025-12-02',
        time: '1',
        workoutCategory: 'AMRAP',
        plans: [{ round: 1, time: 60, rest: 0, circuit_type: 'AMRAP' }],
        exercises: [{ originalExerciseId: 'ex1', exercise_type: 'AMRAP', reps: 30 }],
        workoutExercises: [],
        admin: true
      })
      .expect(200)

    expect(response.body.success).toBe(true)
    expect(response.body.data.id).toBe('amrap-id')
    expect(callProcedureMock).toHaveBeenCalled()
  })
})


