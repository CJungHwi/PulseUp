import mysql from 'mysql2/promise'
import { config } from 'dotenv'

config()

// 데이터베이스 연결 풀 설정
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'workout_system',
  charset: 'utf8mb4',
  timezone: '+09:00', // 한국 시간대 (KST, UTC+9) 설정
  // BIGINT 등이 BigInt로 오면 res.json 직렬화 시 500이 날 수 있음 → 문자열로 수신
  supportBigNumbers: true,
  bigNumberStrings: true,
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
  multipleStatements: true
})

// 데이터베이스 연결 테스트
export async function testConnection(): Promise<boolean> {
  try {
    const connection = await pool.getConnection()
    await connection.ping()
    connection.release()
    //console.log('✅ MariaDB 연결 성공')
    return true
  } catch (error) {
    console.error('❌ MariaDB 연결 실패:', error)
    return false
  }
}

// 저장 프로시저 실행 헬퍼 함수
export async function callProcedure(
  procedureName: string,
  params: any[] = []
): Promise<any> {
  const connection = await pool.getConnection()

  try {
    const placeholders = params.map(() => '?').join(', ')
    const query = `CALL ${procedureName}(${placeholders})`

    const [results] = await connection.execute(query, params)
    return results
  } catch (error) {
    console.error(`프로시저 ${procedureName} 실행 오류:`, error)
    throw error
  } finally {
    connection.release()
  }
}

// 일반 쿼리 실행 헬퍼 함수
export async function executeQuery(
  query: string,
  params: any[] = []
): Promise<any> {
  const connection = await pool.getConnection()

  try {
    const [results] = await connection.execute(query, params)
    return results
  } catch (error) {
    console.error('쿼리 실행 오류:', error)
    throw error
  } finally {
    connection.release()
  }
}

// 트랜잭션 실행 헬퍼 함수
export async function executeTransaction(
  operations: ((connection: mysql.Connection) => Promise<any>)[]
): Promise<any[]> {
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const results = []
    for (const operation of operations) {
      const result = await operation(connection)
      results.push(result)
    }

    await connection.commit()
    return results
  } catch (error) {
    await connection.rollback()
    console.error('트랜잭션 실행 오류:', error)
    throw error
  } finally {
    connection.release()
  }
}

// 연결 풀 종료
export async function closePool(): Promise<void> {
  await pool.end()
  //console.log('데이터베이스 연결 풀이 종료되었습니다')
}

// Named export 추가
export { pool }

export default pool