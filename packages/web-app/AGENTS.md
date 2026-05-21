# Web App (packages/web-app)

## Module Context

- 역할: 관리자 웹 UI (운동/콘텐츠/사용자/재생 제어 등)
- 프레임워크: React 18 + Vite
- UI: MUI 기반(레이아웃 포함), DataGrid 사용
- 상태/라우팅: Redux Toolkit, React Router

## Tech Stack & Constraints

- MUI 스타일 규칙은 `docs/project-guide.md`를 기준으로 한다.
  - 입력 컴포넌트 focus: `outline: 'none'`, focus borderWidth `1px`
  - Paper 컨테이너 높이 기본값: `calc(100vh - 140px)`
- 공통 DataGrid 스타일은 `src/styles/dataGridStyles.ts` 재사용을 우선한다.
- API 호출은 서비스 레이어로 모으고, UI 컴포넌트에서 axios 직접 사용을 최소화한다.

## Implementation Patterns

- 폴더 역할
  - `src/pages`: 라우트 단위 화면
  - `src/layouts`: 페이지 레이아웃(헤더/사이드바 포함)
  - `src/components`: 재사용 UI 블록
  - `src/services`: API 호출 및 외부 연동
  - `src/store`: Redux store/slices
  - `src/themes`: MUI 테마/토큰
- 컴포넌트 스타일
  - `sx` 기반으로 MUI theme 값(`theme.palette`, spacing 등)을 우선 사용
  - 동일 패턴이 반복되면 `styles/` 또는 공통 컴포넌트로 추출

## Testing Strategy

- 단위/통합 테스트: Vitest
  - 실행: `npm run test --workspace=web-app`
  - 감시: `npm run test:watch --workspace=web-app`

## Local Golden Rules

- Do: 입력 컴포넌트 focus 스타일은 공통 규칙에 맞춘다(중복 테두리/outline 제거).
- Do: DataGrid는 공통 스타일/props를 먼저 적용한다.
- Do: 라우트 단위 페이지는 `layouts`와 결합해 화면 구조를 표준화한다.
- Don't: 페이지마다 임의의 레이아웃/패딩 규칙을 새로 만들지 않는다.
- Don't: 환경별 주소/포트/키를 하드코딩하지 않는다.
