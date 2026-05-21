import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    testTimeout: 30000, // 30초 타임아웃
    hookTimeout: 30000,
    teardownTimeout: 30000,
    pool: 'forks', // 테스트 격리를 위해 forks 사용
    poolOptions: {
      forks: {
        singleFork: true // 데이터베이스 테스트를 위해 단일 프로세스 사용
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/tests/',
        'dist/',
        '**/*.d.ts'
      ]
    }
  }
})