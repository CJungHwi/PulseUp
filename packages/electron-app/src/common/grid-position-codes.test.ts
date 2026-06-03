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

    expect(transposeLegacyLrToAb('L', 4)).toBe('B1')

    expect(transposeLegacyLrToAb('R', 1)).toBe('A4')

  })



  it('normalizeGridPosition converts legacy L/R via transpose', () => {

    expect(normalizeGridPosition('L4')).toBe('B1')

    expect(normalizeGridPosition('r2')).toBe('A5')

  })



  it('parseGridPosition: side=num, set=prefix', () => {

    expect(parseGridPosition('A1')?.side).toBe('left')

    expect(parseGridPosition('A4')?.side).toBe('right')

    expect(parseGridPosition('B1')?.side).toBe('left')

    expect(parseGridPosition('B2')?.set).toBe('set2')

  })



  it('intro focus aligns with grid positions', () => {

    const target = parseIntroFocusPositionCode('A3')

    expect(target?.internalPosition).toBe('A3')

    expect(target?.zone).toBe('A')

    expect(target?.monitorSides).toEqual(['left'])

    expect(parseIntroFocusPositionCode('A4')?.monitorSides).toEqual(['right'])

    expect(parseIntroFocusPositionCode('B1')?.monitorSides).toEqual(['left'])

  })



  it('constants', () => {

    expect(GRID_FIRST_HALF_PREFIX).toBe('A')

    expect(GRID_SECOND_HALF_PREFIX).toBe('B')

    expect(DEFAULT_GRID_POSITION).toBe('A1')

    expect(STRESS_LAP_ORDER[3]).toBe('A6')

  })

})

