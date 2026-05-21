# LINKHIIT 통합 가이드

본 문서는 아래 문서들을 통합한 단일 가이드입니다.

- `DEV-SETUP.md`
- `deployment-guide.md`
- `docs/common-features.md`
- `docs/common-styles.md`
- `packages/electron-app/BUILD_GUIDE.md`
- `packages/electron-app/ANT_DRIVER_SETUP.md`
- `packages/electron-app/ANT_HEARTRATE_DB_IMPLEMENTATION.md`

중복 내용은 제거했고, 현재 구현(웹/서버/Electron) 기준으로 용어와 흐름을 정리했습니다.

---

## 목차

- [1. 시스템 개요](#1-시스템-개요)
- [2. 개발 환경 설정 및 실행](#2-개발-환경-설정-및-실행)
- [3. 빌드](#3-빌드)
- [4. 배포](#4-배포)
- [5. 공통 UI 스타일 규칙(MUI)](#5-공통-ui-스타일-규칙mui)
- [6. 운동 데이터 저장/조회 개요](#6-운동-데이터-저장조회-개요)
- [7. Time-Structured Training(AMRAP/EMOM) 저장 구조](#7-time-structured-trainingamrapemom-저장-구조)
- [8. Electron 멀티 모니터 플레이어](#8-electron-멀티-모니터-플레이어)
- [9. ANT+ 심박계(동글) 설정](#9-ant-심박계동글-설정)
- [10. ANT+ 심박 데이터 DB 저장](#10-ant-심박-데이터-db-저장)

---

## 1. 시스템 개요

LINKHIIT는 아래 3개 구성요소로 동작합니다.

- **Web(관리자)**: 운동/콘텐츠/사용자 관리, 재생 제어 UI
- **API 서버**: 인증/데이터 저장/조회, DB 프로시저 호출
- **Electron 앱(체육관 PC)**: 멀티 모니터 운동 재생(좌/중앙/우)

모노레포(npm workspaces) 구조이며, 주요 워크스페이스는 `packages/*` 입니다.

---

## 2. 개발 환경 설정 및 실행

### 2.1 설치

```bash
npm install
```

### 2.2 개발 실행(권장)

루트 기준 스크립트(권장):

```bash
npm run dev
```

또는 개별 실행:

```bash
npm run dev:web
npm run dev:api
npm run dev:electron
```

### 2.3 포트(기본)

- **Electron 로컬 HTTP 서버**: `http://localhost:3002`
- **API 서버**: `http://localhost:3001`
- **Web 앱(Vite)**: `http://localhost:3006`

### 2.4 개발 테스트 기본 순서

1. API 서버 실행 및 헬스체크

```bash
curl http://localhost:3001/api/health
```

2. Electron HTTP 서버 헬스체크

```bash
curl http://localhost:3002/ping
```

3. Web에서 재생 제어(예: MonthProgram) → Electron으로 요청 전송

---

## 3. 빌드

### 3.1 전체 빌드

```bash
npm run build
```

### 3.2 배포용 빌드 스크립트

```bash
node build-for-production.js
```

### 3.3 Electron 앱 패키징(Windows)

빠른 테스트(압축 없이 폴더 생성):

```bash
npm run pack
```

설치 파일 생성:

```bash
npm run dist:win
```

결과물 예시:

- `packages/electron-app/dist-electron/*Setup*.exe` (설치형)
- `packages/electron-app/dist-electron/*Portable*.exe` 또는 유사 명칭 (포터블)

### 3.4 네이티브 모듈(필요 시)

```bash
npx electron-rebuild
```

---

## 4. 배포

### 4.1 서버 배포(중앙 서버)

#### Web 정적 배포 + 리버스 프록시 예시(Nginx)

- `/`는 Web 정적 파일
- `/api/`는 API 서버로 프록시

#### API 서버 운영(PM2)

```bash
cd packages/api-server
npm run build
pm2 start dist/index.js --name "linkhiit-api"
pm2 startup
pm2 save
```

### 4.2 클라이언트 배포(체육관 PC)

Electron 설치 파일을 배포하고, 체육관 PC에서 실행합니다.

운영 시나리오(요약):

- 운영자: Web에서 프로그램 관리 → 재생 시작
- Electron: 멀티 모니터에 운동 영상/타이머 출력

### 4.3 로컬 Windows에서 빌드 후 Linux 서버로 배포(예시)

- Web/API를 로컬에서 빌드한 다음, SCP/SFTP로 서버에 전달
- 서버에서 PM2/Nginx 재시작

주의:

- `.env`는 서버 환경에 맞게 별도 관리합니다(리포지토리 하드코딩 금지).

---

## 5. 공통 UI 스타일 규칙(MUI)

### 5.1 입력 컴포넌트 Focus 규칙(중요)

- TextField/Select/OutlinedInput 등 focus 시 **중복 테두리 방지**
- 브라우저 기본 outline 제거: `outline: 'none'`
- MUI 기본 focus 스타일 유지(특히 `borderWidth: '1px'`)

### 5.2 DataGrid 공통 스타일

- 공통 스타일은 `packages/web-app/src/styles/dataGridStyles.ts` 재사용을 우선합니다.
- 셀 focus outline 제거, 선택 셀 배경 투명 처리, 행 hover/selected 색상 통일

### 5.3 레이아웃 기본 규칙

- 관리자 페이지 컨테이너 패딩: `p: 1.5`를 기본으로 사용
- **Paper 컨테이너 높이 기본값**: `height: calc(100vh - 140px)`

---

## 6. 운동 데이터 저장/조회 개요

### 6.1 핵심 테이블(개요)

- `workout_history_master`: 운동 기록 마스터(날짜/시간/메모/카테고리 등)
- `workout_history_detail`: 선택된 운동 상세(운동 ID/시간/위치/타입/횟수 등)
- `workout_history_plan`: 라운드(세트)별 계획(시간/휴식/물보충/구분 등)
- `workout_exercises`: 실제 실행 시퀀스(순서/라운드/타입/시간/횟수/위치 등)

### 6.2 실행 시퀀스 기본 구조

- `sequence`: 전체 실행 순서(1부터 시작, 연속 정수)
- `round`: 라운드(서버/플레이어 규칙에 의해 DS=0, CD=99를 사용)
- `exercise_type`: `exercise` / `rest` / `water`

### 6.3 위치(position) 규칙(요약)

- Main 운동: 등록 순서 기반으로 `L1,L2,L3,R1,R2,R3,L4...` 형태로 배치 가능
- Stretching(DS/CD): `DS1..`, `CD1..` 등 실제 position 값을 사용

---

## 7. Time-Structured Training(AMRAP/EMOM) 저장 구조

### 7.1 공통 원칙

- **DB 저장 단위는 초(seconds)** 입니다.
- UI에서 분(min) 입력을 받는 경우, 저장 직전에 초로 변환합니다.
- DS/CD는 `exercise_type`을 각각 **`DS` / `CD`** 로 저장합니다(프로시저 기준).

### 7.2 저장 Payload(요약)

```ts
{
  date: string
  time: string
  memo: string
  workoutCategory: 'AMRAP' | 'EMOM'
  masterId?: string
  dynamicMasterId?: string | 'none' // (호환) 유지
  staticMasterId?: string | 'none'  // (호환) 유지
  plans: Array<{
    circuit_type: 'none'
    round: number
    time: number      // 초
    rest: number      // 초
    hydration: 0
    method_name?: ''
  }>
  exercises: Array<{
    originalExerciseId: string
    duration: number   // 초
    reps: number
    position: string   // DS1.. / L1..R.. / CD1..
    exercise_type: 'DS' | 'main' | 'CD'
  }>
  workoutExercises: Array<{
    sequence: number
    round: number
    exercise_type: 'exercise' | 'rest' | 'water'
    exercise_id: string | null
    duration: number
    reps?: number
    position: string
    name: string
  }>
}
```

### 7.3 DS/CD round 규칙

- DS: `round = 0`
- CD: `round = 99`
- Main(AMRAP/EMOM): `round = 1..N` (설계 패널 기준)

---

## 8. Electron 멀티 모니터 플레이어

### 8.1 목표

- 모니터 3개를 사용:
  - 좌측: 운동 영상(그리드)
  - 중앙: 타이머/라운드/심박 등
  - 우측: 운동 영상(그리드)

### 8.2 로컬 통신

- Web → Electron: `http://localhost:3002/*` 로 요청
- Electron 내부: IPC 브로드캐스트로 각 창에 시퀀스 전달

### 8.3 라운드/카테고리 해석

- `round=0`: DS(스트레칭)
- `round=99`: CD(쿨다운)
- 그 외: Main(Stress/Loop/AMRAP/EMOM 포함)

### 8.4 Stretching(DS/CD) 화면 배치 규칙

- DS1~DS3: 좌측 모니터 1~3 슬롯
- DS4~DS6: 우측 모니터 1~3 슬롯
- DS7~DS9: 좌측 모니터 1~3 슬롯(다음 세트)
- DS10~DS12: 우측 모니터 1~3 슬롯(다음 세트)
- CD도 동일 규칙

### 8.5 Vimeo 재생(배포 환경 주의)

- `file://` origin으로 로드되면 Vimeo 임베드 정책에 의해 차단될 수 있습니다.
- 배포 환경에서도 `http://localhost:3002` origin으로 렌더러를 제공하는 방식으로 구성합니다.

---

## 9. ANT+ 심박계(동글) 설정

### 9.1 개요

Windows에서 ANT+ USB 동글을 사용하려면, 기본 드라이버 대신 **WinUSB 드라이버**가 필요합니다.

### 9.2 설치(요약)

1. Zadig 실행(관리자 권한)
2. Options → List All Devices
3. ANT USBStick 장치 선택
4. Driver를 **WinUSB**로 선택 후 Install/Replace
5. 재부팅

### 9.3 주의사항

- WinUSB 드라이버 설치 후 Garmin Express/Zwift 등 다른 ANT+ 앱과 충돌할 수 있습니다.
- 되돌리려면 장치 관리자에서 드라이버 제거 후 재부팅/재연결로 기본 드라이버를 복원합니다.

---

## 10. ANT+ 심박 데이터 DB 저장

### 10.1 DB 스키마(요약)

- ANT+ 식별을 위해 `device_id`, `device_name`이 `"ant-10771"`, `"HR-10771"` 같은 형태를 사용합니다.
- 프로시저 `sp_insert_heart_rate_data`를 통해 저장합니다.

적용 예시:

```bash
mysql -u root -p hiitlink < packages/api-server/database/alter_heart_rate_data_for_ant.sql
```

### 10.2 데이터 흐름(요약)

```
ANT+ 동글 → HeartRateANTManager → main.ts 콜백
→ ipc-handlers.ts(버퍼링) → API POST /api/heartrate/save-batch
→ sp_insert_heart_rate_data → heart_rate_data 저장
```

### 10.3 저장 조건(요약)

- 운동 재생 세션이 활성화된 경우에만 저장합니다.
- 세션 종료 시 남은 버퍼 데이터는 자동 전송하여 유실을 줄입니다.
