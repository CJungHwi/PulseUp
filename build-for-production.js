#!/usr/bin/env node

/**
 * 🚀 LINKHIIT 프로덕션 빌드 스크립트
 * 
 * 사용법:
 * node build-for-production.js [component]
 * 
 * component:
 * - web: 웹 애플리케이션만 빌드
 * - api: API 서버만 빌드  
 * - electron: Electron 앱만 빌드
 * - all: 모든 컴포넌트 빌드 (기본값)
 */

const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')

const component = process.argv[2] || 'all'

//console.log('🚀 LINKHIIT 프로덕션 빌드 시작...')
//console.log(`📦 빌드 대상: ${component}`)

function runCommand(command, cwd) {
  return new Promise((resolve, reject) => {
    //console.log(`\n▶️ 실행 중: ${command}`)
    //console.log(`📁 경로: ${cwd}`)

    const child = exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ 오류: ${error.message}`)
        reject(error)
        return
      }
      if (stderr) {
        console.warn(`⚠️ 경고: ${stderr}`)
      }
      console.log(`✅ 완료: ${command}`)
      resolve(stdout)
    })

    child.stdout.on('data', (data) => {
      process.stdout.write(data)
    })
  })
}

async function buildWeb() {
  //console.log('\n🌐 웹 애플리케이션 빌드 중...')
  await runCommand('npm install', './packages/web-app')
  await runCommand('npm run build', './packages/web-app')

  // 빌드 결과 확인
  const distPath = './packages/web-app/dist'
  if (fs.existsSync(distPath)) {
    //console.log('✅ 웹 애플리케이션 빌드 완료!')
    //console.log(`📁 빌드 파일 위치: ${path.resolve(distPath)}`)
  } else {
    throw new Error('웹 애플리케이션 빌드 실패')
  }
}

async function buildApi() {
  //console.log('\n🔌 API 서버 빌드 중...')
  await runCommand('npm install', './packages/api-server')
  await runCommand('npm run build', './packages/api-server')

  // 빌드 결과 확인
  const distPath = './packages/api-server/dist'
  if (fs.existsSync(distPath)) {
    //console.log('✅ API 서버 빌드 완료!')
    //console.log(`📁 빌드 파일 위치: ${path.resolve(distPath)}`)
  } else {
    throw new Error('API 서버 빌드 실패')
  }
}

async function buildElectron() {
  //console.log('\n📱 Electron 앱 빌드 중...')
  await runCommand('npm install', './packages/electron-app')
  await runCommand('npm run build', './packages/electron-app')
  await runCommand('npm run electron:pack', './packages/electron-app')

  // 빌드 결과 확인
  const distPath = './packages/electron-app/dist-electron'
  if (fs.existsSync(distPath)) {
    //console.log('✅ Electron 앱 빌드 완료!')
    //console.log(`📁 설치 파일 위치: ${path.resolve(distPath)}`)

    // 설치 파일 목록 표시
    const files = fs.readdirSync(distPath)
    const exeFiles = files.filter(f => f.endsWith('.exe'))
    if (exeFiles.length > 0) {
      //console.log('🎯 설치 파일:')
      exeFiles.forEach(file => {
        //console.log(`   📦 ${file}`)
      })
    }
  } else {
    throw new Error('Electron 앱 빌드 실패')
  }
}

async function createDeploymentPackage() {
  //console.log('\n📦 배포 패키지 생성 중...')

  const deploymentDir = './deployment'
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir)
  }

  // 배포 안내 파일 생성
  const readmeContent = `
# 🚀 LINKHIIT 배포 파키지

## 📋 포함된 파일들

### 1. 서버 배포용
- \`web-app/\` - 웹 애플리케이션 빌드 파일 (Nginx/Apache에 배포)
- \`api-server/\` - API 서버 빌드 파일 (Node.js 서버에 배포)

### 2. 클라이언트 배포용  
- \`electron-app/\` - Windows 설치 파일 (.exe)

## 🔧 배포 방법

### 서버 배포
1. 웹 애플리케이션: \`web-app/dist/\` 내용을 웹 서버에 업로드
2. API 서버: \`api-server/dist/\` 내용을 Node.js 서버에 배포

### 클라이언트 배포
1. 각 체육관에 .exe 파일 전달
2. 관리자 권한으로 설치 실행
3. 라이센스 키 입력

## 📞 지원
문의사항: support@linkhiit.com
`

  fs.writeFileSync(path.join(deploymentDir, 'README.md'), readmeContent)
  console.log('✅ 배포 패키지 생성 완료!')
}

async function main() {
  try {
    console.log('⏰ 빌드 시작 시간:', new Date().toLocaleString())

    if (component === 'web' || component === 'all') {
      await buildWeb()
    }

    if (component === 'api' || component === 'all') {
      await buildApi()
    }

    if (component === 'electron' || component === 'all') {
      await buildElectron()
    }

    if (component === 'all') {
      await createDeploymentPackage()
    }

    //console.log('\n🎉 모든 빌드 완료!')
    //console.log('⏰ 완료 시간:', new Date().toLocaleString())

    //console.log('\n📋 다음 단계:')
    //console.log('1. 서버에 웹앱과 API 배포')
    //console.log('2. 각 체육관에 Electron 앱 설치 파일 전달')
    //console.log('3. 라이센스 키 발급 및 등록')

  } catch (error) {
    console.error('\n❌ 빌드 실패:', error.message)
    process.exit(1)
  }
}

main()

