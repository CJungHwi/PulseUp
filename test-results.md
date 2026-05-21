# Workout Validation Results

`tools/workout-validation.ts` 실행 기준 최신 검증 결과 요약입니다.

## Summary

| 항목 | 값 |
|---|---|
| 실행 파일 | `tools/workout-validation.ts` |
| 총 검증 케이스 | `13` |
| 실패 체크 | `0` |
| 최종 결과 | `PASS` |

## Sequence Validation

| 구분 | 케이스 | 기대 규칙 | 결과 |
|---|---|---|---|
| Stress | 운동 6개 / 3라운드 | 후반 없음, 마지막 water 없음 | PASS |
| Stress | 운동 12개 / 전후반 분리 | 전반 마지막에 water 1회 | PASS |
| Loop | 운동 6개 / 마지막 water 생략 | 후반 없음, 마지막 water 없음 | PASS |
| Loop | 운동 12개 / 전후반 water | 전반 마지막에 water 1회 | PASS |
| AMRAP | 1패널 / 운동 6개 | exercise만 생성 | PASS |
| AMRAP | 2패널 / 운동 12개 | 전후반 사이 water/rest 반영 | PASS |
| EMOM | 운동 6개 / 후반전 없음 | 마지막 rest/water 없음 | PASS |
| EMOM | 운동 12개 / round 3 water | round 3 끝 water 1회 | PASS |
| EMOM | 운동 12개 / round 3 rest | round 3 끝 rest 1회 | PASS |

## Preload Validation

| 구분 | 케이스 | 검증 포인트 | 결과 |
|---|---|---|---|
| Stress | timeline preload | 첫 preload broadcast 생성 | PASS |
| AMRAP | timeline preload | 첫 preload broadcast 생성 | PASS |
| Loop | timeline + next group + water + CD | 다음 그룹 preload, water 중 preload, CD preload | PASS |
| EMOM | timeline + next group + water + CD | 다음 그룹 preload, water 중 preload, CD preload | PASS |

## Notes

| 항목 | 내용 |
|---|---|
| EMOM 6개 | 후반 그룹이 없으므로 마지막 `rest` / `water`는 생성되지 않음 |
| EMOM 12개 | 전반 마지막 라운드의 설정값에 따라 `rest` 또는 `water`가 1회만 생성됨 |
| Loop / EMOM preload | 다음 그룹(`L4~R4`) preload와 cool down preload까지 확인됨 |
