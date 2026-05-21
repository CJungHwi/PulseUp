export interface DeviceControlLock {
  deviceId: string
  controllerId: string
  userId: string
  userid: string
  lockedAt: string
  lastSeenAt: string
}

export interface LockOwner {
  controllerId: string
  userId: string
  userid: string
}

export class DeviceControlLockedError extends Error {
  lock: DeviceControlLock

  constructor(lock: DeviceControlLock) {
    super('다른 태블릿에서 제어 중입니다. 기존 연결을 끊은 후 다시 시도해주세요.')
    this.name = 'DeviceControlLockedError'
    this.lock = lock
  }
}

export class DeviceControlMissingError extends Error {
  constructor() {
    super('제어 연결이 설정되어 있지 않습니다. 월간프로그램에서 Play를 다시 실행해주세요.')
    this.name = 'DeviceControlMissingError'
  }
}

export class DeviceControlLockService {
  private static locks = new Map<string, DeviceControlLock>()

  private static now(): string {
    return new Date().toISOString()
  }

  static acquire(deviceId: string, owner: LockOwner): DeviceControlLock {
    const existing = this.locks.get(deviceId)

    if (existing && existing.controllerId !== owner.controllerId) {
      throw new DeviceControlLockedError(existing)
    }

    const timestamp = this.now()
    const lock: DeviceControlLock = existing
      ? { ...existing, lastSeenAt: timestamp }
      : {
          deviceId,
          controllerId: owner.controllerId,
          userId: owner.userId,
          userid: owner.userid,
          lockedAt: timestamp,
          lastSeenAt: timestamp
        }

    this.locks.set(deviceId, lock)
    return lock
  }

  static assertOwner(deviceId: string, owner: LockOwner): DeviceControlLock {
    const existing = this.locks.get(deviceId)

    if (!existing) {
      throw new DeviceControlMissingError()
    }

    if (existing.controllerId !== owner.controllerId) {
      throw new DeviceControlLockedError(existing)
    }

    const lock = { ...existing, lastSeenAt: this.now() }
    this.locks.set(deviceId, lock)
    return lock
  }

  static release(deviceId: string, controllerId: string): boolean {
    const existing = this.locks.get(deviceId)
    if (!existing || existing.controllerId !== controllerId) return false
    return this.locks.delete(deviceId)
  }

  static releaseDevice(deviceId: string): void {
    this.locks.delete(deviceId)
  }

  static getStatus(deviceId: string, controllerId?: string): {
    locked: boolean
    isOwner: boolean
    lock: DeviceControlLock | null
  } {
    const lock = this.locks.get(deviceId) || null
    return {
      locked: !!lock,
      isOwner: !!lock && !!controllerId && lock.controllerId === controllerId,
      lock
    }
  }
}
