# API Middleware (packages/api-server/src/middleware)

## Module Context

- 역할: 인증/권한/요청 식별/로깅/레이트리밋/검증/에러 처리 등 횡단 관심사를 통합

## Tech Stack & Constraints

- Express middleware
- 민감정보(비밀번호/토큰)는 절대 로그로 남기지 않는다.

## Implementation Patterns

- 순서(개념)
  - requestId/logging -> 보안 헤더 -> CORS -> 파싱 -> 검증 -> 인증/권한 -> 라우트 -> 에러 미들웨어
- 미들웨어는 가능한 한 순수하게 유지하고, 외부 I/O는 서비스로 분리한다.

## Testing Strategy

- 인증/권한/검증 미들웨어는 보안 회귀를 막기 위해 테스트를 우선한다.

## Local Golden Rules

- Do: 권한 체크는 분산 구현하지 말고 공통 미들웨어로 통일한다.
- Don't: 에러 포맷을 라우트마다 따로 만들지 않는다.
