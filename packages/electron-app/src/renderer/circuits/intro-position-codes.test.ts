import { describe, expect, it } from 'vitest'

import {
  getIntroSlotDefaultLabel,
  isIntroGridPositionForDisplay,
  mapGridPositionToDomSlot,
  resolveIntroFocusForMonitor,
} from './intro-position-codes.js'

describe('intro-position-codes', () => {
  describe('mapGridPositionToDomSlot', () => {
    it('인트로 슬롯: A~D 각 구역 slot 1–3', () => {
      const opts = { introLayout: true, maxSlots: 3 }
      expect(mapGridPositionToDomSlot('A1', opts)).toBe(1)
      expect(mapGridPositionToDomSlot('A3', opts)).toBe(3)
      expect(mapGridPositionToDomSlot('B1', opts)).toBe(1)
      expect(mapGridPositionToDomSlot('B2', opts)).toBe(2)
      expect(mapGridPositionToDomSlot('C2', opts)).toBe(2)
      expect(mapGridPositionToDomSlot('D3', opts)).toBe(3)
    })

    it('메인 3슬롯: num 기준 slot', () => {
      const opts = { introLayout: false, maxSlots: 3 }
      expect(mapGridPositionToDomSlot('A1', opts)).toBe(1)
      expect(mapGridPositionToDomSlot('B1', opts)).toBe(1)
      expect(mapGridPositionToDomSlot('B2', opts)).toBe(2)
    })
  })

  describe('isIntroGridPositionForDisplay', () => {
    it('3분할: 좌측=A/B, 우측=C/D', () => {
      expect(isIntroGridPositionForDisplay('A1', 'workout-left')).toBe(true)
      expect(isIntroGridPositionForDisplay('B3', 'workout-left')).toBe(true)
      expect(isIntroGridPositionForDisplay('C1', 'workout-left')).toBe(false)
      expect(isIntroGridPositionForDisplay('C1', 'workout-right')).toBe(true)
      expect(isIntroGridPositionForDisplay('D3', 'workout-right')).toBe(true)
      expect(isIntroGridPositionForDisplay('A1', 'workout-right')).toBe(false)
    })

    it('3분할: 구형 4~6 슬롯은 두 번째 열로 정규화한다', () => {
      expect(isIntroGridPositionForDisplay('A4', 'workout-left')).toBe(true)
      expect(isIntroGridPositionForDisplay('B4', 'workout-right')).toBe(true)
      expect(isIntroGridPositionForDisplay('A4', 'workout-right')).toBe(false)
    })

    it('5분할: 좌부터 A, B, C, D', () => {
      const opts = { fiveScreen: true }
      expect(isIntroGridPositionForDisplay('A1', 'workout-left', opts)).toBe(true)
      expect(isIntroGridPositionForDisplay('B1', 'workout-left', opts)).toBe(false)
      expect(isIntroGridPositionForDisplay('B1', 'workout-left-2', opts)).toBe(true)
      expect(isIntroGridPositionForDisplay('A3', 'workout-left-2', opts)).toBe(false)
      expect(isIntroGridPositionForDisplay('C1', 'workout-right', opts)).toBe(true)
      expect(isIntroGridPositionForDisplay('B1', 'workout-right', opts)).toBe(false)
      expect(isIntroGridPositionForDisplay('D1', 'workout-right-2', opts)).toBe(true)
      expect(isIntroGridPositionForDisplay('C3', 'workout-right-2', opts)).toBe(false)
    })

    it('5분할: 구형 A4~A6/B4~B6도 좌측 우화면 B, 우측 우화면 D로 정규화한다', () => {
      const opts = { fiveScreen: true }
      expect(isIntroGridPositionForDisplay('A4', 'workout-left-2', opts)).toBe(true)
      expect(isIntroGridPositionForDisplay('A4', 'workout-left', opts)).toBe(false)
      expect(isIntroGridPositionForDisplay('B4', 'workout-right-2', opts)).toBe(true)
      expect(isIntroGridPositionForDisplay('B4', 'workout-right', opts)).toBe(false)
    })
  })

  describe('resolveIntroFocusForMonitor', () => {
    const introOpts = { introLayout: true, maxSlots: 6 }

    it('B2 → 좌측 모니터 두 번째 열 slot=5', () => {
      const target = {
        positionCode: 'B2',
        zone: 'B' as const,
        number: 2,
        internalPosition: 'B2',
        monitorSides: ['left'] as ('left' | 'right')[],
      }
      const resolved = resolveIntroFocusForMonitor(target, 'left', introOpts)
      expect(resolved?.internalPosition).toBe('B2')
      expect(resolved?.slot).toBe(5)
    })

    it('C2 → 우측 모니터 첫 번째 열 slot=2', () => {
      const target = {
        positionCode: 'C2',
        zone: 'C' as const,
        number: 2,
        internalPosition: 'C2',
        monitorSides: ['right'] as ('left' | 'right')[],
      }
      const resolved = resolveIntroFocusForMonitor(target, 'right', introOpts)
      expect(resolved?.internalPosition).toBe('C2')
      expect(resolved?.slot).toBe(2)
    })

    it('선택보기는 다른 모니터에서도 같은 영상을 표시한다', () => {
      const target = {
        positionCode: 'B2',
        zone: 'B' as const,
        number: 2,
        internalPosition: 'B2',
        monitorSides: ['left'] as ('left' | 'right')[],
      }
      const resolved = resolveIntroFocusForMonitor(target, 'right', introOpts)
      expect(resolved?.internalPosition).toBe('B2')
      expect(resolved?.slot).toBe(5)
    })
  })

  describe('getIntroSlotDefaultLabel', () => {
    it('3분할 기본 라벨은 좌 A/B, 우 C/D', () => {
      expect(getIntroSlotDefaultLabel('left', 1)).toBe('A1')
      expect(getIntroSlotDefaultLabel('left', 4)).toBe('B1')
      expect(getIntroSlotDefaultLabel('left', 6)).toBe('B3')
      expect(getIntroSlotDefaultLabel('right', 1)).toBe('C1')
      expect(getIntroSlotDefaultLabel('right', 4)).toBe('D1')
      expect(getIntroSlotDefaultLabel('right', 6)).toBe('D3')
    })

    it('5분할 패널 라벨은 좌부터 A, B, C, D', () => {
      const opts = { fiveScreen: true }
      expect(getIntroSlotDefaultLabel('left', 1, opts)).toBe('A1')
      expect(getIntroSlotDefaultLabel('left', 3, opts)).toBe('A3')
      expect(getIntroSlotDefaultLabel('left-2', 1, opts)).toBe('B1')
      expect(getIntroSlotDefaultLabel('left-2', 3, opts)).toBe('B3')
      expect(getIntroSlotDefaultLabel('right', 1, opts)).toBe('C1')
      expect(getIntroSlotDefaultLabel('right', 3, opts)).toBe('C3')
      expect(getIntroSlotDefaultLabel('right-2', 1, opts)).toBe('D1')
      expect(getIntroSlotDefaultLabel('right-2', 3, opts)).toBe('D3')
    })
  })
})
