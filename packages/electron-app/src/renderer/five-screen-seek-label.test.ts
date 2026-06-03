import { describe, expect, it } from 'vitest'
import { resolveMainPhaseSeekLabel } from './five-screen-seek-label.js'

describe('resolveMainPhaseSeekLabel', () => {
  it('3-screen: maps to monitor num (A1→우측 A4)', () => {
    expect(resolveMainPhaseSeekLabel('workout-left', 'A1')).toBe('A1')
    expect(resolveMainPhaseSeekLabel('workout-right', 'A1')).toBe('A4')
    expect(resolveMainPhaseSeekLabel('workout-right', 'B2')).toBe('B5')
  })

  it('5-screen: maps to panel queue labels', () => {
    expect(
      resolveMainPhaseSeekLabel('workout-left', 'A1', { fiveScreen: true }),
    ).toBe('A1')
    expect(
      resolveMainPhaseSeekLabel('workout-left-2', 'A1', { fiveScreen: true }),
    ).toBe('A4')
    expect(
      resolveMainPhaseSeekLabel('workout-right', 'B1', { fiveScreen: true }),
    ).toBe('B1')
    expect(
      resolveMainPhaseSeekLabel('workout-right-2', 'B1', { fiveScreen: true }),
    ).toBe('B4')
  })
})
