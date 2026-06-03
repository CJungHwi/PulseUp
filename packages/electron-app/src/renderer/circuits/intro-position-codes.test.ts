import { describe, expect, it } from 'vitest'

import {
  getIntroSlotDefaultLabel,
  isIntroGridPositionForDisplay,
  mapGridPositionToDomSlot,
  resolveIntroFocusForMonitor,
} from './intro-position-codes.js'

describe('intro-position-codes', () => {
  describe('mapGridPositionToDomSlot', () => {
    it('인트로 6슬롯: num 1–3 좌열, 4–6 우열', () => {
      const opts = { introLayout: true, maxSlots: 6 }
      expect(mapGridPositionToDomSlot('A1', opts)).toBe(1)
      expect(mapGridPositionToDomSlot('A3', opts)).toBe(3)
      expect(mapGridPositionToDomSlot('A4', opts)).toBe(4)
      expect(mapGridPositionToDomSlot('A6', opts)).toBe(6)
      expect(mapGridPositionToDomSlot('B2', opts)).toBe(2)
      expect(mapGridPositionToDomSlot('B5', opts)).toBe(5)
    })

    it('메인 3슬롯: num 기준 slot', () => {
      const opts = { introLayout: false, maxSlots: 3 }
      expect(mapGridPositionToDomSlot('A1', opts)).toBe(1)
      expect(mapGridPositionToDomSlot('A4', opts)).toBe(1)
      expect(mapGridPositionToDomSlot('B2', opts)).toBe(2)
    })
  })

  describe('isIntroGridPositionForDisplay', () => {
    it('인트로 재생 그리드는 좌측=A*, 우측=B*', () => {
      expect(isIntroGridPositionForDisplay('A1', 'workout-left')).toBe(true)
      expect(isIntroGridPositionForDisplay('A6', 'workout-left')).toBe(true)
      expect(isIntroGridPositionForDisplay('B1', 'workout-left')).toBe(false)
      expect(isIntroGridPositionForDisplay('B4', 'workout-right')).toBe(true)
      expect(isIntroGridPositionForDisplay('A4', 'workout-right')).toBe(false)
    })

    it('5분할: 좌좌 A123, 좌우 A456, 우좌 B123, 우우 B456', () => {
      const opts = { fiveScreen: true }
      expect(isIntroGridPositionForDisplay('A1', 'workout-left', opts)).toBe(true)
      expect(isIntroGridPositionForDisplay('A4', 'workout-left', opts)).toBe(false)
      expect(isIntroGridPositionForDisplay('A4', 'workout-left-2', opts)).toBe(true)
      expect(isIntroGridPositionForDisplay('A3', 'workout-left-2', opts)).toBe(false)
      expect(isIntroGridPositionForDisplay('B1', 'workout-right', opts)).toBe(true)
      expect(isIntroGridPositionForDisplay('B4', 'workout-right', opts)).toBe(false)
      expect(isIntroGridPositionForDisplay('B4', 'workout-right-2', opts)).toBe(true)
      expect(isIntroGridPositionForDisplay('B3', 'workout-right-2', opts)).toBe(false)
    })
  })

  describe('resolveIntroFocusForMonitor', () => {
    const introOpts = { introLayout: true, maxSlots: 6 }

    it('A5 → 우측 모니터 slot=5', () => {
      const target = {
        positionCode: 'A5',
        zone: 'A' as const,
        number: 5,
        internalPosition: 'A5',
        monitorSides: ['right'] as const,
      }
      const resolved = resolveIntroFocusForMonitor(target, 'right', introOpts)
      expect(resolved?.internalPosition).toBe('A5')
      expect(resolved?.slot).toBe(5)
    })

    it('B2 → 좌측 모니터 slot=2', () => {
      const target = {
        positionCode: 'B2',
        zone: 'B' as const,
        number: 2,
        internalPosition: 'B2',
        monitorSides: ['left'] as const,
      }
      const resolved = resolveIntroFocusForMonitor(target, 'left', introOpts)
      expect(resolved?.internalPosition).toBe('B2')
      expect(resolved?.slot).toBe(2)
    })

    it('선택보기는 다른 모니터에서도 같은 영상을 표시한다', () => {
      const target = {
        positionCode: 'B2',
        zone: 'B' as const,
        number: 2,
        internalPosition: 'B2',
        monitorSides: ['left'] as const,
      }
      const resolved = resolveIntroFocusForMonitor(target, 'right', introOpts)
      expect(resolved?.internalPosition).toBe('B2')
      expect(resolved?.slot).toBe(2)
    })
  })

  describe('getIntroSlotDefaultLabel', () => {
    it('인트로 재생 그리드는 좌측 A*, 우측 B*', () => {
      expect(getIntroSlotDefaultLabel('left', 1)).toBe('A1')
      expect(getIntroSlotDefaultLabel('left', 4)).toBe('A4')
      expect(getIntroSlotDefaultLabel('right', 1)).toBe('B1')
      expect(getIntroSlotDefaultLabel('right', 3)).toBe('B3')
      expect(getIntroSlotDefaultLabel('right', 6)).toBe('B6')
    })

    it('5분할 패널 라벨', () => {
      const opts = { fiveScreen: true }
      expect(getIntroSlotDefaultLabel('left', 1, opts)).toBe('A1')
      expect(getIntroSlotDefaultLabel('left', 3, opts)).toBe('A3')
      expect(getIntroSlotDefaultLabel('left-2', 1, opts)).toBe('A4')
      expect(getIntroSlotDefaultLabel('left-2', 3, opts)).toBe('A6')
      expect(getIntroSlotDefaultLabel('right', 1, opts)).toBe('B1')
      expect(getIntroSlotDefaultLabel('right', 3, opts)).toBe('B3')
      expect(getIntroSlotDefaultLabel('right-2', 1, opts)).toBe('B4')
      expect(getIntroSlotDefaultLabel('right-2', 3, opts)).toBe('B6')
    })
  })
})
