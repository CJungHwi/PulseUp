# 운동 카테고리 변경사항 (2025-01-13)

## 변경 요약

### 1. 카테고리 통합

- **Main Training으로 통합**: 기존 Circuit Training, Core Carry Focus, Power Circuit, Functional Circuit → Main Training으로 통합
- **Cool Down으로 변경**: Static Stretching → Cool Down으로 명칭 변경
- **유지**: EMOM, AMRAP, Dynamic Stretching은 동일

### 2. 운동 진행 순서

모든 운동은 다음 순서로 진행됩니다:

```
Dynamic Stretching (DS) → Main Training / EMOM / AMRAP → Cool Down (CD)
```

- **Round 0**: Dynamic Stretching (DS)
- **Round 1~N**: Main Training / EMOM / AMRAP
- **Round 99**: Cool Down (CD)

### 3. 약어

- **DS**: Dynamic Stretching
- **CD**: Cool Down (구 Static Stretching)

## 수정된 파일

### 1. WorkoutPlayTimerUI.ts

- 카테고리 매핑 업데이트 (830-858라인)
  - Main_Training, MainTraining → 'Main Training'
  - Power_Circuit, Circuit_Training, Functional_Circuit, Core_Carry_Focus → 'Main Training'
  - Dynamic_Stretching, DynamicStretching, DS → 'DS'
  - Cool_Down, CoolDown, CD, Static_Stretching, StaticStretching → 'CD'
- Round/Set 라벨 로직 업데이트 (729-747라인)
  - isHybridStrength → isMainTraining으로 변경
  - Main Training 카테고리 체크 로직 업데이트

- 주석 업데이트
  - "Round 0 (Dynamic Stretching)"
  - "Round 99 (Cool Down)"

### 2. ipc-handlers.ts

- 스트레칭 관련 주석 업데이트
  - "Round 0 (Dynamic Stretching) 또는 Round 99 (Cool Down)"

### 3. sp_save_power_circuit_new.sql

- Cool Down 운동 저장 로직 업데이트 (311번 라인)
  - `exercise_type = 'cooldown' OR exercise_type = 'static'` 둘 다 지원
  - Round 99로 저장
  - 호환성: 기존 'static'과 새로운 'cooldown' 모두 지원

### 4. sp_save_workout_with_reps.sql

- Cool Down 운동 저장 로직 업데이트 (312번 라인)
  - `exercise_type = 'static' OR exercise_type = 'cooldown'` 둘 다 지원
  - Round 99로 저장
  - 호환성: 기존 'static'과 새로운 'cooldown' 모두 지원

## 카테고리 매핑 테이블

| 데이터베이스 값    | 표시 이름     | 비고                 |
| ------------------ | ------------- | -------------------- |
| Main_Training      | Main Training | 새로운 통합 카테고리 |
| MainTraining       | Main Training | camelCase 버전       |
| Power_Circuit      | Main Training | 레거시 (호환성)      |
| PowerCircuit       | Main Training | 레거시 (호환성)      |
| Circuit_Training   | Main Training | 레거시 (호환성)      |
| CircuitTraining    | Main Training | 레거시 (호환성)      |
| Functional_Circuit | Main Training | 레거시 (호환성)      |
| FunctionalCircuit  | Main Training | 레거시 (호환성)      |
| Core_Carry_Focus   | Main Training | 레거시 (호환성)      |
| CoreCarryFocus     | Main Training | 레거시 (호환성)      |
| AMRAP              | AMRAP         | 변경 없음            |
| EMOM               | EMOM          | 변경 없음            |
| Dynamic_Stretching | DS            | 약어 사용            |
| DynamicStretching  | DS            | 약어 사용            |
| DS                 | DS            | 약어                 |
| Cool_Down          | CD            | 새로운 명칭          |
| CoolDown           | CD            | 새로운 명칭          |
| CD                 | CD            | 약어                 |
| Static_Stretching  | CD            | 레거시 (호환성)      |
| StaticStretching   | CD            | 레거시 (호환성)      |

## Main Training 서킷 타입

Main Training은 두 가지 서킷 타입을 지원합니다:

1. **스트레스 서킷 (Stress Circuit)**: Round로 표시
2. **루프 서킷 (Loop Circuit)**: Set으로 표시

## 운동 구조

```
운동 세션
├── Dynamic Stretching (Round 0)
│   ├── L1, L2, L3 (그룹 1)
│   ├── L4, L5, L6 (그룹 2)
│   └── 3개씩 동시 재생
│
├── Main Training / EMOM / AMRAP (Round 1~N)
│   ├── 스트레스 서킷: 모든 운동 완료 후 다음 라운드
│   └── 루프 서킷: 각 운동마다 SET 진행
│
└── Cool Down (Round 99)
    ├── L1, L2, L3 (그룹 1)
    ├── L4, L5, L6 (그룹 2)
    └── 3개씩 동시 재생
```

## 호환성

기존 데이터베이스의 레거시 카테고리명(Power_Circuit, Circuit_Training 등)도 자동으로 Main Training으로 매핑되어 표시됩니다.

## exercise_type 필드

운동 저장 시 `exercise_type` 필드 값:

- **'dynamic'**: Dynamic Stretching → Round 0으로 저장
- **'main'**: Main Training 운동 → Round 1~N으로 저장
- **'static'** 또는 **'cooldown'**: Cool Down → Round 99로 저장

두 저장 프로시저 모두 `'static'`과 `'cooldown'`을 모두 지원하여 호환성을 보장합니다.

## 문제 해결

### Dynamic Stretching과 Cool Down이 표시되지 않는 경우

1. **데이터베이스 확인**: `workout_exercises` 테이블에서 Round 0과 Round 99 데이터가 있는지 확인

   ```sql
   SELECT round, COUNT(*)
   FROM workout_exercises
   WHERE workout_history_master_id = 'YOUR_MASTER_ID'
   GROUP BY round;
   ```

2. **exercise_type 확인**: 저장 시 `exercise_type`이 올바른 값인지 확인
   - Dynamic: `'dynamic'`
   - Cool Down: `'static'` 또는 `'cooldown'`

3. **프로시저 업데이트**:
   - `sp_save_power_circuit_new.sql`
   - `sp_save_workout_with_reps.sql`

   두 파일을 DB에 반영했는지 확인

4. **새로운 운동 저장**: 기존 데이터는 Round 0/99가 없을 수 있으므로, 새로 저장된 운동부터 확인















