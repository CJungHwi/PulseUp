-- 슈퍼관리자 라이선스 관리 메뉴 시드

INSERT INTO menus (parent_id, name, name_en, description, menu_type, url, icon, sort_order, is_active, is_visible, target_audience, level)
SELECT NULL, '라이선스 관리', 'License Management', '지점별 운동 대분류 라이선스를 발급하고 관리합니다.', 'page', '/admin/licenses', 'ShieldCheck', 90, TRUE, TRUE, 'super_admin', 1
WHERE NOT EXISTS (
  SELECT 1 FROM menus WHERE url = '/admin/licenses' AND target_audience = 'super_admin'
);

INSERT INTO menus (parent_id, name, name_en, description, menu_type, url, icon, sort_order, is_active, is_visible, target_audience, level)
SELECT NULL, '수업예약', 'Class Booking', '소속 지점 수업 예약 캘린더를 확인합니다.', 'page', '/booking/calendar', 'Calendar', 30, TRUE, TRUE, 'user', 1
WHERE NOT EXISTS (
  SELECT 1 FROM menus WHERE url = '/booking/calendar' AND target_audience = 'user'
);

INSERT INTO menus (parent_id, name, name_en, description, menu_type, url, icon, sort_order, is_active, is_visible, target_audience, level)
SELECT NULL, '수업예약 관리', 'Class Booking Management', '소속 지점 수업 예약 슬롯을 캘린더에서 등록하고 관리합니다.', 'page', '/booking/manage', 'Calendar', 30, TRUE, TRUE, 'branch_admin', 1
WHERE NOT EXISTS (
  SELECT 1 FROM menus WHERE url = '/booking/manage' AND target_audience = 'branch_admin'
);
