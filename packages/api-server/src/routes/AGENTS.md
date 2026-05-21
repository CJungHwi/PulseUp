# API Routes (packages/api-server/src/routes)

## Module Context

- 역할: HTTP 엔드포인트 정의(라우팅) 및 요청/응답 경계 처리

## Tech Stack & Constraints

- Express Router
- 입력 검증은 zod 스키마 + 검증 미들웨어로 표준화한다.

## Implementation Patterns

- 라우트 파일은 리소스 단위로 유지한다(예: users, workouts, playlists).
- 라우트에서 처리하는 것
  - 입력 검증 및 정상화
  - 권한/인가 미들웨어 적용
  - 서비스 호출 및 결과를 응답 형태로 변환
- 라우트에서 처리하지 않는 것
  - DB 접근/SQL
  - 복잡한 비즈니스 로직

## Testing Strategy

- 새 라우트/변경은 최소 1개의 테스트 케이스를 `src/tests`에 추가한다.

## Local Golden Rules

- Do: 에러는 공통 에러 미들웨어 경로로 전달한다(next).
- Don't: 라우트 파일에 서비스 로직이 누적되면 즉시 서비스로 분리한다.
