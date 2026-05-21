import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      jsxRuntime: 'automatic',
    }),
    // 개발 환경에서는 HTTP 사용 (Electron 앱이 HTTP 모드일 때)
    // 운영 환경에서는 HTTPS 사용
    ...(mode === 'production' ? [basicSsl()] : [])
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  define: {
    // 프로덕션 빌드 시 환경 변수 설정
    'import.meta.env.VITE_API_URL': mode === 'production' 
      ? JSON.stringify('/api')  // 프로덕션: 상대 경로 (같은 서버)
      : JSON.stringify('http://127.0.0.1:3001/api')  // 개발: localhost
  },
  server: {
    port: 3006,
    strictPort: true,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  // @ts-ignore - vitest config
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
}))