import { pool as db } from '../lib/database.js'

export class SystemSettingsService {
    // 특정 설정값 조회
    async getSetting(key: string): Promise<string | null> {
        try {
            const [rows] = await db.execute(
                'SELECT setting_value FROM system_settings WHERE setting_key = ?',
                [key]
            ) as any
            return rows.length > 0 ? rows[0].setting_value : null
        } catch (error) {
            console.error(`설정 조회 실패 (${key}):`, error)
            return null
        }
    }

    // 모든 설정 조회
    async getAllSettings(): Promise<any[]> {
        try {
            const [rows] = await db.execute('SELECT * FROM system_settings') as any
            return rows
        } catch (error) {
            console.error('전체 설정 조회 실패:', error)
            return []
        }
    }

    // 설정값 업데이트 (관리자 기능 지원을 위해 필요 - 빌드 오류 방지용 구현)
    async updateSetting(key: string, value: any, userId: string): Promise<void> {
        // 값이 객체라면 JSON 문자열로, 문자열이라면 그대로 저장
        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value)

        await db.execute(
            `INSERT INTO system_settings (setting_key, setting_value, updated_by, updated_at) 
       VALUES (?, ?, ?, NOW()) 
       ON DUPLICATE KEY UPDATE 
       setting_value = VALUES(setting_value), 
       updated_by = VALUES(updated_by),
       updated_at = NOW()`,
            [key, stringValue, userId]
        )
    }
}
