/**
 * CoolDown 포지션(자리) 매핑 유틸
 * - 서버 저장: A1~A6
 * - 구형 L/R 및 잘못 전치된 B1~B3 레코드는 CD4~CD6로 복구 표시
 * - 화면: CD1 ~ CD6
 */
import type { Exercise } from './coolDownTypes'

const SERVER_TO_CD: Record<string, string> = {
  A1: 'CD1',
  A2: 'CD2',
  A3: 'CD3',
  A4: 'CD4',
  A5: 'CD5',
  A6: 'CD6',
  L1: 'CD1',
  L2: 'CD2',
  L3: 'CD3',
  L4: 'CD4',
  L5: 'CD5',
  L6: 'CD6',
  R1: 'CD4',
  R2: 'CD5',
  R3: 'CD6',
  B1: 'CD4',
  B2: 'CD5',
  B3: 'CD6',
  B4: 'CD4',
  B5: 'CD5',
  B6: 'CD6',
}

const CD_TO_SERVER: Record<string, string> = {
  CD1: 'A1',
  CD2: 'A2',
  CD3: 'A3',
  CD4: 'A4',
  CD5: 'A5',
  CD6: 'A6',
}

export const convertServerPositionToCD = (serverPosition: string): string =>
  SERVER_TO_CD[serverPosition] || serverPosition

export const convertCDPositionToServer = (cdPosition: string): string =>
  CD_TO_SERVER[cdPosition] || cdPosition

export const getPositionByIndex = (index: number): string => `CD${index + 1}`

export const reassignPositions = (exercisesList: Exercise[]): Exercise[] =>
  exercisesList.map((exercise, index) => ({
    ...exercise,
    position: getPositionByIndex(index),
  }))
