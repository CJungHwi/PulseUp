# Electron App (packages/electron-app)

## Module Context

- 역할: 체육관 PC에서 멀티 모니터 운동 재생 및 로컬 제어
- 구성
  - main process: 창/디스플레이 관리, 로컬 HTTP 서버, 센서/디바이스 연동
  - preload: IPC 브릿지
  - renderer: 표시/UI

## Tech Stack & Constraints

- Electron 28
- TypeScript 빌드: main/preload/renderer 별도 tsconfig
- 보안
  - renderer에서 Node API를 직접 쓰지 않는다. preload IPC로만 접근한다.
  - IPC 채널은 명시적으로 정의하고, 입력 검증을 수행한다.

## Operational Commands

- 개발 (사용자가 직접 실행)
  - `npm run dev --workspace=electron-app`
- 빌드
  - `npm run build --workspace=electron-app`
- 패키징
  - `npm run dist:win --workspace=electron-app`

## Implementation Patterns

- 창 생성/레이아웃: 디스플레이 목록을 기준으로 창을 배치하고, 실패 시 안전한 기본값으로 폴백한다.
- 로컬 HTTP 서버: 엔드포인트는 최소화하고, CORS/권한 범위를 명확히 한다.
- HeartRate/ANT 연동은 main 프로세스에서만 처리한다.

## Testing Strategy

- `npm run test --workspace=electron-app`

## Local Golden Rules

- Do: IPC는 단방향/요청-응답 패턴을 명확히 하고 타입을 부여한다.
- Do: 멀티 모니터 환경(디스플레이 개수/해상도/연결 변경)에 대한 방어 로직을 유지한다.
- Don't: renderer에서 파일 시스템/디바이스 접근을 직접 하지 않는다.
- Don't: 포트/서버 주소를 하드코딩하지 않는다.
