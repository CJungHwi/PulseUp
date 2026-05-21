import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 환경 변수 로드
dotenv.config()

async function runMigration() {
    let connection

    try {
        // 데이터베이스 연결
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'workout_system',
            multipleStatements: true
        })

        //console.log('데이터베이스에 연결되었습니다.')

        // 사용자 role 마이그레이션 실행
        const userRoleMigrationPath = join(__dirname, 'database', 'migrations', 'add_user_role.sql')
        const userRoleMigrationSQL = readFileSync(userRoleMigrationPath, 'utf8')

        //console.log('사용자 role 마이그레이션을 실행합니다...')
        await connection.execute(userRoleMigrationSQL)
        //console.log('사용자 role 마이그레이션이 완료되었습니다.')

        // 지점 데이터 마이그레이션 실행
        const branchMigrationPath = join(__dirname, 'database', 'migrations', 'add_sample_branches.sql')
        const branchMigrationSQL = readFileSync(branchMigrationPath, 'utf8')

        //console.log('지점 데이터 마이그레이션을 실행합니다...')
        const [results] = await connection.execute(branchMigrationSQL)
        //console.log('지점 데이터 마이그레이션이 완료되었습니다.')

        //console.log('모든 마이그레이션이 성공적으로 완료되었습니다.')
        //console.log('결과:', results)

    } catch (error) {
        console.error('마이그레이션 실행 중 오류가 발생했습니다:', error)
        process.exit(1)
    } finally {
        if (connection) {
            await connection.end()
            //console.log('데이터베이스 연결이 종료되었습니다.')
        }
    }
}

// 마이그레이션 실행
runMigration()