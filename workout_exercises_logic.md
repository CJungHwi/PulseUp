# workout_exercises 테이블 저장 로직

## 개요
운동 실행 순서를 `workout_exercises` 테이블에 저장하는 로직을 설명합니다.
Main 운동은 **Stress**와 **Loop** 두 가지 방식이 있습니다.
**AMRAP/EMOM**은 Loop와 유사하나, 6개 그룹 단위가 아닌 전체 운동 순차 실행 방식입니다.

## 운동 순서 대전제

모든 Main 운동은 다음 순서로 진행됩니다:

```
전반전: L1 → L2 → L3 → R3 → R2 → R1 → 물보충
후반전: L4 → L5 → L6 → R6 → R5 → R4 → 물보충
...
```

- 6개 운동 단위로 전반전/후반전 구분
- L 그룹은 오름차순 (L1, L2, L3)
- R 그룹은 내림차순 (R3, R2, R1)
- 물보충은 6개 그룹 끝날 때만 추가 (마지막 그룹 제외)

**Stress / Loop / EMOM 공통:** 메인 운동이 **6개뿐이면 전반전(L1→…→R1)만** 수행하고 후반전 블록은 없다. 이 경우 **그룹 사이 물보충은 넣지 않는다**(후반으로 이어질 때만 물보충이 의미 있음).

---

## 운동 방식별 실행 순서

### 1. Stress 방식 (각 운동을 모든 라운드에서 반복)

**운동 설정 예시:**
| Round | 운동 | 휴식 | 물보충 |
|-------|------|-----|--------|
| 1     | 60초 | 20초 |     0 |
| 2     | 40초 | 15초 |     0 |
| 3     | 20초 | 10초 |  60초 |

**실행 순서:**

dynamic stratching
```
전반전:
  L1: 60초(운동) → 20초(휴식) → 40초(운동) → 15초(휴식) → 20초(운동) → 10초(휴식)
  L2: 60초(운동) → 20초(휴식) → 40초(운동) → 15초(휴식) → 20초(운동) → 10초(휴식)
  L3: 60초(운동) → 20초(휴식) → 40초(운동) → 15초(휴식) → 20초(운동) → 10초(휴식)
  R3: 60초(운동) → 20초(휴식) → 40초(운동) → 15초(휴식) → 20초(운동) → 10초(휴식)
  R2: 60초(운동) → 20초(휴식) → 40초(운동) → 15초(휴식) → 20초(운동) → 10초(휴식)
  R1: 60초(운동) → 20초(휴식) → 40초(운동) → 15초(휴식) → 20초(운동) → 물보충 60초

후반전:
  L4: 60초(운동) → 20초(휴식) → 40초(운동) → 15초(휴식) → 20초(운동) → 10초(휴식)
  L5: 60초(운동) → 20초(휴식) → 40초(운동) → 15초(휴식) → 20초(운동) → 10초(휴식)
  L6: 60초(운동) → 20초(휴식) → 40초(운동) → 15초(휴식) → 20초(운동) → 10초(휴식)
  R6: 60초(운동) → 20초(휴식) → 40초(운동) → 15초(휴식) → 20초(운동) → 10초(휴식)
  R5: 60초(운동) → 20초(휴식) → 40초(운동) → 15초(휴식) → 20초(운동) → 10초(휴식)
  R4: 60초(운동) → 20초(휴식) → 40초(운동) → 15초(휴식) → 20초(운동)
```
Cool Down
```

**특징:**
- 각 운동을 모든 라운드에서 연속 실행
- 라운드별 시간이 다름 (60초 → 40초 → 20초)
- **마지막 라운드 뒤에도 휴식 추가** (다음 운동으로 넘어가기 전 쉬는 시간)
- 6개 그룹 끝(R1/R4 등)의 마지막 라운드에서는 물보충이 휴식을 대체
- 마지막 운동(R4)의 마지막 라운드 뒤에는 휴식/물보충 없음
- 물보충은 마지막 라운드에 설정된 값 사용
- 6개 운동 그룹 끝날 때만 물보충 (마지막 그룹 제외)
- **운동 6개만**이면 전반전만 진행하며, **물보충 없음**(후반전이 없으면 R1 뒤 물보충 생략)

---

### 2. Loop 방식 (6개 그룹 단위로 모든 라운드 실행)

**운동 설정 예시:**
| Round | 시간 | 휴식 | 물보충 |
|-------|------|------|-------|
| 1     | 60초 | 20초 |     0 |
| 2     | 40초 | 15초 |     0 |
| 3     | 20초 | 10초 |  60초 |

**실행 순서 (DB 저장 시 Round 번호):**

dynamic stratching
``````
전반전 (L1-3, R3-1):
  Round 1: L1 60초(운동) → 20초(휴식) → L2 60초(운동) → 20초(휴식) → L3 60초(운동) → 20초(휴식) → R3 60초(운동) → 20초(휴식) → R2 60초(운동) → 20초(휴식) → R1 60초(운동) → 20초(휴식)
  Round 2: L1 40초(운동) → 15초(휴식) → L2 40초(운동) → 15초(휴식) → L3 40초(운동) → 15초(휴식) → R3 40초(운동) → 15초(휴식) → R2 40초(운동) → 15초(휴식) → R1 40초(운동) → 15초(휴식)
  Round 3: L1 20초(운동) → 10초(휴식) → L2 20초(운동) → 10초(휴식) → L3 20초(운동) → 10초(휴식) → R3 20초(운동) → 10초(휴식) → R2 20초(운동) → 10초(휴식) → R1 20초(운동) → 물보충 60초

후반전 (L4-6, R6-4):
  Round 4: L4 60초(운동) → 20초(휴식) → L5 60초(운동) → 20초(휴식) → L6 60초(운동) → 20초(휴식) → R6 60초(운동) → 20초(휴식) → R5 60초(운동) → 20초(휴식) → R4 60초(운동) → 20초(휴식) 
  Round 5: L4 40초(운동) → 15초(휴식) → L5 40초(운동) → 15초(휴식) → L6 40초(운동) → 15초(휴식) → R6 40초(운동) → 15초(휴식) → R5 40초(운동) → 15초(휴식) → R4 40초(운동) → 15초(휴식) 
  Round 6: L4 20초(운동) → 10초(휴식) → L5 20초(운동) → 10초(휴식) → L6 20초(운동) → 10초(휴식) → R6 20초(운동) → 10초(휴식) → R5 20초(운동) → 10초(휴식) → R4 20초(운동)
```
Cool Down


**특징:**
- 6개 운동 그룹(전반전/후반전) 단위로 모든 라운드 실행
- **그룹별로 고유한 Round 번호**: 전반전(1,2,3), 후반전(4,5,6)
- Stress와 동일하게 라운드별 시간이 다름 (60초 → 40초 → 20초)
- 물보충은 마지막 라운드에 설정된 값 사용
- 6개 운동 그룹 끝날 때만 물보충 (마지막 그룹 제외)
- **운동 6개만**이면 전반전 Round만 돌고 **물보충 없음**(후반 그룹이 없으면 Round 3 끝의 물보충 생략)

**Stress vs Loop 차이:**
- **Stress**: 운동 중심 (L1을 R1→R2→R3 반복 후 L2로 이동)
- **Loop**: 라운드 중심 (R1에서 L1→L2→L3→R3→R2→R1 실행 후 R2로 이동)

---

### 3. EMOM 방식 (그룹 전체 시간 내 반복)

**운동 설정 예시:**
| Round | 시간 | 휴식|
|-------|-----|-----|
| 1     | 3분 |     |
| 2     | 2분 |     |
| 3     | 1분 | 1분 |

**실행 순서 (DB 저장 시 Round 번호):**

dynamic stratching
``````
전반전 : L1(3분/10회)→L2(3분/10회)→L3(3분/10회)→R3(3분/10회)→R2(3분/10회)→R1(3분/10회)(1Round 끝)
→L1(2분/8회)→L2(2분/8회)→L3(2분/8회)→R3(2분/8회)→R2(2분/8회)→R1(2분/8회)(2Round 끝)
→L1(1분/7회)→L2(1분/7회)→L3(1분/7회)→R3(1분/7회)→R2(1분/7회)→R1(1분/7회)→물보충 1분 (3Round 끝)

후반전 : L4(3분/10회)→L5(3분/10회)→L6(3분/10회)→R6(3분/10회)→R5(3분/10회)→R4(3분/10회)(1Round 끝)
→L4(2분/8회)→L5(2분/8회)→L6(2분/8회)→R6(2분/8회)→R5(2분/8회)→R4(2분/8회)(2Round 끝)
→L4(1분/7회)→L5(1분/7회)→L6(1분/7회)→R6(1분/7회)→R5(1분/7회)→R4(1분/7회)(3Round 끝)
```
Cool Down


**특징 (저장·재생과 동일 기준):**
- **6포지션 블록 단위**: 전반 L1–L3/R1–R3, 후반 L4–L6/R4–R6 (`sortExercisesForExecution` → `EMOM_LAP_ORDER` 와 동일 순서).
- **세션 Round 번호**는 Stress/Loop와 같다: 설계(패널) 행이 N개이면 **전반 `1…N`**, **후반 `N+1…2N`** (`generateEmomWorkoutExercises` 의 `round = groupIdx * panelRows.length + roundIndex + 1`). 아래 예시에서 전반 끝=3, 후반 시작=4.
- 플랜 **각 행의 `time`**(분→초)이 그 행에서 **랩당(슬롯당) EMOM 구간 길이**이다. 같은 행 안에서는 **운동 6개를 연속 배치**하고, 행과 행 사이에만 `rest` 1회(마지막 행은 그룹 마무리 규칙에 따라 `water`/`rest`).
- **운동 6개만**(한 블록)이면 전반만 생성·재생하고, 후반·그룹 사이 전환(`numGroups === 1`) 시 문서상 전반 끝 물/휴식은 저장 로직에 맞게 생략될 수 있다.

**Electron 재생:** `runEmomMainRound`는 DB 시퀀스 순서대로 진행하며, 라운드 시작 시 `sortEmomDisplaySequences`로 랩 순서를 한 번 더 확정한다. **운동 스텝 IPC에는 항상 실제 `position`(L1…R4 등)** 을 실어 그리드·set 전환이 문서 순서와 맞는다(`KEEP_VIDEO`는 휴식/물등 비운동 경로용).

---

### 4. AMRAP 방식

**운동 설정(설계 영역)**은 **1건 또는 2건**이다. 2건일 때 1행 = **전반전**, 2행 = **후반전** 설정이다. (시간·휴식·물보충·reps 등은 행마다 독립.)

**메인 운동**은 position 정렬(`L1→L2→L3→R3→R2→R1` …) 후 **앞 6개**가 전반전 블록, **다음 6개**가 후반전 블록에 대응한다. **운동이 12개·설계 2건**이면 전반 6개(Round 1)·후반 6개(Round 2)로 나뉜다. **운동이 6개·설계 2건**이면 **동일 6슬롯**을 Round 1(전반 행)·Round 2(후반 행)로 **두 번** 실행한다. **운동이 6개·설계 1건**이면 전반 6슬롯 1그룹만 시퀀스에 올라간다(후반 없음).

**운동 설정 예시1 : 운동설정 2개, 운동종류 12개
| 구분 | 시간 | 휴식 |
|-----|------|------|
| 전반 (Round 1) | 10분| 1분 |
| 후반 (Round 2) | 5분 |     | 

**실행 순서 (DB 저장 시 Round 번호):**

dynamic stretching
```
전반전 (Round 1): 전반 행 시간 동안 L1→…→R1 AMRAP 반복  → 휴식 1분
후반전 (Round 2): 후반 행 시간 동안 L4→…→R4 AMRAP 반복
```
Cool Down


**운동 설정 예시2 : 운동설정 2개, 운동종류 6개
| 구분 | 시간 | 휴식 |
|-----|------|------|
| 전반 (Round 1) | 10분| 1분 |
| 후반 (Round 2) | 5분 |     | 

**실행 순서 (DB 저장 시 Round 번호):**

dynamic stretching
```
전반전 (Round 1): 전반 행 시간 동안 L1→…→R1 AMRAP 반복  → 휴식 1분
후반전 (Round 2): 후반 행 시간 동안 L1→…→R1 AMRAP 반복
```
Cool Down

**운동 설정 예시3 : 운동설정 1개, 운동종류 12개
| 구분 | 시간 | 휴식 |
|-----|------|------|
| 전반 (Round 1) | 10분| 1분 | 

**실행 순서 (DB 저장 시 Round 번호):**

dynamic stretching
```
전반전 (Round 1): 전반 행 시간 동안 L1→…→R1 AMRAP 반복  → 휴식 1분
후반전 (Round 2): 전반 행 시간 동안 L4→…→R4 AMRAP 반복
```
Cool Down

**운동 설정 예시4 : 운동설정 1개, 운동종류 6개 (전반 6슬롯 1그룹)
| 구분 | 시간 | 휴식 |
|-----|------|------|
| 전반 (Round 1) | 10분| 1분 | 

**실행 순서 (DB 저장 시 Round 번호):**

dynamic stretching
```
전반전 (Round 1): 전반 행 시간 동안 L1→…→R1 AMRAP 반복
```
Cool Down  
(후반이 없으므로 **마지막 그룹 뒤**에는 전반 행에 적힌 휴식·물보충이 **시퀀스에 넣어지지 않음**.)

**특징:**
- **설계 1~2건**: 2건이면 전반·후반 행 각각 등록, 1건이면 전반 행만 사용(후반은 운동 개수에 따라 시퀀스에만 반영).
- **그룹별 Round 번호**: 전반전 = 보통 Round 1, 후반전 = Round 2.
- 각 **반**은 해당 행의 **시간(분)** 동안 그룹 내 운동을 reps 기준으로 반복한다.
- **전반과 후반 사이**에만 전반 행에 설정한 **물보충·휴식**이 올 수 있다(마지막 그룹 뒤에는 없음).

---

### AMRAP vs EMOM vs Loop 비교

| 항목 | Loop | AMRAP | EMOM |
|------|------|-------|------|
| 그룹화 | 6개 단위 | 6개 단위 | 6개 단위 |
| 시간 설정 | 초 (운동당) | 분 (그룹 전체) | 분 (운동당) |
| 진행 방식 | 운동별 순차 | 그룹 내 반복 | 운동별 순차 |
| reps | 없음 | 있음 | 있음 |
| 물보충 | 있음 | 전·후반 사이(전반 행 설정) 가능 | 없음 |

---

## 저장 순서 (전체 구조)

### 1. Dynamic Stretching (맨 앞)
- **Round**: 0
- **exercise_type**: 'exercise'
- **휴식/물보충**: 없음 (연속 저장)

### 2. Main 운동 (중간)
- **Round**: 1, 2, 3, ... (실제 라운드)
- **exercise_type**: 'exercise', 'rest', 'water'
- **방식에 따른 패턴**: Stress 또는 Loop

### 3. Cool Down (맨 끝)
- **Round**: 99
- **exercise_type**: 'exercise'
- **휴식/물보충**: 없음 (연속 저장)

---

## 프론트엔드 데이터 생성

### 파일 위치
`packages/web-app/src/pages/exercises/Totalexercises/saveWorkout.ts`

### sortExercisesForExecution() - 운동 순서 정렬
```typescript
/**
 * 운동 순서를 L1→L2→L3→R3→R2→R1 순서로 정렬
 * 6개씩 그룹화하여 L그룹은 오름차순, R그룹은 내림차순
 */
const sortExercisesForExecution = (exercises: Exercise[]): Exercise[] => {
    // position 파싱: L1, L2, R3 등
    // 6개씩 그룹화 (L1-3, R1-3 = 그룹0 / L4-6, R4-6 = 그룹1)
    // L 그룹: 숫자 오름차순 (L1, L2, L3)
    // R 그룹: 숫자 내림차순 (R3, R2, R1)
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
-- L1: 모든 라운드 실행 후 휴식
3        | 1     | exercise      | L1운동        | 60       | L1
4        | 1     | rest          | 휴식          | 20       | NULL
5        | 2     | exercise      | L1운동        | 40       | L1
6        | 2     | rest          | 휴식          | 15       | NULL
7        | 3     | exercise      | L1운동        | 20       | L1
8        | 3     | rest          | 휴식          | 10       | NULL
-- L2~R2: 동일 패턴 (마지막 라운드 뒤에도 휴식)
...
-- R1: 마지막 라운드 뒤 물보충 (그룹 끝)
N        | 1     | exercise      | R1운동        | 60       | R1
N+1      | 1     | rest          | 휴식          | 20       | NULL
N+2      | 2     | exercise      | R1운동        | 40       | R1
N+3      | 2     | rest          | 휴식          | 15       | NULL
N+4      | 3     | exercise      | R1운동        | 20       | R1
N+5      | 3     | water         | 물보충        | 60       | NULL
-- L4~R5: 동일 패턴 (마지막 라운드 뒤에도 휴식)
...
-- R4: 마지막 운동 → 마지막 라운드 뒤 아무것도 없음
M-2      | 3     | exercise      | R4운동        | 20       | R4
M-1      | 99    | exercise      | CD운동1       | 30       | CD1
M        | 99    | exercise      | CD운동2       | 30       | CD2
```

### Loop 방식 (3라운드, 12개 운동)
```
sequence | round | exercise_type | exercise_name | duration | position
---------|-------|---------------|---------------|----------|----------
1        | 0     | exercise      | DS운동1       | 30       | DS1
-- 전반전 Round 1
2        | 1     | exercise      | L1운동        | 60       | L1
3        | 1     | exercise      | L2운동        | 60       | L2
4        | 1     | exercise      | L3운동        | 60       | L3
5        | 1     | exercise      | R3운동        | 60       | R3
6        | 1     | exercise      | R2운동        | 60       | R2
7        | 1     | exercise      | R1운동        | 60       | R1
8        | 1     | rest          | 휴식          | 20       | NULL
-- 전반전 Round 2
9        | 2     | exercise      | L1운동        | 40       | L1
10       | 2     | exercise      | L2운동        | 40       | L2
... (L3, R3, R2, R1)
N        | 2     | rest          | 휴식          | 20       | NULL
-- 전반전 Round 3
N+1      | 3     | exercise      | L1운동        | 20       | L1
... (L2, L3, R3, R2, R1)
N+6      | 3     | water         | 물보충        | 60       | NULL
-- 후반전 Round 4
N+7      | 4     | exercise      | L4운동        | 60       | L4
... (L5, L6, R6, R5, R4)
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
            "position": "L1"
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
