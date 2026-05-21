import mysql from 'mysql2/promise'

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'linkhiit2024!',
  database: 'linkhiit_db',
  port: 3306
}

async function cleanupMenus() {
  let connection

  try {
    connection = await mysql.createConnection(dbConfig)
    //console.log('데이터베이스 연결 성공')

    // 중복된 메뉴 개수 확인
    const [countResult] = await connection.execute(
      "SELECT COUNT(*) as total FROM menus WHERE name = '사용자 대시보드'"
    )
    //console.log(`중복된 '사용자 대시보드' 메뉴 개수: ${countResult[0].total}`)

    // 가장 오래된 하나만 남기고 나머지 삭제
    const [deleteResult] = await connection.execute(`
      DELETE FROM menus 
      WHERE name = '사용자 대시보드' 
      AND id NOT IN (
        SELECT * FROM (
          SELECT id FROM menus 
          WHERE name = '사용자 대시보드' 
          ORDER BY created_at ASC 
          LIMIT 1
        ) as temp
      )
    `)

    //console.log(`삭제된 메뉴 개수: ${deleteResult.affectedRows}`)

    // 정리 후 개수 확인
    const [finalCount] = await connection.execute(
      "SELECT COUNT(*) as total FROM menus WHERE name = '사용자 대시보드'"
    )
    //console.log(`정리 후 '사용자 대시보드' 메뉴 개수: ${finalCount[0].total}`)

  } catch (error) {
    console.error('메뉴 정리 중 오류:', error)
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

cleanupMenus()

