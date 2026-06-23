import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const connection = {
    beginTransaction: vi.fn(),
    execute: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
    release: vi.fn(),
  }

  return {
    connection,
    pool: {
      execute: vi.fn(),
      getConnection: vi.fn(),
    },
  }
})

vi.mock('../lib/database.js', () => ({
  pool: mocks.pool,
}))

import { HeartRateService } from '../services/heartrate.service.js'

describe('HeartRateService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.pool.getConnection.mockResolvedValue(mocks.connection as any)
  })

  it('매핑이 있는 운동 세션은 device_id에 매핑된 회원으로 배치 심박수를 저장한다', async () => {
    mocks.connection.execute
      .mockResolvedValueOnce([[{ user_id: 'member-1', device_id: 'ant-1' }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id: 'hr-1' }]])

    const service = new HeartRateService()
    const result = await service.saveBatchHeartRateData('login-user', 'master-1', [
      {
        deviceId: 'ant-1',
        deviceName: 'HR-1',
        heartRate: 120,
        timestamp: new Date('2026-06-09T10:00:00.000Z'),
        zone: 'cardio',
        slotNumber: 1,
      },
      {
        deviceId: 'ant-2',
        deviceName: 'HR-2',
        heartRate: 130,
        timestamp: new Date('2026-06-09T10:00:01.000Z'),
        zone: 'cardio',
        slotNumber: 2,
      },
    ])

    expect(result.savedCount).toBe(1)
    expect(result.skippedCount).toBe(1)
    expect(result.mappedDeviceCount).toBe(1)
    expect(mocks.connection.execute).toHaveBeenCalledWith(
      'CALL sp_insert_heart_rate_data(?, ?, ?, ?, ?, ?, ?)',
      expect.arrayContaining(['member-1', 'master-1', 'ant-1', 'HR-1', 120, 'cardio'])
    )
  })

  it('매핑이 없는 운동 세션은 기존 1:1 흐름처럼 로그인 사용자로 저장한다', async () => {
    mocks.connection.execute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id: 'hr-1' }]])

    const service = new HeartRateService()
    const result = await service.saveBatchHeartRateData('login-user', 'master-1', [
      {
        deviceId: 'ant-1',
        deviceName: 'HR-1',
        heartRate: 118,
        timestamp: new Date('2026-06-09T10:00:00.000Z'),
        zone: 'fat-burn',
      },
    ])

    expect(result.savedCount).toBe(1)
    expect(result.skippedCount).toBe(0)
    expect(mocks.connection.execute).toHaveBeenCalledWith(
      'CALL sp_insert_heart_rate_data(?, ?, ?, ?, ?, ?, ?)',
      expect.arrayContaining(['login-user', 'master-1', 'ant-1', 'HR-1', 118, 'fat-burn'])
    )
  })
})
