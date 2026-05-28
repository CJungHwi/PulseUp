-- PulseUp 권한 확장 + 수업예약 + 라이선스 도입 DB 변경 통합본
-- 작성일: 2026-05-24
--
-- 목적:
-- 1) users.role: admin -> branch_admin
-- 2) menus.target_audience: admin -> super_admin
-- 3) 지점별 수업예약 테이블 추가
-- 4) 지점별 운동 대분류 라이선스 테이블 추가
-- 5) 변경된 프로시저/메뉴 시드/아이콘/운동설정 템플릿 쿼리 반영
--
-- 적용 전 확인:
-- - 운영 DB명이 다르면 USE 구문을 환경에 맞게 변경하세요.
-- - 실제 DB 반영은 수동으로 수행하세요.

USE workout_system;

-- ============================================================================
-- 1. Role / 메뉴 대상 enum 변경 및 기존 데이터 변환
-- ============================================================================

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

-- ============================================================================
-- 2. 수업예약 테이블 추가
-- ============================================================================

CREATE TABLE IF NOT EXISTS class_slots (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  branch_id bigint(20) NOT NULL,
  workout_category_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  start_at DATETIME NOT NULL,
  end_at DATETIME NOT NULL,
  capacity INT NOT NULL DEFAULT 1,
  recurrence_rule VARCHAR(255) NULL,
  created_by CHAR(36) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_branch_start (branch_id, start_at),
  INDEX idx_workout_category_id (workout_category_id),
  INDEX idx_created_by (created_by),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB COMMENT='지점별 수업 슬롯';

CREATE TABLE IF NOT EXISTS class_bookings (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  slot_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  branch_id bigint(20) NOT NULL,
  status ENUM('reserved','cancelled','attended','noshow') NOT NULL DEFAULT 'reserved',
  reserved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_slot_user (slot_id, user_id),
  INDEX idx_slot_id (slot_id),
  INDEX idx_user_status (user_id, status),
  INDEX idx_branch_status (branch_id, status)
) ENGINE=InnoDB COMMENT='지점별 사용자 수업 예약';

-- ============================================================================
-- 3. 지점별 라이선스 테이블 추가
-- ============================================================================

CREATE TABLE IF NOT EXISTS branch_licenses (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  branch_id bigint(20) NOT NULL,
  workout_category_id CHAR(36) NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE NULL,
  granted_by CHAR(36) NOT NULL,
  status ENUM('active','revoked','expired') NOT NULL DEFAULT 'active',
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_branch_category_from (branch_id, workout_category_id, valid_from),
  INDEX idx_branch_status (branch_id, status),
  INDEX idx_workout_category_id (workout_category_id),
  INDEX idx_valid_range (valid_from, valid_to)
) ENGINE=InnoDB COMMENT='지점별 운동 대분류 라이선스';

-- ============================================================================
-- 4. 변경 프로시저 재정의
-- ============================================================================

DELIMITER //

CREATE OR REPLACE PROCEDURE sp_create_user(
    IN p_userid VARCHAR(50),
    IN p_email VARCHAR(255),
    IN p_name VARCHAR(100),
    IN p_password VARCHAR(255),
    IN p_role ENUM('user', 'branch_admin', 'super_admin'),
    IN p_branch_id bigint
)
BEGIN
    DECLARE v_user_id CHAR(36);
    DECLARE v_final_role VARCHAR(50);
    DECLARE v_is_approved BOOLEAN DEFAULT FALSE;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SET v_user_id = UUID();
    SET v_final_role = IFNULL(p_role, 'user');

    -- 지점관리자나 super_admin은 자동 승인
    IF v_final_role IN ('branch_admin', 'super_admin') THEN
        SET v_is_approved = TRUE;
    END IF;

    INSERT INTO users (
        id, userid, email, name, password, role, branch_id,
        is_approved, approved_by, approved_at, used
    )
    VALUES (
        v_user_id, p_userid, p_email, p_name, p_password, v_final_role, p_branch_id,
        v_is_approved,
        CASE WHEN v_is_approved = TRUE THEN v_user_id ELSE NULL END,
        CASE WHEN v_is_approved = TRUE THEN CURRENT_TIMESTAMP ELSE NULL END,
        TRUE
    );

    SELECT
        v_user_id as user_id,
        v_final_role as role,
        v_is_approved as is_approved,
        TRUE as used,
        'success' as status;

    COMMIT;
END //

CREATE OR REPLACE PROCEDURE sp_update_user(
    IN p_user_id CHAR(36),
    IN p_userid VARCHAR(50),
    IN p_name VARCHAR(100),
    IN p_email VARCHAR(255),
    IN p_role ENUM('user', 'branch_admin', 'super_admin'),
    IN p_branch_id bigint
)
BEGIN
    DECLARE v_affected_rows INT DEFAULT 0;
    DECLARE v_duplicate_count INT DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT COUNT(*) INTO v_affected_rows
    FROM users
    WHERE id = p_user_id;

    IF v_affected_rows = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '사용자를 찾을 수 없습니다';
    END IF;

    IF p_userid IS NOT NULL THEN
        SELECT COUNT(*) INTO v_duplicate_count
        FROM users
        WHERE userid = p_userid AND id != p_user_id;

        IF v_duplicate_count > 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '이미 사용 중인 사용자 ID입니다';
        END IF;
    END IF;

    IF p_branch_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_affected_rows
        FROM branches
        WHERE id = p_branch_id;

        IF v_affected_rows = 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '존재하지 않는 지점입니다';
        END IF;
    END IF;

    UPDATE users
    SET
        userid = COALESCE(p_userid, userid),
        name = COALESCE(p_name, name),
        email = p_email,
        role = COALESCE(p_role, role),
        branch_id = p_branch_id,
        updated_at = NOW()
    WHERE id = p_user_id;

    SET v_affected_rows = ROW_COUNT();

    IF v_affected_rows = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '사용자 정보 업데이트에 실패했습니다';
    END IF;

    SELECT
        id, userid, name, email, role, branch_id as branchId,
        is_approved as isApproved, used as isActive, created_at, last_login_at
    FROM users
    WHERE id = p_user_id;

    COMMIT;
END //

CREATE OR REPLACE PROCEDURE sp_CreateMenu(
    IN p_name VARCHAR(100),
    IN p_path VARCHAR(255),
    IN p_icon VARCHAR(100),
    IN p_parent_id VARCHAR(50),
    IN p_order_index INT,
    IN p_target_audience VARCHAR(50),
    IN p_menu_type VARCHAR(20),
    IN p_is_active BOOLEAN
)
BEGIN
    DECLARE v_menu_id BIGINT;
    DECLARE v_level INT DEFAULT 1;
    DECLARE v_parent_bigint BIGINT DEFAULT NULL;

    IF p_parent_id IS NOT NULL AND p_parent_id != '0' AND p_parent_id != 0 THEN
        SET v_parent_bigint = CAST(p_parent_id AS UNSIGNED);
        SELECT level + 1 INTO v_level
        FROM menus
        WHERE id = v_parent_bigint;
        IF v_level IS NULL THEN
            SET v_level = 2;
        END IF;
    END IF;

    INSERT INTO menus (
        parent_id, name, url, icon, sort_order,
        target_audience, menu_type, is_active, level
    ) VALUES (
        v_parent_bigint,
        p_name,
        p_path,
        p_icon,
        COALESCE(p_order_index, 0),
        COALESCE(p_target_audience, 'all'),
        COALESCE(p_menu_type, 'page'),
        COALESCE(p_is_active, TRUE),
        v_level
    );

    SET v_menu_id = LAST_INSERT_ID();

    IF p_target_audience = 'all' THEN
        INSERT INTO user_menu_items (user_id, menu_id, parent_id, is_enabled, created_at)
        SELECT u.userid, v_menu_id, COALESCE(v_parent_bigint, 0), TRUE, CURRENT_TIMESTAMP
        FROM users u;
    ELSEIF p_target_audience = 'super_admin' THEN
        INSERT INTO user_menu_items (user_id, menu_id, parent_id, is_enabled, created_at)
        SELECT u.userid, v_menu_id, COALESCE(v_parent_bigint, 0), TRUE, CURRENT_TIMESTAMP
        FROM users u
        WHERE u.role = 'super_admin';
    ELSEIF p_target_audience = 'branch_admin' THEN
        INSERT INTO user_menu_items (user_id, menu_id, parent_id, is_enabled, created_at)
        SELECT u.userid, v_menu_id, COALESCE(v_parent_bigint, 0), TRUE, CURRENT_TIMESTAMP
        FROM users u
        WHERE u.role = 'branch_admin';
    ELSEIF p_target_audience = 'user' THEN
        INSERT INTO user_menu_items (user_id, menu_id, parent_id, is_enabled, created_at)
        SELECT u.userid, v_menu_id, COALESCE(v_parent_bigint, 0), TRUE, CURRENT_TIMESTAMP
        FROM users u
        WHERE u.role = 'user';
    END IF;

    SELECT
        id, parent_id, name, url as path, icon, sort_order as order_index,
        target_audience, menu_type, is_active, level, created_at
    FROM menus
    WHERE id = v_menu_id;
END //

DELIMITER ;

-- ============================================================================
-- 5. 메뉴 시드 / 아이콘 업데이트
-- ============================================================================

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

INSERT INTO menus (parent_id, name, name_en, description, menu_type, url, icon, sort_order, is_active, is_visible, target_audience, level)
SELECT NULL, '라이선스 관리', 'License Management', '지점별 운동 대분류 라이선스를 발급하고 관리합니다.', 'page', '/admin/licenses', 'ShieldCheck', 90, TRUE, TRUE, 'super_admin', 1
WHERE NOT EXISTS (
  SELECT 1 FROM menus WHERE url = '/admin/licenses' AND target_audience = 'super_admin'
);

UPDATE menus
SET url = '/booking/manage',
    description = '소속 지점 수업 예약 슬롯을 캘린더에서 등록하고 관리합니다.'
WHERE url = '/booking/calendar'
  AND target_audience = 'branch_admin'
  AND name = '수업예약 관리';

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

UPDATE menus SET icon = 'LayoutDashboard'
WHERE name = '관리자 대시보드' AND target_audience = 'super_admin';

UPDATE menus SET icon = 'Dumbbell'
WHERE name = '운동관리 및 동영상 등록' AND target_audience = 'super_admin';

UPDATE menus SET icon = 'MessageSquare'
WHERE name = '공지사항 등록 관리' AND target_audience = 'super_admin';

UPDATE menus SET icon = 'Settings'
WHERE name = '메뉴관리' AND target_audience = 'super_admin';

UPDATE menus SET icon = 'Store'
WHERE name = '지점관리' AND target_audience = 'super_admin';

UPDATE menus SET icon = 'User'
WHERE name = '사용자 관리 및 승인' AND target_audience = 'super_admin';

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
-- 6. 기존 workout_setting -> workout_setting_profile 초기 템플릿 복사 기준 변경
-- ============================================================================
-- create_workout_setting_profile_tables.sql 의 변경 쿼리만 별도 반영.
-- 이미 템플릿 복사가 끝난 운영 DB에서는 필요 시에만 실행하세요.

INSERT INTO workout_setting_profile (
    owner_user_id,
    method_type,
    round_no,
    time_value,
    rest_value,
    water_break,
    reps,
    sort_order,
    is_active
)
SELECT
    u.id AS owner_user_id,
    'stress' AS method_type,
    ws.round AS round_no,
    ws.time AS time_value,
    ws.rest AS rest_value,
    ws.water_break,
    ws.reps,
    ws.sort_order,
    ws.is_active
FROM workout_setting ws
JOIN (
    SELECT id
    FROM users
    WHERE role = 'branch_admin' AND used = TRUE
    ORDER BY created_at ASC
    LIMIT 1
) u
ON 1=1
ON DUPLICATE KEY UPDATE
    time_value = VALUES(time_value),
    rest_value = VALUES(rest_value),
    water_break = VALUES(water_break),
    reps = VALUES(reps),
    sort_order = VALUES(sort_order),
    is_active = VALUES(is_active),
    updated_at = CURRENT_TIMESTAMP;

-- ---------------------------------------------------------------------------
-- sp_CreateUserMenuItems: 승인 시 역할별 기본 메뉴 등록 (DB에 직접 적용)
-- npm run db:procedures --workspace=api-server 또는 아래 블록 실행
-- ---------------------------------------------------------------------------
-- DELIMITER //
-- CREATE OR REPLACE PROCEDURE sp_CreateUserMenuItems(IN p_userid VARCHAR(50))
-- ... (packages/api-server/database/procedures.sql 와 동일)
-- END //
-- DELIMITER ;
