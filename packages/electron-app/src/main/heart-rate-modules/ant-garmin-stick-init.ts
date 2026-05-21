import * as Ant from 'ant-plus-next'

/** Dynastream/Garmin ANT+ USB Vendor ID */
const GARMIN_ANT_USB_VENDOR = 0x0fcf

const STICK_HANDOVER_MS = 350

type GarminUsbStick = Ant.GarminStick2 | Ant.GarminStick3

export type AntStickVariant = { create: () => GarminUsbStick; label: string }

type UsbDeviceListEntry = { deviceDescriptor: { idVendor: number; idProduct: number } }
type UsbDiagnosticModule = { getDeviceList: () => UsbDeviceListEntry[] }

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** `import usb from 'usb'` 는 Electron/CJS에서 default 가 비는 경우가 있어 require 로 통일 */
const loadUsbForDiagnostics = (): UsbDiagnosticModule | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('usb') as unknown
    if (m && typeof (m as UsbDiagnosticModule).getDeviceList === 'function') {
      return m as UsbDiagnosticModule
    }
    const d = (m as { default?: UsbDiagnosticModule }).default
    if (d && typeof d.getDeviceList === 'function') {
      return d
    }
  } catch {
    /* ignore */
  }
  return null
}

/** USB에 실제로 보이는 Garmin ANT 동글 PID (node-usb 목록 기준, 실패 시 둘 다 false) */
const collectGarminAntUsbPids = (): { has1008: boolean; has1009: boolean; anyListed: boolean } => {
  try {
    const usbMod = loadUsbForDiagnostics()
    if (!usbMod) {
      return { has1008: false, has1009: false, anyListed: false }
    }
    const list = usbMod.getDeviceList().filter((d) => d.deviceDescriptor.idVendor === GARMIN_ANT_USB_VENDOR)
    if (list.length === 0) {
      return { has1008: false, has1009: false, anyListed: false }
    }
    let has1008 = false
    let has1009 = false
    for (const d of list) {
      const p = d.deviceDescriptor.idProduct
      if (p === 0x1008) has1008 = true
      if (p === 0x1009) has1009 = true
    }
    return { has1008, has1009, anyListed: true }
  } catch {
    return { has1008: false, has1009: false, anyListed: false }
  }
}

/** libusb 기준 연결 여부 — open() 실패·startup 타임아웃 시 원인 추적용 */
export const logAntUsbDiagnostics = (context: string): void => {
  try {
    const usbMod = loadUsbForDiagnostics()
    if (!usbMod) {
      console.warn(
        `🔎 [ANT USB] ${context}: node-usb 모듈을 불러오지 못해 목록 진단을 건너뜁니다. (번들/Electron 호환)`
      )
      return
    }
    const list = usbMod.getDeviceList().filter((d) => d.deviceDescriptor.idVendor === GARMIN_ANT_USB_VENDOR)
    if (list.length === 0) {
      console.error(
        `🔎 [ANT USB] ${context}: VID 0x${GARMIN_ANT_USB_VENDOR.toString(16).toUpperCase()} 장치가 USB 목록에 없습니다. 동글 연결·포트·케이블을 확인하세요.`
      )
      return
    }
    for (const d of list) {
      const pid = d.deviceDescriptor.idProduct
      const pidHex = `0x${pid.toString(16).padStart(4, '0')}`
      const hint =
        pid === 0x1008 ? '(GarminStick2)' : pid === 0x1009 ? '(GarminStick3·미니)' : '(기타 ANT 제품 가능)'
      console.error(`🔎 [ANT USB] ${context}: VID 0x0fcf PID ${pidHex} ${hint}`)
    }
    console.error(
      '🔎 [ANT USB] stick.open()==false 이고 장치는 보이면: Zadig로 해당 인터페이스에 WinUSB(libusb) 지정, Garmin/벤더 드라이버 제거 후 재부팅. 다른 ANT 프로그램 종료.'
    )
  } catch (e) {
    console.warn('🔎 [ANT USB] 진단 목록 조회 실패:', e)
  }
}

/**
 * LINKHIIT_ANT_STICK=2|3|auto — auto 시 USB 목록의 PID(0x1008/0x1009)에 맞춰 시도 순서 결정
 */
export const getAntStickVariants = (envRaw: string, dbg: Ant.DebugOptions | undefined): AntStickVariant[] => {
  const env = envRaw.trim().toLowerCase()
  const opts: Ant.DebugOptions = { throwLibUSBException: true, ...dbg }
  const stick2: AntStickVariant = {
    create: () => new Ant.GarminStick2(opts),
    label: 'GarminStick2 (PID 0x1008)'
  }
  const stick3: AntStickVariant = {
    create: () => new Ant.GarminStick3(opts),
    label: 'GarminStick3 (PID 0x1009, 미니 동글)'
  }
  if (env === '3' || env === 'stick3') return [stick3]
  if (env === '2' || env === 'stick2') return [stick2]

  const { has1008, has1009, anyListed } = collectGarminAntUsbPids()
  if (!anyListed) {
    console.log(
      '🔎 [ANT USB] auto: USB 목록에서 Garmin 동글 PID를 읽지 못함 — Stick3→Stick2 순으로 시도합니다 (PID 확인: node-usb/Zadig).'
    )
    return [stick3, stick2]
  }
  if (has1009 && !has1008) {
    console.log('🔎 [ANT USB] auto: 0x1009(미니)만 목록에 있음 — Stick3만 시도합니다.')
    return [stick3]
  }
  if (has1008 && !has1009) {
    console.log('🔎 [ANT USB] auto: 0x1008만 목록에 있음 — Stick2만 시도합니다.')
    return [stick2]
  }
  if (has1008 && has1009) {
    console.log('🔎 [ANT USB] auto: Stick2·Stick3 PID 모두 감지 — Stick3 먼저, 실패 시 Stick2.')
    return [stick3, stick2]
  }
  console.log('🔎 [ANT USB] auto: 알 수 없는 Garmin PID 조합 — Stick3→Stick2 순으로 시도합니다.')
  return [stick3, stick2]
}

export const cleanupGarminStickRef = async (
  getStick: () => GarminUsbStick | null,
  setStick: (s: GarminUsbStick | null) => void
): Promise<void> => {
  const s = getStick()
  if (!s) return
  setStick(null)
  try {
    s.removeAllListeners()
  } catch {
    /* ignore */
  }
  try {
    await Promise.resolve(s.close())
  } catch {
    /* ignore */
  }
}

type InitSessionOptions = {
  getStartupTimeoutMs: () => number
  getStick: () => GarminUsbStick | null
  setStick: (s: GarminUsbStick | null) => void
  /** USB 동글에서 'shutdown' 이벤트 수신 시 호출. 매니저가 자동 재초기화 등을 결정한다. */
  onUsbShutdown?: () => void
  /** USB bulk 'read' 이벤트 수신 시마다 호출. 매니저의 무수신 워치독에 사용된다. */
  onUsbRead?: () => void
}

/**
 * libusb/ant-plus 라이브러리에서 보고하는 치명적 USB 오류 패턴.
 * 이 패턴 중 하나라도 매칭되면 dongle이 사실상 죽은 것이므로 재초기화가 필요하다.
 * (ant-plus-next는 일부 stall을 자체 console.error('ERROR RECV: ...')로만 찍고
 *  'shutdown'을 발생시키지 않으므로, 'error' 이벤트를 받았을 때 여기서 한 번 더 잡는다.)
 */
const FATAL_USB_ERROR_PATTERNS = [
  'LIBUSB_TRANSFER_STALL',
  'LIBUSB_TRANSFER_NO_DEVICE',
  'LIBUSB_TRANSFER_ERROR',
  'LIBUSB_TRANSFER_CANCELLED',
  'LIBUSB_ERROR_NO_DEVICE',
  'LIBUSB_ERROR_IO',
  'LIBUSB_ERROR_PIPE',
  'LIBUSB_ERROR_TIMEOUT',
] as const

const isFatalUsbError = (error: unknown): boolean => {
  const msg = error instanceof Error ? `${error.message} ${String((error as { code?: unknown }).code ?? '')}` : String(error ?? '')
  return FATAL_USB_ERROR_PATTERNS.some((p) => msg.includes(p))
}

/**
 * open + startup 한 세션. startup 타임아웃 시 정리 후 동일 프로필을 최대 1회 재시도.
 */
export const initializeGarminStickSession = async (
  createStick: () => GarminUsbStick,
  label: string,
  options: InitSessionOptions,
  startupRetryIndex: number = 0
): Promise<boolean> => {
  const { getStartupTimeoutMs, getStick, setStick, onUsbShutdown, onUsbRead } = options

  await cleanupGarminStickRef(getStick, setStick)
  await delay(STICK_HANDOVER_MS)

  const timeoutMs = getStartupTimeoutMs()
  let stick: GarminUsbStick
  try {
    console.log(`🔧 ${label} 로 연결 시도...`)
    stick = createStick()
  } catch (error: unknown) {
    console.error('❌ ANT+ 매니저 초기화 실패:', error)
    return false
  }

  setStick(stick)
  let usbDataReceived = false
  const triggerShutdownRecovery = (reason: string) => {
    if (!onUsbShutdown) return
    console.warn(`⚠️ ANT+ 동글 복구 트리거: ${reason} — 자동 재초기화 예정`)
    try {
      onUsbShutdown()
    } catch (err) {
      console.error('⚠️ onUsbShutdown 콜백 실패:', err)
    }
  }
  const onError = (error: Error) => {
    console.error('❌ ANT+ 동글 에러:', error)
    if (isFatalUsbError(error)) {
      triggerShutdownRecovery(`치명적 USB 오류 (${error.message || error.name})`)
    }
  }
  const onShutdown = () => {
    triggerShutdownRecovery("'shutdown' 이벤트 수신")
  }
  const onRead = () => {
    if (!usbDataReceived) {
      usbDataReceived = true
      console.log('📥 ANT+ USB 데이터 수신 시작됨 (핸드셰이크 진행 중)')
    }
    if (onUsbRead) {
      try {
        onUsbRead()
      } catch {
        /* 워치독 갱신 실패는 치명적이지 않다 */
      }
    }
  }
  stick.on('error', onError)
  stick.on('shutdown', onShutdown)
  stick.on('read', onRead)

  console.log('🔓 ANT+ 동글 열기 시도...')
  let openResult: boolean
  try {
    openResult = await Promise.resolve(stick.open())
  } catch (err: unknown) {
    console.error(`❌ ANT+ stick.open() 예외 (${label}):`, err)
    await cleanupGarminStickRef(getStick, setStick)
    return false
  }

  console.log(`📤 stick.open() 결과: ${openResult} (${label})`)
  if (!openResult) {
    logAntUsbDiagnostics(`stick.open() 실패 · ${label}`)
    console.error('💡 Zadig로 WinUSB(libusb) 드라이버를 설치하세요. 디버그: LINKHIIT_ANT_USB_DEBUG=1')
    await cleanupGarminStickRef(getStick, setStick)
    return false
  }

  console.log(`✅ ANT+ 동글 열기 성공, startup 이벤트 대기 중... (${label})`)

  const RESET_RETRY_INTERVAL_MS = 5000
  const startupReceived = await new Promise<boolean>((resolve) => {
    let done = false

    const resetRetryTimer = setInterval(() => {
      if (done) return
      console.log('🔄 ANT+ startup 미수신 — reset 명령 재전송 중...')
      stick.reset().catch((e: unknown) => {
        console.warn('⚠️ reset() 재전송 실패:', e)
      })
    }, RESET_RETRY_INTERVAL_MS)

    const timer = setTimeout(() => {
      if (done) return
      done = true
      clearInterval(resetRetryTimer)
      resolve(false)
    }, timeoutMs)

    const onStartup = () => {
      if (done) return
      done = true
      clearTimeout(timer)
      clearInterval(resetRetryTimer)
      resolve(true)
    }
    stick.once('startup', onStartup)
  })

  if (startupReceived) {
    console.log(`✅ ANT+ 동글 startup 이벤트 수신 (${label})`)
    return true
  }

  console.error(`❌ ANT+ 동글 초기화 타임아웃 (${timeoutMs / 1000}초) — ${label}`)
  if (!usbDataReceived) {
    console.error(
      '🚨 USB bulk 데이터가 전혀 수신되지 않았습니다. WinUSB 드라이버 미설치 또는 다른 프로그램이 USB 점유 중일 가능성이 높습니다.'
    )
    console.error(
      '   → Zadig 실행 → ANT USB Stick 2 선택 → Driver를 "WinUSB (v6.x)" 로 교체 → "Replace Driver" 클릭 → PC 재부팅'
    )
  }
  console.error('💡 가능한 원인:')
  console.error('   1. 다른 ANT+ 프로그램(Garmin Express, Zwift 등)이 실행 중')
  console.error('   2. USB 포트 문제 - 다른 USB 포트·허브 없이 직연결 시도')
  console.error('   3. 드라이버 문제 - Zadig로 WinUSB(libusb) 재설치, Windows는 개발 실행 시 관리자 권한도 시도')
  console.error(
    '   4. auto 모드는 USB PID로 시도 순서를 정합니다. 강제: LINKHIIT_ANT_STICK=2|3, 대기: LINKHIIT_ANT_STARTUP_TIMEOUT_MS'
  )
  logAntUsbDiagnostics(`startup 타임아웃 · ${label}`)
  await cleanupGarminStickRef(getStick, setStick)

  if (startupRetryIndex < 1) {
    console.log('🔁 startup 미수신 — 동일 USB 프로필 1회 재시도(정리·대기 후)...')
    await delay(500)
    return initializeGarminStickSession(createStick, label, options, startupRetryIndex + 1)
  }

  return false
}
