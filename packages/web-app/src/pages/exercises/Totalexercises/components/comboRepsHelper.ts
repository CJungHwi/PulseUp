/**
 * COMBO 반복 횟수 — 목록 순서(1-based) 기준 슬롯 매핑
 * 1,4,7,10… → 운동설정 1번 / 2,5,8,11… → 2번 / 3,6,9,12… → 3번
 */
import { COMBO_GROUP_SIZE } from '../../shared/saveWorkout'
import type { Exercise, PanelRow } from '../../shared/types'

export const COMBO_REPS_GUIDE_TEXT =
  'COMBO 반복 횟수: 운동설정(운동1·2·3)의 반복 횟수를 기준으로, 메인 목록 순서 1·4·7·10…번은 1번, 2·5·8·11…번은 2번, 3·6·9·12…번은 3번 횟수가 자동 지정됩니다.'

export const getComboRepsForListIndex = (
  listIndex: number,
  panelRows: PanelRow[],
  fallback = 10,
): number => {
  const slotIdx = listIndex % COMBO_GROUP_SIZE
  const reps = Number(panelRows[slotIdx]?.reps ?? 0)
  return reps > 0 ? reps : fallback
}

export const applyComboRepsByListOrder = (
  exerciseList: Exercise[],
  panelRows: PanelRow[],
): Exercise[] =>
  exerciseList.map((ex, idx) => ({
    ...ex,
    reps: getComboRepsForListIndex(idx, panelRows),
  }))
