import { describe, expect, it } from 'vitest'
import { resolveMainPhaseSeekLabel } from './five-screen-seek-label.js'

describe('resolveMainPhaseSeekLabel', () => {
  it('3-screen: 좌측 A(전반)/C(후반), 우측 B(전반)/D(후반)', () => {
    expect(resolveMainPhaseSeekLabel('workout-left', 'A1')).toBe('A1')
    expect(resolveMainPhaseSeekLabel('workout-left', 'C2')).toBe('C2')
    expect(resolveMainPhaseSeekLabel('workout-right', 'B2')).toBe('B2')
    expect(resolveMainPhaseSeekLabel('workout-right', 'D3')).toBe('D3')
  })

  it('3-screen: cross-side seek target maps to this side (set 유지) — DS 멈춤 버그 방지', () => {
    // 메인 시작 seek 는 보통 'A1'(좌 set1)을 모든 창에 보낸다.
    // 우측 화면은 같은 set1 의 우측 구역 B1 로 변환되어야 한다 (null 아님).
    expect(resolveMainPhaseSeekLabel('workout-right', 'A1')).toBe('B1')
    expect(resolveMainPhaseSeekLabel('workout-right', 'A3')).toBe('B3')
    // 후반(set2) seek 'C1' → 우측 D1, 좌측 C1
    expect(resolveMainPhaseSeekLabel('workout-right', 'C1')).toBe('D1')
    expect(resolveMainPhaseSeekLabel('workout-left', 'C2')).toBe('C2')
    expect(resolveMainPhaseSeekLabel('workout-left', 'D3')).toBe('C3')
  })

  it('5-screen: 모든 패널이 같은 슬롯으로 동시 진행 (어떤 position 이 와도 매핑)', () => {
    // 메인 시작 seek 'A1' 이 모든 패널에 와도 각 패널의 첫 메인으로 변환되어야 한다.
    expect(resolveMainPhaseSeekLabel('workout-left', 'A1', { fiveScreen: true })).toBe('A1')
    expect(resolveMainPhaseSeekLabel('workout-left-2', 'A1', { fiveScreen: true })).toBe('B1')
    expect(resolveMainPhaseSeekLabel('workout-right', 'A1', { fiveScreen: true })).toBe('C1')
    expect(resolveMainPhaseSeekLabel('workout-right-2', 'A1', { fiveScreen: true })).toBe('D1')
    // 슬롯 번호 유지
    expect(resolveMainPhaseSeekLabel('workout-right-2', 'A3', { fiveScreen: true })).toBe('D3')
  })
})
