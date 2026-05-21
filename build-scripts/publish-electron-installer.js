/**
 * Electron 윈도우 설치 파일을 web-app 다운로드 경로로 복사
 * - source: packages/electron-app/dist-electron/LINKHIIT Workout System Setup.exe
 * - target: packages/web-app/public/downloads/LINKHIIT Setup.exe
 *
 * 사용:
 *  node build-scripts/publish-electron-installer.js
 */
const fs = require('fs')
const path = require('path')

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function copyFile(src, dst) {
  ensureDir(path.dirname(dst))
  fs.copyFileSync(src, dst)
  const st = fs.statSync(dst)
  console.log(`✅ copied: ${src} -> ${dst} (${st.size} bytes)`)
}

function main() {
  const root = path.join(__dirname, '..')
  const src = path.join(root, 'packages', 'electron-app', 'dist-electron', 'LINKHIIT Workout System Setup.exe')
  const dst1 = path.join(root, 'packages', 'web-app', 'public', 'downloads', 'LINKHIIT Setup.exe')
  const dst2 = path.join(root, 'packages', 'web-app', 'dist', 'downloads', 'LINKHIIT Setup.exe')

  if (!fs.existsSync(src)) {
    console.error('❌ installer not found:', src)
    process.exit(1)
  }

  copyFile(src, dst1)
  // web-app dist가 존재하면 같이 갱신(로컬 검증/배포 편의)
  if (fs.existsSync(path.dirname(dst2))) {
    try {
      copyFile(src, dst2)
    } catch {
      // ignore
    }
  }
}

main()





