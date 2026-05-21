# Web App Themes (packages/web-app/src/themes)

## Module Context

- 역할: MUI 테마/토큰/다크-라이트 모드 정책을 정의

## Tech Stack & Constraints

- MUI theme 기반으로 색/타이포/컴포넌트 기본 스타일을 통일한다.
- 입력 컴포넌트 focus 규칙과 Paper 높이 규칙은 공통 스타일 가이드를 따른다.

## Implementation Patterns

- 토큰은 `designTokens.ts`에 모으고, 테마 생성은 `muiTheme.ts`에서 수행한다.
- 컴포넌트별 기본 스타일 overrides는 재사용 가능한 수준으로만 추가한다.

## Testing Strategy

- 시각적 회귀 테스트가 없다면, 최소한 테마 토큰 변경의 영향 범위를 PR/커밋 메시지에 명시한다.

## Local Golden Rules

- Do: 임의의 하드코딩 색상 대신 theme.palette를 우선 사용한다.
- Don't: 페이지별로 서로 다른 포커스/테두리 규칙을 만들지 않는다.
