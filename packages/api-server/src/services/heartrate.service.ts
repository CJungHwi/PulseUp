import { pool as db } from '../lib/database.js'

interface SaveHeartRateDataParams {
  user_id: string
  workout_history_master_id: string
  device_id: string
  device_name: string
  heart_rate: number
  timestamp: Date
  zone?: string
}

interface BatchHeartRateData {
  deviceId: string
  deviceName: string
  heartRate: number
  timestamp: Date
  zone?: string
}

export class HeartRateService {
  // 단일 심박수 데이터 저장 (프로시저 사용)
  async saveHeartRateData(params: SaveHeartRateDataParams) {
    const {
      user_id,
      workout_history_master_id,
      device_id,
      device_name,
      heart_rate,
      timestamp,
      zone
    } = params

    // UTC 시간을 한국 시간대(KST, UTC+9)로 변환 (문자열 조립 방식)
    const t = new Date(timestamp)
    const kst = new Date(t.getTime() + (9 * 60 * 60 * 1000))
    const yyyy = kst.getUTCFullYear()
    const mm = String(kst.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(kst.getUTCDate()).padStart(2, '0')
    const hh = String(kst.getUTCHours()).padStart(2, '0')
    const mi = String(kst.getUTCMinutes()).padStart(2, '0')
    const ss = String(kst.getUTCSeconds()).padStart(2, '0')
    const mysqlTimestamp = `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`

    console.log(`[HR DEBUG] Single Save Time: Input=${t.toISOString()}, Output=${mysqlTimestamp}`)

    await db.execute(
      'CALL sp_insert_heart_rate_data(?, ?, ?, ?, ?, ?, ?)',
      [
        user_id,
        workout_history_master_id,
        device_id,
        device_name,
        mysqlTimestamp,
        heart_rate,
        zone || null
      ]
    )

    return { success: true, message: '심박수 데이터가 저장되었습니다' }
  }

  // 배치 심박수 데이터 저장 (ANT+ 전용)
  async saveBatchHeartRateData(
    userId: string,
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

      // 중복 제거된 데이터만 저장
      let savedCount = 0
      for (const data of uniqueDataMap.values()) {
        // UTC 시간을 한국 시간대(KST, UTC+9)로 변환 (문자열 조립 방식)
        const t = new Date(data.timestamp)
        const kst = new Date(t.getTime() + (9 * 60 * 60 * 1000))
        const yyyy = kst.getUTCFullYear()
        const mm = String(kst.getUTCMonth() + 1).padStart(2, '0')
        const dd = String(kst.getUTCDate()).padStart(2, '0')
        const hh = String(kst.getUTCHours()).padStart(2, '0')
        const mi = String(kst.getUTCMinutes()).padStart(2, '0')
        const ss = String(kst.getUTCSeconds()).padStart(2, '0')
        const mysqlTimestamp = `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`

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
            userId,
            workoutHistoryMasterId,
            data.deviceId,
            data.deviceName,
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
           WHERE user_id = ? AND device_id = ? 
           AND DATE_FORMAT(timestamp, '%Y-%m-%d %H:%i:%s') = ?
           ORDER BY created_at DESC LIMIT 1`,
          [userId, data.deviceId, mysqlTimestamp]
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
        message: `${uniqueDataMap.size}개의 심박수 데이터가 저장되었습니다 (중복 ${heartRateData.length - uniqueDataMap.size}개 제거)`
      }
    } catch (error) {
      console.error('❌ 심박수 배치 저장 실패:', error)
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
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

