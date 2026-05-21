import { executeQuery } from '../lib/database.js'
import { randomBytes } from 'crypto'

export interface Device {
  id: number
  device_id: string
  device_token: string | null
  register_code: string | null
  register_code_expires_at: Date | null
  store_id: number | null
  display_label: string | null
  status: 'pending' | 'approved' | 'blocked'
  last_seen_at: Date | null
  ip_address: string | null
  created_at: Date
  registered_at: Date | null
  registered_by: string | null
  registered_by_userid: string | null
  approved_at: Date | null
  approved_by: number | null
}

export class DeviceService {
  /**
   * 6자리 등록 코드 생성 (대문자 + 숫자)
   */
  private static generateRegisterCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 혼동 방지: I, O, 0, 1 제외
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  /**
   * device_token 생성 (32바이트 hex)
   */
  private static generateDeviceToken(): string {
    return randomBytes(32).toString('hex')
  }

  /**
   * deviceId로 디바이스 조회
   */
  static async getDeviceByDeviceId(deviceId: string): Promise<Device | null> {
    const results = await executeQuery(
      'SELECT * FROM devices WHERE device_id = ?',
      [deviceId]
    )
    return results[0] || null
  }

  /** DB primary key(id)로 조회 */
  static async getDeviceByNumericId(id: number): Promise<Device | null> {
    const results = await executeQuery('SELECT * FROM devices WHERE id = ?', [id])
    return results[0] || null
  }

  /**
   * deviceToken으로 디바이스 조회
   */
  static async getDeviceByToken(deviceToken: string): Promise<Device | null> {
    const results = await executeQuery(
      'SELECT * FROM devices WHERE device_token = ? AND status = ?',
      [deviceToken, 'approved']
    )
    return results[0] || null
  }

  /**
   * 등록 코드로 디바이스 조회 (유효한 코드만)
   */
  static async getDeviceByRegisterCode(code: string): Promise<Device | null> {
    const results = await executeQuery(
      `SELECT * FROM devices 
       WHERE register_code = ? 
       AND register_code_expires_at > NOW()`,
      [code.toUpperCase()]
    )
    return results[0] || null
  }

  /**
   * 디바이스 상태 조회 및 등록 코드 발급
   * - 이미 등록된 경우: 기존 정보 반환
   * - 기존 유효한 코드가 있으면: 기존 코드 반환
   * - 미등록/코드 만료: 새 등록 코드 발급
   */
  static async getDeviceStatus(deviceId: string): Promise<{
    registered: boolean
    device?: Device
    registerCode?: string
    expiresIn?: number
  }> {
    console.log(`📋 getDeviceStatus 호출: deviceId=${deviceId}`)
    let device = await this.getDeviceByDeviceId(deviceId)
    console.log(`📋 기존 디바이스:`, device ? `id=${device.id}, token=${device.device_token}` : 'null')

    if (device && device.device_token) {
      // 이미 등록 완료된 디바이스
      console.log(`📋 이미 등록된 디바이스`)
      return { registered: true, device }
    }

    // 기존 등록 코드가 아직 유효한지 확인
    if (device && device.register_code && device.register_code_expires_at) {
      const expiresAt = new Date(device.register_code_expires_at)
      const now = new Date()
      if (expiresAt > now) {
        // 기존 코드가 아직 유효함 - 재사용
        const remainingSeconds = Math.floor((expiresAt.getTime() - now.getTime()) / 1000)
        console.log(`📋 기존 등록 코드 재사용: ${device.register_code} (${remainingSeconds}초 남음)`)
        return {
          registered: false,
          registerCode: device.register_code,
          expiresIn: remainingSeconds
        }
      }
    }

    // 새 등록 코드 생성
    const registerCode = this.generateRegisterCode()
    const expiresInMinutes = 10 // 10분 유효
    console.log(`📋 새 등록 코드 생성: ${registerCode}`)

    try {
      if (device) {
        // 기존 디바이스가 있지만 등록 안됨 - 코드 갱신
        console.log(`📋 기존 디바이스 코드 갱신`)
        await executeQuery(
          `UPDATE devices SET 
             register_code = ?, 
             register_code_expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
           WHERE device_id = ?`,
          [registerCode, expiresInMinutes, deviceId]
        )
      } else {
        // 새 디바이스 생성
        console.log(`📋 새 디바이스 생성`)
        await executeQuery(
          `INSERT INTO devices (device_id, register_code, register_code_expires_at, status)
           VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), 'pending')`,
          [deviceId, registerCode, expiresInMinutes]
        )
      }
      console.log(`📋 DB 저장 완료`)
    } catch (error) {
      console.error(`❌ DB 저장 실패:`, error)
      throw error
    }

    return {
      registered: false,
      registerCode,
      expiresIn: expiresInMinutes * 60 // 초 단위
    }
  }

  /**
   * 디바이스 등록 (웹앱에서 호출)
   * 등록 코드로 디바이스를 매장에 연결하고 토큰 발급
   */
  static async registerDevice(
    code: string,
    storeId: number,
    displayLabel: string,
    registeredByUserId: string,
    registeredByUserid: string
  ): Promise<{ success: boolean; device?: Device; error?: string }> {
    const device = await this.getDeviceByRegisterCode(code)

    if (!device) {
      return { success: false, error: '유효하지 않거나 만료된 등록 코드입니다' }
    }

    if (device.device_token) {
      return { success: false, error: '이미 등록된 디바이스입니다' }
    }

    const deviceToken = this.generateDeviceToken()

    await executeQuery(
      `UPDATE devices SET 
         device_token = ?,
         store_id = ?,
         display_label = ?,
         status = 'approved',
         register_code = NULL,
         register_code_expires_at = NULL,
         registered_at = NOW(),
         registered_by = ?,
         registered_by_userid = ?
       WHERE id = ?`,
      [deviceToken, storeId, displayLabel, registeredByUserId, registeredByUserid, device.id]
    )

    const updatedDevice = await this.getDeviceByDeviceId(device.device_id)
    return { success: true, device: updatedDevice! }
  }

  /**
   * 매장의 등록된 디바이스 목록 조회
   */
  static async getDevicesByStore(storeId: number): Promise<Device[]> {
    const results = await executeQuery(
      `SELECT d.*, 
              CASE 
                WHEN d.last_seen_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE) THEN 1 
                ELSE 0 
              END as is_online
       FROM devices d
       WHERE d.store_id = ? AND d.status = 'approved'
       ORDER BY d.display_label ASC`,
      [storeId]
    )
    return results
  }

  /**
   * 등록된 전체 디바이스 목록 조회 (전체 매장 권한 관리자용)
   */
  static async getAllDevices(): Promise<Device[]> {
    const results = await executeQuery(
      `SELECT d.*,
              CASE
                WHEN d.last_seen_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE) THEN 1
                ELSE 0
              END as is_online
       FROM devices d
       WHERE d.status = 'approved'
       ORDER BY d.display_label ASC`,
      []
    )
    return results
  }

  /**
   * 온라인 상태인 디바이스 목록 조회 (특정 매장)
   */
  static async getOnlineDevicesByStore(storeId: number): Promise<Device[]> {
    const results = await executeQuery(
      `SELECT * FROM devices 
       WHERE store_id = ? 
       AND status = 'approved'
       AND last_seen_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)
       ORDER BY display_label ASC`,
      [storeId]
    )
    return results
  }

  /**
   * 온라인 상태인 전체 디바이스 목록 조회 (전체 매장 권한 관리자용)
   */
  static async getAllOnlineDevices(): Promise<Device[]> {
    const results = await executeQuery(
      `SELECT *
       FROM devices
       WHERE status = 'approved'
       AND last_seen_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)
       ORDER BY display_label ASC`,
      []
    )
    return results
  }

  /**
   * 디바이스 마지막 연결 시간 업데이트 (heartbeat)
   */
  static async updateLastSeen(deviceId: string, ipAddress?: string): Promise<void> {
    await executeQuery(
      `UPDATE devices SET 
         last_seen_at = NOW(),
         ip_address = COALESCE(?, ip_address)
       WHERE device_id = ?`,
      [ipAddress || null, deviceId]
    )
  }

  /**
   * 디바이스 삭제 (연결 해제)
   */
  static async deleteDevice(deviceId: number): Promise<void> {
    await executeQuery('DELETE FROM devices WHERE id = ?', [deviceId])
  }

  /**
   * 관리자 연동 관리: 디바이스 + 등록 사용자 정보 (매장 필터 null이면 전체)
   */
  static async listLinkagesForAdmin(filterStoreId: number | null): Promise<
    Array<{
      id: number
      device_id: string
      display_label: string | null
      store_id: number | null
      last_seen_at: Date | null
      registered_by: string | null
      registered_by_userid: string | null
      registeredByUserid: string | null
      registeredByName: string | null
      registrantLinkageEnabled: number | null
    }>
  > {
    let sql = `
      SELECT d.id, d.device_id, d.display_label, d.store_id, d.last_seen_at,
             d.registered_by, d.registered_by_userid,
             COALESCE(d.registered_by_userid, u.userid) AS registeredByUserid,
             u.name AS registeredByName,
             u.linkage_enabled AS registrantLinkageEnabled
      FROM devices d
      LEFT JOIN users u ON d.registered_by = u.id
    `
    const params: unknown[] = []
    if (filterStoreId != null) {
      sql += ` WHERE d.store_id = ?`
      params.push(filterStoreId)
    }
    sql += ` ORDER BY d.id DESC`
    const rows = await executeQuery(sql, params)
    return rows
  }

  /**
   * 디바이스 상태 변경 (승인/차단)
   */
  static async updateDeviceStatus(
    deviceId: number,
    status: 'approved' | 'blocked',
    approvedBy?: number
  ): Promise<void> {
    if (status === 'approved') {
      await executeQuery(
        `UPDATE devices SET 
           status = ?,
           approved_at = NOW(),
           approved_by = ?
         WHERE id = ?`,
        [status, approvedBy || null, deviceId]
      )
    } else {
      await executeQuery(
        'UPDATE devices SET status = ? WHERE id = ?',
        [status, deviceId]
      )
    }
  }

  /**
   * 디바이스 표시 이름 변경
   */
  static async updateDisplayLabel(deviceId: number, displayLabel: string): Promise<void> {
    await executeQuery(
      'UPDATE devices SET display_label = ? WHERE id = ?',
      [displayLabel, deviceId]
    )
  }
}
