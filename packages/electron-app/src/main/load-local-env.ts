import * as path from 'path'
import dotenv from 'dotenv'

/**
 * `packages/electron-app/.env` — 로컬 전용(gitignore).
 * 빌드 산출물 기준 `dist/main/main/*.js` → 패키지 루트는 `../../../`.
 * 이미 설정된 process.env는 덮어쓰지 않음(dotenv 기본).
 */
dotenv.config({
  path: path.resolve(__dirname, '../../../.env'),
})
