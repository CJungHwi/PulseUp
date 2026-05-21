/**
 * Self-signed SSL 인증서 생성 스크립트
 * 로컬 개발 및 Electron 앱용 HTTPS 서버에 사용
 * localhost와 네트워크 IP(192.168.x.x) 모두 지원
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

const CERT_DIR = path.join(__dirname, '..', 'cert')
const KEY_FILE = path.join(CERT_DIR, 'server.key')
const CERT_FILE = path.join(CERT_DIR, 'server.crt')

// 네트워크 인터페이스에서 IPv4 주소 수집
function getLocalIPAddresses() {
    const addresses = ['127.0.0.1']
    const networkInterfaces = os.networkInterfaces()

    for (const name in networkInterfaces) {
        const interfaces = networkInterfaces[name]
        if (!interfaces) continue

        for (const iface of interfaces) {
            // IPv4이고 내부 주소가 아닌 것
            if (iface.family === 'IPv4' && !iface.internal) {
                addresses.push(iface.address)
            }
        }
    }

    return addresses
}

// selfsigned 패키지로 인증서 생성
function generateWithSelfsigned() {
    try {
        const selfsigned = require('selfsigned')
        const ipAddresses = getLocalIPAddresses()

        //console.log('인증서에 포함될 IP 주소:', ipAddresses)

        // Subject Alternative Names 생성
        const altNames = [
            { type: 2, value: 'localhost' }, // DNS
        ]

        // 모든 IP 주소 추가
        ipAddresses.forEach(ip => {
            altNames.push({ type: 7, ip: ip }) // IP
        })

        const attrs = [{ name: 'commonName', value: 'localhost' }]
        const pems = selfsigned.generate(attrs, {
            keySize: 2048,
            days: 365,
            algorithm: 'sha256',
            extensions: [
                {
                    name: 'subjectAltName',
                    altNames: altNames
                }
            ]
        })

        fs.writeFileSync(KEY_FILE, pems.private)
        fs.writeFileSync(CERT_FILE, pems.cert)

        //console.log('SSL 인증서 생성 완료 (selfsigned 사용)')
        //console.log('  Private Key:', KEY_FILE)
        //console.log('  Certificate:', CERT_FILE)
        return true
    } catch (error) {
        console.log('selfsigned 패키지 사용 불가:', error.message)
        return false
    }
}

// 메인 실행
function main() {
    // 인증서 디렉토리 생성
    if (!fs.existsSync(CERT_DIR)) {
        fs.mkdirSync(CERT_DIR, { recursive: true })
        //console.log('인증서 디렉토리 생성:', CERT_DIR)    
    }

    // 인증서가 이미 있으면 스킵 (강제 재생성 옵션: --force)
    if (fs.existsSync(KEY_FILE) && fs.existsSync(CERT_FILE) && !process.argv.includes('--force')) {
        //console.log('SSL 인증서가 이미 존재합니다. 재생성하려면 --force 옵션을 사용하세요.')
        process.exit(0)
    }

    //console.log('Self-signed SSL 인증서 생성 중...')

    if (generateWithSelfsigned()) {
        //console.log('인증서 생성 성공!')
    } else {
        console.error('인증서 생성 실패. selfsigned 패키지를 설치해주세요: npm install selfsigned')
        process.exit(1)
    }
}

main()
