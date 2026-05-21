# Electron Main (packages/electron-app/src/main)

## Module Context

- 역할: 멀티 모니터 창 관리, IPC 핸들러, 로컬 HTTP 서버, 센서(ANT) 연동

## Tech Stack & Constraints

- main 프로세스에서만 디바이스/USB/ANT 접근을 수행한다.
- 창 배치는 연결된 디스플레이 목록을 기반으로 하고, 실패 시 단일 디스플레이 폴백을 제공한다.

## Implementation Patterns

- 파일 역할
  - `main.ts`: 앱 부트스트랩
  - `ipc-handlers.ts`: IPC 채널/핸들러 정의
  - `http-server.ts`: 로컬 HTTP 서버
  - `HeartRateANTManager.ts`: 심박수 센서 관리
- IPC 입력은 타입/검증을 거친 뒤 처리한다.

## Testing Strategy

- I/O가 있는 로직은 순수 부분을 분리해 unit test로 검증한다.

## Local Golden Rules

- Do: 포트/서버 URL은 설정 레이어로 관리한다.
- Don't: renderer가 보안 경계를 우회하도록 임시 코드를 넣지 않는다.
