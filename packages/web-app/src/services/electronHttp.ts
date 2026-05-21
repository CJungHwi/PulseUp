import { apiClient } from './api.service'
import * as deviceService from './deviceService'

// 서버 중계 모드 사용 여부 (항상 활성화, 직접 연결은 VITE_USE_SERVER_RELAY=false로 비활성화)
const USE_SERVER_RELAY = import.meta.env.VITE_USE_SERVER_RELAY !== 'false'

/**
 * 서버 중계 모드 사용 여부 확인
 */
export function isServerRelayMode(): boolean {
  return USE_SERVER_RELAY
}

/**
 * 선택된 디바이스 ID 저장/조회 (localStorage)
 */
export function getSelectedDeviceId(): string | null {
  try {
    return localStorage.getItem('selectedDeviceId')
  } catch {
    return null
  }
}

export function setSelectedDeviceId(deviceId: string | null): void {
  try {
    if (deviceId) {
      localStorage.setItem('selectedDeviceId', deviceId)
    } else {
      localStorage.removeItem('selectedDeviceId')
    }
  } catch {
    // ignore
  }
}

interface ElectronHeadersOptions {
  includeAuth?: boolean
  authToken?: string | null
}

function getTokenFromStorage(): string | null {
  try {
    // sessionStorage 사용 (브라우저 닫으면 만료)
    return sessionStorage.getItem('token') || sessionStorage.getItem('accessToken')
  } catch {
    return null
  }
}

export function getApiTokenFromStorage(): string | null {
  return getTokenFromStorage()
}

export async function ensureApiTokenFresh(): Promise<string | null> {
  const initialToken = getTokenFromStorage()
  if (!initialToken) return null

  try {
    await apiClient.get('/auth/me')
  } catch {
    // apiClient 인터셉터에서 refresh 시도함
  }

  return getTokenFromStorage()
}

function normalizeBaseUrl(input: string): string {
  return String(input || '').trim().replace(/\/+$/, '')
}

function stripTrailingApiPath(baseUrl: string): string {
  // VITE_API_URL은 보통 ".../api" 형태. Electron은 webAppUrl + "/api/..."로 호출하므로 여기서는 /api를 제거해야 함.
  return normalizeBaseUrl(baseUrl).replace(/\/api$/i, '')
}

export function getApiServerRootUrl(): string {
  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001/api'
  return stripTrailingApiPath(apiBaseUrl)
}

/**
 * Electron(다른 PC)에서 접근 가능한 API 서버 루트 URL을 계산
 * - VITE_API_URL이 localhost/127.0.0.1이면, 현재 웹앱 접속 hostname으로 자동 치환
 * - 예1: 태블릿이 linkhiit.co.kr 접속 → Electron에 https://linkhiit.co.kr 주입
 * - 예2: 개발 PC에서 127.0.0.1:5173 접속 → Electron에 http://127.0.0.1:3001 주입
 */
function getApiServerRootUrlForElectron(): string {
  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001/api'
  const stripped = stripTrailingApiPath(apiBaseUrl)

  try {
    const url = new URL(stripped)
    const isLoopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1'

    if (!isLoopback) {
      // VITE_API_URL이 이미 실제 도메인/IP면 그대로 사용
      return url.toString().replace(/\/$/, '')
    }

    // VITE_API_URL이 localhost/127.0.0.1인 경우 → 웹앱 접속 hostname으로 치환
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : ''

    if (currentHost && currentHost !== 'localhost') {
      // 웹앱이 127.0.0.1이나 실제 도메인으로 접속 중이면 그걸로 치환
      url.hostname = currentHost
      // 프로토콜은 원본 VITE_API_URL 기준 유지 (개발: http, 실서버: https)
      // 127.0.0.1 개발 환경에서는 API 서버가 http이므로 protocol 변경하지 않음
      if (typeof window !== 'undefined' && window.location.protocol === 'https:' && !currentHost.match(/^(127\.0\.0\.1|localhost)$/)) {
        // 실제 도메인(linkhiit.co.kr 등)이고 웹앱이 https면 API도 https
        url.protocol = 'https:'
      }
      return url.toString().replace(/\/$/, '')
    }

    // 웹앱도 localhost로 접속 중(hostname이 정확히 'localhost'인 경우만)
    // → localStorage override 지원
    try {
      const override = localStorage.getItem('electronApiServerRootUrl')
      if (override) {
        return stripTrailingApiPath(override).replace(/\/$/, '')
      }
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }

  return stripped
}

/**
 * 현재 웹 앱의 도메인 URL을 반환
 * Electron 앱이 심박수 데이터를 전송할 웹 서버 주소를 결정
 */
export function getWebAppUrl(): string {
  // 환경 변수에서 API URL 가져오기
  const apiUrl = import.meta.env.VITE_API_URL
  if (apiUrl) {
    // VITE_API_URL에서 /api 제거
    return stripTrailingApiPath(apiUrl)
  }

  // 현재 브라우저 URL 기반으로 감지
  if (typeof window !== 'undefined') {
    const origin = window.location.origin
    const hostname = window.location.hostname

    // 로컬 개발 환경
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3001'
    }

    // 운영 환경 - 현재 origin의 프로토콜과 호스트명 사용
    if (window.location.protocol === 'https:') {
      return `https://${hostname}`
    }

    return origin
  }

  // 기본값 (서버 사이드 렌더링 등)
  return 'http://localhost:3001'
}

/**
 * Electron IP에 따라 프로토콜 결정
 * localhost/127.0.0.1은 HTTP 사용, 외부 IP는 HTTPS 필수
 */
export function getElectronProtocol(electronIP: string): string {
  if (electronIP === 'localhost' || electronIP === '127.0.0.1') {
    // 개발 환경에서는 HTTP 사용 (Electron 앱이 HTTP 모드로 실행 중)
    return 'http'
  }
  // 외부 네트워크 IP는 Mixed Content 방지를 위해 HTTPS 필수
  return 'https'
}

export function buildElectronHeaders(options: ElectronHeadersOptions = {}): HeadersInit {
  const apiServerRootUrl = getApiServerRootUrlForElectron()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-Server-URL': apiServerRootUrl
  }

  if (options.includeAuth !== false) {
    const token = typeof options.authToken !== 'undefined' ? options.authToken : getTokenFromStorage()
    if (token) headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`
  }

  return headers
}

export async function configureElectron(
  electronIP: string,
  electronPort: number,
  options?: { signal?: AbortSignal; authToken?: string | null; displayLabel?: string }
): Promise<boolean> {
  // 실패해도 운동 플레이 요청은 계속 시도할 수 있게 throw하지 않음
  try {
    const protocol = getElectronProtocol(electronIP)
    // 웹 앱 URL을 자동으로 감지하여 전달
    const webAppUrl = getWebAppUrl()
    if (import.meta.env.DEV) {
      console.log(`📡 Electron 설정 전송: webAppUrl=${webAppUrl}`)
    }

    const body: Record<string, any> = { webAppUrl }
    if (options?.displayLabel) {
      body.displayLabel = options.displayLabel
    }

    const resp = await fetch(`${protocol}://${electronIP}:${electronPort}/config`, {
      method: 'POST',
      headers: buildElectronHeaders({ authToken: options?.authToken }),
      body: JSON.stringify(body),
      signal: options?.signal
    })
    if (import.meta.env.DEV) {
      if (resp.ok) console.log(`✅ Electron 설정 성공: Electron 앱이 ${webAppUrl}로 데이터를 전송합니다`)
      else console.warn(`⚠️ Electron 설정 실패 (상태: ${resp.status})`)
    }

    return resp.ok
  } catch (error) {
    if (import.meta.env.DEV) console.error('❌ Electron 설정 오류:', error)
    return false
  }
}

export async function startWorkoutPlay(
  electronIP: string,
  electronPort: number,
  playData: unknown,
  options?: { signal?: AbortSignal; authToken?: string | null }
): Promise<Response> {
  // 1회 config를 먼저 찍어두면(저장됨) 현장 세팅 없이 재시작에도 유지됨
  await configureElectron(electronIP, electronPort, options)

  const protocol = getElectronProtocol(electronIP)
  return await fetch(`${protocol}://${electronIP}:${electronPort}/start-workout-play`, {
    method: 'POST',
    headers: buildElectronHeaders({ authToken: options?.authToken }),
    body: JSON.stringify(playData),
    signal: options?.signal
  })
}

/**
 * 서버 중계 모드로 운동 시작
 * - deviceId: 선택된 디바이스 ID
 * - playData: 운동 데이터
 */
export async function startWorkoutPlayRelay(
  deviceId: string,
  playData: {
    masterId: string | number
    userId: string | number
    sequences: any[]
    metadata?: any
  }
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const data = await deviceService.startWorkoutPlay(deviceId, playData)
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '운동 시작 실패'
    }
  }
}

/**
 * 서버 중계 모드로 운동 제어
 * NOTE: 'toggle-fullscreen'은 2026-04-17부로 리모컨에서 제거되어 지원 명령에서도 빠졌다.
 */
export async function sendCommandRelay(
  deviceId: string,
  command: 'play-start' | 'play-pause' | 'play-stop' | 'play-next' | 'play-previous'
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    let data: any
    switch (command) {
      case 'play-start':
        data = await deviceService.playStart(deviceId)
        break
      case 'play-pause':
        data = await deviceService.playPause(deviceId)
        break
      case 'play-stop':
        data = await deviceService.playStop(deviceId)
        break
      case 'play-next':
        data = await deviceService.playNext(deviceId)
        break
      case 'play-previous':
        data = await deviceService.playPrevious(deviceId)
        break
    }
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '명령 전송 실패'
    }
  }
}

/**
 * 연결된 디바이스 목록 조회
 */
export async function getConnectedDevices(): Promise<{ deviceId: string; displayLabel: string }[]> {
  if (USE_SERVER_RELAY) {
    return await deviceService.getConnectedDevices()
  }
  return []
}

/**
 * 디바이스 연결 상태 확인
 */
export async function checkDeviceConnected(deviceId: string): Promise<boolean> {
  if (USE_SERVER_RELAY) {
    return await deviceService.checkDeviceStatus(deviceId)
  }
  return false
}