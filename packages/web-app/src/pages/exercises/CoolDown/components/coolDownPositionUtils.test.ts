import { describe, expect, it } from 'vitest'

import {
  convertCDPositionToServer,
  convertServerPositionToCD,
} from './coolDownPositionUtils'

describe('coolDownPositionUtils', () => {
  it('maps canonical A positions to CD slots', () => {
    expect(convertServerPositionToCD('A1')).toBe('CD1')
    expect(convertServerPositionToCD('A6')).toBe('CD6')
  })

  it('recovers legacy/transposed positions for CD4-CD6', () => {
    expect(convertServerPositionToCD('L4')).toBe('CD4')
    expect(convertServerPositionToCD('B1')).toBe('CD4')
    expect(convertServerPositionToCD('B3')).toBe('CD6')
  })

  it('saves CD slots as canonical A positions', () => {
    expect(convertCDPositionToServer('CD1')).toBe('A1')
    expect(convertCDPositionToServer('CD6')).toBe('A6')
  })
})
