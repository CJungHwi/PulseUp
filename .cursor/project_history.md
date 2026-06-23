# PulseUp 프로젝트 작업 이력

매일 작업 종료 시 이 파일 **상단**(최신 날짜가 위)에 `## YYYY-MM-DD` 섹션을 추가하고, **기능별**로 묶어 작업 카드를 정리합니다.

### 작성 형식

```markdown
## YYYY-MM-DD

### 기능명

> **영역** · `경로/파일`
>
> **요청** 무엇을 위해 작업했는지
>
> **내용** 실제로 무엇을 했는지 (1~2문장)
```

- **기능명**: 그날 작업한 기능·이슈 단위 (`###` 소제목)
- 같은 날 서로 다른 기능을 다뤘으면 `### 기능명` 블록을 나눠 작성
- 기능 블록 안에서는 영역(`DB` · `API` · `Web` 등)별로 카드 1개

---

## 2026-06-23

### EMOM-Stress SET 연속 전환 벨소리 제거

> **Electron** · `packages/electron-app/src/main/workout-modules/circuits/emom-stress/emom-stress-main-round.ts`, `renderer/components/workout-play-timer-countdown.ts`, `renderer/components/WorkoutPlayTimerUI.ts`
>
> **요청** MAIN-Stress는 그대로 두고, EMOM-Stress에서 같은 운동의 SET 1→2(→3) 전환 시 벨소리가 울리지 않게
>
> **내용** EMOM-Stress runner에서 "다음 메인 운동이 같은 위치(=SET 연속)"인지 판별(`isSameMoveContinuation`)해 스텝 브로드캐스트에 `suppressCountdownBell` 플래그를 추가. 렌더러 카운트다운은 이 플래그가 true면 잔여 3초 종료 벨을 건너뛰도록 수정. MOVE(운동)가 바뀌는 마지막 SET에서만 벨이 울리며, MAIN-Stress·EMOM-Loop는 플래그 미전송으로 기존 동작 유지.

### EMOM-Stress 재생 오분류 근본 수정 (웹 재생 metadata)

> **Web** · `packages/web-app/src/pages/MonthProgram/components/useWorkoutPlay.ts`
>
> **요청** EMOM-Stress가 계속 RND로 표시되고 SET/MOVE가 반대로 동작 — 실행 로그상 `StressModule`로 오분류됨
>
> **내용** 재생 metadata 빌더의 `computeCircuitType`가 카테고리를 `workoutCategoriesId`(UUID)로 비교해 EMOM 판별이 항상 실패하던 버그를 수정. 이름(`workoutCategoriesName`) 우선으로 EMOM/AMRAP을 판별하고, EMOM이면 `workoutCategory='EMOM'`과 `emomCircuitType/method_type`(=master.circuitType의 stress/loop)을 함께 전송하도록 변경. 이로써 Electron이 EMOM으로 인식하고 EMOM-Stress 모듈/표시(SET·MOVE)를 정상 선택.

### EMOM-Stress 독립 모듈 분리

> **Electron** · `packages/electron-app/src/main/workout-modules/circuits/emom-stress/` (`emom-stress-module.ts`, `emom-stress-main-round.ts`, `emom-stress-detect.ts`, `emom-stress-navigation.ts`, `emom-stress-main-round.test.ts`)
>
> **요청** EMOM-Stress를 Main Stress/Loop처럼 완전 독립 모듈로 떼고, 선택도 동일하게 레지스트리 기반으로 분리
>
> **내용** 기존 `EmomModule` 내부 분기(`isEmomStressPlayback`)로만 존재하던 EMOM-Stress를 전용 폴더/모듈(`EmomStressModule`)로 분리. 메인 재생 runner와 판별 헬퍼, 네비게이션을 새 폴더로 이동·정리하고 `emom-module.ts`는 EMOM-Loop 전용으로 단순화.

> **Electron** · `packages/electron-app/src/main/workout-modules/circuit-registry.ts`, `packages/electron-app/src/main/workout-modules/index.ts`, `packages/electron-app/src/main/workout-play-service.ts`, `packages/electron-app/src/main/playback-controller.ts`
>
> **요청** 모듈/네비게이션 선택을 Main Stress/Loop와 동일한 방식으로
>
> **내용** 레지스트리에 `'emom-stress'` 케이스(모듈·네비)와 `resolveModuleCircuitType()` 추가. 화면 표시/큐 빌더용 `circuitType`은 `'emom'`을 유지하면서, `createWorkoutModule`과 prev/next 네비게이션이 metadata·시퀀스 구조로 EMOM-Stress를 판별해 전용 모듈을 선택하도록 변경. 빌드/테스트/lint 통과.

### EMOM-Stress Electron 표시/카운터 보정

> **Electron** · `packages/electron-app/src/renderer/components/workout-timer-circuit.ts`, `packages/electron-app/src/renderer/components/WorkoutGridDisplay.ts`, `packages/electron-app/src/renderer/circuits/emom/grid-display-strategy.ts`
>
> **요청** EMOM-Stress 실행 시 영상창 상단을 `Main Training (Stress)`가 아닌 `EMOM (Stress)`로 표시
>
> **내용** Renderer 서킷 판별에서 `workoutCategory=EMOM`을 `circuitType=stress`보다 우선하도록 변경하고, 별도 method 판별값을 GridDisplay 전략에 전달. EMOM-Stress 메인 위치는 `EMOM (Stress)`로 표시하고 EMOM-Loop 기본 표시는 유지.

> **Electron/Test** · `packages/electron-app/src/renderer/components/timer-header-display.ts`, `packages/electron-app/src/renderer/components/WorkoutPlayTimerUI.ts`, `packages/electron-app/src/main/workout-modules/circuits/emom/emom-stress-main-round.test.ts`
>
> **요청** 카운터 영역 `RND`를 `SET`으로 바꾸고 `workout_exercises_logic.md` 기준의 SET/MOVE 순서로 표시
>
> **내용** EMOM-Stress method metadata를 main process에서 보존하고, 타이머 표시가 `SET/MOVE`를 사용하도록 보정. 전반/후반 마지막 운동까지 문서 기준 카운터가 유지되는 테스트와 Renderer 판별 테스트를 추가.

> **Electron/Test** · `packages/electron-app/src/main/workout-modules/circuits/emom/emom-module.ts`, `packages/electron-app/src/main/workout-modules/circuits/emom/emom-stress-main-round.ts`, `packages/electron-app/src/renderer/components/workout-timer-circuit.ts`
>
> **요청** EMOM-Stress가 여전히 기존 EMOM-Loop처럼 `RND`로 표시되고 MOVE만 증가하는 문제 수정
>
> **내용** `circuitType`이 `emom`으로 정규화된 뒤에도 EMOM-Stress runner가 선택되도록, metadata뿐 아니라 실제 시퀀스 구조(`A1→A1→A1→A2...`)로 판별하는 로직을 추가. 전용 runner payload에 `counterMode=emom-stress`와 method metadata를 명시해 Renderer가 항상 `SET/MOVE`로 표시하도록 보강.

## 2026-06-19

### 월간프로그램 운동상세 영상 모달

> **Web** · `WorkoutDetailTable.tsx`, `ExerciseVideoDialog.tsx`, `monthProgramVideoUtils.ts`
>
> **요청** 운동상세 기록 DataTable에서 운동명 클릭 시 해당 운동 영상을 모달 팝업으로 표시
>
> **내용** 운동명(영문/한글) 클릭 시 Vimeo/YouTube 임베드 모달을 열고, 영상 URL이 없으면 Snackbar 경고를 표시. 행 선택과 분리하기 위해 클릭 이벤트 stopPropagation 처리.

> **Web** · `monthProgramVideoUtils.ts`, `ExerciseVideoDialog.tsx`, `WorkoutDetailTable.tsx`
>
> **요청** 영상 모달 미표시 버그 수정
>
> **내용** DB `video_url`이 Vimeo ID(숫자)만 저장되는 경우를 파싱하도록 수정, Snackbar 호출 시그니처 수정, 모달을 `createPortal`+z-index 10000으로 헤더 위에 표시.

### 3화면 Main 운동 전반/후반 배치 변경

> **Electron** · `packages/electron-app/src/common/grid-position-codes.ts`, `packages/electron-app/src/main/workout-modules/circuits/shared/queue-builder-base.ts`, `packages/electron-app/src/renderer/five-screen-seek-label.ts`
>
> **요청** 3개 화면에서 모든 운동의 전반을 A/C가 아닌 A/B로, 후반을 B/D가 아닌 C/D로 표시
>
> **내용** 공통 grid position 해석을 `A/B=set1(전반)`, `C/D=set2(후반)`, 3화면 물리 배치를 `좌 A/C`, `우 B/D`로 변경. AMRAP/EMOM 전용 B↔C 스왑을 no-op 처리하고 큐 빌더·seek 라벨·half-group 판정을 새 기준에 맞춤.

> **Web** · `packages/web-app/src/utils/gridPositionCodes.ts`, `packages/web-app/src/pages/exercises/shared/save-workout/grid-workout-exercise-helpers.ts`
>
> **요청** 저장/정렬 기준도 모든 Main 운동에서 전반 A/B, 후반 C/D 순서로 통일
>
> **내용** 저장 정렬 lap 순서를 `A1→A2→A3→B3→B2→B1 / C1→C2→C3→D3→D2→D1` 기준으로 통일하고 레거시 L/R·구 A/B 변환도 새 A/B·C/D 반 구분에 맞게 동기화.

> **Test/문서** · `packages/electron-app/src/**/*.test.ts`, `packages/web-app/src/utils/gridPositionCodes.test.ts`, `workout_exercises_logic.md`
>
> **요청** 변경된 3화면 전반/후반 기준을 테스트와 운동 실행 문서에 반영
>
> **내용** Electron grid/intro/seek/Loop/Stress 테스트와 Web grid 테스트 기대값을 새 기준으로 수정. `workout_exercises_logic.md`의 Stress·Loop·EMOM·AMRAP 예시를 전반 A/B, 후반 C/D 순서로 업데이트.

### 3화면 인트로 그리드 표시

> **Electron** · `packages/electron-app/src/renderer/circuits/intro-position-codes.ts`, `packages/electron-app/src/common/intro-position-codes.ts`
>
> **요청** 3화면 인트로에서 좌측 1열 A1~A3, 좌측 2열 B1~B3, 우측 1열 C1~C3, 우측 2열 D1~D3로 표시
>
> **내용** 인트로 전용 표시/필터/선택보기 매핑을 Main 재생의 set/side 판정과 분리. 3화면 인트로는 `좌 A/B · 우 C/D`로 필터링하고, B/D 위치는 각 화면의 4~6번 슬롯에 배치되도록 수정.

> **Web** · `packages/web-app/src/pages/RemoteControl/RemoteControlPage.tsx`, `packages/web-app/src/pages/RemoteControl/components/IntroSelectViewPanel.tsx`, `packages/web-app/src/pages/RemoteControl/components/introPositionCodes.ts`
>
> **요청** RemoteControl 선택보기도 A/B/C/D와 번호 1/2/3 체계로 변경
>
> **내용** 선택보기 구역 버튼을 A/B/C/D 4개로 확장하고 번호 선택을 1~3으로 축소. Electron `intro-focus`로 `zone=A~D`, `number=1~3` payload가 전송되도록 검증 범위와 안내 문구를 동기화.

> **Test** · `packages/electron-app/src/renderer/circuits/intro-position-codes.test.ts`
>
> **요청** 5화면 인트로가 좌측부터 A, B, C, D 화면으로 표시되도록 보장
>
> **내용** 5화면 인트로 필터 기준을 테스트로 고정. `workout-left=A`, `workout-left-2=B`, `workout-right=C`, `workout-right-2=D`와 구형 `A4~A6/B4~B6` 정규화가 각각 B/D 패널로 이동하는지 검증.

### EMOM-Stress Electron 재생

> **Electron** · `packages/electron-app/src/main/workout-modules/circuits/emom/emom-stress-main-round.ts`, `packages/electron-app/src/main/workout-modules/circuits/emom/emom-module.ts`
>
> **요청** Web에 추가된 EMOM-Stress를 Electron에서도 별도 파일로 분리해 문서 순서대로 재생
>
> **내용** `method_type=stress` EMOM 세션을 감지해 기존 EMOM-Loop runner가 아닌 EMOM-Stress 전용 runner로 분기. 저장된 순서대로 `A1 SET1→2→3`, `A2 SET1→2→3` 방식으로 진행하고, MOVE는 6개 position 블록 기준으로 계산하도록 구현.

> **Renderer/Test** · `packages/electron-app/src/renderer/components/timer-header-display.ts`, `packages/electron-app/src/main/workout-modules/circuits/emom/emom-stress-main-round.test.ts`, `workout_exercises_logic.md`
>
> **요청** EMOM-Stress 화면 표시와 문서 기준을 SET/MOVE 규칙에 맞춤
>
> **내용** EMOM-Stress는 타이머 상단 라벨을 `SET/MOVE`로 표시하고 EMOM-Loop는 기존 `RND/MOVE`를 유지하도록 분기. 전용 테스트를 추가하고 `workout_exercises_logic.md`의 EMOM-Stress 상태를 완료로 갱신.

## 2026-06-17

### 운동 중 비활성 강제 로그아웃 방지

> **Web** · `packages/web-app/src/App.tsx`, `hooks/useInactivityTimeout.ts`
>
> **요청** 월간프로그램 Play 후 리모컨/Electron으로 운동을 진행하는 동안 메인 웹페이지를 건드리지 않으면 90분 비활성 타임아웃으로 자동 로그아웃되는 문제 해결
>
> **내용** 원인 분석 결과 `useInactivityTimeout`(90분 무조작 강제 로그아웃)이 직접 원인. `App.tsx`의 `useInactivityTimeout()` 호출부와 import를 주석 처리하여 비활성화. 토큰은 `sessionStorage` 기반이라 브라우저 종료 시 자동 로그아웃은 유지되고, idle 시 401은 refreshToken(7일) 자동 갱신으로 복구됨.

### Main-Stress 라운드/Move 표시

> **Electron** · `packages/electron-app/src/main/workout-modules/circuits/stress/stress-module.ts`, `stress-order.ts`, `stress-preload.ts`
>
> **요청** Main-Stress 실행 중 MOVE가 `1→2→3→3→2→1`로 표시되어 문서 순서(`A1→A2→A3→C3→C2→C1`)와 맞지 않음
>
> **내용** Stress 전용 `stress-order.ts`를 추가해 position prefix가 아니라 저장된 실행 순서의 6개 블록 기준으로 SET/MOVE와 그룹 프리로드를 계산하도록 분리. 첫 6개 운동은 MOVE `1→6`, 다음 6개 운동도 MOVE `1→6`으로 표시되도록 테스트 추가.

> **Electron** · `packages/electron-app/src/main/workout-modules/circuits/stress/stress-module.ts`
>
> **요청** Main-Stress waterbreak 구간에서 다음 그룹 영상으로 미리 넘어가도록 변경
>
> **내용** waterbreak 진입 시 3분할 큐를 다음 그룹 첫 position으로 절대 seek하고 `_lastStressGroupIndex`를 갱신해 다음 운동 시작 시 중복 advance가 발생하지 않도록 조정. 상대 advance로 CD까지 밀릴 수 있던 경로를 제거했으며, 5분할은 패널별 큐 구조를 유지하기 위해 seek를 생략.

### Main-Loop 라운드/Move 표시

> **Electron** · `packages/electron-app/src/main/workout-modules/circuits/loop/loop-order.ts`, `loop-constants.ts`, `loop-main-round.ts`, `loop-preload.ts`
>
> **요청** Main-Loop를 문서 순서(`Round 1~3: A1→A2→A3→C3→C2→C1`, `Round 4~6: B1→B2→B3→D3→D2→D1`) 기준으로 Stress처럼 전반 점검 및 수정
>
> **내용** Loop 전용 `loop-order.ts`를 추가해 라운드 안 저장 실행 순서 기준으로 영상 정렬과 MOVE를 계산하도록 분리. prefix 기반 역산으로 MOVE가 `1→2→3→3→2→1`처럼 깨질 수 있던 경로를 제거하고 waterbreak 중 다음 그룹 첫 position seek도 Stress와 동일하게 적용.

> **Electron** · `packages/electron-app/src/main/workout-modules/circuits/loop/loop-preload.ts`
>
> **요청** Main-Loop waterbreak 때 후반전 영상으로 넘어가지 않음
>
> **내용** Loop는 후반 판정을 position이 아니라 round 기준으로 해야 하므로, waterbreak 다음 운동의 raw position이 `C1`이어도 `round 4`이면 후반 대표 seek position `B1`로 변환해 좌 B/우 D 큐로 이동하도록 수정.

> **Electron** · `packages/electron-app/src/main/playback-controller.ts`, `loop-order.ts`
>
> **요청** waterbreak 후 후반전 영상으로 이동한 상태에서 다음/이전 버튼을 누르면 A/C 영상으로 돌아감
>
> **내용** 버튼 네비게이션의 공통 `broadcastQueueSeek`가 raw position(`C1` 등)을 그대로 보내던 문제를 수정. Loop일 때는 `round` 기준 반(1~3 전반, 4~6 후반)을 계산해 seek position을 `A{slot}` 또는 `B{slot}`로 변환하도록 `resolveLoopQueueSeekPosition`을 적용.

### workout_exercises 저장 로직 문서

> **분석** · `workout_exercises_logic.md`
>
> **요청** Markdown `###` 단원이 인식되지 않는 깨진 양식 전체 리빌딩
>
> **내용** 깨진 코드 펜스(` `````` `), 미닫힌 볼드·표 앞 빈 줄 누락을 수정하고 AMRAP 예시를 `####` 하위 섹션으로 정리해 헤딩·목차가 정상 렌더링되도록 문서 재작성.

---

## 2026-06-16

### AMRAP·EMOM 좌/우 모니터 배치 좌 A·C / 우 B·D 적용 (서킷별 분기)

> **분석** · `runAmrapMainRound`, `queue-builder-base`
>
> **요청** loop/stress 는 좌 A/B·우 C/D 유지하되, AMRAP·EMOM(및 그 외, combo 제외)은 좌 A/C·우 B/D 로 표시 + 양쪽표시
>
> **내용** AMRAP 블록은 round 로 동시재생 묶음, 모니터 배치는 position(set) 기반임을 확인. 전반/후반(A,C↔A,B)이 B↔C 스왑 관계라는 점을 이용해 서킷별 배치를 분기.

> **Web** · `gridPositionCodes.ts`, `grid-workout-exercise-helpers.ts`
>
> **요청** AMRAP·EMOM 저장 블록을 전반 A·B / 후반 C·D 로 묶기
>
> **내용** `AMRAP_EMOM_LAP_ORDER`(OLD, 좌 A/C용)와 `lapOrderForCircuit()` 추가. `sortExercisesForExecution(exercises, circuitType)` 서킷 인지로 변경(loop/stress=STRESS_LAP_ORDER, 그 외=OLD).

> **Electron** · `grid-position-codes.ts`, `workout-play-service.ts`, `WorkoutGridDisplay.ts`
>
> **요청** NEW 엔진(좌 A/B) 유지하면서 AMRAP·EMOM만 OLD(좌 A/C) 물리배치
>
> **내용** `swapGridHalfPosition`/`applyCircuitHalfSwap`(B↔C, 자기역함수) 추가. `handleWorkoutPlay` 정규화에서 amrap/emom 메인 position 만 B↔C 스왑→NEW 큐/렌더 엔진이 OLD 배치로 출력. 화면 라벨은 `updatePositionLabel`에서 역스왑해 작성 코드(B/C) 표시. 양쪽표시는 올바른 슬롯 정렬로 자동 노출.

> **Electron(5분할 보정)** · `workout-play-service.ts`, `WorkoutGridDisplay.ts`, `electron-renderer-workout.ts`
>
> **요청** EMOM·Main-Training·AMRAP 모두 5분할은 좌→우 A,B,C,D
>
> **내용** B↔C 스왑은 3분할 전용이므로 `getScreenMode()==='five'` 이면 스왑 생략. `WorkoutGridDisplay.isFiveScreenLayout` 플래그 추가, 큐/인트로 셋업에서 설정해 5분할에서는 라벨 역스왑도 끔. 5분할은 `fillFiveScreenSlotQueues`가 패널 L1=A·L2=B·R1=C·R2=D 로 직배치.

### 메인 운동 좌/우 모니터 배치 L/R 기준 복원 (좌 A·B / 우 C·D)

> **분석** · `git 이력(eb6aa15)` 대조
>
> **요청** A,B,C,D 수정 전 L/R일 때가 정상. 그 기준으로 재적용. 영상 진행 순서는 정상이나 좌우 배치가 `좌 A/C·우 B/D`로 나옴 → `좌 A/B·우 C/D`로 변경 필요
>
> **내용** L/R 시절 좌측=L1~L6(→A·B), 우측=R1~R6(→C·D), 전반=번호1~3(A·C)/후반=4~6(B·D)였음. 현재 A/B/C/D가 B↔C 역할이 뒤바뀐 회귀임을 git 이력으로 확인.

> **공통** · `electron/common/grid-position-codes.ts`, `web-app/utils/gridPositionCodes.ts`
>
> **요청** 위치 코드의 좌/우·전반/후반 정의를 L/R 기준으로 재정의
>
> **내용** `parseGridPosition` side(A,B=좌·C,D=우)·set(A,C=set1·B,D=set2) 변경, `STRESS_LAP_ORDER`를 `A1→A2→A3→C3→C2→C1 / B1→B2→B3→D3→D2→D1`로 변경, `gridSetFromPrefix`·`gridSidePrefix` 동기화. 저장 정렬(`sortExercisesForExecution`)·loop lap(`LOOP_LAP_ORDER`)·EMOM/AMRAP half-group이 모두 이 상수에서 파생되어 자동 정합.

> **Electron** · `circuits/shared/queue-builder-base.ts`, `main-half-group-utils.ts`, `renderer/workout-renderers/main-renderer.ts`, `renderer/five-screen-seek-label.ts`, `common/intro-position-codes.ts`, `renderer/circuits/intro-position-codes.ts`
>
> **요청** 재생/인트로 그리드도 좌 A/B·우 C/D로 표시
>
> **내용** 3분할 슬롯 큐 prefix(좌 A·B / 우 C·D), 5분할 mainSet 판정, 메인 렌더러 set별 prefix, seek 라벨 변환, half-group set(0=A/C·1=B/D), 인트로 monitorSides·기본 라벨을 일괄 정합. EMOM 타이머/DS/reps 로직은 미변경.

> **Test** · `grid-position-codes.test.ts`(electron·web), `five-screen-seek-label.test.ts`, `intro-position-codes.test.ts`, `main-half-group-utils.test.ts`
>
> **요청** 변경된 매핑 검증
>
> **내용** side/set·STRESS_LAP_ORDER·half-group·seek 라벨 기대값 갱신. 관련 28개 테스트 통과(그 외 실패는 DB/jsdom 의존 기존 실패).

## 2026-06-15

### EMOM 재생 멀티모니터 전환·양쪽표시·타이머(분:초) 수정

> **Electron** · `renderer/five-screen-seek-label.ts`, `renderer/five-screen-seek-label.test.ts`
>
> **요청** DS 이후 메인 시작 시 우측 모니터(3분할 B/D, 5분할 C·D 패널)가 DS 영상에 멈춰 전환 안 됨
>
> **내용** `resolveMainPhaseSeekLabel`이 다른 구역 position('A1')을 받으면 `null`을 반환해 해당 화면이 seek 못 하던 버그 수정. 이제 같은 슬롯/세트 기준으로 각 화면 라벨(우측 B1/D1, 5분할 패널별)로 변환. 테스트 갱신.

> **Electron** · `renderer/components/workout-timer-circuit.ts`
>
> **요청** EMOM 카운터가 분:초(1:30)가 아닌 초(90)로만 표시
>
> **내용** EMOM-LOOP는 LoopModule로 재생돼 `getCircuitTypeForBroadcast`가 'loop'을 주입 → loop 전략(초)으로 표시되던 문제. 타이머 전용 `resolveTimerCircuitType`에서 시퀀스 `major_category`(EMOM/AMRAP)를 서킷타입보다 우선 판별하도록 변경(재생 모듈 선택용 `resolveWorkoutCircuitType`은 미변경). sticky로 라운드 중 유지.

> **DB** · `database/sp_get_workout_exercises_with_reps.sql` (재배포 필요)
>
> **요청** A1/A2 양쪽운동 횟수 아래 '(양쪽)' 표시 누락 + EMOM 타이머 분:초 전제
>
> **내용** 렌더러 `updateRepsBadge`는 `is_bilateral`이 오면 정상 표시하나, 배포된 구버전 GET 프로시저가 `is_bilateral`(및 EMOM `major_category` 오버라이드)을 반환하지 않음. `sp_get_workout_exercises_with_reps.sql` 재배포 필요(reps·is_bilateral·major_category 오버라이드 모두 포함).

> **Web** · `MonthProgram/components/monthProgramApi.ts`, `monthProgramTypes.ts`
>
> **요청** GET 프로시저 재배포 후에도 '(양쪽)' 여전히 안 나옴
>
> **내용** 진짜 원인 — 재생은 웹이 GET 결과를 `normalizeSequence`로 정규화해 일렉트론에 보내는데, 이 매핑이 `is_bilateral`을 누락시켜 버림. `ExerciseSequence` 타입에 `is_bilateral?` 추가하고 `normalizeSequence`에서 `is_bilateral`을 채우도록 수정. (GET 재배포 + 이 수정 둘 다 필요)

### 월간운동프로그램 운동상세 양쪽여부

> **Web** · `WorkoutDetailTable.tsx`, `monthProgramTypes.ts`, `monthProgramApi.ts`, `MonthProgram.tsx`
>
> **요청** 운동기록 상세의 운동상세정보 DataTable 맨 끝에 양쪽여부 추가
>
> **내용** `is_bilateral` 필드를 API 정규화·타입에 반영하고 상세 테이블 마지막 컬럼에 Y/N 표시. DS/CD 행은 빈 값 처리.

### 월간운동프로그램 좌측 기록 테이블

> **Web** · `MonthProgramMasterTabs.tsx`, `MonthProgram.tsx`
>
> **요청** 좌측 기록 DataTable에 운동구분 왼쪽에 운동저장구분 정보 추가
>
> **내용** 마스터 테이블에 `운동저장구분` 컬럼을 추가하고 `workoutScope`를 `workoutScopes` 마스터의 `scopeName`으로 표시. `MonthProgram`에서 `workoutScopes` props 전달.

### EMOM DS 누락·reps=0 근본원인 규명 및 재발 방지

> **분석** · 터미널 로그(API/Electron)
>
> **요청** A/B/C/D 변경 후 EMOM 등에서 DS가 안 나오고 우측 상단 횟수가 안 뜨는 문제가 계속됨 → 전체 재점검
>
> **내용** API 로그에서 `sp_SaveWorkout ... expected 10, got 19/18/17` 발견. DB에 구버전(10-param) 프로시저가 배포돼 있어 신버전(reps/DS) 호출이 모두 실패하고 10-param 구버전으로 fallback 저장됨. 구버전은 DS를 `exercise_type='dynamic'`로만 저장(웹앱은 'DS' 전송 → 누락)하고 reps를 INSERT하지 않아(=0) 재생 데이터에 DS·reps가 빠졌던 것. Electron 렌더러는 무관.

> **DB** · `sp_save_power_circuit_new.sql`, `_v2-procedures.sql`, `migrations/20260614_exercise_bilateral_flag.sql`
>
> **요청** 구버전 프로시저 재배포로 인한 재발 방지
>
> **내용** 구버전 `sp_save_power_circuit_new.sql`의 10-param `sp_SaveWorkout` 정의 제거(DEPRECATED 안내 스텁으로 대체). `_v2-procedures.sql`·마이그레이션 주석을 정식본 `sp_save_workout_with_reps.sql`(19-param)로 통일. (DB 적용은 사용자가 직접 수행)

> **API** · `workoutCategories.routes.ts`
>
> **요청** 구버전 DB일 때 데이터 조용히 유실되는 fallback 차단
>
> **내용** `callSaveWorkoutProcedure`의 10-param 구버전 fallback 제거 → 19/18/17 모두 실패 시 "최신 프로시저 적용 필요" 에러를 명확히 throw 하도록 변경.

### Electron A~D position 재생 안정화

> **Electron** · `ready-renderer.ts`, `stretching-renderer.ts`, `main-renderer.ts`, `intro-position-codes.test.ts`
>
> **요청** A/B/C/D 변경 후 EMOM 등에서 DS가 안 나오고 main이 바로 나오며 우측 상단 운동횟수 배지가 안 보이는 문제 수정
>
> **내용** (1차 시도에서 추가했던) queue 모드 가드가 정상 동작하던 `handleStretchingMode`/`playVideo` 호출을 막아 회귀를 유발 → 가드를 제거하고 HEAD의 렌더링 경로(항상 playVideo, DS는 handleStretchingMode)를 복원하되 A~D position 매핑(`mapMainPositionToDisplayLabel`, 5분할 패널 prefix)은 유지. StretchingRenderer는 DS 큐 영상을 다시 재생, MainRenderer는 본운동 재생+reps 배지 갱신, ReadyRenderer는 카운트다운 중 main 프리뷰 재생. 테스트 readonly 타입 오류도 수정

### 양쪽운동 플래그 저장/표시

> **DB** · `_v2-schema.sql`, `sp_insert_vimeo_video.sql`, `sp_save_workout_with_reps.sql`, `sp_GetWorkoutExercises_updated.sql`, `20260614_exercise_bilateral_flag.sql`
>
> **요청** 운동 마스터와 운동 등록 내 양쪽운동 여부를 별도로 저장
>
> **내용** `exercises`, `workout_history_detail`, `workout_exercises`에 `is_bilateral` 저장 경로를 추가. Vimeo 설명 5번째 토큰 `$Y/$N`을 파싱하고 저장/조회 프로시저에 반영

> **API** · `workoutCategory.schema.ts`, `workoutCategory.service.ts`, `workoutCategories.routes.ts`, `admin.routes.ts`
>
> **요청** 양쪽운동 값을 생성/수정/저장 API에서 전달
>
> **내용** 운동 생성·수정 payload와 운동 저장 검증 스키마에 `is_bilateral`을 추가하고, 기존 관리자 직접 SQL 경로도 동일 필드를 처리하도록 보강

> **Web** · `WorkoutManager`, `Vimeo.tsx`, `Totalexercises.tsx`, `WorkoutEditor.tsx`, `vimeoDescriptionFormat.ts`
>
> **요청** 운동 목록, Vimeo 설명 편집, 통합 운동 등록 화면에서 양쪽운동 체크 지원
>
> **내용** 운동 마스터 기본값 스위치와 목록 표시를 추가. Vimeo 설명은 `운동명$자극부위$특징$기구$Y/N` 헬퍼로 편집하며, 통합 운동 등록에서는 행 단위 양쪽운동 override 체크를 저장 payload에 포함

> **Electron** · `WorkoutGridDisplay.ts`
>
> **요청** 양쪽운동이면 영상 우측상단 운동카운트 아래에 `(양쪽)` 표시
>
> **내용** `sequence.is_bilateral`을 읽어 REPS 배지 아래 노란색 `(양쪽)` 라벨을 선명하게 렌더링

> **Test** · `vimeoDescriptionFormat.test.ts`
>
> **요청** Vimeo 설명 `$Y/$N` 포맷 검증
>
> **내용** 설명 파싱, 기존 4필드 N 기본 처리, 양쪽운동 토큰 변경 테스트를 추가하고 web helper 테스트로 검증

> **API/DB** · `workoutCategories.routes.ts`, `sp_save_power_circuit_new.sql`
>
> **요청** 메인트레이닝 행 단위 양쪽운동 체크값 저장 누락 보정
>
> **내용** 저장 직전 `exercises`와 `workoutExercises`의 `is_bilateral` 값을 상호 보강하도록 API 정규화를 추가. 구형 10파라미터 `sp_SaveWorkout` 정의에도 `workout_history_detail`·`workout_exercises` 저장 컬럼을 반영

### 운동 선택 모달 A~D position 반영

> **Web** · `ExerciseSelectionModal.tsx`
>
> **요청** 메인 운동 선택 모달에도 A/B/C/D position 체계 적용
>
> **내용** 선택 목록 라벨·position 옵션을 공통 `MAIN_GRID_POSITION_ORDER` 기준으로 연결하고, 부모에서 전달된 기존 position을 모달 내부에서 A~D 형식으로 정규화

### Electron 메인 운동 A~D 모니터 배치

> **Electron** · `grid-position-codes.ts`, `queue-builder-base.ts`, `main-half-group-utils.ts`, `five-screen-seek-label.ts`, `intro-position-codes.ts`
>
> **요청** 3모니터는 좌 A/C·우 B/D, 5모니터는 좌측부터 A/B/C/D 순서로 메인 운동 표시
>
> **내용** Electron 큐 생성·seek label·인트로 필터·전후반 그룹 판단을 A1~A3/B1~B3/C1~C3/D1~D3 체계로 정리. 관련 unit test와 Electron build로 검증

### 통합 메인 운동 position 코드 (A~D)

> **Web** · `gridPositionCodes.ts`, `Totalexercises.tsx`, `ExerciseSelectionModal.tsx`, `grid-workout-exercise-helpers.ts`
>
> **요청** 메인 운동 추가 시 A1~A6/B1~B6 대신 A1~A3, B1~B3, C1~C3, D1~D3 순서로 등록
>
> **내용** `positionFromMainIndex`·정렬·Stress lap 순서를 4구역×3슬롯 체계로 변경. 구 A/B(1~6)·L/R 이력은 불러올 때 `migrateOldMainGridPosition`으로 자동 변환

> **Electron** · `grid-position-codes.ts`
>
> **요청** 저장 position과 재생 파싱 일치
>
> **내용** web-app과 동일한 A~D position 정규화·파싱 로직 동기화

### 운동저장구분 UI 표기 통일

> **Web** · `WorkoutScopeManager.tsx`, `WorkoutScopeTable.tsx`, `WorkoutScopeFormDialog.tsx`, `MonthProgramFilterBar.tsx`, `Totalexercises.tsx`, `Singleexercises.tsx`
>
> **요청** Scope UI 표기를 운동저장구분으로 변경, Admin 테이블 정렬 컬럼 제거
>
> **내용** 사용자 노출 문구를 운동저장구분으로 통일. WorkoutScopeManager 목록 테이블에서 정렬 컬럼 제거(등록/수정 폼의 정렬 순서 입력은 유지)

> **DB** · `20260614_workout_scope_menu_rename.sql`, `20260606_workout_scope_menu_seed.sql`
>
> **요청** 사이드바 메뉴명도 운동저장구분으로 맞춤
>
> **내용** menus 시드·마이그레이션에서 메뉴명·설명을 운동저장구분 관리로 변경

## 2026-06-09

### 개인별 운동심박수 저장/조회

> **분석** · 심박 저장 흐름 전반
>
> **요청** 개인별 운동심박수 저장/조회 개발 계획 수립
>
> **내용** 운동 구성 저장과 심박 저장 분리 구조 분석. `MemberWorkoutRecords` 개인 조회 화면 재사용, 그룹 수업 매핑 필요성 정리

> **DB** · `_v2-schema.sql`, `_v2_heart_rate_participants.sql`
>
> **요청** 개인별/그룹수업 심박 데이터 저장 스키마 정합화
>
> **내용** `heart_rate_data`에 `device_id VARCHAR(255)`, `device_name`, UPSERT UNIQUE 반영. `workout_heart_rate_participants` 매핑 테이블 추가

> **API** · `heartrate.service.ts`, `heartrate.routes.ts`, `heartRate.schema.ts`
>
> **요청** 매핑 기반 심박 저장·참가자 조회 API
>
> **내용** 회원-기기 매핑 CRUD, `device_id` 기준 `user_id` 결정 저장, 참가자별 심박 요약 API 추가. 매핑 없을 때 1:1 fallback 유지

> **Electron** · `heart-rate-manager.ts`, `types.ts`
>
> **요청** 심박 업로드·실패 큐 세션 컨텍스트 보존
>
> **내용** 업로드 payload에 `slotNumber` 포함. 실패 큐에 `userId`, `workoutHistoryMasterId` 저장 후 동일 세션 기준 재전송

> **Web** · `AttendanceDialog`, `HeartRateParticipantPanel`, `heartRateParticipantsApi.ts`
>
> **요청** 그룹 수업 개인별 심박계 배정 UI
>
> **내용** 출석체크 다이얼로그에 운동기록 ID 기준 심박계 배정 패널 추가. 타입·API 서비스 모듈 분리

> **Test** · `heartrate.service.test.ts`
>
> **요청** 심박 저장 정책 검증
>
> **내용** 매핑 기반 저장·미매핑 1:1 fallback 저장 단위 테스트 추가

> **DB** · `_v2_heart_rate_menu_seed.sql`
>
> **요청** 심박수 기능 연동 메뉴 시드
>
> **내용** 기존 `운동기록`·`수업예약 관리` 메뉴 설명 보강(심박 그래프·심박계 배정). idempotent INSERT 및 `user`/`branch_admin` `user_menu_items` 백필

> **Web** · `MemberWorkoutHeartRateDetail`, `HeartRateChartCard`, `heartRateChartShared`
>
> **요청** 운동기록 심박 미리보기에서 상세 페이지 분리
>
> **내용** `points` 배지를 `더보기`로 교체. `/account/workout-records/:workoutId/heart-rate` 상세 페이지에 확대 그래프·zone 분포·측정값 테이블 추가

> **Web** · `ClassBookingCalendar`, `BookingMonthCalendar`, `bookingCalendarUtils`
>
> **요청** 수업예약 시 하루에 여러 수업 예약 지원
>
> **내용** 같은 날 시간 겹침만 차단하고 다건 예약 허용. 캘린더에 내 예약·일별 수업/예약 건수 표시, 셀 내 스크롤로 다건 수업 노출

> **Web** · `ClassBookingManagement`, `SlotFormDialog`, `bookingCalendarUtils`
>
> **요청** 수업예약 관리에서 같은 날 여러 수업 등록 방법 개선
>
> **내용** 저장 후 계속 등록 버튼 추가, 기존 수업 종료 후 15분 뒤 다음 시간대 자동 제안, 당일 등록 수업 목록 안내

> **Web/API** · `UserManagement`, `BranchFilterSelect`, `admin.routes.ts`
>
> **요청** 사용자 관리 조회에 지점별 필터
>
> **내용** 슈퍼관리자용 지점 필터 UI 추가. API `GET /admin/users?branchId=` 지원(모든 지점/지점 미지정/특정 지점)
>
> **요청** 같은 시간대 수업 중복 저장 차단
>
> **내용** 프론트 시간 겹침 검증·경고 표시, API `createSlot`/`updateSlot`에서 지점 슬롯 시간 중복 검사 추가

> **DB** · `_v2_heart_rate_demo_seed.sql`
>
> **요청** 심박 화면 확인용 가상 데이터
>
> **내용** `workout_history_master.id = 000001` 데모 운동기록·상세·심박 60포인트 시드 추가. `user` 역할 첫 활성 회원에 연결
