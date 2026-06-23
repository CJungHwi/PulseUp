/**
 * 소스 요약 — 운동 심박수 서비스
 *
 * 기능: 실시간/배치 심박수 저장, 운동 세션별 회원-심박계 매핑, 참가자별 심박 요약 조회를 처리한다.
 *
 * 호출/연동: `heartrate.routes`, `sp_insert_heart_rate_data`, `heart_rate_data`,
 *           `workout_heart_rate_participants`, `workout_history_master`, `users`.
 *
 * 흐름: API 요청 → 세션별 활성 매핑 확인 → 매핑된 회원 또는 1:1 fallback 사용자 결정
 *      → 심박 UPSERT 저장 → 회원/수업별 조회 응답 생성.
 */

import { pool as db } from '../lib/database.js'

interface SaveHeartRateDataParams {
  user_id: string
  workout_history_master_id: string
  device_id: string
  device_name?: string | null
  heart_rate: number
  timestamp: Date
  zone?: string
  slot_number?: number | null
}

interface BatchHeartRateData {
  deviceId: string
  deviceName?: string | null
  heartRate: number
  timestamp: Date
  zone?: string
  slotNumber?: number | null
}

interface HeartRateParticipantInput {
  userId: string
  deviceId: string
  deviceName?: string | null
  slotNumber?: number | null
}

interface ActiveParticipantRow {
  user_id: string
  device_id: string
}

const toMysqlTimestamp = (timestamp: Date | string) => {
  // UTC 시간을 한국 시간대(KST, UTC+9)로 변환 (문자열 조립 방식)
  const t = new Date(timestamp)
  const kst = new Date(t.getTime() + (9 * 60 * 60 * 1000))
  const yyyy = kst.getUTCFullYear()
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(kst.getUTCDate()).padStart(2, '0')
  const hh = String(kst.getUTCHours()).padStart(2, '0')
  const mi = String(kst.getUTCMinutes()).padStart(2, '0')
  const ss = String(kst.getUTCSeconds()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}

const buildParticipantMap = (rows: ActiveParticipantRow[]) => {
  const map = new Map<string, string>()
  for (const row of rows) {
    if (row.device_id && row.user_id) map.set(row.device_id, row.user_id)
  }
  return map
}

export class HeartRateService {
  // 단일 심박수 데이터 저장 (프로시저 사용)
  async saveHeartRateData(params: SaveHeartRateDataParams) {
    const activeParticipants = await this.getActiveParticipants(params.workout_history_master_id)
    const participantMap = buildParticipantMap(activeParticipants)
    const targetUserId = participantMap.get(params.device_id)
      || (participantMap.size === 0 ? params.user_id : null)

    if (!targetUserId) {
      return {
        success: false,
        message: '매핑되지 않은 심박계 데이터는 저장하지 않았습니다',
        savedCount: 0,
        skippedCount: 1
      }
    }

    const mysqlTimestamp = toMysqlTimestamp(params.timestamp)

    console.log(`[HR DEBUG] Single Save Time: Input=${new Date(params.timestamp).toISOString()}, Output=${mysqlTimestamp}`)

    await db.execute(
      'CALL sp_insert_heart_rate_data(?, ?, ?, ?, ?, ?, ?)',
      [
        targetUserId,
        params.workout_history_master_id,
        params.device_id,
        params.device_name || null,
        mysqlTimestamp,
        params.heart_rate,
        params.zone || null
      ]
    )

    return { success: true, message: '심박수 데이터가 저장되었습니다' }
  }

  // 배치 심박수 데이터 저장 (ANT+ 전용)
  async saveBatchHeartRateData(
    fallbackUserId: string,
    workoutHistoryMasterId: string,
    heartRateData: BatchHeartRateData[]
  ) {
    const connection = await db.getConnection()

    try {
      await connection.beginTransaction()

      //console.log(`🔄 트랜잭션 시작: ${heartRateData.length}개 데이터 처리`)

      // 같은 초(second) 단위로 중복 제거 (deviceId + timestamp 기준)
      const uniqueDataMap = new Map<string, BatchHeartRateData>()

      for (const data of heartRateData) {
        // 초 단위로 반올림 (밀리초 제거)
        const roundedDate = new Date(data.timestamp)
        roundedDate.setMilliseconds(0)

        // deviceId + timestamp를 키로 사용 (같은 기기의 같은 초는 하나만)
        const key = `${data.deviceId}_${roundedDate.getTime()}`

        // 이미 존재하면 최신 데이터로 덮어쓰기
        uniqueDataMap.set(key, {
          ...data,
          timestamp: roundedDate
        })
      }

      //console.log(`✂️ 중복 제거 완료: ${uniqueDataMap.size}개 (제거: ${heartRateData.length - uniqueDataMap.size}개)`)

      const [participantRows] = await connection.execute(
        `SELECT user_id, device_id
         FROM workout_heart_rate_participants
         WHERE workout_history_master_id = ?
           AND is_active = TRUE
           AND unassigned_at IS NULL`,
        [workoutHistoryMasterId]
      ) as any
      const participantMap = buildParticipantMap(Array.isArray(participantRows) ? participantRows : [])

      // 중복 제거된 데이터만 저장
      let savedCount = 0
      let skippedCount = 0
      for (const data of uniqueDataMap.values()) {
        const targetUserId = participantMap.get(data.deviceId)
          || (participantMap.size === 0 ? fallbackUserId : null)

        if (!targetUserId) {
          skippedCount++
          continue
        }

        const t = new Date(data.timestamp)
        const mysqlTimestamp = toMysqlTimestamp(t)

        if (savedCount === 0) {
          console.log(`[HR DEBUG] Time Conversion: Input(UTC)=${t.toISOString()}, Output(KST)=${mysqlTimestamp}`)
        }

        //console.log(`💾 저장 시도 [${savedCount + 1}/${uniqueDataMap.size}]: ${data.deviceName} - ${mysqlTimestamp} - ${data.heartRate} BPM`)
        //console.log(`📋 프로시저 파라미터:`, {
        //   userId,
        //   workoutHistoryMasterId,
        //   deviceId: data.deviceId,
        //   deviceName: data.deviceName,
        //   mysqlTimestamp,
        //   heartRate: data.heartRate,
        //   zone: data.zone || null
        // })

        const result = await connection.execute(
          'CALL sp_insert_heart_rate_data(?, ?, ?, ?, ?, ?, ?)',
          [
            targetUserId,
            workoutHistoryMasterId,
            data.deviceId,
            data.deviceName || null,
            mysqlTimestamp,
            data.heartRate,
            data.zone || null
          ]
        )

        //console.log(`✅ 저장 성공 [${savedCount + 1}/${uniqueDataMap.size}]`, result[0])

        // 실제 DB에 저장되었는지 확인
        const [checkResult] = await connection.execute(
          `SELECT *, 
           DATE_FORMAT(timestamp, '%Y-%m-%d %H:%i:%s') as timestamp_formatted
           FROM heart_rate_data 
           WHERE user_id = ? AND workout_history_master_id = ? AND device_id = ? 
           AND DATE_FORMAT(timestamp, '%Y-%m-%d %H:%i:%s') = ?
           ORDER BY created_at DESC LIMIT 1`,
          [targetUserId, workoutHistoryMasterId, data.deviceId, mysqlTimestamp]
        ) as any

        // if (checkResult.length > 0) {
        //   //console.log(`🔍 DB 저장 확인: ✅ 저장됨`, {
        //   //  timestamp_sent: mysqlTimestamp,
        //   //  timestamp_db: checkResult[0].timestamp_formatted,
        //   //  heart_rate: checkResult[0].heart_rate
        //   //})
        // } else {
        //   //console.log(`🔍 DB 저장 확인: ❌ 데이터 없음 (timestamp: ${mysqlTimestamp})`)
        // }
        savedCount++
      }

      await connection.commit()
      //console.log(`✅ 트랜잭션 커밋 완료: ${savedCount}개 저장됨`)

      return {
        success: true,
        savedCount,
        skippedCount,
        mappedDeviceCount: participantMap.size,
        message: `${savedCount}개의 심박수 데이터가 저장되었습니다 (중복 ${heartRateData.length - uniqueDataMap.size}개 제거, 미매핑 ${skippedCount}개 제외)`
      }
    } catch (error) {
      console.error('❌ 심박수 배치 저장 실패:', error)
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async upsertParticipants(workoutHistoryMasterId: string, participants: HeartRateParticipantInput[]) {
    const connection = await db.getConnection()

    try {
      await connection.beginTransaction()

      const [masterRows] = await connection.execute(
        'SELECT id FROM workout_history_master WHERE id = ? LIMIT 1',
        [workoutHistoryMasterId]
      ) as any
      if (!Array.isArray(masterRows) || masterRows.length === 0) {
        throw new Error('운동기록을 찾을 수 없습니다')
      }

      for (const participant of participants) {
        await connection.execute(
          `UPDATE workout_heart_rate_participants
           SET is_active = FALSE,
               unassigned_at = NOW()
           WHERE workout_history_master_id = ?
             AND is_active = TRUE
             AND (user_id = ? OR device_id = ?)`,
          [workoutHistoryMasterId, participant.userId, participant.deviceId]
        )

        await connection.execute(
          `INSERT INTO workout_heart_rate_participants (
             workout_history_master_id,
             user_id,
             device_id,
             device_name,
             slot_number,
             assigned_at,
             is_active
           ) VALUES (?, ?, ?, ?, ?, NOW(), TRUE)`,
          [
            workoutHistoryMasterId,
            participant.userId,
            participant.deviceId,
            participant.deviceName || null,
            participant.slotNumber || null
          ]
        )
      }

      await connection.commit()
      return this.listParticipants(workoutHistoryMasterId)
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async listParticipants(workoutHistoryMasterId: string) {
    const [rows] = await db.execute(
      `SELECT
        p.id,
        p.workout_history_master_id,
        p.user_id,
        u.userid,
        u.name,
        u.email,
        p.device_id,
        p.device_name,
        p.slot_number,
        p.assigned_at,
        p.unassigned_at,
        p.is_active,
        COUNT(hrd.id) as heart_rate_readings,
        ROUND(AVG(hrd.heart_rate), 1) as avg_heart_rate,
        MAX(hrd.heart_rate) as max_heart_rate,
        MIN(hrd.heart_rate) as min_heart_rate,
        MAX(hrd.timestamp) as last_heart_rate_at
      FROM workout_heart_rate_participants p
      INNER JOIN users u ON u.id = p.user_id
      LEFT JOIN heart_rate_data hrd
        ON hrd.workout_history_master_id = p.workout_history_master_id
        AND hrd.user_id = p.user_id
        AND hrd.device_id = p.device_id
      WHERE p.workout_history_master_id = ?
      GROUP BY
        p.id,
        p.workout_history_master_id,
        p.user_id,
        u.userid,
        u.name,
        u.email,
        p.device_id,
        p.device_name,
        p.slot_number,
        p.assigned_at,
        p.unassigned_at,
        p.is_active
      ORDER BY p.is_active DESC, p.slot_number ASC, u.name ASC`,
      [workoutHistoryMasterId]
    )

    return rows
  }

  async deactivateParticipant(workoutHistoryMasterId: string, participantId: string) {
    const [result] = await db.execute(
      `UPDATE workout_heart_rate_participants
       SET is_active = FALSE,
           unassigned_at = NOW()
       WHERE id = ?
         AND workout_history_master_id = ?
         AND is_active = TRUE`,
      [participantId, workoutHistoryMasterId]
    ) as any

    return Number(result?.affectedRows || 0) > 0
  }

  async getParticipantsSummary(workoutHistoryMasterId: string) {
    const [rows] = await db.execute(
      `SELECT
        p.id,
        p.user_id,
        u.userid,
        u.name,
        u.email,
        p.device_id,
        p.device_name,
        p.slot_number,
        COUNT(hrd.id) as readings,
        ROUND(AVG(hrd.heart_rate), 1) as avg_heart_rate,
        MAX(hrd.heart_rate) as max_heart_rate,
        MIN(hrd.heart_rate) as min_heart_rate,
        (
          SELECT h2.heart_rate
          FROM heart_rate_data h2
          WHERE h2.workout_history_master_id = p.workout_history_master_id
            AND h2.user_id = p.user_id
            AND h2.device_id = p.device_id
          ORDER BY h2.timestamp DESC
          LIMIT 1
        ) as current_heart_rate,
        (
          SELECT h2.zone
          FROM heart_rate_data h2
          WHERE h2.workout_history_master_id = p.workout_history_master_id
            AND h2.user_id = p.user_id
            AND h2.device_id = p.device_id
          ORDER BY h2.timestamp DESC
          LIMIT 1
        ) as current_zone,
        MAX(hrd.timestamp) as last_heart_rate_at
      FROM workout_heart_rate_participants p
      INNER JOIN users u ON u.id = p.user_id
      LEFT JOIN heart_rate_data hrd
        ON hrd.workout_history_master_id = p.workout_history_master_id
        AND hrd.user_id = p.user_id
        AND hrd.device_id = p.device_id
      WHERE p.workout_history_master_id = ?
        AND p.is_active = TRUE
        AND p.unassigned_at IS NULL
      GROUP BY
        p.id,
        p.user_id,
        u.userid,
        u.name,
        u.email,
        p.device_id,
        p.device_name,
        p.slot_number,
        p.workout_history_master_id
      ORDER BY p.slot_number ASC, u.name ASC`,
      [workoutHistoryMasterId]
    )

    return rows
  }

  private async getActiveParticipants(workoutHistoryMasterId: string) {
    const [rows] = await db.execute(
      `SELECT user_id, device_id
       FROM workout_heart_rate_participants
       WHERE workout_history_master_id = ?
         AND is_active = TRUE
         AND unassigned_at IS NULL`,
      [workoutHistoryMasterId]
    )
    return Array.isArray(rows) ? rows as ActiveParticipantRow[] : []
  }

  async getWorkoutHeartRateData(user_id: string, workout_history_master_id: string) {
    const query = `
      SELECT 
        hrd.id,
        hrd.device_id,
        hrd.device_name,
        hrd.timestamp,
        hrd.heart_rate,
        hrd.zone
      FROM heart_rate_data hrd
      WHERE hrd.user_id = ? AND hrd.workout_history_master_id = ?
      ORDER BY hrd.timestamp ASC
    `

    const [rows] = await db.execute(query, [user_id, workout_history_master_id])
    return rows
  }

  async getHeartRateStats(user_id: string, workout_history_master_id: string) {
    const query = `
      SELECT 
        AVG(heart_rate) as avg_heart_rate,
        MAX(heart_rate) as max_heart_rate,
        MIN(heart_rate) as min_heart_rate,
        COUNT(*) as total_readings,
        COUNT(DISTINCT device_id) as device_count
      FROM heart_rate_data
      WHERE user_id = ? AND workout_history_master_id = ?
    `

    const [rows] = await db.execute(query, [user_id, workout_history_master_id])
    return (rows as any)[0]
  }

  // 심박수 임계값 설정 조회 (system_settings 테이블)
  async getHeartRateThreshold(): Promise<number> {
    const query = `
      SELECT setting_value 
      FROM system_settings 
      WHERE setting_key = 'heart'
      LIMIT 1
    `

    try {
      const [rows] = await db.execute(query) as any
      if (rows && rows.length > 0 && rows[0].setting_value) {
        const threshold = parseInt(rows[0].setting_value, 10)
        return isNaN(threshold) ? 120 : threshold // 기본값 120
      }
      return 120 // 설정이 없으면 기본값 120
    } catch (error) {
      console.error('심박수 임계값 조회 실패:', error)
      return 120 // 에러 시 기본값 120
    }
  }
}

