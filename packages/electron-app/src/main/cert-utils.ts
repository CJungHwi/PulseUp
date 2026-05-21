import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as crypto from 'crypto'
import { app } from 'electron'
import { execFileSync } from 'child_process'
import selfsigned from 'selfsigned'

export class CertUtils {
    /**
     * 인증서는 설치 경로(Program Files 등, 읽기 전용일 수 있음)가 아니라
     * 항상 userData(쓰기 가능)에 저장한다.
     * - HTTPS 브라우저 접근(인증서 신뢰) + IP 변경 시 재생성까지 고려
     */
    private static getCertDir(): string {
        try {
            const dir = path.join(app.getPath('userData'), 'linkhiit-cert')
            fs.mkdirSync(dir, { recursive: true })
            return dir
        } catch {
            // electron 초기화 전이거나 예외 상황: 홈 폴더로 폴백
            const fallback = path.join(os.homedir(), '.linkhiit', 'cert')
            fs.mkdirSync(fallback, { recursive: true })
            return fallback
        }
    }

    public static getKeyPath(): string {
        return path.join(this.getCertDir(), 'server.key')
    }

    public static getCertPath(): string {
        return path.join(this.getCertDir(), 'server.crt')
    }

    private static getHashPath(): string {
        return path.join(this.getCertDir(), 'server.hash')
    }

    private static getTrustMarkerPath(): string {
        return path.join(this.getCertDir(), 'cert-trust.json')
    }

    /**
     * 현재 PC의 모든 IPv4 주소를 수집합니다.
     */
    public static getLocalIPAddresses(): string[] {
        const addresses = ['127.0.0.1', 'localhost']
        const networkInterfaces = os.networkInterfaces()

        for (const name in networkInterfaces) {
            const interfaces = networkInterfaces[name]
            if (!interfaces) continue

            for (const iface of interfaces) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    addresses.push(iface.address)
                }
            }
        }

        return addresses
    }

    /**
     * 인증서가 유효한지(현재 IP들을 포함하고 있는지) 확인하고, 필요하면 재생성합니다.
     */
    public static ensureValidCertificate(): boolean {
        try {
            const currentIPs = this.getLocalIPAddresses()
            const currentHash = crypto.createHash('sha256').update(JSON.stringify([...currentIPs].sort())).digest('hex')

            const keyPath = this.getKeyPath()
            const certPath = this.getCertPath()
            const hashPath = this.getHashPath()

            const hasExisting = fs.existsSync(keyPath) && fs.existsSync(certPath) && fs.existsSync(hashPath)
            const prevHash = hasExisting ? String(fs.readFileSync(hashPath, 'utf8') || '').trim() : ''

            if (!hasExisting || prevHash !== currentHash) {
                const ok = this.generateCertificate(currentIPs)
                if (!ok) return false
                fs.writeFileSync(hashPath, currentHash)
                console.log('✅ SSL 인증서 생성/갱신 완료')
            } else {
                console.log('✅ 기존 SSL 인증서가 유효합니다. (현재 IP들 포함됨)')
            }

            // Windows: 브라우저 경고 제거를 위한 자동 신뢰 등록(현재 사용자 Root)
            this.tryInstallCertToWindowsUserRoot(certPath)
            return true
        } catch (error) {
            console.error('❌ 인증서 유효성 검사 중 오류 발생:', error)
            return false
        }
    }

    /**
     * 새로운 Self-signed 인증서를 생성합니다.
     */
    private static generateCertificate(ips: string[]): boolean {
        try {
            //console.log('인증서에 포함될 주소:', ips)

            const altNames = ips.map(ip => {
                if (ip === 'localhost') return { type: 2, value: 'localhost' }
                return { type: 7, ip: ip }
            })

            const attrs = [{ name: 'commonName', value: 'LINKHIIT-Local-Server' }]
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

            fs.writeFileSync(this.getKeyPath(), pems.private)
            fs.writeFileSync(this.getCertPath(), pems.cert)

            //console.log('✅ SSL 인증서 자동 생성 완료')
            return true
        } catch (error) {
            console.error('❌ SSL 인증서 생성 실패:', error)
            return false
        }
    }

    /**
     * Windows에서 브라우저 인증서 경고를 제거하기 위해
     * 현재 사용자 Root 저장소에 self-signed cert를 자동 등록 시도한다.
     * - 관리자 권한 불필요(현재 사용자 스토어)
     * - 실패해도 앱 동작은 계속 (경고만 노출)
     */
    private static tryInstallCertToWindowsUserRoot(certPath: string) {
        if (process.platform !== 'win32') return
        try {
            if (!fs.existsSync(certPath)) return

            const certPem = fs.readFileSync(certPath, 'utf8')
            const fingerprint = crypto.createHash('sha256').update(certPem).digest('hex')

            // 동일 cert에 대해 이미 등록 시도 성공했으면 스킵
            try {
                const markerPath = this.getTrustMarkerPath()
                if (fs.existsSync(markerPath)) {
                    const parsed = JSON.parse(fs.readFileSync(markerPath, 'utf8') || '{}') as any
                    if (parsed?.installed === true && parsed?.fingerprint === fingerprint) return
                }
            } catch {
                // ignore
            }

            execFileSync('certutil', ['-user', '-addstore', '-f', 'Root', certPath], { stdio: 'ignore' })

            try {
                fs.writeFileSync(this.getTrustMarkerPath(), JSON.stringify({
                    installed: true,
                    fingerprint,
                    at: new Date().toISOString()
                }, null, 2))
            } catch {
                // ignore
            }

            console.log('✅ (Windows) 브라우저용 인증서 신뢰 등록 완료 (현재 사용자)')
        } catch (error) {
            console.warn('⚠️ (Windows) 인증서 신뢰 등록 실패(수동 등록 필요):', error instanceof Error ? error.message : error)
        }
    }
}
