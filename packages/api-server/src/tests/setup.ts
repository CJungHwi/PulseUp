import { beforeAll, afterAll } from 'vitest'
import { executeQuery } from '../lib/database.js'

// 테스트 환경 설정
beforeAll(async () => {
  // 테스트용 환경 변수 설정
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only'

  // 테스트용 데이터베이스 테이블 확인 및 생성
  try {
    // 테스트에 필요한 기본 테이블들이 존재하는지 확인
    await executeQuery('SELECT 1 FROM users LIMIT 1')
    await executeQuery('SELECT 1 FROM user_activity_logs LIMIT 1')

    //console.log('✅ 테스트 데이터베이스 연결 성공')
  } catch (error) {
    console.error('❌ 테스트 데이터베이스 설정 오류:', error)
    throw error
  }
})

afterAll(async () => {
  // 테스트 후 정리 작업
  try {
    // 테스트 중 생성된 임시 데이터 정리
    await executeQuery('DELETE FROM user_activity_logs WHERE user_id IN (SELECT id FROM users WHERE userid LIKE "%test%" OR userid LIKE "%e2e%" OR userid LIKE "%security%")')
    await executeQuery('DELETE FROM users WHERE userid LIKE "%test%" OR userid LIKE "%e2e%" OR userid LIKE "%security%"')

    //console.log('✅ 테스트 데이터 정리 완료')
  } catch (error) {
    console.error('❌ 테스트 정리 중 오류:', error)
  }
})