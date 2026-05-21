-- 메뉴 아이콘 업데이트 스크립트
-- Lucide React 아이콘 이름을 사용

-- 관리자 메뉴 아이콘 설정
UPDATE menus SET icon = 'LayoutDashboard' 
WHERE name = '관리자 대시보드' AND target_audience = 'admin';

UPDATE menus SET icon = 'Dumbbell' 
WHERE name = '운동관리 및 동영상 등록' AND target_audience = 'admin';

UPDATE menus SET icon = 'MessageSquare' 
WHERE name = '공지사항 등록 관리' AND target_audience = 'admin';

UPDATE menus SET icon = 'Settings' 
WHERE name = '메뉴관리' AND target_audience = 'admin';

UPDATE menus SET icon = 'Store' 
WHERE name = '지점관리' AND target_audience = 'admin';

UPDATE menus SET icon = 'User' 
WHERE name = '사용자 관리 및 승인' AND target_audience = 'admin';

-- 결과 확인
SELECT id, name, icon, target_audience 
FROM menus 
WHERE target_audience = 'admin' 
ORDER BY sort_order;
