/**
 * electron-builder afterPack hook
 * - 네이티브 모듈(ant-plus-next, node-hid, usb)을 Electron 버전에 맞게 재빌드
 * - 중요: electron-rebuild 옵션
 *   - -m / --module-dir 는 "모듈 디렉토리(node_modules가 있는 경로)" 이지 모듈 이름이 아니다.
 *   - 모듈 지정은 -w/--which-module(여러 번)로 한다.
 */

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

function resolveElectronVersion(appDir) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf-8'))
    return (
      (pkg.devDependencies && pkg.devDependencies.electron) ||
      (pkg.dependencies && pkg.dependencies.electron) ||
      null
    )
  } catch {
    return null
  }
}

function resolveArchName(arch) {
  // electron-builder Arch enum (number) → string
  // 일반적으로 1=x64, 0=ia32, 3=arm64
  if (typeof arch === 'string') return arch
  const map = {
    0: 'ia32',
    1: 'x64',
    2: 'armv7l',
    3: 'arm64'
  }
  return map[arch] || 'x64'
}

module.exports = async function (context) {
  const { appOutDir, electronPlatformName } = context
  const appDir = (context && context.packager && context.packager.projectDir) ? context.packager.projectDir : undefined

  const nativeModules = ['ant-plus-next', 'node-hid', 'usb']

  try {
    if (!appDir) {
      throw new Error('afterPack context.packager.projectDir(appDir)을 찾을 수 없습니다')
    }

    const electronVersion =
      (context.packager && context.packager.electronVersion) ||
      context.electronVersion ||
      resolveElectronVersion(appDir) ||
      '28.0.0'
    const archName = resolveArchName(context.arch)

    // -m: 모듈 디렉토리(node_modules가 있는 경로)
    // -w: 재빌드할 모듈(단일 string, 콤마로 나열) — electron-rebuild CLI가 배열을 처리 못함
    const which = nativeModules.join(',')
    const rebuildCmd = `npx electron-rebuild -v ${electronVersion} -a ${archName} -m "${appDir}" -w "${which}"`

    console.log('🔧 네이티브 모듈 재빌드 시작...')
    console.log(`📦 플랫폼: ${electronPlatformName}`)
    console.log(`📂 appDir: ${appDir}`)
    console.log(`📂 appOutDir: ${appOutDir}`)
    console.log(`⚡ Electron 버전: ${electronVersion}, 아키텍처: ${archName}`)
    console.log(`🔨 실행: ${rebuildCmd}`)

    execSync(rebuildCmd, {
      cwd: appDir,
      stdio: 'inherit'
    })

    console.log('✅ 네이티브 모듈 재빌드 완료')
  } catch (error) {
    console.error('❌ 네이티브 모듈 재빌드 실패:', error && error.message ? error.message : String(error))
    console.error('⚠️ 앱이 정상적으로 동작하지 않을 수 있습니다 (설치형 배포 전 반드시 해결 필요)')
    throw error // 설치형 배포 품질을 위해 빌드를 실패로 처리
  }
}
