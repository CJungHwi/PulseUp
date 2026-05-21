# Electron Renderer (packages/electron-app/src/renderer)

## Module Context

- 역할: 모니터별 표시 UI 및 사용자 조작 화면(렌더러)

## Tech Stack & Constraints

- renderer는 표시/UI에 집중하고, 시스템 자원 접근은 preload IPC로 위임한다.

## Implementation Patterns

- 외부 데이터는 IPC 또는 로컬 HTTP 서버를 통해 가져오되, 실패 시 사용자에게 명확한 상태를 표시한다.
- 화면/모니터 역할이 분리되어 있다면 역할별 파일/컴포넌트 경계를 유지한다.

## Testing Strategy

- 렌더러 로직은 가능하면 DOM 의존을 최소화하고, 순수 로직을 unit test로 분리한다.

## Local Golden Rules

- Do: IPC 호출은 최소화하고 배치/캐싱 가능한 형태로 설계한다.
- Don't: main과 동일한 로직을 renderer에 중복 구현하지 않는다.
