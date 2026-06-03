-- 지점관리자 전용 기본 메뉴 시드

INSERT INTO menus (parent_id, name, name_en, description, menu_type, url, icon, sort_order, is_active, is_visible, target_audience, level)
SELECT NULL, '지점 사용자 관리', 'Branch User Management', '소속 지점 사용자 계정을 관리합니다.', 'page', '/admin/usermanager', 'Users', 10, TRUE, TRUE, 'branch_admin', 1
WHERE NOT EXISTS (
  SELECT 1 FROM menus WHERE url = '/admin/usermanager' AND target_audience = 'branch_admin'
);

INSERT INTO menus (parent_id, name, name_en, description, menu_type, url, icon, sort_order, is_active, is_visible, target_audience, level)
SELECT NULL, '지점 공지 관리', 'Branch Notice Management', '소속 지점 공지를 작성하고 관리합니다.', 'page', '/admin/notification', 'Bell', 20, TRUE, TRUE, 'branch_admin', 1
WHERE NOT EXISTS (
  SELECT 1 FROM menus WHERE url = '/admin/notification' AND target_audience = 'branch_admin'
);

