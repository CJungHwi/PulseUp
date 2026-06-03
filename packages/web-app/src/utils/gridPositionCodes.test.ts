import { describe, expect, it } from 'vitest'

import {

  DEFAULT_GRID_POSITION,

  GRID_FIRST_HALF_PREFIX,

  GRID_SECOND_HALF_PREFIX,

  MAIN_GRID_POSITION_ORDER,

  STRESS_LAP_ORDER,

  buildGridPosition,

  getMainPositionSortValue,

  gridSetFromPrefix,

  normalizeGridPosition,

  numOffsetForSide,

  parseGridPosition,

  positionFromMainIndex,

  transposeLegacyLrToAb,

} from './gridPositionCodes'



describe('gridPositionCodes', () => {

  it('transposeLegacyLrToAb maps L/R to transposed A/B', () => {

    expect(transposeLegacyLrToAb('L', 1)).toBe('A1')

    expect(transposeLegacyLrToAb('L', 4)).toBe('B1')

    expect(transposeLegacyLrToAb('R', 1)).toBe('A4')

    expect(transposeLegacyLrToAb('R', 4)).toBe('B4')

  })



  it('normalizeGridPosition converts legacy L/R via transpose', () => {

    expect(normalizeGridPosition('L1')).toBe('A1')

    expect(normalizeGridPosition('L4')).toBe('B1')

    expect(normalizeGridPosition('R1')).toBe('A4')

    expect(normalizeGridPosition('R3')).toBe('A6')

    expect(normalizeGridPosition('A2')).toBe('A2')

    expect(normalizeGridPosition('B6')).toBe('B6')

  })



  it('normalizeGridPosition leaves DS/CD unchanged', () => {

    expect(normalizeGridPosition('DS1')).toBe('DS1')

    expect(normalizeGridPosition('CD4')).toBe('CD4')

  })



  it('parseGridPosition: side=num, set=prefix', () => {

    expect(parseGridPosition('A1')).toEqual({

      prefix: 'A',

      num: 1,

      side: 'left',

      slot: 1,

      set: 'set1',

    })

    expect(parseGridPosition('A4')?.side).toBe('right')

    expect(parseGridPosition('B2')?.set).toBe('set2')

    expect(parseGridPosition('L4')).toEqual({

      prefix: 'B',

      num: 1,

      side: 'left',

      slot: 1,

      set: 'set2',

    })

  })



  it('positionFromMainIndex assigns sequential A1~A6, B1~B6', () => {

    expect(positionFromMainIndex(0)).toBe('A1')

    expect(positionFromMainIndex(5)).toBe('A6')

    expect(positionFromMainIndex(6)).toBe('B1')

    expect(positionFromMainIndex(11)).toBe('B6')

  })



  it('MAIN and STRESS orders', () => {

    expect(MAIN_GRID_POSITION_ORDER).toEqual([

      'A1', 'A2', 'A3', 'A4', 'A5', 'A6',

      'B1', 'B2', 'B3', 'B4', 'B5', 'B6',

    ])

    expect(STRESS_LAP_ORDER[3]).toBe('A6')

    expect(STRESS_LAP_ORDER[6]).toBe('B1')

    expect(DEFAULT_GRID_POSITION).toBe('A1')

  })



  it('getMainPositionSortValue orders A block before B block', () => {

    expect(getMainPositionSortValue('A6')).toBeLessThan(getMainPositionSortValue('B1'))

  })



  it('helpers', () => {

    expect(buildGridPosition(GRID_FIRST_HALF_PREFIX, 2)).toBe('A2')

    expect(buildGridPosition(GRID_SECOND_HALF_PREFIX, 5)).toBe('B5')

    expect(gridSetFromPrefix('A')).toBe('set1')

    expect(gridSetFromPrefix('B')).toBe('set2')

    expect(numOffsetForSide('left')).toBe(0)

    expect(numOffsetForSide('right')).toBe(3)

  })

})

