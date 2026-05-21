# API Server (packages/api-server)

## Module Context

- 역할: 웹/클라이언트(Electron)에서 사용하는 API 제공
- 프레임워크: Node.js + Express (TypeScript)
- DB: mysql2 기반(스키마/프로시저 SQL 스크립트 포함)
- 유효성 검증: zod
- 테스트: vitest

## Tech Stack & Constraints

- 서버 실행은 사용자의 명시적 요청이 있을 때만 한다.
- DB 스키마/프로시저 반영은 사용자가 직접 수행한다. 에이전트는 `database/*.sql`만 수정한다.
- 인증/인가
  - JWT 관련 비밀키는 환경변수로 관리한다.
  - 비밀번호/토큰 등 민감정보를 로그로 남기지 않는다.

## Implementation Patterns

- 계층 구조
  - `src/routes`: 라우트 핸들러(HTTP 경계)
  - `src/middleware`: 인증/권한/검증/로깅/에러 처리
  - `src/services`: 비즈니스 로직
  - `src/lib/database.ts` 및 서비스 레이어를 통해 DB 접근을 통제
  - `src/schemas`: 요청/응답/도메인 스키마(zod)
- 라우트는 가능한 한 얇게 유지하고, 로직은 서비스로 이동한다.
- 요청 검증은 스키마 + 검증 미들웨어로 표준화한다.

## Testing Strategy

- 전체: `npm run test --workspace=api-server`
- 관리자 영역 집중: `npm run test:admin-all --workspace=api-server`

## Local Golden Rules

- Do: 라우트에서 직접 SQL 실행을 피하고 서비스/DB 유틸을 사용한다.
- Do: 새 엔드포인트는 최소 1개의 테스트(vitest)를 추가한다.
- Do: 에러 응답은 공통 유틸/미들웨어 경로로 일원화한다.
- Don't: DB 변경을 코드에서 자동으로 수행하지 않는다.
- Don't: 권한 체크를 컨트롤러별로 중복 구현하지 않는다(미들웨어로 통합).
