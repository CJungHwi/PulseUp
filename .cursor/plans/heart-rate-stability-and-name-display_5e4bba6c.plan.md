---
name: heart-rate-stability-and-name-display
overview: ANT+ 심박계 빈번한 끊김과 데이터 누락 원인을 수정하고, 화면에 표시되는 기기명칭을 끝 숫자 3자리로만 노출한다.
todos:
  - id: ant-stability
    content: "ant-heart-rate-manager: 중복 자동할당 차단, 리스너 누수 제거, connectDevice lastUpdate 시드, 생성자의 startConnectionCheck 제거"
    status: completed
  - id: ant-shutdown
    content: "ant-garmin-stick-init/HeartRateANTManager: shutdown 이벤트 콜백 추가 + restart() 자동 재초기화 1회"
    status: completed
  - id: flush-on-stop
    content: 운동 종료 경로(handleWebStopWorkout, workout-play-service stop/complete)에서 heartRateManager.flushBuffer() 호출 후 clearBuffer
    status: completed
  - id: channel-rename
    content: heart-rate-manager의 'heart-rate-update'(단수) → 'heart-rate-updated'(복수)로 통일
    status: completed
  - id: name-formatter
    content: format-device-name 유틸 신설(끝 3자리 숫자 추출) + workout-heart-rate-panel/renderer-device-slot-grid에서 표시값 변환 적용
    status: completed
  - id: verify
    content: electron-app 빌드 및 시나리오별 수동 점검(연결 안정성, 종료 시 데이터 업로드, 표시 포맷)
    status: completed
isProject: false
---

## 배경 요약 (점검 결과)

- 채널 충돌: `HeartRateScanner`와 슬롯별 `HeartRateSensor`가 동일 디바이스에 대해 이중으로 데이터를 받아 `lastUpdate` 갱신·UI 브로드캐스트가 중복되고, 스캐너 자동 할당 분기가 “이미 다른 슬롯에 연결된 deviceId”를 빈 슬롯에 다시 박아 슬롯이 흔들림.
- 리스너 누수: `disconnectDevice()`/`startConnectionCheck()`가 `sensor.detach()`만 호출하고 `removeAllListeners()`를 안 함 → 재연결 반복 시 콜백 누적.
- USB shutdown 무처리: stick의 `shutdown` 이벤트가 와도 로그만 남기고 자동 재초기화하지 않음.
- 종료 시 데이터 손실: `IPCHandlers.handleWebStopWorkout`에서 `clearBuffer()`만 호출해 10개 미만으로 쌓인 마지막 심박 데이터가 폐기됨. play 종료 경로(`playService` 정지)에도 flush가 없음.
- 죽은 채널: `'heart-rate-update'`(단수) 브로드캐스트는 preload가 구독하지 않아 사용처 없음. 오해 방지를 위해 통일.

## 수정 계획

### 1) ANT+ 안정화 — `packages/electron-app/src/main/heart-rate-modules/ant-heart-rate-manager.ts`

- 스캐너 콜백에서 “타 슬롯에 이미 연결된 deviceId”는 무시(중복 자동할당 차단). 즉, 어떤 슬롯에서든 `deviceId` 일치 항목을 찾으면 거기서만 `lastUpdate`/HR 갱신하고 즉시 return. 빈 슬롯 자동할당은 `recentlyDisconnected`에 없는 신규 deviceId로만 수행.
- `disconnectDevice()`/`startConnectionCheck()`의 stale 정리에서 `sensor.detach()` 후 `sensor.removeAllListeners()` 호출하고 `sensor = null`로 정리.
- `connectDevice()`에서 기존 `sensor`가 있으면 재사용 대신 `removeAllListeners()` + `detach()` 후 새 인스턴스를 만들어 listener 누적을 방지.
- `connectDevice()` 시작 시 `lastUpdate = Date.now()`로 세팅(연결 직후 stale 오판 방지).
- 생성자에서의 `startConnectionCheck()` 호출 제거(어차피 `initialize()` 성공 시 다시 호출됨).
- `shutdown` 이벤트 처리: `ant-garmin-stick-init.ts`의 `onShutdown`에서 단순 로그가 아니라 콜백을 통해 매니저로 통보 → 매니저가 `isInitialized=false`로 표시하고 `initialize()` 1회 자동 재시도(쿨다운 5초). `HeartRateANTManager`에 `restart()` 메서드 추가.

### 2) 종료 시 심박 데이터 보존 — `packages/electron-app/src/main/`

- `ipc-handlers.ts` `handleWebStopWorkout`: `clearBuffer()` 호출을 `await this.heartRateManager.flushBuffer()` 후 `clearBuffer()` 순으로 변경.
- `workout-play-service.ts` 운동 정지/완료 흐름(`workout-play-stopped`/`workout-play-completed` 브로드캐스트 직전)에 `await this.heartRateManager.flushBuffer()` 호출이 가능하도록 deps에 `flushHeartRateBuffer: () => Promise<void>` 추가하고 `IPCHandlers`에서 주입.
  - 위치: 정지(`922 라인 부근`), 완료/세션 정상 종료 지점.
- `'heart-rate-update'`(단수) 브로드캐스트를 `'heart-rate-updated'`(복수)로 통일하여 죽은 채널 제거 — `heart-rate-manager.ts:111, 124`.

### 3) 표시 기기명칭 — 끝 숫자 3자리만 노출

- 신규 유틸 `packages/electron-app/src/renderer/heart-rate-modules/format-device-name.ts` 생성: `formatHeartRateDeviceShortName(name: string): string` — 문자열에서 마지막 연속 숫자 그룹을 찾아 마지막 3자리만 반환. 숫자가 없으면 원본 반환.
- 적용 지점:
  - `renderer/heart-rate-modules/workout-heart-rate-panel.ts` — `${deviceName}` 출력 직전 변환(라인 224 부근). 기존 `(슬롯N)` 파싱 로직은 유지.
  - `renderer/renderer-device-slot-grid.ts` — `${deviceName}` 출력 직전 변환(라인 34 부근). 슬롯 카드 좌상단 슬롯 번호는 그대로 노출.
- 서버 업로드 페이로드의 `deviceName`은 추적성 보존을 위해 변경하지 않음(원본 `HR-{deviceId}` 유지).

### 4) 부가 정리 (선택, 동일 PR에 포함)

- `renderer/renderer.js`의 죽은 `onHeartRateUpdated` 콘솔 로그(409라인)는 그대로 두되 별도 변경 없음.
- `update-heart-rate` IPC(`main.ts:434`)는 호출처 없으므로 변경 없이 유지(영향 범위를 키우지 않기 위해 제거는 별도 작업으로).

## 검증 절차

- 빌드: `npm run build --workspace=electron-app` 통과.
- 기능 점검(수동):
  1. 동글 연결 후 4~6개 심박계 동시 연결 → 1시간 이상 가동, “슬롯 N 연결 끊김” 로그가 30초 단위로 다발하는지 모니터링.
  2. 한 기기를 의도적으로 OFF/ON → 같은 슬롯으로 복귀하는지(자동할당이 다른 빈 슬롯으로 새지 않는지) 확인.
  3. 운동을 짧게(10초) 진행 후 종료 → 10개 미만이 쌓인 buffer가 서버에 정상 업로드되는지 `/api/heart-rate/save-batch` 응답·DB row 확인.
  4. 화면 두 곳(운동 중 우측 패널, 디바이스 연결 카드)에 기기명이 3자리 숫자로만 보이는지 시각 확인.
  5. 동글 USB를 잠시 분리 후 재삽입 → 자동 재초기화 로그 및 연결 회복 확인.