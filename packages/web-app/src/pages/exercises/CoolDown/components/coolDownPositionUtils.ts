/**
 * CoolDown 포지션(자리) 매핑 유틸
 * - 서버: L1~L3 / R1~R3
 * - 화면: CD1 ~ CD6
 *
 * 사용처: `CoolDown.tsx`, `CoolDownEditorPanel.tsx`
 */
import type { Exercise } from './coolDownTypes'

const SERVER_TO_CD: Record<string, string> = {
  L1: 'CD1',
  L2: 'CD2',
  L3: 'CD3',
  R1: 'CD4',
  R2: 'CD5',
  R3: 'CD6',
}

const CD_TO_SERVER: Record<string, string> = {
  CD1: 'L1',
  CD2: 'L2',
  CD3: 'L3',
  CD4: 'R1',
  CD5: 'R2',
  CD6: 'R3',
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
