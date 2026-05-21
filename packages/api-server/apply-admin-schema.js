import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { executeQuery } from './src/lib/database.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function applyAdminSchema() {
  try {
    console.log('관리자 스키마 확장을 적용합니다...')

    // SQL 파일 읽기
    const sqlFile = path.join(__dirname, 'database', 'admin-schema-extension.sql')
    const sqlContent = fs.readFileSync(sqlFile, 'utf8')

    // SQL 문을 세미콜론으로 분리
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('USE'))

    //console.log(`${statements.length}개의 SQL 문을 실행합니다...`)

    // 각 SQL 문 실행
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.trim()) {
        try {
          //console.log(`실행 중 (${i + 1}/${statements.length}): ${statement.substring(0, 50)}...`)
          await executeQuery(statement)
          //console.log(`✓ 완료`)
        } catch (error) {
          if (error.message.includes('Duplicate column name') ||
            error.message.includes('already exists') ||
            error.message.includes('Duplicate entry')) {
            //console.log(`⚠ 이미 존재함: ${error.message}`)
          } else {
            console.error(`✗ 오류: ${error.message}`)
            throw error
          }
        }
      }
    }

    //console.log('✅ 관리자 스키마 확장이 성공적으로 적용되었습니다!')

  } catch (error) {
    console.error('❌ 스키마 적용 중 오류 발생:', error)
    process.exit(1)
  }
}

applyAdminSchema()