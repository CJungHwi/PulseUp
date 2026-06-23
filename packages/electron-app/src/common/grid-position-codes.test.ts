import { describe, expect, it } from 'vitest'

import {

  DEFAULT_GRID_POSITION,

  GRID_FIRST_HALF_PREFIX,

  GRID_SECOND_HALF_PREFIX,

  STRESS_LAP_ORDER,

  normalizeGridPosition,

  parseGridPosition,

  transposeLegacyLrToAb,

} from './grid-position-codes.js'

import { parseIntroFocusPositionCode } from './intro-position-codes.js'



describe('electron grid-position-codes', () => {

  it('transposeLegacyLrToAb', () => {

    expect(transposeLegacyLrToAb('L', 4)).toBe('C1')

    expect(transposeLegacyLrToAb('R', 1)).toBe('B1')

  })



  it('normalizeGridPosition converts legacy L/R via transpose', () => {

    expect(normalizeGridPosition('L4')).toBe('C1')

    expect(normalizeGridPosition('r2')).toBe('B2')

  })



  it('parseGridPosition: 좌측 A/C, 우측 B/D · set1 A/B, set2 C/D', () => {

    expect(parseGridPosition('A1')?.side).toBe('left')

    expect(parseGridPosition('B1')?.side).toBe('right')

    expect(parseGridPosition('C1')?.side).toBe('left')

    expect(parseGridPosition('B2')?.set).toBe('set1')

    expect(parseGridPosition('C2')?.set).toBe('set2')

    expect(parseGridPosition('D2')?.set).toBe('set2')

  })



  it('intro focus aligns with grid positions', () => {

    const target = parseIntroFocusPositionCode('A3')

    expect(target?.internalPosition).toBe('A3')

    expect(target?.zone).toBe('A')

    expect(target?.monitorSides).toEqual(['left'])

    expect(parseIntroFocusPositionCode('B1')?.monitorSides).toEqual(['left', 'left-2'])

    expect(parseIntroFocusPositionCode('C1')?.monitorSides).toEqual(['right'])

    expect(parseIntroFocusPositionCode('A4')?.internalPosition).toBe('B1')

  })



  it('constants', () => {

    expect(GRID_FIRST_HALF_PREFIX).toBe('A')

    expect(GRID_SECOND_HALF_PREFIX).toBe('C')

    expect(DEFAULT_GRID_POSITION).toBe('A1')

    expect(STRESS_LAP_ORDER[3]).toBe('B3')

  })

})

