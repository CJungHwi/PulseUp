# 실제 런타임 검증: 인트로 → 운동 시작 → 메인 진입

이 문서는 **실제 `electron-app` 프로세스**가 떠 있는 상태에서, 로컬 HTTP API로 운동 데이터를 주입해 확인한 결과를 정리합니다.  
(Node에서 `WorkoutPlayService`만 직접 호출하는 `sim` 모드와는 별개입니다.)

## 검증 일자·환경

- 검증 시점: 2026-03-26
- 앱: `packages/electron-app` 클린 빌드 후 `electron .` 실행
- Electron HTTP 서버: 기본 `http://127.0.0.1:3002` (`/ping`으로 확인)
- 헬스 체크: `curl http://127.0.0.1:3002/ping`

## 사용 스크립트

- 경로: `tools/runtime-intro-start-validation.ts`
- **실제 앱 연동 모드**: `http` (아래 엔드포인트 호출)
- **시뮬레이션 모드**: 인자 없음 또는 `sim` — 메인 프로세스 없이 `WorkoutPlayService`만 호출 (`sim`도 HTTP와 같이 **인트로 재생 중** `play-start` 시나리오)

### 시작·인트로 동작 (전 서킷 공통)

- **Stress / Loop / AMRAP / EMOM** 모두 동일:
  - 인트로 **도중** 또는 인트로 **종료 후** `play-start` 시 `intro-cancelled-reset-to-ready`( `showSplash: true` ) → **2초** → `countdown-started` → 프리뷰·큐 재주입 등 → 6초 뒤 본 운동.
- **`intro-dismissed-to-ready`** 로 “한 번은 ready만 복귀”하던 경로는 **제거됨** (두 번 `play-start` 불필요).

### 실제 앱 기준 실행 예시

저장소 루트에서:

```bash
npm run build --workspace=electron-app
```

`packages/electron-app`에서 Electron 실행 후:

```bash
npx tsx tools/runtime-intro-start-validation.ts http
```

특정 서킷만, 대기 시간(ms) 지정:

```bash
npx tsx tools/runtime-intro-start-validation.ts http stress 15000
```

스크립트가 보내는 HTTP 순서는 동일합니다.

| 단계 | 메서드·경로 | 비고 |
|------|-------------|------|
| 1 | `POST /start-workout-play` | 바디에 `masterId`, `userId`, `sequences`, `metadata` |
| 2 | `POST /play-intro` | 빈 바디 |
| 3 | (약 800ms 대기) | 인트로 재생 중 상태 유지 |
| 4 | `POST /play-start` | **한 번만** — 전 서킷: 스플래시·2초·카운트다운·본 운동으로 이어짐 |
| 5 | (대기) | `waitAfterStartMs` 만큼 sleep 후 메인 로그 관찰 |
| 6 | `POST /play-stop` | 세션 정리 |

요청 헤더: `Content-Type: application/json`, `X-API-Server-URL: http://localhost:3001` (스크립트 기본값)

## 테스트 데이터(스크립트 내 생성 케이스) 요약

- **Stress / Loop**: `generateWorkoutExercises`로 DS(3) + 메인 12포지션 + CD(3), 패널 3라운드(휴식·물 설정 포함)
- **AMRAP**: `generateWorkoutExercisesForTimeStructured`, 2 패널
- **EMOM**: `generateWorkoutExercisesForTimeStructured`, 3 패널(마지막에 물 설정 등 시나리오 반영)

실제 웹에서 저장한 플랜과 동일하지는 않지만, **인트로 → DS → Ready(카운트다운) → 메인 모듈 진입** 경로를 동일하게 태울 수 있습니다.

## 실제 Electron 로그에서 확인한 결과

### 공통

- 인트로 이미지 API: 실행 환경에 따라 `401`이 나와도 인트로는 계속 진행되고, 좌·우 이미지 URL이 비어 있어도 실패 처리되지 않음.
- ANT+ 동글: 미연결 시 초기화 실패 로그가 있으나, 본 검증(운동 시퀀스·모듈 분기)과는 무관한 경우가 많음.
- `play-start` 직후 브로드캐스트: `intro-cancelled-reset-to-ready`, 이어 `countdown-started`, `workout-play-preview`, `workout-setup-queue` 등 (타이밍·순서는 `workout-play-service.ts` 기준).

### Stress / Loop / AMRAP

- 인트로 중 첫 `play-start`만으로 카운트다운·재생으로 이어짐 (`intro-dismissed-to-ready` **미사용**).
- DS 구간: `StretchingModule` + `[WorkoutPlay][circuit]`의 `activeModule`이 각각 `StressModule` / `LoopModule` / `AmrapModule`과 일치함.
- 메인 진입 직전: `ReadyModule` 카운트다운(Round 1) 및 **프리뷰 6개 순서 `L1,L2,L3,R3,R2,R1`** 브로드캐스트 로그 확인.
- 이후:
  - **Stress**: `Main Workout (Round 1, Group …)`, 그룹 6개, 타임라인 프리로드 등
  - **Loop**: `Round 1 시작`, 타임라인 프리로드, `운동 위치: L1` 등
  - **AMRAP**: Round 0 종료 후 Ready, 이어서 메인 동시 실행 구간 로그

### EMOM

- Stress 등과 동일하게 **인트로 중·후** `play-start` 한 번으로 진행.
- 메인 로그: `🎬 인트로 중 운동 시작` / `🎬 인트로 후 운동 시작`(구현 상 `workout-play-service`의 `log` 문구).
- `[WorkoutPlay][circuit]`에서 `activeModule: 'EmomModule'`, `injectedCircuitType: 'emom'`과 **일치함**.
- 메인: `ReadyModule` 이후 **`EmomModule` Round 1 시작**, `운동 위치: L1` 등 **EMOM 모듈 전용 로그** 확인.

### 이전에 의심되던 현상(과거 로그)

- 과거 터미널에서 **EMOM 세션인데 `[LoopModule] 운동 위치` 로그가 섞이는** 흔적이 있었음.
- **이번 클린 빌드 + 새 Electron 프로세스 + HTTP 주입** 기준으로는 해당 불일치가 **재현되지 않음**.  
  원인 후보로는 **watch 중단·구버전 `dist` 혼재** 등을 두고 있음.

## 관찰 전제·한계

- 메인 프로세스의 일부 안내 로그(예: `[IntroStart]` 등)는 `workout-play-service.ts`에서 `DEBUG` 플래그로 막혀 있을 수 있어 **콘솔에 안 찍혀도** 브로드캐스트·모듈 로그로 동작은 확인 가능함.
- 본 검증은 **HTTP로 시퀀스를 주입**하는 경로이며, 웹앱 UI에서 동일 시퀀스를 보내는 것과 100% 동일하다고 단정하지는 않음.
- `water` / `rest` **후반 라운드 경계**까지 장시간 재생하려면 `waitAfterStartMs`를 크게 잡거나 별도 시나리오를 추가해야 함.

## 관련 파일

- 검증 스크립트: `tools/runtime-intro-start-validation.ts`
- HTTP 라우트: `packages/electron-app/src/main/http-server.ts` (`/start-workout-play`, `/play-intro`, `/play-start`, `/play-stop`)
- 인트로·시작 로직: `packages/electron-app/src/main/workout-play-service.ts`
- 렌더러 인트로·프리로드 스킵: `packages/electron-app/src/renderer/electron-renderer-workout.ts` (`introPlaybackActive` 구간 `workout-play-preload` 스킵)
