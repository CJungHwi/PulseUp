/**
 * DynamicStretching 포지션(자리) 매핑 유틸
 * - 서버: L1~L3 / R1~R3
 * - 화면: DS1 ~ DS6
 *
 * 사용처: `DynamicStretching.tsx`, `DynamicStretchingEditorPanel.tsx`
 */
import type { Exercise } from './dynamicStretchingTypes'

const SERVER_TO_DS: Record<string, string> = {
  L1: 'DS1',
  L2: 'DS2',
  L3: 'DS3',
  R1: 'DS4',
  R2: 'DS5',
  R3: 'DS6',
}

const DS_TO_SERVER: Record<string, string> = {
  DS1: 'L1',
  DS2: 'L2',
  DS3: 'L3',
  DS4: 'R1',
  DS5: 'R2',
  DS6: 'R3',
}

export const convertServerPositionToDS = (serverPosition: string): string =>
  SERVER_TO_DS[serverPosition] || serverPosition

export const convertDSPositionToServer = (dsPosition: string): string =>
  DS_TO_SERVER[dsPosition] || dsPosition

export const getPositionByIndex = (index: number): string => `DS${index + 1}`

export const reassignPositions = (exercisesList: Exercise[]): Exercise[] =>
  exercisesList.map((exercise, index) => ({
    ...exercise,
    position: getPositionByIndex(index),
  }))
