# 연동 관리 · 연동사용여부 · 관리자 페이지 (계획)

> Cursor 계획 도구로 생성된 원안을 워크스페이스에 두고, **디자인 rule**을 아래에 반영함.

## 배경 및 범위 (요약)

- `users.linkage_enabled`: `N`이면 웹에서 Electron/릴레이 **Play** 차단 + 메시지: `현재 LINKHIIT앱 사용이 중지되어 있습니다. 관리자에 문의하세요.`
- 관리자: **사용자별 연동 리스트**, **선택 삭제**, 데이터 유지 **연동 중지**(토글).
- API: 릴레이·디바이스 등록 등에 서버 차단(403).
- `devices.registered_by` ↔ `users.id`(UUID) 정합성 수정 권장.

---

## 디자인 및 UI (프로젝트 rule 준수)

구현 시 아래를 **준수**한다. ([`packages/web-app/AGENTS.md`](../../packages/web-app/AGENTS.md), [`packages/web-app/src/themes/AGENTS.md`](../../packages/web-app/src/themes/AGENTS.md), [`docs/project-guide.md`](../../docs/project-guide.md) § 공통 UI)

### 공통 원칙

- **스타일 가이드**: MUI/공통 규칙은 `docs/project-guide.md`의 **공통 UI 스타일 규칙(MUI)** 을 따른다.  
  - 입력 포커스: `outline: 'none'`, 포커스 테두리 `1px` 등 (가이드 및 AGENTS.md와 동일).  
  - **Paper** 류 컨테이너 높이 기본: `calc(100vh - 140px)` 패턴을 가이드에 맞출 것.
- **테마**: 임의 hex 색 대신 **`theme.palette` / `designTokens`** 우선 ([`src/themes`](../../packages/web-app/src/themes)).
- **레이아웃**: 라우트 페이지는 기존처럼 **layouts와 결합**해 헤더/사이드바 구조를 맞추고, **페이지마다 임의 패딩·레이아웃 규칙을 새로 만들지 않는다** (AGENTS.md Golden Rules).

### 관리자 · 연동 관리 페이지 UI

- **기존 관리자 화면과 톤 맞추기**: [`UserManagement.tsx`](../../packages/web-app/src/pages/Admin/Users/UserManagement.tsx) 등과 동일한 스택을 우선한다 — **shadcn/ui** (`Card`, `Table`, `Button`, `Dialog`, `Alert` 등) + **lucide-react** 아이콘. 동일한 간격·카드·테이블 헤더 패턴을 재사용해 한 화면 안에서 이질감이 없게 한다.
- **DataGrid**가 필요하면 [`src/styles/dataGridStyles.ts`](../../packages/web-app/src/styles/dataGridStyles.ts) 공통 스타일을 먼저 적용한다 (AGENTS.md).
- **스타일링**: MUI를 쓰는 구간은 `sx` + `theme.palette` / spacing; shadcn 구간은 기존 Admin과 동일하게 `cn()`·컴포넌트 variant를 맞춘다.
- **MonthProgram Play 차단**: 기존 [`notify`](../../packages/web-app/src/pages/MonthProgram/MonthProgram.tsx) / Snackbar 패턴 유지, 문구만 요구사항대로.

### 금지·주의 (AGENTS.md)

- 페이지별로 서로 다른 포커스/테두리 규칙을 새로 만들지 않는다.  
- 환경별 URL/포트 하드코딩 없음.

---

## 기술 작업 체크리스트 (참고)

1. DB: `users.linkage_enabled`, `sp_get_user_by_token`, `registered_by` UUID 정리.  
2. API: 릴레이·`/devices/register` 403, 로그인/restore에 필드 포함.  
3. Web: `authSlice`, `MonthProgram` Play 가드.  
4. Admin: 연동 관리 라우트 + 목록·삭제·토글 API + 위 **디자인 rule** 준수 UI.

---

## 모듈 분리

- 관리자 페이지 단일 파일 600줄 초과 시 테이블/다이얼로그를 하위 컴포넌트·훅으로 분리 (사용자 rule).
