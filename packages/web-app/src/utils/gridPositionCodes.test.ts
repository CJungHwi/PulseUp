import { describe, expect, it } from 'vitest'

import {
  DEFAULT_GRID_POSITION,
  GRID_FIRST_HALF_PREFIX,
  GRID_GROUP_PREFIXES,
  GRID_SECOND_HALF_PREFIX,
  MAIN_GRID_POSITION_ORDER,
  STRESS_LAP_ORDER,
  buildGridPosition,
  getMainPositionSortValue,
  gridSetFromPrefix,
  migrateOldMainGridPosition,
  normalizeGridPosition,
  numOffsetForSide,
  parseGridPosition,
  positionFromMainIndex,
  transposeLegacyLrToAb,
} from './gridPositionCodes'

describe('gridPositionCodes', () => {
  it('transposeLegacyLrToAb maps L/R to A~D groups', () => {
    expect(transposeLegacyLrToAb('L', 1)).toBe('A1')
    expect(transposeLegacyLrToAb('L', 4)).toBe('C1')
    expect(transposeLegacyLrToAb('R', 1)).toBe('B1')
    expect(transposeLegacyLrToAb('R', 4)).toBe('D1')
  })

  it('normalizeGridPosition converts legacy L/R and old A/B formats', () => {
    expect(normalizeGridPosition('L1')).toBe('A1')
    expect(normalizeGridPosition('L4')).toBe('C1')
    expect(normalizeGridPosition('R1')).toBe('B1')
    expect(normalizeGridPosition('R3')).toBe('B3')
    expect(normalizeGridPosition('R4')).toBe('D1')
    expect(normalizeGridPosition('A2')).toBe('A2')
    expect(normalizeGridPosition('A4')).toBe('C1')
    expect(normalizeGridPosition('B1')).toBe('B1')
    expect(normalizeGridPosition('B4')).toBe('D1')
    expect(normalizeGridPosition('C2')).toBe('C2')
    expect(migrateOldMainGridPosition('B1')).toBe('B1')
    expect(migrateOldMainGridPosition('B6')).toBe('D3')
  })

  it('normalizeGridPosition leaves DS/CD unchanged', () => {
    expect(normalizeGridPosition('DS1')).toBe('DS1')
    expect(normalizeGridPosition('CD4')).toBe('CD4')
  })

  it('parseGridPosition: side/set by A~D group', () => {
    expect(parseGridPosition('A1')).toEqual({
      prefix: 'A',
      num: 1,
      side: 'left',
      slot: 1,
      set: 'set1',
    })
    expect(parseGridPosition('B2')?.side).toBe('right')
    expect(parseGridPosition('B2')?.set).toBe('set1')
    expect(parseGridPosition('C1')?.set).toBe('set2')
    expect(parseGridPosition('C1')?.side).toBe('left')
    expect(parseGridPosition('D3')?.side).toBe('right')
    expect(parseGridPosition('L4')).toEqual({
      prefix: 'C',
      num: 1,
      side: 'left',
      slot: 1,
      set: 'set2',
    })
  })

  it('positionFromMainIndex assigns sequential A~D groups', () => {
    expect(positionFromMainIndex(0)).toBe('A1')
    expect(positionFromMainIndex(2)).toBe('A3')
    expect(positionFromMainIndex(3)).toBe('B1')
    expect(positionFromMainIndex(5)).toBe('B3')
    expect(positionFromMainIndex(6)).toBe('C1')
    expect(positionFromMainIndex(8)).toBe('C3')
    expect(positionFromMainIndex(9)).toBe('D1')
    expect(positionFromMainIndex(11)).toBe('D3')
  })

  it('MAIN and STRESS orders', () => {
    expect(MAIN_GRID_POSITION_ORDER).toEqual([
      'A1', 'A2', 'A3', 'B1', 'B2', 'B3',
      'C1', 'C2', 'C3', 'D1', 'D2', 'D3',
    ])
    expect(STRESS_LAP_ORDER[3]).toBe('B3')
    expect(STRESS_LAP_ORDER[6]).toBe('C1')
    expect(DEFAULT_GRID_POSITION).toBe('A1')
    expect(GRID_GROUP_PREFIXES).toEqual(['A', 'B', 'C', 'D'])
  })

  it('getMainPositionSortValue orders A~D blocks sequentially', () => {
    expect(getMainPositionSortValue('A3')).toBeLessThan(getMainPositionSortValue('B1'))
    expect(getMainPositionSortValue('B3')).toBeLessThan(getMainPositionSortValue('C1'))
    expect(getMainPositionSortValue('C3')).toBeLessThan(getMainPositionSortValue('D1'))
  })

  it('helpers', () => {
    expect(buildGridPosition(GRID_FIRST_HALF_PREFIX, 2)).toBe('A2')
    expect(buildGridPosition('D', 3)).toBe('D3')
    expect(gridSetFromPrefix('A')).toBe('set1')
    expect(gridSetFromPrefix('B')).toBe('set1')
    expect(gridSetFromPrefix('C')).toBe('set2')
    expect(gridSetFromPrefix('D')).toBe('set2')
    expect(gridSetFromPrefix(GRID_SECOND_HALF_PREFIX)).toBe('set2')
    expect(numOffsetForSide('left')).toBe(0)
    expect(numOffsetForSide('right')).toBe(3)
  })
})
