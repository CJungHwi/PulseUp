-- 권한 모델 변경:
-- - users.role: admin -> branch_admin
-- - menus.target_audience: admin -> super_admin
-- 기존 데이터가 존재하므로 enum 확장 -> 데이터 변환 -> enum 축소 순서로 처리한다.

ALTER TABLE users
  MODIFY COLUMN role ENUM('user','admin','branch_admin','super_admin') NOT NULL DEFAULT 'user'
  COMMENT '사용자 역할 - user: 지점사용자, branch_admin: 지점관리자, super_admin: 최고관리자';

UPDATE users
SET role = 'branch_admin'
WHERE role = 'admin';

ALTER TABLE users
  MODIFY COLUMN role ENUM('user','branch_admin','super_admin') NOT NULL DEFAULT 'user'
  COMMENT '사용자 역할 - user: 지점사용자, branch_admin: 지점관리자, super_admin: 최고관리자';

ALTER TABLE menus
  MODIFY COLUMN target_audience ENUM('all','admin','super_admin','user','branch_admin') NOT NULL DEFAULT 'all'
  COMMENT '대상 사용자 그룹 - all: 전체, super_admin: 최고관리자, branch_admin: 지점관리자, user: 지점사용자';

UPDATE menus
SET target_audience = 'super_admin'
WHERE target_audience = 'admin';

ALTER TABLE menus
  MODIFY COLUMN target_audience ENUM('all','super_admin','user','branch_admin') NOT NULL DEFAULT 'all'
  COMMENT '대상 사용자 그룹 - all: 전체, super_admin: 최고관리자, branch_admin: 지점관리자, user: 지점사용자';
