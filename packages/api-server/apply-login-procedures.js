import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import mysql from 'mysql2/promise'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 데이터베이스 연결 설정
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'workout_system',
    multipleStatements: true
}

async function applyLoginProcedures() {
    let connection

    try {
        //console.log('🔗 데이터베이스 연결 중...')
        connection = await mysql.createConnection(dbConfig)
        //console.log('✅ 데이터베이스 연결 성공')

        // 모든 프로시저는 이제 packages/api-server/database/procedures.sql에서 관리됩니다.
        // 하드코딩된 SQL 블록은 제거되었습니다.
        console.log('📋 로그인 관련 프로시저 상태 확인 중...')

        // 프로시저 생성 확인
        const [procedures] = await connection.execute(`
      SHOW PROCEDURE STATUS WHERE Db = '${dbConfig.database}' 
      AND (Name LIKE 'sp_%user%' OR Name LIKE 'sp_%login%' OR Name LIKE 'sp_%session%')
    `)

        // console.log('📋 현재 데이터베이스에 등록된 로그인 관련 프로시저 목록:')
        // procedures.forEach(proc => {
        //     console.log(`- ${proc.Name}: ${proc.Comment || '로그인 관련 프로시저'}`)
        // })

        // console.log('\n🎉 프로시저 확인 완료!')
        // console.log('� 새로운 프로시저를 적용하려면 database/procedures.sql을 실행하세요.')

    } catch (error) {
        console.error('❌ 프로시저 확인 중 오류 발생:', error)
        throw error
    } finally {
        if (connection) {
            await connection.end()
            //console.log('\n🔌 데이터베이스 연결 종료')
        }
    }
}

// 스크립트 실행
applyLoginProcedures().catch(console.error)