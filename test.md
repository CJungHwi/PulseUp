# Workout Validation

`tools/workout-validation.ts` 는 `workoutExercises` 생성 순서와 preload 브로드캐스트를 한 번에 검증하는 실행 스크립트입니다.

## 실행 방법

```bash
npx tsx tools/workout-validation.ts
```

## 검증 범위

- `Stress`
  - 운동 6개 / 3라운드
  - 운동 12개 / 전후반 분리
- `Loop`
  - 운동 6개 / 마지막 water 생략
  - 운동 12개 / 전후반 water
- `AMRAP`
  - 1패널 / 운동 6개
  - 2패널 / 운동 12개
- `EMOM`
  - 운동 6개 / 후반전 없음
  - 운동 12개 / 마지막 round water
  - 운동 12개 / 마지막 round rest

## preload 검증 범위

- `Stress` timeline preload
- `AMRAP` timeline preload
- `Loop`
  - timeline preload
  - next group preload
  - water 중 next group video preload
  - cool down preload
- `EMOM`
  - timeline preload
  - next group preload
  - water 중 next group video preload
  - cool down preload

## 출력 형식

- `PASS`: 해당 케이스의 핵심 규칙이 기대값과 일치
- `FAIL`: 규칙 위반이 있어 수정 필요
- 각 케이스 아래에는 실제 생성 순서 또는 preload broadcast 요약이 텍스트로 출력됨

## 주의

- 이 스크립트는 저장 로직과 preload 로직을 빠르게 검증하기 위한 도구입니다.
- 실제 UI 렌더링 결과까지 완전히 대체하지는 않습니다.
- package 설정은 건드리지 않았으므로 `npx tsx ...`로 직접 실행해야 합니다.
