-- 슈퍼관리자: 운동 Scope 관리 메뉴 시드

INSERT INTO menus (parent_id, name, name_en, description, menu_type, url, icon, sort_order, is_active, is_visible, target_audience, level)
SELECT NULL, '운동 Scope 관리', 'Workout Scope', '운동 페이지별 workout scope 코드를 등록·수정합니다.', 'page', '/admin/workout-scope', 'Layers', 85, TRUE, TRUE, 'super_admin', 1
WHERE NOT EXISTS (
  SELECT 1 FROM menus WHERE url = '/admin/workout-scope' AND target_audience = 'super_admin'
);
