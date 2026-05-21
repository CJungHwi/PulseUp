import { AuthService } from '../services/auth.service.js'
import { executeQuery } from '../lib/database.js'

/**
 * 기본 관리자 계정 생성 스크립트
 */
async function createDefaultAdmin() {
  try {
    //console.log('기본 관리자 계정을 생성합니다...')

    // 기존 관리자 계정 확인
    const existingAdmin = await executeQuery(
      'SELECT id FROM users WHERE userid = ? OR role = ?',
      ['admin', 'super_admin']
    )

    if (existingAdmin.length > 0) {
      console.log('⚠ 이미 관리자 계정이 존재합니다.')
      return
    }

    // 관리자 비밀번호 해시화
    const adminPassword = 'admin123!'
    const hashedPassword = await AuthService.hashPassword(adminPassword)

    // 관리자 계정 생성
    const result = await executeQuery(
      `INSERT INTO users (userid, name, password, role, created_at) 
       VALUES (?, ?, ?, ?, NOW())`,
      ['admin', '시스템 관리자', hashedPassword, 'super_admin']
    )

    if (result.affectedRows > 0) {
      //console.log('✅ 기본 관리자 계정이 성공적으로 생성되었습니다!')
      //console.log('   - 사용자 ID: admin')
      //console.log('   - 비밀번호: admin123!')
      //console.log('   - 역할: super_admin')
      //console.log('')
      //console.log('⚠ 보안을 위해 첫 로그인 후 비밀번호를 변경해주세요.')
    } else {
      console.log('❌ 관리자 계정 생성에 실패했습니다.')
    }

  } catch (error) {
    console.error('❌ 관리자 계정 생성 중 오류 발생:', error)
    process.exit(1)
  }
}

// 스크립트가 직접 실행될 때만 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  createDefaultAdmin()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Script execution failed:', error)
      process.exit(1)
    })
}

export { createDefaultAdmin }