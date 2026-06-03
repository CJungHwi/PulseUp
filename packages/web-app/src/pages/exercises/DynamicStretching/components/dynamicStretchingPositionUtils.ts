/**
 * DynamicStretching 포지션(자리) 매핑 유틸
 * - 서버 저장: A1~A6
 * - 구형 L/R 및 잘못 전치된 B1~B3 레코드는 DS4~DS6로 복구 표시
 * - 화면: DS1 ~ DS6
 */
import type { Exercise } from './dynamicStretchingTypes'

const SERVER_TO_DS: Record<string, string> = {
  A1: 'DS1',
  A2: 'DS2',
  A3: 'DS3',
  A4: 'DS4',
  A5: 'DS5',
  A6: 'DS6',
  L1: 'DS1',
  L2: 'DS2',
  L3: 'DS3',
  L4: 'DS4',
  L5: 'DS5',
  L6: 'DS6',
  R1: 'DS4',
  R2: 'DS5',
  R3: 'DS6',
  B1: 'DS4',
  B2: 'DS5',
  B3: 'DS6',
  B4: 'DS4',
  B5: 'DS5',
  B6: 'DS6',
}

const DS_TO_SERVER: Record<string, string> = {
  DS1: 'A1',
  DS2: 'A2',
  DS3: 'A3',
  DS4: 'A4',
  DS5: 'A5',
  DS6: 'A6',
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
