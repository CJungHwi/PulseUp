# API Services (packages/api-server/src/services)

## Module Context

- 역할: 비즈니스 로직(라우트에서 분리) 및 데이터 접근 오케스트레이션

## Tech Stack & Constraints

- DB 접근은 직접 커넥션을 만들기보다 공통 DB 레이어/유틸을 통해 통제한다.
- 외부 연동(예: YouTube/Vimeo/Google APIs)은 서비스에서 캡슐화한다.

## Implementation Patterns

- 서비스 함수는 입력을 명확히 받고(가능하면 타입/스키마 기반), 출력 형태를 표준화한다.
- 트랜잭션이 필요하면 범위를 좁게 유지하고 실패 시 롤백 경로를 명확히 한다.
- 에러는 도메인/검증/권한/인프라로 구분해 상위(라우트/에러 미들웨어)가 처리할 수 있게 한다.

## Testing Strategy

- 서비스 단위 테스트는 DB 의존을 최소화한다.
  - 순수 로직은 unit test
  - DB가 필요한 부분은 최소한의 fixture로 integration test

## Local Golden Rules

- Do: 라우트에서 서비스로 로직을 끌어올려 중복을 줄인다.
- Do: 새 기능은 기존 서비스 분류(예: auth, workout, playlist)를 따르거나, 필요하면 새 폴더로 분리한다.
- Don't: 서비스가 Express(req/res)에 의존하게 만들지 않는다.
