import * as Ant from 'ant-plus-next'

import {
  cleanupGarminStickRef,
  getAntStickVariants,
  initializeGarminStickSession,
  logAntUsbDiagnostics
} from './ant-garmin-stick-init'
import type { HeartRateAntDiagnostics, HeartRateAntState } from './diagnostics-types'

/**
 * ANT+ 심박수 센서 연결을 관리하는 매니저
 * USB ANT+ 동글을 사용하여 최대 20대의 심박계를 동시에 연결
 */

interface HeartRateDevice {
  slotNumber: number
  deviceId: number
  sensor: Ant.HeartRateSensor | null
  currentHeartRate: number
  isConnected: boolean
  deviceName: string
  lastUpdate: number
}

interface HeartRateCallback {
  (slotNumber: number, heartRate: number): void
}

interface ConnectionStatusCallback {
  (slotNumber: number, isConnected: boolean, deviceName: string, meta?: {
    reason?: string
    lastUpdate?: number
    secondsSinceLastUpdate?: number
    reconnecting?: boolean
    reconnectExpiresInSec?: number | null
  }): void
}

type GarminUsbStick = Ant.GarminStick2 | Ant.GarminStick3

export class HeartRateANTManager {
  private stick: GarminUsbStick | null = null
  private devices: Map<number, HeartRateDevice> = new Map()
  private scanners: Ant.HeartRateScanner[] = []
  private onHeartRateUpdate: HeartRateCallback | null = null
  private onConnectionStatusChange: ConnectionStatusCallback | null = null
  private isInitialized: boolean = false
  private connectionCheckInterval: NodeJS.Timeout | null = null
  private readonly GRACE_PERIOD = 60000 // 60초 grace period — 해제 후에도 deviceId 기억하여 자동 재연결
  /** 최근 연결 해제된 기기 기억 (slotNumber → { deviceId, disconnectedAt }) */
  private recentlyDisconnected: Map<number, { deviceId: number; disconnectedAt: number }> = new Map()
  /** USB shutdown 자동 재초기화 진행 중인지 여부(중복 트리거 방지) */
  private isAutoRestarting = false
  private readonly AUTO_RESTART_COOLDOWN_MS = 5000
  private antState: HeartRateAntState = 'initializing'
  private lastError: string | null = null

  /** ant-garmin-stick-init의 'read' 콜백이 갱신하는 마지막 USB 수신 시각(ms). 0=아직 한 번도 못 받음. */
  private lastUsbReadAt = 0
  /** USB 워치독이 한 사이클 안에서 중복 트리거되지 않도록 가드 */
  private usbWatchdogTripped = false
  /** 슬롯별 최근 verbose 로그 시각(ms) — `getVerboseLogIntervalMs` 마다 한 줄씩 찍는다 */
  private lastVerboseLogAt: Map<number, number> = new Map()

  /** 기본 30초. `LINKHIIT_ANT_STALE_MS`(15000~120000)로 현장 조정 가능 */
  private getStaleTimeoutMs(): number {
    const raw = (process.env.LINKHIIT_ANT_STALE_MS || '').trim()
    const n = parseInt(raw, 10)
    if (Number.isFinite(n) && n >= 15000 && n <= 120000) return n
    return 30000
  }

  /**
   * USB bulk 'read' 무수신 워치독 임계(ms).
   * - 기본 60초. `LINKHIIT_ANT_USB_WATCHDOG_MS`(15000~600000)로 조정.
   * - `0` 또는 음수, `off`/`false`/`disabled`로 설정 시 워치독 비활성화.
   *
   * LIBUSB_TRANSFER_STALL 같이 라이브러리가 'shutdown'/'error'를 띄우지 않고
   * 조용히 죽는 경우를 잡아내기 위한 안전장치.
   */
  private getUsbWatchdogMs(): number {
    const raw = (process.env.LINKHIIT_ANT_USB_WATCHDOG_MS || '').trim().toLowerCase()
    if (['0', 'off', 'false', 'disabled', 'no'].includes(raw)) return 0
    const n = parseInt(raw, 10)
    if (Number.isFinite(n) && n >= 15000 && n <= 600000) return n
    return 60000
  }

  /** 슬롯별 verbose BPM 로그 간격(ms). `LINKHIIT_ANT_LOG_INTERVAL_MS`(5000~300000)로 조정. */
  private getVerboseLogIntervalMs(): number {
    const raw = (process.env.LINKHIIT_ANT_LOG_INTERVAL_MS || '').trim()
    const n = parseInt(raw, 10)
    if (Number.isFinite(n) && n >= 5000 && n <= 300000) return n
    return 30000
  }

  /** ISO 시각 포맷 (로그 가독성용) */
  private formatTs(ms: number): string {
    if (!ms) return '-'
    try {
      return new Date(ms).toISOString()
    } catch {
      return String(ms)
    }
  }

  constructor() {
    for (let i = 1; i <= 20; i++) {
      this.devices.set(i, {
        slotNumber: i,
        deviceId: 0,
        sensor: null,
        currentHeartRate: 0,
        isConnected: false,
        deviceName: '',
        lastUpdate: 0
      })
    }
    // initialize() 성공 시 startConnectionCheck()가 호출되므로 여기서는 시작하지 않는다.
  }

  /** 센서 콜백을 모두 제거하고 detach. 재연결 반복 시 listener 누수를 방지한다. */
  private async cleanupSensor(sensor: Ant.HeartRateSensor | null): Promise<void> {
    if (!sensor) return
    try {
      sensor.removeAllListeners()
    } catch {
      /* ignore */
    }
    try {
      await sensor.detach()
    } catch {
      /* ignore */
    }
  }

  private antStickDebugOptions(): Ant.DebugOptions | undefined {
    const v = (process.env.LINKHIIT_ANT_USB_DEBUG || '').trim().toLowerCase()
    if (['1', 'true', 'yes', 'y', 'on'].includes(v)) {
      return { usbDebugLevel: 1 }
    }
    return undefined
  }

  private getAntStartupTimeoutMs(): number {
    const raw = parseInt(process.env.LINKHIIT_ANT_STARTUP_TIMEOUT_MS || '30000', 10)
    const ms = Number.isFinite(raw) ? raw : 30000
    return Math.max(5000, ms)
  }

  private logAntInitFailure(): void {
    console.warn('⚠️ ANT+ 동글 초기화 실패 — 심박수 기능 없이 계속 실행합니다.')
  }

  /**
   * ANT+ USB 동글 초기화
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      console.log('✅ ANT+ 매니저가 이미 초기화되어 있습니다')
      return true
    }

    this.antState = 'initializing'
    this.lastError = null
    console.log('🔌 ANT+ USB 동글 초기화 중 (ant-plus-next 사용)...')
    console.log('📦 다른 ANT+ 프로그램(Garmin Express 등)이 종료되었는지 확인하세요')

    const variants = getAntStickVariants(process.env.LINKHIIT_ANT_STICK || 'auto', this.antStickDebugOptions())

    for (let i = 0; i < variants.length; i++) {
      if (i > 0) {
        console.log(`🔁 이전 동글 유형 실패 — ${variants[i].label} 로 재시도합니다...`)
      }
      const ok = await initializeGarminStickSession(variants[i].create, variants[i].label, {
        getStartupTimeoutMs: () => this.getAntStartupTimeoutMs(),
        getStick: () => this.stick,
        setStick: (s) => {
          this.stick = s
        },
        onUsbShutdown: () => {
          void this.handleUsbShutdown()
        },
        onUsbRead: () => {
          this.lastUsbReadAt = Date.now()
          this.usbWatchdogTripped = false
        }
      })
      if (ok) {
        this.isInitialized = true
        this.antState = 'ready'
        // 첫 'read' 가 들어오기 전이라도 워치독이 즉시 트리거되지 않도록 시드값을 둔다
        this.lastUsbReadAt = Date.now()
        this.usbWatchdogTripped = false
        this.lastVerboseLogAt.clear()
        const watchdogMs = this.getUsbWatchdogMs()
        console.log(
          `✅ ANT+ 매니저 초기화 완료 (stale=${this.getStaleTimeoutMs() / 1000}s, ` +
          `usbWatchdog=${watchdogMs > 0 ? `${watchdogMs / 1000}s` : 'OFF'}, ` +
          `verboseLog=${this.getVerboseLogIntervalMs() / 1000}s)`
        )
        this.startScanning()
        this.startConnectionCheck()
        return true
      }
    }

    console.error('❌ ANT+ 동글 초기화 실패 (시도한 USB 프로필에서 startup 미수신 또는 open 실패)')
    logAntUsbDiagnostics('모든 시도 실패 후')
    this.logAntInitFailure()
    this.antState = 'failed'
    this.lastError = 'ANT+ USB 동글을 열지 못했습니다. 동글 연결, WinUSB 드라이버, 다른 ANT 프로그램 점유 여부를 확인하세요.'
    return false
  }

  /**
   * USB 동글에서 'shutdown' 이벤트가 들어왔을 때 호출.
   * 진행 중인 자동 재시작이 없으면, 5초 쿨다운 후 1회 자동 재초기화한다.
   */
  private async handleUsbShutdown(): Promise<void> {
    if (this.isAutoRestarting) return
    this.isAutoRestarting = true
    try {
      console.warn('🔁 ANT+ 동글 shutdown 감지 — 모든 슬롯 정리 후 자동 재초기화 시도')
      await this.restart()
    } catch (err) {
      console.error('❌ ANT+ 자동 재초기화 실패:', err)
    } finally {
      this.isAutoRestarting = false
    }
  }

  /**
   * ANT+ 동글을 안전하게 종료한 뒤 재초기화한다.
   * shutdown 자동복구 외에도 외부에서 강제로 호출할 수 있다.
   */
  async restart(): Promise<boolean> {
    try {
      await this.shutdown()
    } catch (err) {
      console.warn('⚠️ ANT+ shutdown 중 오류(무시하고 재초기화 진행):', err)
    }
    await new Promise((resolve) => setTimeout(resolve, this.AUTO_RESTART_COOLDOWN_MS))
    const ok = await this.initialize()
    if (ok) {
      console.log('✅ ANT+ 자동 재초기화 성공')
    } else {
      console.error('❌ ANT+ 자동 재초기화 실패 — 수동 개입 필요')
    }
    return ok
  }

  /**
   * 심박수 업데이트 콜백 설정
   */
  setOnHeartRateUpdate(callback: HeartRateCallback) {
    this.onHeartRateUpdate = callback
  }

  /**
   * 연결 상태 변경 콜백 설정
   */
  setOnConnectionStatusChange(callback: ConnectionStatusCallback) {
    this.onConnectionStatusChange = callback
  }

  /**
   * 심박수 센서 스캔 시작
   * HeartRateScanner를 사용하여 모든 심박계 검색
   */
  startScanning(): void {
    if (!this.isInitialized || !this.stick) {
      console.error('❌ ANT+ 매니저가 초기화되지 않았습니다')
      return
    }

    console.log('🔍 심박수 센서 스캔 시작...')

    // HeartRateScanner 생성 (모든 심박계 검색)
    const scanner = new Ant.HeartRateScanner(this.stick)

    scanner.on('heartRateData', (data: any) => {
      const deviceId = data.DeviceID || data.DeviceId || 0
      const heartRate = data.ComputedHeartRate || 0

      if (deviceId === 0) return

      const isValidHeartRate = heartRate >= 20 && heartRate <= 250

      // 1순위: 이미 어느 슬롯에 연결되어 있으면 그 슬롯에서만 갱신하고 종료(중복 자동할당 방지)
      for (const [slotNumber, deviceSlot] of this.devices.entries()) {
        if (deviceSlot.isConnected && deviceSlot.deviceId === deviceId) {
          deviceSlot.lastUpdate = Date.now()
          if (isValidHeartRate) {
            deviceSlot.currentHeartRate = heartRate
          }
          if (this.onHeartRateUpdate) {
            this.onHeartRateUpdate(slotNumber, isValidHeartRate ? heartRate : 0)
          }
          return
        }
      }

      // 2순위: 최근 끊긴 deviceId면 원래 슬롯으로만 복원(다른 빈 슬롯으로 새지 않음)
      for (const [slotNumber, info] of this.recentlyDisconnected.entries()) {
        if (info.deviceId === deviceId) {
          const deviceSlot = this.devices.get(slotNumber)
          if (deviceSlot && !deviceSlot.isConnected) {
            deviceSlot.deviceId = deviceId
            deviceSlot.isConnected = true
            deviceSlot.deviceName = `HR-${deviceId}`
            deviceSlot.currentHeartRate = isValidHeartRate ? heartRate : 0
            deviceSlot.lastUpdate = Date.now()

            this.recentlyDisconnected.delete(slotNumber)
            console.log(`🔄 슬롯 ${slotNumber}에 Device ID ${deviceId} 자동 재연결 (이전 슬롯 복원)`)

            if (this.onConnectionStatusChange) {
              this.onConnectionStatusChange(slotNumber, true, deviceSlot.deviceName)
            }
            if (this.onHeartRateUpdate) {
              this.onHeartRateUpdate(slotNumber, isValidHeartRate ? heartRate : 0)
            }
          }
          // recentlyDisconnected에 등록된 deviceId는 복원 외 다른 슬롯에 할당하지 않는다.
          return
        }
      }

      // 3순위: 신규 deviceId만 빈 슬롯에 자동 할당
      // - 단, HR이 유효 범위(20~250) 안일 때만 등록한다. HR=0인 좀비 strap이 슬롯을 점유해
      //   실제 사용자의 strap이 빈 슬롯을 못 찾는 사고를 막기 위함.
      //   (스캐너는 동일 deviceId 패킷을 계속 수신하므로, 다음 유효 패킷에서 자연스럽게 등록된다.)
      if (!isValidHeartRate) {
        this.logZombieRejection(deviceId, heartRate)
        return
      }

      for (const [slotNumber, deviceSlot] of this.devices.entries()) {
        if (!deviceSlot.isConnected) {
          deviceSlot.deviceId = deviceId
          deviceSlot.isConnected = true
          deviceSlot.deviceName = `HR-${deviceId}`
          deviceSlot.currentHeartRate = heartRate
          deviceSlot.lastUpdate = Date.now()
          this.lastVerboseLogAt.set(slotNumber, Date.now())

          console.log(`✅ 슬롯 ${slotNumber}에 Device ID ${deviceId} 자동 연결 (HR: ${heartRate} BPM)`)

          if (this.onConnectionStatusChange) {
            this.onConnectionStatusChange(slotNumber, true, deviceSlot.deviceName)
          }
          if (this.onHeartRateUpdate) {
            this.onHeartRateUpdate(slotNumber, heartRate)
          }
          break
        }
      }
    })

    // 스캔 시작
    scanner.scan()
    console.log('✅ HeartRateScanner 활성화 완료')

    // Scanner 참조 저장 (나중에 정리용)
    this.scanners.push(scanner)
  }

  /** 유효하지 않은 HR(=좀비)로 자동연결을 거절했을 때 deviceId별로 최대 1회 로그 */
  private zombieRejectionLogged: Set<number> = new Set()
  private logZombieRejection(deviceId: number, heartRate: number): void {
    if (this.zombieRejectionLogged.has(deviceId)) return
    this.zombieRejectionLogged.add(deviceId)
    console.warn(
      `⚠️ Device ID ${deviceId} 자동 연결 보류 — HR=${heartRate} (유효 범위 20~250 밖). ` +
      '센서 접촉/배터리 확인. 유효 HR 패킷 도착 시 자동 연결됩니다.'
    )
  }

  /**
   * 연결 상태 체크 시작 (주기적으로 타임아웃 확인)
   */
  private startConnectionCheck(): void {
    // 기존 인터벌이 있으면 제거
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval)
    }

    this.connectionCheckInterval = setInterval(async () => {
      const now = Date.now()

      // grace period가 만료된 기억 항목 정리
      for (const [slotNumber, info] of this.recentlyDisconnected.entries()) {
        if (now - info.disconnectedAt > this.GRACE_PERIOD) {
          this.recentlyDisconnected.delete(slotNumber)
          console.log(
            `🕒 슬롯 ${slotNumber} grace period 만료 — Device ID ${info.deviceId} 자동 재연결 대기 종료`
          )
        }
      }

      const staleMs = this.getStaleTimeoutMs()
      for (const [slotNumber, deviceSlot] of this.devices.entries()) {
        if (!deviceSlot.isConnected) continue

        const timeSinceLastUpdate = now - deviceSlot.lastUpdate
        if (timeSinceLastUpdate <= staleMs) {
          this.maybeLogSlotHeartbeat(slotNumber, deviceSlot, now)
          continue
        }

        console.log(
          `❌ 슬롯 ${slotNumber} 연결 끊김 — ${Math.floor(timeSinceLastUpdate / 1000)}초 동안 데이터 없음 ` +
          `(lastUpdate=${this.formatTs(deviceSlot.lastUpdate)}, now=${this.formatTs(now)}, threshold=${staleMs / 1000}s)`
        )

        const deviceName = deviceSlot.deviceName
        const disconnectedDeviceId = deviceSlot.deviceId

        if (deviceSlot.sensor) {
          await this.cleanupSensor(deviceSlot.sensor)
        }

        // deviceId를 기억하여 자동 재연결 가능하게 함
        if (disconnectedDeviceId > 0) {
          this.recentlyDisconnected.set(slotNumber, {
            deviceId: disconnectedDeviceId,
            disconnectedAt: now,
          })
          console.log(`📝 슬롯 ${slotNumber}의 Device ID ${disconnectedDeviceId} 기억 (${this.GRACE_PERIOD / 1000}초간 자동 재연결 대기)`)
        }

        deviceSlot.deviceId = 0
        deviceSlot.isConnected = false
        deviceSlot.deviceName = ''
        deviceSlot.currentHeartRate = 0
        deviceSlot.lastUpdate = 0
        deviceSlot.sensor = null
        this.lastVerboseLogAt.delete(slotNumber)

        if (this.onConnectionStatusChange) {
          this.onConnectionStatusChange(slotNumber, false, deviceName, {
            reason: 'stale-timeout',
            lastUpdate: deviceSlot.lastUpdate,
            secondsSinceLastUpdate: Math.floor(timeSinceLastUpdate / 1000),
            reconnecting: disconnectedDeviceId > 0,
            reconnectExpiresInSec: disconnectedDeviceId > 0 ? Math.ceil(this.GRACE_PERIOD / 1000) : null,
          })
        }
      }

      // USB bulk 'read' 무수신 워치독 — LIBUSB_TRANSFER_STALL 등 라이브러리가
      // 'shutdown'/'error'를 띄우지 않고 조용히 죽는 케이스에 대한 안전망.
      this.checkUsbReadWatchdog(now)
    }, 5000) // 5초마다 체크 (3초 → 5초로 완화)
  }

  /**
   * 슬롯이 정상 수신 중인지 주기적으로 한 줄씩 로그로 남긴다.
   * `LINKHIIT_ANT_LOG_INTERVAL_MS`(기본 30초)마다 슬롯별 1회.
   */
  private maybeLogSlotHeartbeat(slotNumber: number, deviceSlot: HeartRateDevice, now: number): void {
    const intervalMs = this.getVerboseLogIntervalMs()
    const last = this.lastVerboseLogAt.get(slotNumber) || 0
    if (now - last < intervalMs) return
    this.lastVerboseLogAt.set(slotNumber, now)
    const ageSec = Math.max(0, Math.floor((now - deviceSlot.lastUpdate) / 1000))
    console.log(
      `💓 슬롯 ${slotNumber} ${deviceSlot.deviceName} ${deviceSlot.currentHeartRate} BPM ` +
      `(updated ${ageSec}s ago)`
    )
  }

  /**
   * USB 'read' 무수신 워치독.
   * - 마지막 USB read 이후 임계 시간(`LINKHIIT_ANT_USB_WATCHDOG_MS`, 기본 60초)이 지나면
   *   `handleUsbShutdown()`을 호출해 5초 쿨다운 뒤 자동 재초기화한다.
   * - `isAutoRestarting` 중이거나 한 사이클 내 이미 트립된 경우는 중복 트리거하지 않는다.
   */
  private checkUsbReadWatchdog(now: number): void {
    if (!this.isInitialized || this.isAutoRestarting || this.usbWatchdogTripped) return
    const watchdogMs = this.getUsbWatchdogMs()
    if (watchdogMs <= 0) return
    if (this.lastUsbReadAt <= 0) return

    const sinceLastReadMs = now - this.lastUsbReadAt
    if (sinceLastReadMs < watchdogMs) return

    this.usbWatchdogTripped = true
    console.error(
      `🚨 ANT+ USB 무수신 워치독 트립 — 마지막 read=${this.formatTs(this.lastUsbReadAt)} ` +
      `(${Math.floor(sinceLastReadMs / 1000)}초 경과 ≥ 임계 ${watchdogMs / 1000}초). 자동 재초기화 시도.`
    )
    void this.handleUsbShutdown()
  }

  /**
   * 특정 Device ID를 슬롯에 연결
   */
  async connectDevice(slotNumber: number, deviceId: number): Promise<boolean> {
    if (!this.isInitialized || !this.stick) {
      console.error('❌ ANT+ 매니저가 초기화되지 않았습니다')
      return false
    }

    if (slotNumber < 1 || slotNumber > 20) {
      console.error('❌ 슬롯 번호는 1~20 사이여야 합니다')
      return false
    }

    const deviceSlot = this.devices.get(slotNumber)
    if (!deviceSlot) {
      console.error('❌ 유효하지 않은 슬롯')
      return false
    }

    // 이미 연결된 경우
    if (deviceSlot.isConnected && deviceSlot.deviceId === deviceId) {
      console.log(`⚠️ 슬롯 ${slotNumber}은 이미 Device ID ${deviceId}에 연결되어 있습니다`)
      return true
    }

    try {
      console.log(`🔍 슬롯 ${slotNumber}에 Device ID ${deviceId} 연결 시도...`)

      // 기존 센서가 있으면 listener 누수 방지를 위해 완전 정리 후 새로 만든다
      if (deviceSlot.sensor) {
        await this.cleanupSensor(deviceSlot.sensor)
        deviceSlot.sensor = null
      }

      deviceSlot.sensor = new Ant.HeartRateSensor(this.stick)
      deviceSlot.sensor.on('heartRateData', (data: any) => {
        const heartRate = data.ComputedHeartRate || 0
        const isValid = heartRate >= 20 && heartRate <= 250

        deviceSlot.lastUpdate = Date.now()
        if (isValid) {
          deviceSlot.currentHeartRate = heartRate
        }
        if (this.onHeartRateUpdate) {
          this.onHeartRateUpdate(slotNumber, isValid ? heartRate : 0)
        }
      })

      // 특정 Device ID로 연결
      const channelNumber = slotNumber - 1
      await deviceSlot.sensor.attach(channelNumber, deviceId)

      deviceSlot.deviceId = deviceId
      deviceSlot.isConnected = true
      deviceSlot.deviceName = `HR-${deviceId}`
      // 연결 직후 첫 데이터 수신 전 stale 오판을 막기 위해 lastUpdate 시드
      deviceSlot.lastUpdate = Date.now()

      console.log(`✅ 슬롯 ${slotNumber}에 Device ID ${deviceId} 연결 완료`)

      // 연결 상태 콜백 호출
      if (this.onConnectionStatusChange) {
        this.onConnectionStatusChange(slotNumber, true, deviceSlot.deviceName)
      }

      return true

    } catch (error: any) {
      console.error(`❌ 슬롯 ${slotNumber} 연결 실패:`, error)
      return false
    }
  }

  /**
   * 특정 슬롯의 기기 연결 해제
   */
  async disconnectDevice(slotNumber: number): Promise<boolean> {
    if (slotNumber < 1 || slotNumber > 20) {
      console.error('❌ 슬롯 번호는 1~20 사이여야 합니다')
      return false
    }

    const deviceSlot = this.devices.get(slotNumber)
    if (!deviceSlot || !deviceSlot.isConnected) {
      console.log(`⚠️ 슬롯 ${slotNumber}은 연결되어 있지 않습니다`)
      return false
    }

    try {
      const deviceName = deviceSlot.deviceName

      // 센서 정리 (listener 제거 + detach)
      if (deviceSlot.sensor) {
        await this.cleanupSensor(deviceSlot.sensor)
        deviceSlot.sensor = null
        console.log(`🔌 슬롯 ${slotNumber} ANT+ 센서 정리 완료`)
      }

      // 기기 정보 초기화
      deviceSlot.deviceId = 0
      deviceSlot.isConnected = false
      deviceSlot.currentHeartRate = 0
      deviceSlot.deviceName = ''
      deviceSlot.lastUpdate = 0

      console.log(`✅ 슬롯 ${slotNumber} 연결 해제 완료`)

      // 연결 상태 콜백 호출
      if (this.onConnectionStatusChange) {
        this.onConnectionStatusChange(slotNumber, false, deviceName)
      }

      return true

    } catch (error) {
      console.error(`❌ 슬롯 ${slotNumber} 연결 해제 실패:`, error)
      return false
    }
  }

  /**
   * 특정 슬롯의 연결 상태 확인
   */
  isConnected(slotNumber: number): boolean {
    const deviceSlot = this.devices.get(slotNumber)
    return deviceSlot?.isConnected || false
  }

  /**
   * 특정 슬롯의 기기명 가져오기
   */
  getDeviceName(slotNumber: number): string {
    const deviceSlot = this.devices.get(slotNumber)
    return deviceSlot?.deviceName || ''
  }

  /**
   * 특정 슬롯의 현재 심박수 가져오기
   */
  getCurrentHeartRate(slotNumber: number): number {
    const deviceSlot = this.devices.get(slotNumber)
    return deviceSlot?.currentHeartRate || 0
  }

  /**
   * 특정 슬롯의 Device ID 가져오기
   */
  getDeviceId(slotNumber: number): number {
    const deviceSlot = this.devices.get(slotNumber)
    return deviceSlot?.deviceId || 0
  }

  /**
   * 모든 기기 연결 해제
   */
  async disconnectAll(): Promise<void> {
    console.log('🔌 모든 기기 연결 해제 중...')
    const promises: Promise<boolean>[] = []

    for (let i = 1; i <= 20; i++) {
      if (this.isConnected(i)) {
        promises.push(this.disconnectDevice(i))
      }
    }

    await Promise.all(promises)
    console.log('✅ 모든 기기 연결 해제 완료')
  }

  /**
   * 연결된 기기 수 가져오기
   */
  getConnectedDeviceCount(): number {
    let count = 0
    for (let i = 1; i <= 20; i++) {
      if (this.isConnected(i)) {
        count++
      }
    }
    return count
  }

  /**
   * ANT+ 동글 종료
   */
  async shutdown(): Promise<void> {
    console.log('🔌 ANT+ 매니저 종료 중...')

    // 연결 체크 인터벌 정리
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval)
      this.connectionCheckInterval = null
    }

    // 스캐너 정리 (restart 시 중복 등록 방지)
    for (const scanner of this.scanners) {
      try {
        scanner.removeAllListeners()
      } catch {
        /* ignore */
      }
      try {
        await scanner.detach()
      } catch {
        /* ignore */
      }
    }
    this.scanners = []

    // 모든 기기 연결 해제
    await this.disconnectAll()

    await cleanupGarminStickRef(
      () => this.stick,
      (s) => {
        this.stick = s
      }
    )

    this.isInitialized = false
    this.antState = 'disabled'
    this.lastUsbReadAt = 0
    this.usbWatchdogTripped = false
    this.lastVerboseLogAt.clear()
    this.zombieRejectionLogged.clear()
    console.log('✅ ANT+ 매니저 종료 완료')
  }

  /**
   * 저장된 기기 매핑 정보 로드
   */
  loadDeviceMapping(mapping: { [key: string]: number }) {
    console.log('📂 기기 매핑 로드:', mapping)

    Object.entries(mapping).forEach(([slotStr, deviceId]) => {
      const slotNumber = parseInt(slotStr, 10)
      const deviceSlot = this.devices.get(slotNumber)
      if (deviceSlot) {
        deviceSlot.deviceId = deviceId
      }
    })
  }

  /**
   * 저장된 모든 기기 자동 재연결
   */
  async reconnectAllSavedDevices(mapping: { [key: string]: number }): Promise<{ success: number; failed: number }> {
    if (!this.isInitialized) {
      console.error('❌ ANT+ 매니저가 초기화되지 않았습니다')
      return { success: 0, failed: 0 }
    }

    this.loadDeviceMapping(mapping)

    const slots = Object.keys(mapping).map(Number)
    console.log(`🔄 ${slots.length}개 기기 자동 재연결 시작...`)

    let success = 0
    let failed = 0

    for (const slotNumber of slots) {
      const deviceId = mapping[slotNumber.toString()]
      if (deviceId > 0) {
        const result = await this.connectDevice(slotNumber, deviceId)
        if (result) {
          success++
        } else {
          failed++
        }
        // 연결 간 약간의 딜레이
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    console.log(`✅ 자동 재연결 완료: 성공 ${success}개, 실패 ${failed}개`)
    return { success, failed }
  }

  /**
   * 모든 슬롯 정보 가져오기
   */
  getAllDevices(): Array<{
    slotNumber: number
    deviceId: number
    deviceName: string
    currentHeartRate: number
    isConnected: boolean
    lastUpdate: number
  }> {
    const devices: Array<any> = []

    this.devices.forEach((device) => {
      devices.push({
        slotNumber: device.slotNumber,
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        currentHeartRate: device.currentHeartRate,
        isConnected: device.isConnected,
        lastUpdate: device.lastUpdate
      })
    })

    return devices
  }

  /**
   * ANT+ 초기화 상태 확인
   */
  isReady(): boolean {
    return this.isInitialized && this.stick !== null
  }

  getDiagnostics(): HeartRateAntDiagnostics {
    const now = Date.now()
    const slots = Array.from(this.devices.values()).map((device) => {
      const reconnectInfo = this.recentlyDisconnected.get(device.slotNumber)
      const reconnectExpiresInSec = reconnectInfo
        ? Math.max(0, Math.ceil((this.GRACE_PERIOD - (now - reconnectInfo.disconnectedAt)) / 1000))
        : null

      return {
        slotNumber: device.slotNumber,
        state: device.isConnected ? 'connected' as const : reconnectInfo ? 'reconnecting' as const : 'empty' as const,
        deviceId: device.isConnected ? device.deviceId : reconnectInfo?.deviceId || 0,
        deviceName: device.deviceName,
        heartRate: device.currentHeartRate,
        lastUpdate: device.lastUpdate,
        secondsSinceLastUpdate: device.lastUpdate > 0 ? Math.floor((now - device.lastUpdate) / 1000) : null,
        reconnecting: !!reconnectInfo,
        reconnectExpiresInSec,
      }
    })

    return {
      state: this.antState,
      ready: this.isReady(),
      staleTimeoutMs: this.getStaleTimeoutMs(),
      gracePeriodMs: this.GRACE_PERIOD,
      lastError: this.lastError,
      slots,
    }
  }
}
