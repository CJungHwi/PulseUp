import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as crypto from 'crypto'
import { app } from 'electron'

interface DeviceConfig {
  deviceId: string
  deviceToken: string | null
  displayLabel: string | null
  storeId: number | null
  registeredAt: string | null
}

export class DeviceManager {
  private configPath: string
  private config: DeviceConfig

  constructor() {
    // 설정 파일 경로 (userData 디렉토리에 저장)
    const userDataDir = app.isPackaged 
      ? app.getPath('userData')
      : path.join(os.homedir(), '.linkhiit-electron')
    
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true })
    }
    
    this.configPath = path.join(userDataDir, 'device-config.json')
    this.config = this.loadConfig()
  }

  /**
   * 설정 파일 로드
   */
  private loadConfig(): DeviceConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8')
        const parsed = JSON.parse(data)
        
        // deviceId가 없으면 새로 생성
        if (!parsed.deviceId) {
          parsed.deviceId = this.generateDeviceId()
          this.saveConfig(parsed)
        }
        
        return parsed
      }
    } catch (error) {
      console.error('디바이스 설정 로드 실패:', error)
    }

    // 기본 설정 생성
    const defaultConfig: DeviceConfig = {
      deviceId: this.generateDeviceId(),
      deviceToken: null,
      displayLabel: null,
      storeId: null,
      registeredAt: null
    }
    
    this.saveConfig(defaultConfig)
    return defaultConfig
  }

  /**
   * 설정 파일 저장
   */
  private saveConfig(config: DeviceConfig): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8')
    } catch (error) {
      console.error('디바이스 설정 저장 실패:', error)
    }
  }

  /**
   * 고유한 deviceId 생성
   * - hostname + MAC 주소 + CPU 정보를 조합하여 해시
   * - 동일 PC에서는 항상 같은 값 반환
   */
  private generateDeviceId(): string {
    const hostname = os.hostname()
    const cpuModel = os.cpus()[0]?.model || 'unknown-cpu'
    const totalMem = os.totalmem().toString()
    
    // MAC 주소 가져오기 (첫 번째 비-내부 인터페이스)
    let macAddress = 'no-mac'
    const networkInterfaces = os.networkInterfaces()
    for (const [name, interfaces] of Object.entries(networkInterfaces)) {
      if (interfaces) {
        for (const iface of interfaces) {
          if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
            macAddress = iface.mac
            break
          }
        }
      }
      if (macAddress !== 'no-mac') break
    }

    // 조합하여 해시 생성
    const combined = `${hostname}|${macAddress}|${cpuModel}|${totalMem}`
    const hash = crypto.createHash('sha256').update(combined).digest('hex')
    
    // 앞 16자리만 사용
    return hash.substring(0, 16)
  }

  /**
   * deviceId 반환
   */
  getDeviceId(): string {
    return this.config.deviceId
  }

  /**
   * deviceToken 반환
   */
  getDeviceToken(): string | null {
    return this.config.deviceToken
  }

  /**
   * 등록 여부 확인
   */
  isRegistered(): boolean {
    return this.config.deviceToken !== null
  }

  /**
   * 디바이스 등록 정보 저장
   */
  setRegistration(data: {
    deviceToken: string
    displayLabel?: string
    storeId?: number
  }): void {
    this.config.deviceToken = data.deviceToken
    this.config.displayLabel = data.displayLabel || null
    this.config.storeId = data.storeId || null
    this.config.registeredAt = new Date().toISOString()
    this.saveConfig(this.config)
    
    console.log('✅ 디바이스 등록 정보 저장됨:', {
      deviceId: this.config.deviceId,
      displayLabel: this.config.displayLabel,
      storeId: this.config.storeId
    })
  }

  /**
   * 등록 정보 초기화 (연결 해제)
   */
  clearRegistration(): void {
    this.config.deviceToken = null
    this.config.displayLabel = null
    this.config.storeId = null
    this.config.registeredAt = null
    this.saveConfig(this.config)
    
    console.log('🔌 디바이스 등록 정보 초기화됨')
  }

  /**
   * 현재 설정 반환
   */
  getConfig(): DeviceConfig {
    return { ...this.config }
  }

  /**
   * 표시 이름 반환
   * '디바이스' 또는 null/빈값은 '링크힛'으로 표시
   */
  getDisplayLabel(): string {
    const lbl = this.config.displayLabel
    if (lbl && lbl !== '디바이스') return lbl
    return '링크힛'
  }
}
