/**
 * 인트로 선택보기 position
 * - zone A/B = 전반/후반
 * - 번호 1~3 → 좌측 모니터, 4~6 → 우측 모니터
 * - zone C + 번호 → C1~C6 (5분할 외측 모니터)
 */
import { normalizeGridPosition, parseGridPosition } from './grid-position-codes.js'

export type IntroMonitorSide = 'left' | 'left-2' | 'right' | 'right-2'

export type IntroFocusTarget = {
  positionCode: string
  zone: 'A' | 'B' | 'C'
  number: number
  internalPosition: string
  monitorSides: IntroMonitorSide[]
}

export const parseIntroFocusTarget = (zone: 'A' | 'B' | 'C', number: number): IntroFocusTarget | null => {
  if (!Number.isInteger(number) || number < 1 || number > 6) return null

  const positionCode = `${zone}${number}`

  if (zone === 'C') {
    return {
      positionCode,
      zone,
      number,
      internalPosition: `C${number}`,
      monitorSides: ['left-2', 'right-2'],
    }
  }

  const internalPosition = normalizeGridPosition(positionCode)
  const parsed = parseGridPosition(internalPosition)
  if (!parsed) return null

  return {
    positionCode,
    zone,
    number,
    internalPosition,
    monitorSides: [parsed.side],
  }
}

export const parseIntroFocusPositionCode = (positionCode: string): IntroFocusTarget | null => {
  const match = positionCode.trim().toUpperCase().match(/^([ABC])([1-6])$/)
  if (!match) return null
  return parseIntroFocusTarget(match[1] as 'A' | 'B' | 'C', Number(match[2]))
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
  if (!['A', 'B', 'C'].includes(zone)) return null
  return parseIntroFocusTarget(zone as 'A' | 'B' | 'C', number)
}
