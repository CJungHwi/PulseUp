-- 사이드바 메뉴: 운동 Scope → 운동저장구분 UI 표기 변경

UPDATE menus
SET
  name = '운동저장구분 관리',
  name_en = 'Workout Save Category',
  description = '운동 페이지별 운동저장구분 코드를 등록·수정합니다.'
WHERE url = '/admin/workout-scope'
  AND target_audience = 'super_admin';
