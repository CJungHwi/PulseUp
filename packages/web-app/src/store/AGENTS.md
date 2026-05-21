# Web App Store (packages/web-app/src/store)

## Module Context

- 역할: Redux Toolkit 기반 전역 상태 관리
- 구성: `store.ts` + `slices/` + typed hooks(`src/hooks/redux.ts`)

## Tech Stack & Constraints

- Redux Toolkit을 표준으로 사용하고, 직접 reducer boilerplate를 늘리지 않는다.

## Implementation Patterns

- slice 설계
  - 단일 책임: 도메인 단위로 slice를 쪼갠다(예: user, workouts, playlists)
  - 비동기 흐름은 가능한 한 thunk/서비스 레이어로 분리한다.
  - selectors를 통해 UI가 상태 구조에 과도하게 결합되지 않게 한다.
- typed hooks
  - `useAppDispatch`, `useAppSelector`를 우선 사용한다.

## Testing Strategy

- slice는 reducer 단위 테스트(입력 액션 -> 상태 변화)를 우선한다.

## Local Golden Rules

- Do: 상태 shape를 작게 유지하고, 파생 데이터는 selector에서 계산한다.
- Don't: 서버 응답 전체를 무분별하게 store에 저장하지 않는다.
- Don't: UI 컴포넌트에서 복잡한 상태 변환 로직을 중복 구현하지 않는다.
