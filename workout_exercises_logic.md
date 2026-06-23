# workout_exercises 테이블 저장 로직

## 개요

운동 실행 순서를 `workout_exercises` 테이블에 저장하는 로직을 설명합니다.
Main 운동은 **Stress**와 **Loop** 두 가지 방식이 있습니다.
**AMRAP/EMOM**은 Loop와 유사하나, 6개 그룹 단위가 아닌 전체 운동 순차 실행 방식입니다.

## 운동 순서 대전제

모든 Main 운동은 다음 순서로 진행됩니다:

```
전반전: A1 → A2 → A3 → B3 → B2 → B1 → 물보충
후반전: C1 → C2 → C3 → D3 → D2 → D1
...
```

- 6개 운동 단위로 전반전/후반전 구분
- 물보충은 6개 그룹 끝날 때만 추가 (마지막 그룹 제외)

---

## 운동 방식별 실행 순서

### 1. Main Stress 방식 (완료)

**운동 설정 예시:**

| Round | 운동 | 휴식 | 물보충 |
|-------|------|------|--------|
| 1     | 60초 | 20초 | 0      |
| 2     | 40초 | 15초 | 0      |
| 3     | 20초 | 10초 | 60초   |

**실행 순서:**

> Dynamic Stretching → Main → Cool Down

```
전반전:
  A1: 60초(운동) → 20초(휴식) → 40초(운동) → 15초(휴식) → 20초(운동) → 10초(휴식)
  A2: 60초(운동) → 20초(휴식) → 40초(운동) → 15초(휴식) → 20초(운동) → 10초(휴식)
  A3: 60초(운동) → 20초(휴식) → 40초(운동) → 15초(휴식) → 20초(운동) → 10초(휴식)
  B3: 60초(운동) → 20초(휴식) → 40초(운동) → 15초(휴식) → 20초(운동) → 10초(휴식)
  B2: 60초(운동) → 20초(휴식) → 40초(운동) → 15초(휴식) → 20초(운동) → 10초(휴식)
  B1: 60초(운동) → 20초(휴식) → 40초(운동) → 15초(휴식) → 20초(운동) → 물보충 60초

후반전:
  C1: 60초(운동) → 20초(휴식) → 40초(운동) → 15초(휴식) → 20초(운동) → 10초(휴식)
  C2: 60초(운동) → 20초(휴식) → 40초(운동) → 15초(휴식) → 20초(운동) → 10초(휴식)
  C3: 60초(운동) → 20초(휴식) → 40초(운동) → 15초(휴식) → 20초(운동) → 10초(휴식)
  D3: 60초(운동) → 20초(휴식) → 40초(운동) → 15초(휴식) → 20초(운동) → 10초(휴식)
  D2: 60초(운동) → 20초(휴식) → 40초(운동) → 15초(휴식) → 20초(운동) → 10초(휴식)
  D1: 60초(운동) → 20초(휴식) → 40초(운동) → 15초(휴식) → 20초(운동)
```

**특징:**

- 각 운동을 모든 라운드에서 연속 실행
- 라운드별 시간이 다름 (60초 → 40초 → 20초)
- **마지막 라운드 뒤에도 휴식 추가** (다음 운동으로 넘어가기 전 쉬는 시간)
- 6개 그룹 끝(B1/D1 등)의 마지막 라운드에서는 물보충이 휴식을 대체
- 마지막 운동(D1)의 마지막 라운드 뒤에는 휴식/물보충 없음
- 물보충은 마지막 라운드에 설정된 값 사용
- 6개 운동 그룹 끝날 때만 물보충 (마지막 그룹 제외)
- **운동 6개만**이면 전반전만 진행하며, **물보충 없음** (후반전이 없으면 B1 뒤 물보충 생략)

### 2. Main Loop 방식 (완료)

**운동 설정 예시:**

| Round | 시간 | 휴식 | 물보충 |
|-------|------|------|--------|
| 1     | 60초 | 20초 | 0      |
| 2     | 40초 | 15초 | 0      |
| 3     | 20초 | 10초 | 60초   |

**실행 순서 (DB 저장 시 Round 번호):**

> Dynamic Stretching → Main → Cool Down

```
전반전 :
  Round 1: A1 60초(운동) → 20초(휴식) → A2 60초(운동) → 20초(휴식) → A3 60초(운동) → 20초(휴식) → B3 60초(운동) → 20초(휴식) → B2 60초(운동) → 20초(휴식) → B1 60초(운동) → 20초(휴식)
  Round 2: A1 40초(운동) → 15초(휴식) → A2 40초(운동) → 15초(휴식) → A3 40초(운동) → 15초(휴식) → B3 40초(운동) → 15초(휴식) → B2 40초(운동) → 15초(휴식) → B1 40초(운동) → 15초(휴식)
  Round 3: A1 20초(운동) → 10초(휴식) → A2 20초(운동) → 10초(휴식) → A3 20초(운동) → 10초(휴식) → B3 20초(운동) → 10초(휴식) → B2 20초(운동) → 10초(휴식) → B1 20초(운동) → 물보충 60초

후반전 :
  Round 4: C1 60초(운동) → 20초(휴식) → C2 60초(운동) → 20초(휴식) → C3 60초(운동) → 20초(휴식) → D3 60초(운동) → 20초(휴식) → D2 60초(운동) → 20초(휴식) → D1 60초(운동) → 20초(휴식)
  Round 5: C1 40초(운동) → 15초(휴식) → C2 40초(운동) → 15초(휴식) → C3 40초(운동) → 15초(휴식) → D3 40초(운동) → 15초(휴식) → D2 40초(운동) → 15초(휴식) → D1 40초(운동) → 15초(휴식)
  Round 6: C1 20초(운동) → 10초(휴식) → C2 20초(운동) → 10초(휴식) → C3 20초(운동) → 10초(휴식) → D3 20초(운동) → 10초(휴식) → D2 20초(운동) → 10초(휴식) → D1 20초(운동)
```

**특징:**

- 6개 운동 그룹(전반전/후반전) 단위로 모든 라운드 실행
- **그룹별로 고유한 Round 번호**: 전반전(1,2,3), 후반전(4,5,6)
- Stress와 동일하게 라운드별 시간이 다름 (60초 → 40초 → 20초)
- 물보충은 마지막 라운드에 설정된 값 사용
- 6개 운동 그룹 끝날 때만 물보충 (마지막 그룹 제외)
- **운동 6개만**이면 전반전 Round만 돌고 **물보충 없음** (후반 그룹이 없으면 Round 3 끝의 물보충 생략)

**Stress vs Loop 차이:**

- **Stress**: 운동 중심 (A1을 Rnd1→Rnd2→Rnd3 반복 후 A2로 이동)
- **Loop**: 라운드 중심 (Rnd1에서 A1→A2→A3→B3→B2→B1 실행 후 Rnd2로 이동)

---

### 3. EMOM - Loop 방식(완료)

**운동 설정 예시:**

| Round | 시간 | 휴식 |
|-------|------|------|
| 1     | 3분  |      |
| 2     | 2분  |      |
| 3     | 1분  | 1분  |

**실행 순서 (DB 저장 시 Round 번호):**

> Dynamic Stretching → Main → Cool Down

```
전반전:
  A1(3분/10회) → A2(3분/10회) → A3(3분/10회) → B3(3분/10회) → B2(3분/10회) → B1(3분/10회)  [1 Round 끝]
  → A1(2분/8회) → A2(2분/8회) → A3(2분/8회) → B3(2분/8회) → B2(2분/8회) → B1(2분/8회)      [2 Round 끝]
  → A1(1분/7회) → A2(1분/7회) → A3(1분/7회) → B3(1분/7회) → B2(1분/7회) → B1(1분/7회) → 물보충 1분  [3 Round 끝]

후반전:
  C1(3분/10회) → C2(3분/10회) → C3(3분/10회) → D3(3분/10회) → D2(3분/10회) → D1(3분/10회)  [1 Round 끝]
  → C1(2분/8회) → C2(2분/8회) → C3(2분/8회) → D3(2분/8회) → D2(2분/8회) → D1(2분/8회)      [2 Round 끝]
  → C1(1분/7회) → C2(1분/7회) → C3(1분/7회) → D3(1분/7회) → D2(1분/7회) → D1(1분/7회)      [3 Round 끝]
```

**특징 (저장·재생과 동일 기준):**

- **6포지션 블록 단위**: 전반 A1–A3/B1–B3, 후반 C1–C3/D1–D3 (`sortExercisesForExecution` → `EMOM_LAP_ORDER` 와 동일 순서)
- **세션 Round 번호**는 Stress/Loop와 같다: 설계(패널) 행이 N개이면 **전반 `1…N`**, **후반 `N+1…2N`** (`generateEmomWorkoutExercises` 의 `round = groupIdx * panelRows.length + roundIndex + 1`). 아래 예시에서 전반 끝=3, 후반 시작=4
- 플랜 **각 행의 `time`**(분→초)이 그 행에서 **랩당(슬롯당) EMOM 구간 길이**이다. 같은 행 안에서는 **운동 6개를 연속 배치**하고, 행과 행 사이에만 `rest` 1회 (마지막 행은 그룹 마무리 규칙에 따라 `water`/`rest`)
- **운동 6개만**(한 블록)이면 전반만 생성·재생하고, 후반·그룹 사이 전환(`numGroups === 1`) 시 문서상 전반 끝 물/휴식은 저장 로직에 맞게 생략될 수 있다

**Electron 재생:** `runEmomMainRound`는 DB 시퀀스 순서대로 진행하며, 라운드 시작 시 `sortEmomDisplaySequences`로 랩 순서를 한 번 더 확정한다. **운동 스텝 IPC에는 항상 실제 `position`(A1…D1 등)** 을 실어 그리드·set 전환이 문서 순서와 맞는다 (`KEEP_VIDEO`는 휴식/물 등 비운동 경로용).

### 4. EMOM - Stress 방식 (완료)

**운동 설정 예시:**

| SET   | 시간  |  횟수 |  휴식 | 물보충 |
|-------|------|-------|-------|--------|
| 1     | 3분  |   10  |       |        |
| 2     | 2분  |   10  |       |        |
| 3     | 1분  |   10  |       |   1분  |

**실행 순서 (DB 저장 시 Round 번호):**

> Dynamic Stretching → Main → Cool Down

```
전반전
  A1: 3분(운동 / 10회 : Set 1/3 MOVE 1/6) → 2분(운동 / 10회 : Set 2/3 MOVE 1/6) → 1분(운동 / 10회 : Set 3/3 MOVE 1/6)
  A2: 3분(운동 / 10회 : Set 1/3 MOVE 2/6) → 2분(운동 / 10회 : Set 2/3 MOVE 2/6) → 1분(운동 / 10회 : Set 3/3 MOVE 2/6)
  A3: 3분(운동 / 10회 : Set 1/3 MOVE 3/6) → 2분(운동 / 10회 : Set 2/3 MOVE 3/6) → 1분(운동 / 10회 : Set 3/3 MOVE 3/6)
  B3: 3분(운동 / 10회 : Set 1/3 MOVE 4/6) → 2분(운동 / 10회 : Set 2/3 MOVE 4/6) → 1분(운동 / 10회 : Set 3/3 MOVE 4/6)
  B2: 3분(운동 / 10회 : Set 1/3 MOVE 5/6) → 2분(운동 / 10회 : Set 2/3 MOVE 5/6) → 1분(운동 / 10회 : Set 3/3 MOVE 5/6)
  B1: 3분(운동 / 10회 : Set 1/3 MOVE 6/6) → 2분(운동 / 10회 : Set 2/3 MOVE 6/6) → 1분(운동 / 10회 : Set 3/3 MOVE 6/6) → 물보충 60초

후반전:
  C1: 3분(운동 / 10회 : Set 1/3 MOVE 1/6) → 2분(운동 / 10회 : Set 2/3 MOVE 1/6) → 1분(운동 / 10회 : Set 3/3 MOVE 1/6)
  C2: 3분(운동 / 10회 : Set 1/3 MOVE 2/6) → 2분(운동 / 10회 : Set 2/3 MOVE 2/6) → 1분(운동 / 10회 : Set 3/3 MOVE 2/6)
  C3: 3분(운동 / 10회 : Set 1/3 MOVE 3/6) → 2분(운동 / 10회 : Set 2/3 MOVE 3/6) → 1분(운동 / 10회 : Set 3/3 MOVE 3/6)
  D3: 3분(운동 / 10회 : Set 1/3 MOVE 4/6) → 2분(운동 / 10회 : Set 2/3 MOVE 4/6) → 1분(운동 / 10회 : Set 3/3 MOVE 4/6)
  D2: 3분(운동 / 10회 : Set 1/3 MOVE 5/6) → 2분(운동 / 10회 : Set 2/3 MOVE 5/6) → 1분(운동 / 10회 : Set 3/3 MOVE 5/6)
  D1: 3분(운동 / 10회 : Set 1/3 MOVE 6/6) → 2분(운동 / 10회 : Set 2/3 MOVE 6/6) → 1분(운동 / 10회 : Set 3/3 MOVE 6/6)
```

---

### 5. AMRAP 방식

**운동 설정(설계 영역)**은 **1건 또는 2건**이다. 2건일 때 1행 = **전반전**, 2행 = **후반전** 설정이다. (시간·휴식·물보충·reps 등은 행마다 독립.)

**메인 운동**은 position 정렬(`A1→A2→A3→B3→B2→B1` …) 후 **앞 6개**가 전반전 블록, **다음 6개**가 후반전 블록에 대응한다.

- **운동 12개 · 설계 2건**: 전반 6개(Round 1) · 후반 6개(Round 2)
- **운동 6개 · 설계 2건**: 동일 6슬롯을 Round 1(전반 행) · Round 2(후반 행)로 **두 번** 실행
- **운동 6개 · 설계 1건**: 전반 6슬롯 1그룹만 시퀀스에 올라감 (후반 없음)

#### 운동 설정 예시 1: 설계 2개, 운동 12개

| 구분           | 시간 | 휴식 |
|----------------|------|------|
| 전반 (Round 1) | 10분 | 1분  |
| 후반 (Round 2) | 5분  |      |

**실행 순서:**

```
전반전 (Round 1): 전반 행 시간 동안 A1→…→B1 AMRAP 반복 → 휴식 1분
후반전 (Round 2): 후반 행 시간 동안 C1→…→D1 AMRAP 반복
```

#### 운동 설정 예시 2: 설계 2개, 운동 6개

| 구분           | 시간 | 휴식 |
|----------------|------|------|
| 전반 (Round 1) | 10분 | 1분  |
| 후반 (Round 2) | 5분  |      |

**실행 순서:**

```
전반전 (Round 1): 전반 행 시간 동안 A1→…→B1 AMRAP 반복 → 휴식 1분
후반전 (Round 2): 후반 행 시간 동안 A1→…→B1 AMRAP 반복
```

#### 운동 설정 예시 3: 설계 1개, 운동 12개

| 구분           | 시간 | 휴식 |
|----------------|------|------|
| 전반 (Round 1) | 10분 | 1분  |

**실행 순서:**

```
전반전 (Round 1): 전반 행 시간 동안 A1→…→B1 AMRAP 반복 → 휴식 1분
후반전 (Round 2): 전반 행 시간 동안 C1→…→D1 AMRAP 반복
```

#### 운동 설정 예시 4: 설계 1개, 운동 6개 (전반 6슬롯 1그룹)

| 구분           | 시간 | 휴식 |
|----------------|------|------|
| 전반 (Round 1) | 10분 | 1분  |

**실행 순서:**

```
전반전 (Round 1): 전반 행 시간 동안 A1→…→B1 AMRAP 반복
```

> 후반이 없으므로 **마지막 그룹 뒤**에는 전반 행에 적힌 휴식·물보충이 **시퀀스에 넣어지지 않음**.

**특징:**

- **설계 1~2건**: 2건이면 전반·후반 행 각각 등록, 1건이면 전반 행만 사용 (후반은 운동 개수에 따라 시퀀스에만 반영)
- **그룹별 Round 번호**: 전반전 = 보통 Round 1, 후반전 = Round 2
- 각 **반**은 해당 행의 **시간(분)** 동안 그룹 내 운동을 reps 기준으로 반복한다
- **전반과 후반 사이**에만 전반 행에 설정한 **물보충·휴식**이 올 수 있다 (마지막 그룹 뒤에는 없음)

---

### AMRAP vs EMOM vs Loop 비교

| 항목     | Loop       | AMRAP                    | EMOM         |
|----------|------------|--------------------------|--------------|
| 그룹화   | 6개 단위   | 6개 단위                 | 6개 단위     |
| 시간 설정| 초 (운동당)| 분 (그룹 전체)           | 분 (운동당)  |
| 진행 방식| 운동별 순차| 그룹 내 반복             | 운동별 순차  |
| reps     | 없음       | 있음                     | 있음         |
| 물보충   | 있음       | 전·후반 사이(전반 행 설정) 가능 | 없음   |

---

## 저장 순서 (전체 구조)

### 1. Dynamic Stretching (맨 앞)

- **Round**: 0
- **exercise_type**: `exercise`
- **휴식/물보충**: 없음 (연속 저장)

### 2. Main 운동 (중간)

- **Round**: 1, 2, 3, ... (실제 라운드)
- **exercise_type**: `exercise`, `rest`, `water`
- **방식에 따른 패턴**: Stress 또는 Loop

### 3. Cool Down (맨 끝)

- **Round**: 99
- **exercise_type**: `exercise`
- **휴식/물보충**: 없음 (연속 저장)

---

## 프론트엔드 데이터 생성

### 파일 위치

`packages/web-app/src/pages/exercises/Totalexercises/saveWorkout.ts`

### sortExercisesForExecution() - 운동 순서 정렬

```typescript
/**
 * 운동 순서를 A1→A2→A3→B3→B2→B1 순서로 정렬
 * 6개씩 그룹화하여 L그룹은 오름차순, R그룹은 내림차순
 */
const sortExercisesForExecution = (exercises: Exercise[]): Exercise[] => {
    // position 파싱: A1, A2, B3 등
    // 6개씩 그룹화 (A1-3, B1-3 = 그룹0 / C1-3, D1-3 = 그룹1)
    // L 그룹: 숫자 오름차순 (A1, A2, A3)
    // R 그룹: 숫자 내림차순 (B3, B2, B1)
    return sortedExercises
}
```

### generateWorkoutExercises() - Stress/Loop 분기

```typescript
if (circuitType === 'stress') {
    // Stress: 각 운동을 모든 라운드에서 반복
    sortedExercises.forEach((ex, exIndex) => {
        const isEndOfGroup = (exIndex + 1) % 6 === 0
        const isLastExercise = exIndex === sortedExercises.length - 1

        panelRows.forEach((row, setIndex) => {
            // 운동 추가 (duration: row.time)
            const isLastSet = setIndex === panelRows.length - 1

            if (isLastSet) {
                // 마지막 라운드: 그룹 끝이면 물보충(마지막 그룹 제외), 아니면 휴식
                if (isEndOfGroup && !isLastExercise) {
                    // 물보충 추가 (duration: lastRow.waterBreak)
                } else if (!isLastExercise && row.rest > 0) {
                    // 휴식 추가 (duration: row.rest)
                }
            } else {
                // 마지막 라운드가 아닌 경우: 항상 휴식 추가
                if (row.rest > 0) {
                    // 휴식 추가 (duration: row.rest)
                }
            }
        })
    })
} else {
    // Loop: 6개 그룹 단위로 모든 라운드 실행
    const groupSize = 6
    const numGroups = Math.ceil(sortedExercises.length / groupSize)

    for (let groupIdx = 0; groupIdx < numGroups; groupIdx++) {
        const groupExercises = sortedExercises.slice(groupStart, groupEnd)
        const isLastGroup = groupIdx === numGroups - 1

        // 각 라운드별로 그룹 내 모든 운동 실행
        panelRows.forEach((row, roundIndex) => {
            const isLastRound = roundIndex === panelRows.length - 1

            // 그룹 내 각 운동 추가 (duration: row.time)
            groupExercises.forEach((ex) => {
                // 운동 추가
            })

            if (isLastRound) {
                // 마지막 라운드: 마지막 그룹이 아니면 물보충 추가
                if (!isLastGroup && lastRow.waterBreak > 0) {
                    // 물보충 추가
                }
            } else {
                // 마지막 라운드가 아니면 휴식 추가
                if (row.rest > 0) {
                    // 휴식 추가
                }
            }
        })
    }
}
```

---

## 데이터 구조 예시

### Stress 방식 (3라운드, 12개 운동)

```
sequence | round | exercise_type | exercise_name | duration | position
---------|-------|---------------|---------------|----------|----------
1        | 0     | exercise      | DS운동1       | 30       | DS1
2        | 0     | exercise      | DS운동2       | 30       | DS2
-- A1: 모든 라운드 실행 후 휴식
3        | 1     | exercise      | A1운동        | 60       | A1
4        | 1     | rest          | 휴식          | 20       | NULL
5        | 2     | exercise      | A1운동        | 40       | A1
6        | 2     | rest          | 휴식          | 15       | NULL
7        | 3     | exercise      | A1운동        | 20       | A1
8        | 3     | rest          | 휴식          | 10       | NULL
-- A2~C2: 동일 패턴 (마지막 라운드 뒤에도 휴식)
...
-- C1: 마지막 라운드 뒤 물보충 (그룹 끝)
N        | 1     | exercise      | C1운동        | 60       | C1
N+1      | 1     | rest          | 휴식          | 20       | NULL
N+2      | 2     | exercise      | C1운동        | 40       | C1
N+3      | 2     | rest          | 휴식          | 15       | NULL
N+4      | 3     | exercise      | C1운동        | 20       | C1
N+5      | 3     | water         | 물보충        | 60       | NULL
-- B1~D2: 동일 패턴 (마지막 라운드 뒤에도 휴식)
...
-- D1: 마지막 운동 → 마지막 라운드 뒤 아무것도 없음
M-2      | 3     | exercise      | D1운동        | 20       | D1
M-1      | 99    | exercise      | CD운동1       | 30       | CD1
M        | 99    | exercise      | CD운동2       | 30       | CD2
```

### Loop 방식 (3라운드, 12개 운동)

```
sequence | round | exercise_type | exercise_name | duration | position
---------|-------|---------------|---------------|----------|----------
1        | 0     | exercise      | DS운동1       | 30       | DS1
-- 전반전 Round 1
2        | 1     | exercise      | A1운동        | 60       | A1
3        | 1     | exercise      | A2운동        | 60       | A2
4        | 1     | exercise      | A3운동        | 60       | A3
5        | 1     | exercise      | C3운동        | 60       | C3
6        | 1     | exercise      | C2운동        | 60       | C2
7        | 1     | exercise      | C1운동        | 60       | C1
8        | 1     | rest          | 휴식          | 20       | NULL
-- 전반전 Round 2
9        | 2     | exercise      | A1운동        | 40       | A1
10       | 2     | exercise      | A2운동        | 40       | A2
... (A3, C3, C2, C1)
N        | 2     | rest          | 휴식          | 20       | NULL
-- 전반전 Round 3
N+1      | 3     | exercise      | A1운동        | 20       | A1
... (A2, A3, C3, C2, C1)
N+6      | 3     | water         | 물보충        | 60       | NULL
-- 후반전 Round 4
N+7      | 4     | exercise      | B1운동        | 60       | B1
... (B2, B3, D3, D2, D1)
N+12     | 4     | rest          | 휴식          | 20       | NULL
-- 후반전 Round 5, 6 (동일 패턴)
...
M        | 99    | exercise      | CD운동1       | 30       | CD1
```

**Loop 데이터 구조 특징:**

- 6개 운동 그룹(전반전) → 모든 라운드 실행 → 물보충 → 6개 운동 그룹(후반전) → 모든 라운드 실행
- 라운드 간 휴식 (마지막 라운드 제외)
- 그룹 끝(마지막 라운드)에 물보충 (마지막 그룹 제외)

---

## 저장 데이터 형태 (API 전송)

```json
{
    "workoutExercises": [
        {
            "sequence": 1,
            "round": 1,
            "exercise_type": "exercise",
            "exercise_id": "ex1",
            "name": "운동A",
            "duration": 60,
            "position": "A1"
        },
        {
            "sequence": 2,
            "round": 1,
            "exercise_type": "rest",
            "exercise_id": null,
            "name": "휴식",
            "duration": 20,
            "position": null
        },
        {
            "sequence": 3,
            "round": 1,
            "exercise_type": "water",
            "exercise_id": null,
            "name": "물보충",
            "duration": 60,
            "position": null
        }
    ]
}
```

---

## 주요 특징

1. **연속된 순서**: `sequence`로 전체 순서 관리
2. **Round 구분**: Dynamic(0), 실제 라운드(1,2,3...), CoolDown(99)
3. **타입 구분**: exercise, rest, water
4. **위치 정보**: 운동일 때만 position 값 저장
5. **휴식/물보충**: exercise_id는 NULL, position은 NULL
6. **라운드 개수 가변**: 1~4개 라운드 지원, panelRows 동적 처리
7. **설정값 기반**: 저장 시 사용자가 UI에서 설정한 panelRows 값 사용 (DB 기본값 아님)

---

## 설정값 처리

### 기본값 (workout_setting 테이블)

- DB에 저장된 기본 설정값
- UI 초기 로드 시 기본값 제공 용도
- 파일: `packages/api-server/database/create_workout_setting.sql`

### 저장 시 설정값

- 사용자가 UI에서 수정한 `panelRows` 값을 그대로 사용
- 날짜/운동마다 다른 설정값 저장 가능
- `row.time`, `row.rest`, `row.waterBreak` 등 panelRows의 현재 값 사용

```typescript
// saveCircuit에서 현재 panelRows 값 그대로 사용
const planData = panelRows.map(row => ({
    round: row.round,
    time: row.time,        // 사용자가 설정한 값
    rest: row.rest,        // 사용자가 설정한 값
    hydration: row.waterBreak,  // 사용자가 설정한 값
}))
```

---

## 관련 파일

- **저장 로직**: `packages/web-app/src/pages/exercises/Totalexercises/saveWorkout.ts`
- **UI 컴포넌트**: `packages/web-app/src/pages/exercises/Totalexercises/Totalexercises.tsx`
- **에디터**: `packages/web-app/src/pages/exercises/Totalexercises/components/WorkoutEditor.tsx`
- **테이블**: `packages/api-server/database/create_workout_exercises.sql`
- **저장 프로시저**: `packages/api-server/database/sp_save_power_circuit_new.sql`
- **조회 프로시저**: `packages/api-server/database/sp_get_workout_exercises.sql`
- **API**: `packages/api-server/src/routes/workoutCategories.routes.ts`
