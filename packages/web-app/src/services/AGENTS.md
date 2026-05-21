# Web App Services (packages/web-app/src/services)

## Module Context

- 역할: 웹 앱의 API 호출/외부 연동을 한 곳에 모아 UI에서 네트워크 로직을 분리

## Tech Stack & Constraints

- HTTP 클라이언트: axios 사용
- 환경별 설정(서버 URL/포트)은 환경변수 또는 중앙 설정으로 관리한다.

## Implementation Patterns

- 서비스 함수는 다음 책임만 가진다
  - 요청 파라미터 직렬화
  - 응답 타입 정규화
  - 네트워크 오류/서버 오류를 구분해 표준 형태로 리턴
- UI 컴포넌트는 axios 직접 호출을 지양하고, `services/` 함수를 사용한다.
- 공통 실패 처리(예: 토큰 만료, 권한 없음)는 가능한 한 서비스/인터셉터 레벨로 끌어올린다.

## Testing Strategy

- 서비스 로직 테스트는 가능하면 순수 함수로 분리해 Vitest로 검증한다.

## Local Golden Rules

- Do: 요청/응답 타입을 `src/types`와 동기화한다.
- Do: 예외 메시지는 사용자 표시용/로그용을 분리한다.
- Don't: baseURL, 포트, 키를 하드코딩하지 않는다.
- Don't: UI 컴포넌트에 try/catch 네트워크 코드가 확산되게 두지 않는다.
