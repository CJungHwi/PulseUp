# API Database Scripts (packages/api-server/database)

## Module Context

- 역할: DB 스키마/프로시저/데이터 보정 SQL을 소스 코드로 관리
- 중요한 점: 실제 DB 반영은 사용자가 직접 수행

## Tech Stack & Constraints

- DB 클라이언트/드라이버: mysql2
- 에이전트는 SQL 파일을 수정할 수 있으나, DB에 직접 적용하지 않는다.

## Implementation Patterns

- 변경 단위
  - 스키마: `schema.sql` 및 관련 create/alter 스크립트
  - 프로시저: `procedures.sql` 및 `sp_*.sql`
  - 데이터 보정/업데이트: 목적이 드러나는 별도 파일로 분리
- 안전성
  - 파괴적 변경(drop, truncate 등)은 기본적으로 금지하고, 불가피하면 영향/롤백/적용 순서를 스크립트 상단 주석에 명시한다.
  - 가능하면 재실행(idempotent) 가능한 형태로 작성한다.

## Operational Commands (사용자가 직접 실행)

- 스키마 적용: `npm run db:setup --workspace=api-server`
- 프로시저 적용: `npm run db:procedures --workspace=api-server`

## Local Golden Rules

- Do: SQL 변경 이유와 적용 순서를 파일 상단에 간단히 기록한다.
- Don't: 코드 변경 없이 DB만 바뀌는 형태를 만들지 않는다(필요 시 타입/테스트도 함께 갱신).
