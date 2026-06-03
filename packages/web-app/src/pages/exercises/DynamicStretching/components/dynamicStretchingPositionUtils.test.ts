import { describe, expect, it } from 'vitest'

import {
  convertDSPositionToServer,
  convertServerPositionToDS,
} from './dynamicStretchingPositionUtils'

describe('dynamicStretchingPositionUtils', () => {
  it('maps canonical A positions to DS slots', () => {
    expect(convertServerPositionToDS('A1')).toBe('DS1')
    expect(convertServerPositionToDS('A6')).toBe('DS6')
  })

  it('recovers legacy/transposed positions for DS4-DS6', () => {
    expect(convertServerPositionToDS('L4')).toBe('DS4')
    expect(convertServerPositionToDS('B1')).toBe('DS4')
    expect(convertServerPositionToDS('B3')).toBe('DS6')
  })

  it('saves DS slots as canonical A positions', () => {
    expect(convertDSPositionToServer('DS1')).toBe('A1')
    expect(convertDSPositionToServer('DS6')).toBe('A6')
  })
})
