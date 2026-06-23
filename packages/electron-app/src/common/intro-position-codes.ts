/**
 * 인트로 선택보기 position
 * - zone A/B/C/D = 메인 운동 4구역
 * - 번호 1~3 = 구역 내 슬롯
 * - 구형 A/B 4~6 입력은 normalizeGridPosition으로 새 A~D 코드로 변환
 */
import { parseGridPosition } from './grid-position-codes.js'

export type IntroMonitorSide = 'left' | 'left-2' | 'right' | 'right-2'
export type IntroFocusZone = 'A' | 'B' | 'C' | 'D'

export type IntroFocusTarget = {
  positionCode: string
  zone: IntroFocusZone
  number: number
  internalPosition: string
  monitorSides: IntroMonitorSide[]
}

const monitorSidesForPosition = (position: string): IntroMonitorSide[] => {
  const parsed = parseGridPosition(position)
  if (!parsed) return []
  // 3분할: 좌측 A/B, 우측 C/D · 5분할: L1=A, L2=B, R1=C, R2=D
  if (parsed.prefix === 'A') return ['left']
  if (parsed.prefix === 'B') return ['left', 'left-2']
  if (parsed.prefix === 'C') return ['right']
  return ['right', 'right-2']
}

const normalizeIntroFocusPosition = (positionCode: string): string => {
  const raw = String(positionCode || '').trim().toUpperCase()
  const m = raw.match(/^([AB])([1-6])$/)
  if (!m) return raw
  const prefix = m[1]
  const num = Number(m[2])
  if (num <= 3) return `${prefix}${num}`
  return `${prefix === 'A' ? 'B' : 'D'}${num - 3}`
}

export const parseIntroFocusTarget = (zone: IntroFocusZone, number: number): IntroFocusTarget | null => {
  if (!Number.isInteger(number) || number < 1 || number > 6) return null

  const positionCode = `${zone}${number}`
  const internalPosition = normalizeIntroFocusPosition(positionCode)
  const parsed = parseGridPosition(internalPosition)
  if (!parsed) return null

  return {
    positionCode,
    zone,
    number,
    internalPosition,
    monitorSides: monitorSidesForPosition(internalPosition),
  }
}

export const parseIntroFocusPositionCode = (positionCode: string): IntroFocusTarget | null => {
  const match = positionCode.trim().toUpperCase().match(/^([ABCD])([1-6])$/)
  if (!match) return null
  return parseIntroFocusTarget(match[1] as IntroFocusZone, Number(match[2]))
}

export const parseIntroFocusCommandPayload = (data: {
  zone?: string
  number?: number
  positionCode?: string
}): IntroFocusTarget | null => {
  if (typeof data?.positionCode === 'string' && data.positionCode.trim()) {
    return parseIntroFocusPositionCode(data.positionCode)
  }

  const zone = String(data?.zone || '').trim().toUpperCase()
  const number = Number(data?.number)
  if (!['A', 'B', 'C', 'D'].includes(zone)) return null
  return parseIntroFocusTarget(zone as IntroFocusZone, number)
}
