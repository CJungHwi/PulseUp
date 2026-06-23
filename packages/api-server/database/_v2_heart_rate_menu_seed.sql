-- 개인별/그룹수업 운동심박수 관련 메뉴 시드
-- 작성일: 2026-06-09
--
-- 목적:
-- 1) 지점사용자(user): 내 운동기록(`/account/workout-records`) — 개인별 심박 그래프·월간 요약
-- 2) 지점관리자(branch_admin): 수업예약 관리(`/booking/manage`) — 예약자 출석 + 개인별 심박계 배정
-- 3) 기존 사용자 user_menu_items 권한 백필
--
-- 연관 스키마: `_v2_heart_rate_participants.sql`
-- 연관 화면:
--   - packages/web-app/src/pages/WorkoutRecords/MemberWorkoutRecords.tsx
--   - packages/web-app/src/pages/Booking/ClassBookingManagement.tsx (AttendanceDialog + HeartRateParticipantPanel)
--
-- 적용 순서:
-- - `_v2_heart_rate_participants.sql` 적용 후 실행 가능
-- - `_v2-member_workout_records.sql`, `_v2-class_booking_menu_seed.sql` 미적용 DB에서도 idempotent 동작
-- - 재실행 가능(idempotent)
--
-- USE workout_system;

-- ============================================================================
-- 1. 기존 메뉴 설명 보강 (심박수 기능 반영)
-- ============================================================================

UPDATE menus
SET description = '수업 예약/출석, 운동일별 개인 심박 그래프, 인바디 현황을 종합적으로 확인합니다.',
    icon = 'Activity',
    updated_at = CURRENT_TIMESTAMP
WHERE url = '/account/workout-records'
  AND target_audience = 'user';

UPDATE menus
SET description = '수업 슬롯 등록, 예약자 출석 처리, 운동기록별 개인 심박계 배정 및 참가자 심박 현황을 관리합니다.',
    icon = 'Calendar',
    updated_at = CURRENT_TIMESTAMP
WHERE url = '/booking/manage'
  AND target_audience = 'branch_admin';

-- ============================================================================
-- 2. menus 등록 (없을 때만 INSERT)
-- ============================================================================

-- 지점사용자: 내 운동기록 (개인별 심박 그래프)
INSERT INTO menus (parent_id, name, name_en, description, menu_type, url, icon, sort_order, is_active, is_visible, target_audience, level)
SELECT NULL, '운동기록', 'Workout Records', '수업 예약/출석, 운동일별 개인 심박 그래프, 인바디 현황을 종합적으로 확인합니다.', 'page', '/account/workout-records', 'Activity', 32, TRUE, TRUE, 'user', 1
WHERE NOT EXISTS (
  SELECT 1 FROM menus WHERE url = '/account/workout-records' AND target_audience = 'user'
);

-- 지점관리자: 수업예약 관리 (예약자 출석 + 심박계 배정)
INSERT INTO menus (parent_id, name, name_en, description, menu_type, url, icon, sort_order, is_active, is_visible, target_audience, level)
SELECT NULL, '수업예약 관리', 'Class Booking Management', '수업 슬롯 등록, 예약자 출석 처리, 운동기록별 개인 심박계 배정 및 참가자 심박 현황을 관리합니다.', 'page', '/booking/manage', 'Calendar', 30, TRUE, TRUE, 'branch_admin', 1
WHERE NOT EXISTS (
  SELECT 1 FROM menus WHERE url = '/booking/manage' AND target_audience = 'branch_admin'
);

-- ============================================================================
-- 3. 기존 사용자 user_menu_items 권한 백필
-- ============================================================================

INSERT INTO user_menu_items (user_id, menu_id, parent_id, is_enabled, created_at)
SELECT u.userid, m.id, 0, TRUE, CURRENT_TIMESTAMP
FROM users u
INNER JOIN menus m
  ON m.url = '/account/workout-records'
 AND m.target_audience = 'user'
 AND m.is_active = TRUE
 AND m.is_visible = TRUE
WHERE u.role = 'user'
  AND u.used = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM user_menu_items umi
    WHERE umi.user_id = u.userid
      AND umi.menu_id = m.id
  );

INSERT INTO user_menu_items (user_id, menu_id, parent_id, is_enabled, created_at)
SELECT u.userid, m.id, 0, TRUE, CURRENT_TIMESTAMP
FROM users u
INNER JOIN menus m
  ON m.url = '/booking/manage'
 AND m.target_audience = 'branch_admin'
 AND m.is_active = TRUE
 AND m.is_visible = TRUE
WHERE u.role = 'branch_admin'
  AND u.used = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM user_menu_items umi
    WHERE umi.user_id = u.userid
      AND umi.menu_id = m.id
  );

SELECT '개인별/그룹수업 운동심박수 메뉴 시드 완료' AS message;
