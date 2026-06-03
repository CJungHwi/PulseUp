# 모니터 이미지·영상앱 표시 — 수동 검증 체크리스트

DB 적용 후 테스트하세요.

1. `packages/api-server/database/_v2_monitor_display_config.sql`
2. `packages/api-server/database/workout-settings-procedures.sql`

## WorkoutSettings (`/workout-settings`)

- [ ] **기본 이미지** 탭: 좌/중/우 업로드·URL 저장·미리보기
- [ ] **인트로 이미지** 탭: 좌/중/우 저장
- [ ] **영상앱 표시** 탭: 문자 저장
- [ ] super_admin: 시스템 기본/인트로/문자 각 탭 저장

## Totalexercises WorkoutEditor

- [ ] **이미지 설정** 탭이 `전체` 오른쪽에 표시됨
- [ ] 메인 운동 2개 이상일 때 운동별 그룹(기본/인트로/영상앱) URL·문자 입력
- [ ] 저장 후 재불러오기 시 값 유지

## Electron (리모컨 → 운동 시작)

- [ ] 리모컨 ON 후 스플래시: 좌/중/우 모니터에 **기본 이미지** + 동일 **영상앱 문자**
- [ ] 인트로: **인트로 이미지** 그룹 표시
- [ ] 메인 재생 중 운동 전환 시 운동별 설정 반영

## 폴백 (3단계)

- [ ] 운동별 URL 비움 → 운동설정 값 표시
- [ ] 운동설정도 비움 → super_admin 시스템 값 표시
- [ ] `remote-control` masterId: 운동설정 → 시스템만 (운동별 없음)

## API (선택)

```http
GET /api/workout-categories/monitor-display/resolve?context=default&masterId={id}&exerciseId={id}
```
