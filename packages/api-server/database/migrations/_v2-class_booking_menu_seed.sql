-- 수업예약 관련 메뉴 시드
-- 작성일: 2026-05-26
--
-- 목적:
-- 1) 지점사용자(user): 수업예약 캘린더, 내 수업예약 메뉴 등록
-- 2) 지점관리자(branch_admin): 수업예약 관리 메뉴를 별도 URL로 등록
-- 3) 기존 사용자에게 user_menu_items 권한 백필
--
-- 적용 순서:
-- - 20260522_class_booking.sql (테이블) 적용 후 실행
-- - 재실행 가능(idempotent)
--
-- USE workout_system;

-- ============================================================================
-- 1. menus 등록
-- ============================================================================

-- 기존 단일 URL 구조 보정: 지점관리자 관리 메뉴는 별도 화면으로 분리
UPDATE menus
SET url = '/booking/manage',
    description = '소속 지점 수업 예약 슬롯을 캘린더에서 등록하고 관리합니다.'
WHERE url = '/booking/calendar'
  AND target_audience = 'branch_admin'
  AND name = '수업예약 관리';

-- 지점사용자: 수업예약 캘린더
INSERT INTO menus (parent_id, name, name_en, description, menu_type, url, icon, sort_order, is_active, is_visible, target_audience, level)
SELECT NULL, '수업예약', 'Class Booking', '소속 지점 수업 예약 캘린더를 확인합니다.', 'page', '/booking/calendar', 'Calendar', 30, TRUE, TRUE, 'user', 1
WHERE NOT EXISTS (
  SELECT 1 FROM menus WHERE url = '/booking/calendar' AND target_audience = 'user'
);

-- 지점사용자: 내 수업예약 목록
INSERT INTO menus (parent_id, name, name_en, description, menu_type, url, icon, sort_order, is_active, is_visible, target_audience, level)
SELECT NULL, '내 수업예약', 'My Class Bookings', '예약한 수업을 캘린더에서 확인하고 변경/취소합니다.', 'page', '/account/bookings', 'ClipboardCheck', 31, TRUE, TRUE, 'user', 1
WHERE NOT EXISTS (
  SELECT 1 FROM menus WHERE url = '/account/bookings' AND target_audience = 'user'
);

-- 지점관리자: 수업예약 슬롯 관리
INSERT INTO menus (parent_id, name, name_en, description, menu_type, url, icon, sort_order, is_active, is_visible, target_audience, level)
SELECT NULL, '수업예약 관리', 'Class Booking Management', '소속 지점 수업 예약 슬롯을 캘린더에서 등록하고 관리합니다.', 'page', '/booking/manage', 'Calendar', 30, TRUE, TRUE, 'branch_admin', 1
WHERE NOT EXISTS (
  SELECT 1 FROM menus WHERE url = '/booking/manage' AND target_audience = 'branch_admin'
);

-- ============================================================================
-- 2. 기존 사용자 user_menu_items 권한 백필
--    (sp_CreateMenu 프로시저 경유가 아닌 직접 INSERT 시 필수)
-- ============================================================================

INSERT INTO user_menu_items (user_id, menu_id, parent_id, is_enabled, created_at)
SELECT u.userid, m.id, 0, TRUE, CURRENT_TIMESTAMP
FROM users u
INNER JOIN menus m
  ON m.url = '/booking/calendar'
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
  ON m.url = '/account/bookings'
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
