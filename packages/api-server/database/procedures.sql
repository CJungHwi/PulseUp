-- Multi-Monitor Workout System Stored Procedures (Fixed Version)
-- MariaDB 10.5+ 호환

DELIMITER //

-- 1. 지점 관리 프로시저들

-- 지점 생성
CREATE OR REPLACE PROCEDURE sp_create_branch(
    IN p_name VARCHAR(100),
    IN p_address VARCHAR(255),
    IN p_phone VARCHAR(20),
    IN p_region VARCHAR(100),
    IN p_manager VARCHAR(100)
)
BEGIN
    DECLARE v_branch_id CHAR(36);
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    SET v_branch_id = UUID();
    
    INSERT INTO branches (id, name, address, phone, region, manager)
    VALUES (v_branch_id, p_name, p_address, p_phone, p_region, p_manager);
    
    SELECT v_branch_id as branch_id, 'success' as status;
    
    COMMIT;
END //

-- 2. 사용자 관리 프로시저들

-- 사용자 생성 (관리자 자동승인 포함)
CREATE OR REPLACE PROCEDURE sp_create_user(
    IN p_userid VARCHAR(50),
    IN p_email VARCHAR(255),
    IN p_name VARCHAR(100),
    IN p_password VARCHAR(255),
    IN p_role ENUM('user', 'admin', 'super_admin'),
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
    
    -- 관리자나 super_admin은 자동 승인
    IF v_final_role IN ('admin', 'super_admin') THEN
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
    
    -- 결과 반환
    SELECT 
        v_user_id as user_id, 
        v_final_role as role,
        v_is_approved as is_approved,
        TRUE as used,
        'success' as status;
    
    COMMIT;
END //

-- 사용자 인증 (userid 기반) - 승인 여부 포함
CREATE OR REPLACE PROCEDURE sp_authenticate_user(
    IN p_userid VARCHAR(50)
)
BEGIN
    SELECT u.id, u.userid, u.email, u.name, u.password, u.role, u.branch_id, u.last_login_at,
           u.is_approved, u.approved_by, u.approved_at, u.used,
           b.name as branch_name, b.region as branch_region,
           approver.name as approved_by_name
    FROM users u
    LEFT JOIN branches b ON u.branch_id = b.id
    LEFT JOIN users approver ON u.approved_by = approver.id
    WHERE u.userid = p_userid AND u.used = TRUE;
END //

-- 사용자 로그인 시간 업데이트
CREATE OR REPLACE PROCEDURE sp_update_last_login(
    IN p_user_id CHAR(36)
)
BEGIN
    UPDATE users 
    SET last_login_at = CURRENT_TIMESTAMP 
    WHERE id = p_user_id;
END //

-- 14. 사용자 세션 관리 프로시저들

-- 활성 세션 조회 (수정됨)
CREATE OR REPLACE PROCEDURE sp_get_active_sessions(
    IN p_user_id CHAR(36),
    IN p_limit INT,
    IN p_offset INT
)
BEGIN
    IF p_limit IS NULL THEN
        SET p_limit = 50;
    END IF;
    
    IF p_offset IS NULL THEN
        SET p_offset = 0;
    END IF;
    
    IF p_user_id IS NOT NULL AND p_user_id != '' THEN
    SELECT 
            us.id, us.user_id, us.session_token, us.ip_address, us.user_agent, 
            us.login_time, us.last_activity, us.expires_at, 
            u.userid, u.name, u.email 
        FROM user_sessions us 
        JOIN users u ON us.user_id = u.id 
        WHERE us.is_active = TRUE 
          AND us.expires_at > NOW()
          AND us.user_id = p_user_id
        ORDER BY us.last_activity DESC 
        LIMIT p_limit OFFSET p_offset;
    ELSE
    SELECT 
            us.id, us.user_id, us.session_token, us.ip_address, us.user_agent, 
            us.login_time, us.last_activity, us.expires_at, 
            u.userid, u.name, u.email 
        FROM user_sessions us 
        JOIN users u ON us.user_id = u.id 
        WHERE us.is_active = TRUE 
          AND us.expires_at > NOW()
        ORDER BY us.last_activity DESC 
        LIMIT p_limit OFFSET p_offset;
    END IF;
END //

-- 세션 만료 처리
CREATE OR REPLACE PROCEDURE sp_expire_sessions()
BEGIN
    DECLARE v_expired_count INT DEFAULT 0;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    UPDATE user_sessions 
    SET is_active = FALSE, logout_time = NOW()
    WHERE is_active = TRUE AND expires_at <= NOW();
    
    SET v_expired_count = ROW_COUNT();
    
    SELECT v_expired_count as expired_sessions, 'Sessions expired successfully' as message;
    
    COMMIT;
END //

-- 사용자별 세션 통계
CREATE OR REPLACE PROCEDURE sp_get_user_session_stats(
    IN p_user_id CHAR(36)
)
BEGIN
    SELECT 
        COUNT(*) as total_sessions,
        SUM(CASE WHEN is_active = TRUE AND expires_at > NOW() THEN 1 ELSE 0 END) as active_sessions,
        SUM(CASE WHEN logout_time IS NOT NULL THEN 1 ELSE 0 END) as completed_sessions,
        AVG(CASE WHEN logout_time IS NOT NULL THEN TIMESTAMPDIFF(SECOND, login_time, logout_time) ELSE NULL END) as avg_session_duration,
        MAX(last_activity) as last_activity_time
    FROM user_sessions
    WHERE user_id = p_user_id;
END //

-- 15. 로그인 이력 관리 프로시저들

-- 로그인 이력 상세 조회 (수정됨)
CREATE OR REPLACE PROCEDURE sp_get_login_history_detail(
    IN p_user_id CHAR(36),
    IN p_start_date DATE,
    IN p_end_date DATE,
    IN p_success_only BOOLEAN,
    IN p_limit INT,
    IN p_offset INT
)
BEGIN
    IF p_success_only IS NULL THEN
        SET p_success_only = FALSE;
    END IF;
    
    IF p_limit IS NULL THEN
        SET p_limit = 100;
    END IF;
    
    IF p_offset IS NULL THEN
        SET p_offset = 0;
    END IF;
    
    SELECT 
        ulh.id, ulh.user_id, ulh.login_time, ulh.logout_time, ulh.ip_address, 
        ulh.user_agent, ulh.login_method, ulh.success, ulh.failure_reason, 
        ulh.session_duration, u.userid, u.name 
    FROM user_login_history ulh 
    JOIN users u ON ulh.user_id = u.id 
    WHERE (p_user_id IS NULL OR ulh.user_id = p_user_id)
      AND (p_start_date IS NULL OR DATE(ulh.login_time) >= p_start_date)
      AND (p_end_date IS NULL OR DATE(ulh.login_time) <= p_end_date)
      AND (p_success_only = FALSE OR ulh.success = TRUE)
    ORDER BY ulh.login_time DESC 
    LIMIT p_limit OFFSET p_offset;
END //

-- 로그인 통계 조회 (수정됨)
CREATE OR REPLACE PROCEDURE sp_get_login_stats(
    IN p_user_id CHAR(36),
    IN p_start_date DATE,
    IN p_end_date DATE
)
BEGIN
    SELECT 
        COUNT(*) as total_attempts,
        SUM(CASE WHEN success = TRUE THEN 1 ELSE 0 END) as successful_logins,
        SUM(CASE WHEN success = FALSE THEN 1 ELSE 0 END) as failed_attempts,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT ip_address) as unique_ips
    FROM user_login_history 
    WHERE (p_user_id IS NULL OR user_id = p_user_id)
      AND (p_start_date IS NULL OR DATE(login_time) >= p_start_date)
      AND (p_end_date IS NULL OR DATE(login_time) <= p_end_date);
END //

-- 사용자 강제 로그아웃 프로시저
CREATE OR REPLACE PROCEDURE sp_force_user_logout(
    IN p_user_id CHAR(36),
    IN p_session_id CHAR(36)
)
BEGIN
    DECLARE v_affected_rows INT DEFAULT 0;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    IF p_session_id IS NOT NULL THEN
        -- 특정 세션만 로그아웃
        UPDATE user_sessions 
        SET is_active = FALSE, logout_time = NOW() 
        WHERE id = p_session_id AND user_id = p_user_id AND is_active = TRUE;
        
        SET v_affected_rows = ROW_COUNT();
    ELSE
        -- 모든 활성 세션 로그아웃
        UPDATE user_sessions 
        SET is_active = FALSE, logout_time = NOW() 
        WHERE user_id = p_user_id AND is_active = TRUE;
        
        SET v_affected_rows = ROW_COUNT();
    END IF;
    
    -- 영향받은 세션 수 반환
    SELECT v_affected_rows as affected_sessions;
    
    COMMIT;
END //

-- 실패한 로그인 시도 조회 (보안 모니터링용) (수정됨)
CREATE OR REPLACE PROCEDURE sp_get_failed_login_attempts(
    IN p_ip_address VARCHAR(45),
    IN p_hours_back INT,
    IN p_limit INT
)
BEGIN
    IF p_hours_back IS NULL THEN
        SET p_hours_back = 24;
    END IF;
    
    IF p_limit IS NULL THEN
        SET p_limit = 100;
    END IF;
    
    SELECT 
        ulh.id, ulh.user_id, ulh.login_time, ulh.ip_address, ulh.user_agent, 
        ulh.failure_reason, u.userid, u.name 
    FROM user_login_history ulh 
    LEFT JOIN users u ON ulh.user_id = u.id 
    WHERE ulh.success = FALSE 
      AND ulh.login_time >= DATE_SUB(NOW(), INTERVAL p_hours_back HOUR)
      AND (p_ip_address IS NULL OR ulh.ip_address = p_ip_address)
    ORDER BY ulh.login_time DESC 
    LIMIT p_limit;
END //

-- =====================================================
-- 로그인 관련 추가 프로시저들 (직접 SQL 쿼리 대체)
-- =====================================================

-- 1. 토큰에서 사용자 정보 조회 프로시저
CREATE OR REPLACE PROCEDURE sp_get_user_by_token(
    IN p_user_id CHAR(36)
)
BEGIN
    SELECT u.id, u.userid, u.email, u.name, u.role, u.branch_id as branchId,
           b.name as branchName,
           IFNULL(u.linkage_enabled, TRUE) as linkageEnabled
    FROM users u 
    LEFT JOIN branches b ON u.branch_id = b.id
    WHERE u.id = p_user_id AND u.used = TRUE;
END //

-- 2. 사용자 존재 확인 프로시저
CREATE OR REPLACE PROCEDURE sp_check_user_exists(
    IN p_user_id CHAR(36)
)
BEGIN
    SELECT id, userid, name 
    FROM users 
    WHERE id = p_user_id;
END //

-- 3. 사용자 세션 업데이트 프로시저 (활성 세션이 없으면 생성, 중복 키 에러 자동 처리)
CREATE OR REPLACE PROCEDURE sp_update_user_session(
    IN p_user_id CHAR(36),
    IN p_session_token VARCHAR(2000),
    IN p_expires_at TIMESTAMP
)
BEGIN
    DECLARE v_active_session_id CHAR(36) DEFAULT NULL;
    DECLARE v_affected_rows INT DEFAULT 0;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- 활성 세션 ID 조회 (FOR UPDATE로 동시성 제어)
    SELECT id INTO v_active_session_id
    FROM user_sessions
    WHERE user_id = p_user_id AND is_active = TRUE
    LIMIT 1
    FOR UPDATE;
    
    -- 활성 세션이 있으면 업데이트
    IF v_active_session_id IS NOT NULL THEN
        UPDATE user_sessions 
        SET session_token = p_session_token, 
            expires_at = p_expires_at, 
            last_activity = NOW()
        WHERE id = v_active_session_id;
        
        SET v_affected_rows = ROW_COUNT();
        SELECT v_affected_rows as affected_rows, 'Session updated successfully' as message;
    ELSE
        -- 활성 세션이 없으면 INSERT ... ON DUPLICATE KEY UPDATE 사용
        -- 같은 (user_id, session_token) 조합이 이미 있으면 업데이트, 없으면 생성
        INSERT INTO user_sessions 
        (id, user_id, session_token, login_time, last_activity, expires_at, is_active)
        VALUES (UUID(), p_user_id, p_session_token, NOW(), NOW(), p_expires_at, TRUE)
        ON DUPLICATE KEY UPDATE
            expires_at = p_expires_at,
            last_activity = NOW(),
            is_active = TRUE,
            logout_time = NULL,
            login_time = NOW();
        
        SET v_affected_rows = ROW_COUNT();
        SELECT v_affected_rows as affected_rows, 
               CASE 
                   WHEN v_affected_rows = 1 THEN 'Session created successfully'
                   WHEN v_affected_rows = 2 THEN 'Session updated successfully'
                   ELSE 'Session processed successfully'
               END as message;
    END IF;
    
    COMMIT;
END //

-- 4. 로그인 이력 기록 프로시저
CREATE OR REPLACE PROCEDURE sp_record_login_history(
    IN p_user_id CHAR(36),
    IN p_ip_address VARCHAR(45),
    IN p_user_agent TEXT,
    IN p_success BOOLEAN,
    IN p_failure_reason VARCHAR(255)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    INSERT INTO user_login_history 
    (user_id, login_time, ip_address, user_agent, login_method, success, failure_reason)
    VALUES (p_user_id, NOW(), p_ip_address, p_user_agent, 'web', p_success, p_failure_reason);
    
    SELECT LAST_INSERT_ID() as login_history_id, 'Login history recorded successfully' as message;
    
    COMMIT;
END //

-- 5. 기존 세션 로그아웃 프로시저
CREATE OR REPLACE PROCEDURE sp_logout_existing_sessions(
    IN p_user_id CHAR(36)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    UPDATE user_sessions 
    SET is_active = FALSE, logout_time = NOW() 
    WHERE user_id = p_user_id AND is_active = TRUE;
    
    SELECT ROW_COUNT() as affected_rows, 'Existing sessions logged out successfully' as message;
    
    COMMIT;
END //

-- 6. 새 세션 생성 프로시저
CREATE OR REPLACE PROCEDURE sp_create_user_session(
    IN p_user_id CHAR(36),
    IN p_session_token VARCHAR(2000),
    IN p_ip_address VARCHAR(45),
    IN p_user_agent TEXT,
    IN p_expires_at TIMESTAMP
)
BEGIN
    DECLARE v_session_id CHAR(36);
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    SET v_session_id = UUID();
    
    INSERT INTO user_sessions 
    (id, user_id, session_token, ip_address, user_agent, login_time, last_activity, expires_at, is_active)
    VALUES (v_session_id, p_user_id, p_session_token, p_ip_address, p_user_agent, NOW(), NOW(), p_expires_at, TRUE);
    
    SELECT v_session_id as session_id, 'User session created successfully' as message;
    
    COMMIT;
END //

-- 7. 로그아웃 시 세션 비활성화 프로시저
CREATE OR REPLACE PROCEDURE sp_logout_user_sessions(
    IN p_user_id CHAR(36)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    UPDATE user_sessions 
    SET is_active = FALSE, logout_time = NOW() 
    WHERE user_id = p_user_id AND is_active = TRUE;
    
    SELECT ROW_COUNT() as affected_rows, 'User sessions logged out successfully' as message;
    
    COMMIT;
END //

-- 8. 로그아웃 시 로그인 이력 업데이트 프로시저
CREATE OR REPLACE PROCEDURE sp_update_login_history_logout(
    IN p_user_id CHAR(36)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    UPDATE user_login_history 
    SET logout_time = NOW(),
        session_duration = TIMESTAMPDIFF(SECOND, login_time, NOW())
    WHERE user_id = p_user_id 
      AND logout_time IS NULL
    ORDER BY login_time DESC 
    LIMIT 1;
    
    SELECT ROW_COUNT() as affected_rows, 'Login history updated with logout time' as message;
    
    COMMIT;
END //

-- 9. 만료된 세션 정리 프로시저
CREATE OR REPLACE PROCEDURE sp_cleanup_expired_sessions()
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    UPDATE user_sessions 
    SET is_active = FALSE, logout_time = NOW()
    WHERE is_active = TRUE 
      AND expires_at <= NOW();
    
    SELECT ROW_COUNT() as cleaned_sessions, 'Expired sessions cleaned up' as message;
    
    COMMIT;
END //

-- 9. 사용자 ID로 사용자 정보 조회 프로시저
CREATE OR REPLACE PROCEDURE sp_get_user_by_id(
    IN p_user_id CHAR(36)
)
BEGIN
    SELECT u.id, u.email, u.name, u.branch_id, u.created_at, u.last_login_at,
           b.name as branch_name, b.region as branch_region
    FROM users u
    LEFT JOIN branches b ON u.branch_id = b.id
    WHERE u.id = p_user_id;
END //

-- 사용자 로그인 이력 목록 조회 프로시저 (수정됨)
CREATE OR REPLACE PROCEDURE sp_get_user_login_history(
    IN p_page INT,
    IN p_limit INT,
    IN p_search VARCHAR(255),
    IN p_branch_id BIGINT,
    IN p_only_active BOOLEAN
)
BEGIN
    DECLARE v_offset INT DEFAULT 0;
    DECLARE v_search_pattern VARCHAR(257) DEFAULT '';
    
    -- 기본값 설정
    IF p_page IS NULL THEN
        SET p_page = 1;
    END IF;
    
    IF p_limit IS NULL THEN
        SET p_limit = 20;
    END IF;
    
    IF p_only_active IS NULL THEN
        SET p_only_active = FALSE;
    END IF;
    
    -- OFFSET 계산
    SET v_offset = (p_page - 1) * p_limit;
    
    -- 검색 패턴 설정
    IF p_search IS NOT NULL AND p_search != '' THEN
        SET v_search_pattern = CONCAT('%', p_search, '%');
    END IF;
    
    -- 총 개수 조회
    SELECT COUNT(DISTINCT u.id) as total_count
    FROM users u
        LEFT JOIN branches b ON u.branch_id = b.id
        LEFT JOIN user_sessions us ON u.id = us.user_id AND us.is_active = TRUE AND us.expires_at > NOW()
    WHERE u.used = TRUE
        AND (p_search IS NULL OR p_search = '' OR u.name LIKE v_search_pattern OR u.userid LIKE v_search_pattern)
        AND (p_branch_id IS NULL OR p_branch_id = '' OR u.branch_id = p_branch_id)
        AND (p_only_active = FALSE OR (us.is_active = TRUE AND us.expires_at > NOW()));
    
    -- 사용자 로그인 정보 목록 조회
    SELECT 
        u.id,
        u.userid,
        u.name,
        u.email,
        u.branch_id,
        b.name as branch_name,
        u.last_login_at,
        u.created_at,
        CASE
            WHEN us.id IS NOT NULL AND us.is_active = TRUE AND us.expires_at > NOW()
            THEN TRUE
            ELSE FALSE
        END as is_currently_logged_in,
        us.login_time as current_session_start,
        us.last_activity as current_session_activity,
        us.ip_address as current_session_ip,
        COALESCE((SELECT COUNT(*) FROM user_login_history ulh WHERE ulh.user_id = u.id), 0) as total_login_count,
        COALESCE((SELECT COUNT(*) FROM user_login_history ulh WHERE ulh.user_id = u.id AND ulh.login_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)), 0) as login_count_30days
    FROM users u
        LEFT JOIN branches b ON u.branch_id = b.id
        LEFT JOIN user_sessions us ON u.id = us.user_id AND us.is_active = TRUE AND us.expires_at > NOW()
    WHERE u.used = TRUE
        AND (p_search IS NULL OR p_search = '' OR u.name LIKE v_search_pattern OR u.userid LIKE v_search_pattern)
        AND (p_branch_id IS NULL OR p_branch_id = '' OR u.branch_id = p_branch_id)
        AND (p_only_active = FALSE OR (us.is_active = TRUE AND us.expires_at > NOW()))
    GROUP BY u.id, u.userid, u.name, u.email, u.branch_id, b.name, u.last_login_at, u.created_at,
             us.id, us.is_active, us.expires_at, us.login_time, us.last_activity, us.ip_address
    ORDER BY
        CASE WHEN us.id IS NOT NULL THEN 0 ELSE 1 END,
        u.last_login_at DESC
    LIMIT p_limit OFFSET v_offset;
END //

-- 특정 사용자의 세션 상세 정보 조회 프로시저
CREATE OR REPLACE PROCEDURE sp_get_user_session_detail(
    IN p_user_id CHAR(36),
    IN p_page INT,
    IN p_limit INT
)
BEGIN
    DECLARE v_offset INT DEFAULT 0;
    
    -- 기본값 설정
    IF p_page IS NULL THEN
        SET p_page = 1;
    END IF;
    
    IF p_limit IS NULL THEN
        SET p_limit = 50;
    END IF;
    
    -- OFFSET 계산
    SET v_offset = (p_page - 1) * p_limit;
    
    -- 사용자 기본 정보
    SELECT id, userid, name FROM users WHERE id = p_user_id;
    
    -- 현재 활성 세션 조회
    SELECT 
        id,
        session_token,
        login_time,
        last_activity,
        ip_address,
        user_agent,
        expires_at
    FROM user_sessions 
    WHERE user_id = p_user_id AND is_active = TRUE AND expires_at > NOW()
    ORDER BY login_time DESC;
    
    -- 총 로그인 이력 수
    SELECT COUNT(*) as total FROM user_login_history WHERE user_id = p_user_id;
    
    -- 상세 로그인 이력
    SELECT 
        id,
        login_time,
        logout_time,
        ip_address,
        user_agent,
        login_method,
        success,
        failure_reason,
        session_duration,
        CASE 
            WHEN logout_time IS NULL AND login_time >= DATE_SUB(NOW(), INTERVAL 1 DAY)
            THEN TRUE 
            ELSE FALSE 
        END as potentially_active
    FROM user_login_history 
    WHERE user_id = p_user_id
    ORDER BY login_time DESC
    LIMIT p_limit OFFSET v_offset;
END //

-- 사용자 상태 업데이트 (활성화/비활성화)
CREATE OR REPLACE PROCEDURE sp_update_user_status(
    IN p_user_id CHAR(36),
    IN p_active BOOLEAN
)
BEGIN
    DECLARE v_affected_rows INT DEFAULT 0;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- 사용자 상태 업데이트
    UPDATE users 
    SET used = p_active,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    SET v_affected_rows = ROW_COUNT();
    
    -- 업데이트된 행이 없으면 사용자를 찾을 수 없음
    IF v_affected_rows = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '사용자를 찾을 수 없습니다';
    END IF;
    
    -- 업데이트된 사용자 정보 반환
    SELECT 
        id,
        userid,
        name,
        email,
        role,
        branch_id as branchId,
        is_approved as isApproved,
        used as isActive,
        created_at,
        last_login_at
    FROM users 
    WHERE id = p_user_id;
    
    COMMIT;
END //

-- 사용자 정보 업데이트
CREATE OR REPLACE PROCEDURE sp_update_user(
    IN p_user_id CHAR(36),
    IN p_userid VARCHAR(50),
    IN p_name VARCHAR(100),
    IN p_email VARCHAR(255),
    IN p_role ENUM('user', 'admin', 'super_admin'),
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
    
    -- 사용자 존재 확인
    SELECT COUNT(*) INTO v_affected_rows
    FROM users 
    WHERE id = p_user_id;
    
    IF v_affected_rows = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '사용자를 찾을 수 없습니다';
    END IF;
    
    -- userid 중복 확인 (변경하려는 경우)
    IF p_userid IS NOT NULL THEN
        SELECT COUNT(*) INTO v_duplicate_count
        FROM users 
        WHERE userid = p_userid AND id != p_user_id;
        
        IF v_duplicate_count > 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '이미 사용 중인 사용자 ID입니다';
        END IF;
    END IF;
    
    -- 지점 존재 확인 (지점이 지정된 경우)
    IF p_branch_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_affected_rows
        FROM branches 
        WHERE id = p_branch_id;
        
        IF v_affected_rows = 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '존재하지 않는 지점입니다';
        END IF;
    END IF;
    
    -- 사용자 정보 업데이트
    UPDATE users 
    SET 
        userid = COALESCE(p_userid, userid),
        name = COALESCE(p_name, name),
        email = p_email, -- NULL 허용
        role = COALESCE(p_role, role),
        branch_id = p_branch_id, -- NULL 허용
        updated_at = NOW()
    WHERE id = p_user_id;
    
    SET v_affected_rows = ROW_COUNT();
    
    IF v_affected_rows = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '사용자 정보 업데이트에 실패했습니다';
    END IF;
    
    -- 업데이트된 사용자 정보 반환
    SELECT 
        id, userid, name, email, role, branch_id as branchId,
        is_approved as isApproved, used as isActive, created_at, last_login_at
    FROM users 
    WHERE id = p_user_id;
    
    COMMIT;
END //

-- ============================================================================
-- 메뉴 관리 프로시저
-- ============================================================================

-- 메뉴 목록 조회 프로시저 (관리자용 - 모든 메뉴 조회)
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_GetMenus(
    IN p_target_audience VARCHAR(50),
    IN p_parent_id VARCHAR(50)
)
BEGIN
    SELECT 
        id,
        parent_id,
        name,
        name_en,
        description,
        menu_type,
        url as path,
        icon,
        sort_order as order_index,
        is_active,
        is_visible,
        required_permissions,
        target_audience,
        level,
        created_at,
        updated_at
    FROM menus
    WHERE (p_target_audience IS NULL OR 
           FIND_IN_SET(target_audience, p_target_audience) > 0 OR
           target_audience = 'all')
      AND (
          (p_parent_id IS NULL AND parent_id IS NULL) OR
          (p_parent_id = '0' AND (parent_id = '0' OR parent_id = 0)) OR
          (parent_id = p_parent_id)
      )
      AND is_visible = TRUE
    ORDER BY sort_order ASC, name ASC;
END //

-- 사용자별 메뉴 목록 조회 프로시저 (로그인 시 사용 - user_menu_items와 조인)
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_GetUserMenus(
    IN p_userid VARCHAR(50),
    IN p_target_audience VARCHAR(50),
    IN p_parent_id VARCHAR(50)
)
BEGIN
    SELECT 
        m.id,
        m.parent_id,
        m.name,
        m.name_en,
        m.description,
        m.menu_type,
        m.url as path,
        m.icon,
        m.sort_order as order_index,
        m.is_active,
        m.is_visible,
        m.required_permissions,
        m.target_audience,
        m.level,
        m.created_at,
        m.updated_at,
        umi.is_enabled as user_enabled
    FROM menus m
    LEFT JOIN user_menu_items umi ON m.id = umi.menu_id AND umi.user_id = p_userid
    WHERE 
      (p_target_audience IS NULL OR 
           FIND_IN_SET(m.target_audience, p_target_audience) > 0 OR
           m.target_audience = 'all')
      AND (
          (p_parent_id IS NULL AND m.parent_id IS NULL) OR
          (p_parent_id = '0' AND (m.parent_id = '0' OR m.parent_id = 0)) OR
          (m.parent_id = p_parent_id)
      )
      AND m.is_visible = TRUE
      AND m.is_active = TRUE
      AND (
          m.menu_type = 'folder' 
          OR 
          (umi.is_enabled = TRUE)
      )
    ORDER BY m.sort_order ASC, m.name ASC;
END //

-- 메뉴 상태 업데이트 프로시저
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_UpdateMenuStatus(
    IN p_id CHAR(36),
    IN p_is_active BOOLEAN
)
BEGIN
    UPDATE menus 
    SET is_active = p_is_active,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_id;
    
    SELECT id, is_active, updated_at
    FROM menus 
    WHERE id = p_id;
END //

-- 메뉴 생성 프로시저
DELIMITER //
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
    
    -- 부모 메뉴가 있고 0이 아니면 parent_id 파싱 및 레벨 계산
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
    
    -- 메뉴 생성 후 권한 자동 부여 (user_menu_items.user_id = users.userid, sp_GetMenus 등과 동일)
    IF p_target_audience = 'all' THEN
        INSERT INTO user_menu_items (user_id, menu_id, parent_id, is_enabled, created_at)
        SELECT u.userid, v_menu_id, COALESCE(v_parent_bigint, 0), TRUE, CURRENT_TIMESTAMP
        FROM users u;
    ELSEIF p_target_audience = 'admin' THEN
        INSERT INTO user_menu_items (user_id, menu_id, parent_id, is_enabled, created_at)
        SELECT u.userid, v_menu_id, COALESCE(v_parent_bigint, 0), TRUE, CURRENT_TIMESTAMP
        FROM users u
        WHERE u.role IN ('admin', 'super_admin');
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

-- ============================================================================
-- 공지사항 관리 프로시저
-- ============================================================================

-- 공지사항 목록 조회
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_GetAnnouncements(
    IN p_page INT,
    IN p_limit INT,
    IN p_type VARCHAR(50),
    IN p_status VARCHAR(20),
    IN p_search VARCHAR(255)
)
BEGIN
    DECLARE v_offset INT DEFAULT 0;
    DECLARE v_page INT DEFAULT 1;
    DECLARE v_limit INT DEFAULT 10;
    
    -- 기본값 설정
    SET v_page = COALESCE(p_page, 1);
    SET v_limit = COALESCE(p_limit, 10);
    SET v_offset = (v_page - 1) * v_limit;
    
    -- 총 개수 조회
    SELECT COUNT(*) as total
    FROM announcements a
    WHERE (p_type IS NULL OR p_type = '' OR a.type = p_type)
      AND (p_status IS NULL OR p_status = '' OR 
           (p_status = 'active' AND a.is_active = TRUE) OR 
           (p_status = 'inactive' AND a.is_active = FALSE))
      AND (p_search IS NULL OR p_search = '' OR 
           a.title LIKE CONCAT('%', p_search, '%') OR 
           a.content LIKE CONCAT('%', p_search, '%'));
    
    -- 공지사항 목록 조회 (LIMIT 직접 사용)
    SELECT 
        a.id,
        a.title,
        a.content,
        a.attachments,
        a.type,
        a.priority,
        a.target_audience,
        a.branch_id,
        b.name as branch_name,
        a.author_id,
        u.name as author_name,
        a.is_active,
        a.is_pinned,
        a.start_date,
        a.end_date,
        a.view_count,
        a.created_at,
        a.updated_at
    FROM announcements a
    LEFT JOIN branches b ON a.branch_id = b.id
    LEFT JOIN users u ON a.author_id = u.id
    WHERE (p_type IS NULL OR p_type = '' OR a.type = p_type)
      AND (p_status IS NULL OR p_status = '' OR 
           (p_status = 'active' AND a.is_active = TRUE) OR 
           (p_status = 'inactive' AND a.is_active = FALSE))
      AND (p_search IS NULL OR p_search = '' OR 
           a.title LIKE CONCAT('%', p_search, '%') OR 
           a.content LIKE CONCAT('%', p_search, '%'))
    ORDER BY a.is_pinned DESC, a.created_at DESC
    LIMIT v_limit OFFSET v_offset;
END //

-- 공지사항 상세 조회
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_GetAnnouncement(
    IN p_id BIGINT
)
BEGIN
    SELECT 
        a.id,
        a.title,
        a.content,
        a.attachments,
        a.type,
        a.priority,
        a.target_audience,
        a.branch_id,
        b.name as branch_name,
        a.author_id,
        u.name as author_name,
        a.is_active,
        a.is_pinned,
        a.start_date,
        a.end_date,
        a.view_count,
        a.created_at,
        a.updated_at
    FROM announcements a
    LEFT JOIN branches b ON a.branch_id = b.id
    LEFT JOIN users u ON a.author_id = u.id
    WHERE a.id = p_id;
END //

-- 공지사항 생성
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_CreateAnnouncement(
    IN p_title VARCHAR(255),
    IN p_content TEXT,
    IN p_type VARCHAR(50),
    IN p_priority VARCHAR(50),
    IN p_target_audience VARCHAR(50),
    IN p_branch_id BIGINT,
    IN p_author_id CHAR(36),
    IN p_is_active BOOLEAN,
    IN p_is_pinned BOOLEAN,
    IN p_start_date TIMESTAMP,
    IN p_end_date TIMESTAMP,
    IN p_attachments JSON
)
BEGIN
    DECLARE v_announcement_id BIGINT;
    
    START TRANSACTION;
    
    INSERT INTO announcements (
        title, content, attachments, type, priority, target_audience, 
        branch_id, author_id, is_active, is_pinned, 
        start_date, end_date
    ) VALUES (
        p_title, p_content, p_attachments, p_type, p_priority, p_target_audience,
        p_branch_id, p_author_id, p_is_active, p_is_pinned,
        p_start_date, p_end_date
    );
    
    SET v_announcement_id = LAST_INSERT_ID();
    
    -- 생성된 공지사항 조회
    SELECT 
        a.id,
        a.title,
        a.content,
        a.attachments,
        a.type,
        a.priority,
        a.target_audience,
        a.branch_id,
        b.name as branch_name,
        a.author_id,
        u.name as author_name,
        a.is_active,
        a.is_pinned,
        a.start_date,
        a.end_date,
        a.view_count,
        a.created_at,
        a.updated_at
    FROM announcements a
    LEFT JOIN branches b ON a.branch_id = b.id
    LEFT JOIN users u ON a.author_id = u.id
    WHERE a.id = v_announcement_id;
    
    COMMIT;
END //

-- 공지사항 수정
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_UpdateAnnouncement(
    IN p_id BIGINT,
    IN p_title VARCHAR(255),
    IN p_content TEXT,
    IN p_type VARCHAR(50),
    IN p_priority VARCHAR(50),
    IN p_target_audience VARCHAR(50),
    IN p_branch_id BIGINT,
    IN p_is_active BOOLEAN,
    IN p_is_pinned BOOLEAN,
    IN p_start_date TIMESTAMP,
    IN p_end_date TIMESTAMP,
    IN p_attachments JSON
)
BEGIN
    START TRANSACTION;
    
    -- 공지사항 존재 확인
    IF NOT EXISTS (SELECT 1 FROM announcements WHERE id = p_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '공지사항을 찾을 수 없습니다';
    END IF;
    
    UPDATE announcements 
    SET 
        title = COALESCE(p_title, title),
        content = COALESCE(p_content, content),
        attachments = IF(p_attachments IS NULL, attachments, p_attachments),
        type = COALESCE(p_type, type),
        priority = COALESCE(p_priority, priority),
        target_audience = COALESCE(p_target_audience, target_audience),
        branch_id = p_branch_id,
        is_active = COALESCE(p_is_active, is_active),
        is_pinned = COALESCE(p_is_pinned, is_pinned),
        start_date = p_start_date,
        end_date = p_end_date,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_id;
    
    -- 수정된 공지사항 조회
    SELECT 
        a.id,
        a.title,
        a.content,
        a.attachments,
        a.type,
        a.priority,
        a.target_audience,
        a.branch_id,
        b.name as branch_name,
        a.author_id,
        u.name as author_name,
        a.is_active,
        a.is_pinned,
        a.start_date,
        a.end_date,
        a.view_count,
        a.created_at,
        a.updated_at
    FROM announcements a
    LEFT JOIN branches b ON a.branch_id = b.id
    LEFT JOIN users u ON a.author_id = u.id
    WHERE a.id = p_id;
    
    COMMIT;
END //

-- 공지사항 삭제
DELIMITER //
CREATE PROCEDURE sp_DeleteAnnouncement(
    IN p_id BIGINT
)
BEGIN
    START TRANSACTION;
    
    -- 공지사항 존재 확인
    IF NOT EXISTS (SELECT 1 FROM announcements WHERE id = p_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '공지사항을 찾을 수 없습니다';
    END IF;
    
    DELETE FROM announcements WHERE id = p_id;
    
    COMMIT;
END //

-- 공지사항 상태 변경
DELIMITER //
CREATE PROCEDURE sp_UpdateAnnouncementStatus(
    IN p_id BIGINT,
    IN p_status VARCHAR(20)
)
BEGIN
    DECLARE v_is_active BOOLEAN;
    
    START TRANSACTION;
    
    -- 공지사항 존재 확인
    IF NOT EXISTS (SELECT 1 FROM announcements WHERE id = p_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '공지사항을 찾을 수 없습니다';
    END IF;
    
    SET v_is_active = (p_status = 'active');
    
    UPDATE announcements 
    SET is_active = v_is_active, updated_at = CURRENT_TIMESTAMP
    WHERE id = p_id;
    
    -- 수정된 공지사항 조회
    SELECT 
        a.id,
        a.title,
        a.content,
        a.type,
        a.priority,
        a.target_audience,
        a.branch_id,
        b.name as branch_name,
        a.author_id,
        u.name as author_name,
        a.is_active,
        a.is_pinned,
        a.start_date,
        a.end_date,
        a.view_count,
        a.created_at,
        a.updated_at
    FROM announcements a
    LEFT JOIN branches b ON a.branch_id = b.id
    LEFT JOIN users u ON a.author_id = u.id
    WHERE a.id = p_id;
    
    COMMIT;
END //

-- 사용자별 메뉴 생성 프로시저 (회원가입 시 사용)
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_CreateUserMenuItems(
    IN p_userid VARCHAR(50)
)
BEGIN
    DECLARE v_user_id CHAR(36);
    DECLARE v_affected_rows INT DEFAULT 0;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- userid로 실제 user.id 조회
    SELECT id INTO v_user_id 
    FROM users 
    WHERE userid = p_userid AND used = TRUE;
    
    -- 사용자가 존재하지 않으면 에러
    IF v_user_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '사용자를 찾을 수 없습니다';
    END IF;
    
    -- target_audience가 'user' 또는 'all'인 활성 메뉴들을 user_menu_items에 삽입
    INSERT INTO user_menu_items (user_id, menu_id, is_enabled, created_at)
    SELECT p_userid, m.id, TRUE, NOW()
    FROM menus m
    WHERE m.is_active = TRUE 
      AND m.is_visible = TRUE
      AND (m.target_audience = 'user' OR m.target_audience = 'all')
    ON DUPLICATE KEY UPDATE 
      is_enabled = TRUE,
      updated_at = NOW();
    
    SET v_affected_rows = ROW_COUNT();
    
    -- 결과 반환
    SELECT 
        p_userid as user_id,
        p_userid as userid,
        v_affected_rows as affected_rows,
        'User menu items created successfully' as message;
    
    COMMIT;
END //

-- 사용자별 메뉴 권한 조회 프로시저
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_GetUserMenuItems(
    IN p_userid VARCHAR(50)
)
BEGIN
    SELECT 
        umi.id,
        umi.user_id,
        umi.menu_id,
        m.name as menu_name,
        m.url as menu_path,
        umi.is_enabled,
        m.menu_type
    FROM user_menu_items umi
    INNER JOIN menus m ON umi.menu_id = m.id
    INNER JOIN users u ON umi.user_id = u.userid
    WHERE u.userid = p_userid
      AND m.menu_type = 'page'
      AND m.is_active = 1
      AND m.is_visible = 1
    ORDER BY m.sort_order, m.name;
END //

-- 사용자 메뉴 권한 업데이트 프로시저
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_UpdateUserMenuItems(
    IN p_userid VARCHAR(50),
    IN p_menu_id INT,
    IN p_is_enabled BOOLEAN
)
BEGIN
    DECLARE v_user_id CHAR(36);
    DECLARE v_affected_rows INT DEFAULT 0;
    
    -- userid로 실제 user.id 조회
    SELECT id INTO v_user_id 
    FROM users 
    WHERE userid = p_userid AND used = TRUE;
    
    -- 사용자가 존재하지 않으면 에러
    IF v_user_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '사용자를 찾을 수 없습니다';
    END IF;
    
    -- user_menu_items 테이블에서 해당 사용자의 메뉴 권한 업데이트
    UPDATE user_menu_items 
    SET is_enabled = p_is_enabled, updated_at = NOW()
    WHERE user_id = p_userid AND menu_id = p_menu_id;
    
    SET v_affected_rows = ROW_COUNT();
    
    -- 업데이트된 행이 없으면 새로 삽입
    IF v_affected_rows = 0 THEN
        INSERT INTO user_menu_items (user_id, menu_id, is_enabled, created_at)
        VALUES (p_userid, p_menu_id, p_is_enabled, NOW());
    END IF;
    
    -- 결과 반환
    SELECT 
        p_userid as user_id,
        p_menu_id as menu_id,
        p_is_enabled as is_enabled,
        'success' as status;
END //

-- 선택된 메뉴를 모든 사용자에게 활성화하는 프로시저
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_EnableMenuForAllUsers(
    IN p_menu_id INT
)
BEGIN
    DECLARE v_affected_rows INT DEFAULT 0;
    DECLARE v_menu_exists INT DEFAULT 0;
    
    -- 메뉴 존재 확인 (page 타입만 허용)
    SELECT COUNT(*) INTO v_menu_exists
    FROM menus
    WHERE id = p_menu_id AND menu_type = 'page';
    
    IF v_menu_exists = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '메뉴를 찾을 수 없습니다';
    END IF;
    
    -- 메뉴 자체도 활성화/노출 처리 (user_menu_items만 켜도 menus가 비활성이면 목록에 안 뜸)
    UPDATE menus
    SET is_active = TRUE,
        is_visible = TRUE,
        updated_at = NOW()
    WHERE id = p_menu_id;
    
    -- 모든 사용자에 대해 메뉴를 "추가 + 활성화" (없으면 INSERT, 있으면 UPDATE)
    INSERT INTO user_menu_items (user_id, menu_id, is_enabled, created_at)
    SELECT u.userid, p_menu_id, TRUE, NOW()
    FROM users u
    WHERE u.used = TRUE
    ON DUPLICATE KEY UPDATE
        is_enabled = TRUE,
        updated_at = NOW();
    
    SET v_affected_rows = ROW_COUNT();
    
    -- 결과 반환
    SELECT 
        p_menu_id as menu_id,
        v_affected_rows as affected_users,
        'success' as status,
        '선택된 메뉴가 모든 사용자에게 추가 및 활성화되었습니다.' as message;
END //

-- ============================================================================
-- 운동 관리 프로시저
-- ============================================================================

-- 운동 구분 대분류 목록 조회
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_GetWorkoutMajorCategories()
BEGIN
    SELECT DISTINCT
        major_category,
        major_category_name,
        gubun,
        COUNT(*) as exercise_count
    FROM workout_categories wc
    LEFT JOIN exercises e ON wc.id = e.workout_category_id
    WHERE wc.is_active = TRUE
    GROUP BY major_category, major_category_name, gubun
    ORDER BY wc.sort_order ASC, major_category ASC;
END //

-- 운동 검색 및 목록 조회 프로시저 (통합)
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_GetExercises(
    IN p_major_category VARCHAR(100),
    IN p_search_type VARCHAR(50),
    IN p_search_keyword VARCHAR(255),
    IN p_page INT,
    IN p_limit INT,
    IN p_include_inactive BOOLEAN
)
BEGIN
    DECLARE v_offset INT DEFAULT 0;
    DECLARE v_page INT DEFAULT 1;
    DECLARE v_limit INT DEFAULT 20;
    
    -- 기본값 설정
    SET v_page = COALESCE(p_page, 1);
    SET v_limit = COALESCE(p_limit, 20);
    SET v_offset = (v_page - 1) * v_limit;
    
    -- 총 개수 조회
    SELECT COUNT(*) as total
    FROM exercises e
    INNER JOIN workout_categories wc ON e.workout_category_id = wc.id
    WHERE (p_major_category IS NULL OR p_major_category = '' OR wc.major_category = p_major_category)
      AND (p_search_keyword IS NULL OR p_search_keyword = '' OR 
           CASE 
               WHEN p_search_type = 'name_en' THEN e.name_en LIKE CONCAT('%', p_search_keyword, '%')
               WHEN p_search_type = 'name_ko' THEN e.name_ko LIKE CONCAT('%', p_search_keyword, '%')
               WHEN p_search_type = 'target_muscles' THEN e.target_muscles LIKE CONCAT('%', p_search_keyword, '%')
               WHEN p_search_type = 'characteristics' THEN e.characteristics LIKE CONCAT('%', p_search_keyword, '%')
               WHEN p_search_type = 'equipment' THEN e.equipment LIKE CONCAT('%', p_search_keyword, '%')
               WHEN p_search_type = 'purpose' THEN e.purpose LIKE CONCAT('%', p_search_keyword, '%')
               ELSE (e.name_en LIKE CONCAT('%', p_search_keyword, '%') OR 
                     e.name_ko LIKE CONCAT('%', p_search_keyword, '%') OR
                     e.target_muscles LIKE CONCAT('%', p_search_keyword, '%') OR
                     e.characteristics LIKE CONCAT('%', p_search_keyword, '%') OR
                     e.equipment LIKE CONCAT('%', p_search_keyword, '%') OR
                     e.purpose LIKE CONCAT('%', p_search_keyword, '%'))
           END
      )
      AND (p_include_inactive = TRUE OR e.is_active = TRUE);
    
    -- 데이터 조회
    SELECT 
        e.id,
        e.number,
        e.workout_category_id,
        e.level,
        e.name_en,
        e.name_ko,
        e.target_muscles,
        e.characteristics,
        e.equipment,
        e.purpose,
        e.video_url,
        e.thumbnail_url,
        e.video_title,
        e.video_duration,
        e.video_start_time,
        e.video_end_time,
        e.video_loop_count,
        e.is_active,
        e.created_at,
        e.updated_at,
        wc.major_category,
        wc.minor_category,
        wc.major_category_name
    FROM exercises e
    INNER JOIN workout_categories wc ON e.workout_category_id = wc.id
    WHERE (p_major_category IS NULL OR p_major_category = '' OR wc.major_category = p_major_category)
      AND (p_search_keyword IS NULL OR p_search_keyword = '' OR 
           CASE 
               WHEN p_search_type = 'name_en' THEN e.name_en LIKE CONCAT('%', p_search_keyword, '%')
               WHEN p_search_type = 'name_ko' THEN e.name_ko LIKE CONCAT('%', p_search_keyword, '%')
               WHEN p_search_type = 'target_muscles' THEN e.target_muscles LIKE CONCAT('%', p_search_keyword, '%')
               WHEN p_search_type = 'characteristics' THEN e.characteristics LIKE CONCAT('%', p_search_keyword, '%')
               WHEN p_search_type = 'equipment' THEN e.equipment LIKE CONCAT('%', p_search_keyword, '%')
               WHEN p_search_type = 'purpose' THEN e.purpose LIKE CONCAT('%', p_search_keyword, '%')
               ELSE (e.name_en LIKE CONCAT('%', p_search_keyword, '%') OR 
                     e.name_ko LIKE CONCAT('%', p_search_keyword, '%') OR
                     e.target_muscles LIKE CONCAT('%', p_search_keyword, '%') OR
                     e.characteristics LIKE CONCAT('%', p_search_keyword, '%') OR
                     e.equipment LIKE CONCAT('%', p_search_keyword, '%') OR
                     e.purpose LIKE CONCAT('%', p_search_keyword, '%'))
           END
      )
      AND (p_include_inactive = TRUE OR e.is_active = TRUE)
    ORDER BY e.number ASC, e.name_ko ASC
    LIMIT v_limit OFFSET v_offset;
END //

-- 운동정보 수정 프로시저
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_update_exercise(
    IN p_exercise_id CHAR(36),
    IN p_number INT,
    IN p_workout_category_id CHAR(36),
    IN p_level ENUM('beginner', 'intermediate', 'advanced'),
    IN p_name_en VARCHAR(255),
    IN p_name_ko VARCHAR(255),
    IN p_target_muscles TEXT,
    IN p_characteristics TEXT,
    IN p_equipment VARCHAR(255),
    IN p_purpose VARCHAR(255),
    IN p_video_url VARCHAR(500),
    IN p_thumbnail_url VARCHAR(500),
    IN p_video_title VARCHAR(255),
    IN p_video_duration INT,
    IN p_video_start_time INT,
    IN p_video_end_time INT,
    IN p_video_loop_count INT,
    IN p_is_active BOOLEAN
)
BEGIN
    DECLARE v_affected_rows INT DEFAULT 0;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- 운동정보 존재 확인
    SELECT COUNT(*) INTO v_affected_rows
    FROM exercises 
    WHERE id = p_exercise_id;
    
    IF v_affected_rows = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '운동정보를 찾을 수 없습니다';
    END IF;
    
    -- 운동정보 업데이트 (NULL이 아닌 값만 업데이트)
    UPDATE exercises 
    SET 
        number = COALESCE(p_number, number),
        workout_category_id = COALESCE(p_workout_category_id, workout_category_id),
        level = COALESCE(p_level, level),
        name_en = COALESCE(p_name_en, name_en),
        name_ko = COALESCE(p_name_ko, name_ko),
        target_muscles = COALESCE(p_target_muscles, target_muscles),
        characteristics = COALESCE(p_characteristics, characteristics),
        equipment = COALESCE(p_equipment, equipment),
        purpose = COALESCE(p_purpose, purpose),
        video_url = COALESCE(p_video_url, video_url),
        thumbnail_url = COALESCE(p_thumbnail_url, thumbnail_url),
        video_title = COALESCE(p_video_title, video_title),
        video_duration = COALESCE(p_video_duration, video_duration),
        video_start_time = COALESCE(p_video_start_time, video_start_time),
        video_end_time = COALESCE(p_video_end_time, video_end_time),
        video_loop_count = COALESCE(p_video_loop_count, video_loop_count),
        is_active = COALESCE(p_is_active, is_active),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_exercise_id;
    
    SET v_affected_rows = ROW_COUNT();
    
    IF v_affected_rows = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '운동정보 업데이트에 실패했습니다';
    END IF;
    
    -- 결과 반환
    SELECT 'success' as status, '운동정보가 성공적으로 수정되었습니다' as message;
    
    COMMIT;
END //

-- 운동정보 생성 프로시저
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_create_exercise(
    IN p_number INT,
    IN p_workout_category_id CHAR(36),
    IN p_level ENUM('beginner', 'intermediate', 'advanced'),
    IN p_name_en VARCHAR(255),
    IN p_name_ko VARCHAR(255),
    IN p_target_muscles TEXT,
    IN p_characteristics TEXT,
    IN p_equipment VARCHAR(255),
    IN p_purpose VARCHAR(255),
    IN p_video_url VARCHAR(500),
    IN p_thumbnail_url VARCHAR(500),
    IN p_video_title VARCHAR(255),
    IN p_video_duration INT,
    IN p_video_start_time INT,
    IN p_video_end_time INT,
    IN p_video_loop_count INT,
    IN p_is_active BOOLEAN
)
BEGIN
    DECLARE v_exercise_id CHAR(36);
    DECLARE v_duplicate_count INT DEFAULT 0;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    SET v_exercise_id = UUID();
    
    -- 운동 번호 중복 확인
    SELECT COUNT(*) INTO v_duplicate_count
    FROM exercises 
    WHERE number = p_number;
    
    IF v_duplicate_count > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '이미 사용 중인 운동 번호입니다';
    END IF;
    
    -- 운동구분 존재 확인
    SELECT COUNT(*) INTO v_duplicate_count
    FROM workout_categories 
    WHERE id = p_workout_category_id AND is_active = TRUE;
    
    IF v_duplicate_count = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '존재하지 않는 운동구분입니다';
    END IF;
    
    -- 운동정보 생성
    INSERT INTO exercises (
        id, number, workout_category_id, level, name_en, name_ko,
        target_muscles, characteristics, equipment, purpose,
        video_url, thumbnail_url, video_title, video_duration,
        video_start_time, video_end_time, video_loop_count, is_active
    ) VALUES (
        v_exercise_id, p_number, p_workout_category_id, p_level, p_name_en, p_name_ko,
        p_target_muscles, p_characteristics, p_equipment, p_purpose,
        p_video_url, p_thumbnail_url, p_video_title, p_video_duration,
        p_video_start_time, p_video_end_time, p_video_loop_count,
        COALESCE(p_is_active, TRUE)
    );
    
    -- 결과 반환
    SELECT 
        v_exercise_id as exercise_id, 
        'success' as status,
        '운동정보가 성공적으로 생성되었습니다' as message;
    
    COMMIT;
END //

-- 운동정보 목록 조회 (카테고리 포함) 프로시저
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_get_exercises_with_category(
    IN p_workout_category_id CHAR(36),
    IN p_major_category VARCHAR(100),
    IN p_minor_category VARCHAR(100),
    IN p_level ENUM('beginner', 'intermediate', 'advanced'),
    IN p_is_active BOOLEAN,
    IN p_search VARCHAR(255),
    IN p_limit INT,
    IN p_offset INT
)
BEGIN
    DECLARE v_limit INT DEFAULT 20;
    DECLARE v_offset INT DEFAULT 0;
    
    -- 매개변수 기본값 설정
    SET v_limit = IFNULL(p_limit, 20);
    SET v_offset = IFNULL(p_offset, 0);
    
    SELECT 
        e.id,
        e.number,
        e.workout_category_id,
        e.level,
        e.name_en,
        e.name_ko,
        e.target_muscles,
        e.characteristics,
        e.equipment,
        e.purpose,
        e.video_url,
        e.thumbnail_url,
        e.video_title,
        e.video_duration,
        e.video_start_time,
        e.video_end_time,
        e.video_loop_count,
        e.is_active,
        e.created_at,
        e.updated_at,
        wc.major_category,
        wc.minor_category
    FROM exercises e
    INNER JOIN workout_categories wc ON e.workout_category_id = wc.id
    WHERE 
        (p_workout_category_id IS NULL OR e.workout_category_id = p_workout_category_id)
        AND (p_major_category IS NULL OR wc.major_category = p_major_category)
        AND (p_minor_category IS NULL OR wc.minor_category = p_minor_category)
        AND (p_level IS NULL OR e.level = p_level)
        AND (p_is_active IS NULL OR e.is_active = p_is_active)
        AND (p_search IS NULL OR 
             e.name_en LIKE CONCAT('%', p_search, '%') OR 
             e.name_ko LIKE CONCAT('%', p_search, '%') OR
             e.target_muscles LIKE CONCAT('%', p_search, '%'))
    ORDER BY e.number ASC, e.name_ko ASC
    LIMIT v_limit OFFSET v_offset;
END //

-- =====================================================
-- 사용자 대시보드 관련 프로시저들
-- =====================================================

-- 인기 운동 조회 프로시저
-- Main 운동만 조회 (MAIN, AMRAP, EMOM)
DELIMITER //
CREATE PROCEDURE sp_GetPopularWorkouts(
    IN p_view VARCHAR(20),
    IN p_branch_id CHAR(36),
    IN p_date DATE
)
BEGIN
    DECLARE query_sql TEXT DEFAULT '';
    
    SET query_sql = '
        SELECT 
            e.id,
            e.name_ko as name,
            e.category_id,
            wc.name as category,
            e.description,
            COALESCE(COUNT(whd.exercises_id), 0) as count,
            e.thumbnail_url,
            e.video_url
        FROM exercises e
        LEFT JOIN workout_categories wc ON e.category_id = wc.id
        LEFT JOIN workout_history_detail whd ON e.id = whd.exercises_id
        LEFT JOIN workout_history_master whm ON whd.workout_history_master_id = whm.id';
    
    -- 지점별 필터를 위한 users 테이블 조인
    IF p_view = 'branch' AND p_branch_id IS NOT NULL THEN
        SET query_sql = CONCAT(query_sql, '
        LEFT JOIN users u ON whm.user_id = u.id');
    END IF;
    
    SET query_sql = CONCAT(query_sql, '
        WHERE e.is_active = 1
        AND wc.gubun = ''MAIN''');
    
    -- 지점별 필터
    IF p_view = 'branch' AND p_branch_id IS NOT NULL THEN
        SET query_sql = CONCAT(query_sql, '
        AND u.branch_id = ''', p_branch_id, '''');
    END IF;
    
    -- 날짜별 필터
    IF p_view = 'date' AND p_date IS NOT NULL THEN
        SET query_sql = CONCAT(query_sql, '
        AND DATE(whm.date) = ''', p_date, '''');
    END IF;
    
    SET query_sql = CONCAT(query_sql, '
        GROUP BY e.id, e.name_ko, e.category_id, wc.name, e.description, e.thumbnail_url, e.video_url
        ORDER BY count DESC
        LIMIT 20');
    
    SET @sql = query_sql;
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END //

-- 최근 운동 기록 조회 프로시저
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_GetRecentWorkouts(
    IN p_user_id CHAR(36)
)
BEGIN
    SELECT 
        DATE_FORMAT(whm.date, '%Y-%m-%d') as workout_date,
        whm.time as workout_time,
        wc.major_category_name as class_name,
        GROUP_CONCAT(DISTINCT e.name_ko ORDER BY e.name_ko SEPARATOR ', ') as exercise_names,
        COUNT(DISTINCT e.id) as exercise_count,
        COALESCE(SUM(whd.duration), 0) as total_duration_seconds,
        CONCAT(
            LPAD(FLOOR(COALESCE(SUM(whd.duration), 0) / 60), 2, '0'),
            ':',
            LPAD(COALESCE(SUM(whd.duration), 0) % 60, 2, '0')
        ) as total_duration
    FROM workout_history_master whm
    LEFT JOIN workout_history_detail whd ON whm.id = whd.workout_history_master_id
    LEFT JOIN exercises e ON whd.exercises_id = e.id
    LEFT JOIN workout_categories wc ON whm.workout_categories_id = wc.major_category
    WHERE whm.user_id = p_user_id
    AND whm.date >= DATE_SUB(CURDATE(), INTERVAL 5 DAY)
    AND e.number not in (999997, 999998, 999999)
    GROUP BY whm.date, whm.time, whm.id, wc.major_category_name
    ORDER BY whm.date DESC, whm.time DESC;
END //

-- 운동 통계 조회 프로시저
-- 총 운동시간은 workout_history_master의 total_seconds 값을 사용
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_GetWorkoutStats(
    IN p_user_id CHAR(36)
)
BEGIN
    SELECT 
        COUNT(DISTINCT whd.exercises_id) as total_exercises,
        COUNT(DISTINCT whm.date) as workout_days,
        ROUND(SUM(COALESCE(whm.total_seconds, 0)) / 60, 2) as total_minutes,
        COUNT(DISTINCT e.id) as exercise_types_used
    FROM workout_history_master whm
    LEFT JOIN workout_history_detail whd ON whm.id = whd.workout_history_master_id
    LEFT JOIN exercises e ON whd.exercises_id = e.id
    WHERE whm.user_id = p_user_id
        AND whm.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY);
END //

-- 운동 저장 프로시저 (모든 운동 카테고리 지원)
-- 이 프로시저는 sp_save_power_circuit_new.sql 파일에 정의되어 있습니다.
-- 해당 파일을 별도로 실행하여 프로시저를 생성하세요.

-- ============================================================================
-- 운동 기록 조회 관련 프로시저
-- ============================================================================

-- 운동 기록 마스터 조회 (운동시간 계산 포함)
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_GetWorkoutHistoryMaster(
    IN p_user_id CHAR(36),
    IN p_year_month VARCHAR(7),
    IN p_memo VARCHAR(255),
    IN p_workout_category VARCHAR(100),
    IN p_circuit_type VARCHAR(20),
    IN p_admin VARCHAR(1)
)
BEGIN
    SELECT 
        whm.id,
        whm.date,
        whm.time,
        whm.memo,
        whm.admin as is_admin,
        COALESCE(MAX(wc.id), whm.workout_categories_id) as workout_categories_id,
        COALESCE(MAX(wc.major_category), whm.workout_categories_id) as major_category,
        COALESCE(MAX(wc.major_category_name), whm.workout_categories_id) as major_category_name,
        COALESCE(MAX(whp.circuit_type), whm.method_type) as circuit_type,
        CONCAT(
            LPAD(FLOOR(COALESCE(MAX(whm.total_seconds), 
                CASE 
                    WHEN whm.workout_categories_id IN ('Dynamic_stretching', 'Static_stretching') 
                    THEN MAX(whd.duration)
                    ELSE SUM(whd.duration)
                END, 0) / 60), 2, '0'),
            '분',
            LPAD(COALESCE(MAX(whm.total_seconds),
                CASE 
                    WHEN whm.workout_categories_id IN ('Dynamic_stretching', 'Static_stretching') 
                    THEN MAX(whd.duration)
                    ELSE SUM(whd.duration)
                END, 0) % 60, 2, '0'),
            '초'
        ) as workout_time,
        COALESCE(MAX(whm.total_seconds),
            CASE 
                WHEN whm.workout_categories_id IN ('Dynamic_stretching', 'Static_stretching') 
                THEN MAX(whd.duration)
                ELSE SUM(whd.duration)
            END, 0) as total_workout_time,
        COALESCE(whm.ds_seconds, 0) as ds_seconds,
        COALESCE(whm.main_seconds, 0) as main_seconds,
        COALESCE(whm.cd_seconds, 0) as cd_seconds,
        COALESCE(whm.total_seconds, 0) as total_seconds
    FROM workout_history_master whm
    LEFT JOIN workout_history_detail whd ON whm.id = whd.workout_history_master_id
    LEFT JOIN workout_history_plan whp ON whm.id = whp.workout_history_master_id
    LEFT JOIN workout_categories wc ON (whm.workout_categories_id = wc.id OR whm.workout_categories_id = wc.major_category OR whm.workout_categories_id = wc.minor_category)
    WHERE ((p_admin = '1' AND whm.admin = TRUE)
       OR ((p_admin = '0' OR p_admin IS NULL OR p_admin = '') AND whm.user_id = p_user_id AND (whm.admin = FALSE OR whm.admin IS NULL)))
      AND (p_year_month IS NULL OR p_year_month = '' OR DATE_FORMAT(whm.date, '%Y-%m') = p_year_month)
      AND (p_memo IS NULL OR p_memo = '' OR whm.memo LIKE CONCAT('%', p_memo, '%'))
      AND (p_workout_category IS NULL OR p_workout_category = '' 
           OR whm.workout_categories_id = p_workout_category
           OR wc.id = p_workout_category
           OR wc.major_category = p_workout_category
           OR wc.minor_category = p_workout_category)
      AND (p_circuit_type IS NULL OR p_circuit_type = '' 
           OR COALESCE(whp.circuit_type, whm.method_type) = p_circuit_type)
    GROUP BY whm.id, whm.date, whm.time, whm.memo, whm.workout_categories_id, whm.method_type
    ORDER BY whm.date DESC, whm.time DESC;
END //

-- 운동 기록 상세 조회
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_GetWorkoutHistoryDetail(
    IN p_master_id CHAR(36)
)
BEGIN
    -- 마스터 정보 조회
    SELECT 
        whm.id,
        whm.user_id,
        whm.date,
        whm.time,
        whm.workout_categories_id,
        whm.method_type,
        whm.method_name,
        whm.memo,
        whm.created_at,
        whm.updated_at
    FROM workout_history_master whm
    WHERE whm.id = p_master_id;
    
    -- 상세 정보 조회 (reps 필드 포함)
    SELECT 
        whd.workout_history_master_id,
        whd.seq,
        whd.exercises_id,
        whd.method_round,
        whd.duration,
        COALESCE(whd.reps, 0) as reps, -- reps 필드 추가 (NULL이면 0)
        whd.position,
        whd.exercise_type,
        e.name_ko as exercise_name,
        e.name_en, -- 운동명(영문) 추가
        e.target_muscles,
        e.equipment,
        e.characteristics,
        e.purpose,
        e.level,
        COALESCE(v.video_id, e.video_url) as video_url,
        COALESCE(v.thumbnail_url, e.thumbnail_url) as thumbnail_url,
        COALESCE(v.title, e.name_en) as video_title, -- 운동명(영문)
        COALESCE(v.duration, e.video_duration) as video_duration,
        e.video_start_time,
        e.video_end_time,
        e.video_loop_count,
        v.description, -- 운동목적
        wc.major_category,
        wc.major_category_name
    FROM workout_history_detail whd
    LEFT JOIN exercises e ON whd.exercises_id = e.id
    LEFT JOIN workout_categories wc ON e.workout_category_id = wc.id
    LEFT JOIN vimeo_videos v ON (
        v.is_active = TRUE
        AND (
          e.video_url = v.video_id
          OR (
            e.video_url IS NULL
            AND e.name_en IS NOT NULL
            AND e.workout_category_id = v.workout_category_id
            AND e.name_en = v.title
          )
        )
    )
    WHERE whd.workout_history_master_id = p_master_id
    ORDER BY whd.seq;
    
     -- 계획 정보 조회
    SELECT 
        whp.workout_history_master_id,
        whp.circuit_type,
        whp.round,
        whp.time,
        whp.rest,
        whp.hydration,
        whp.created_at,
        whp.updated_at
    FROM workout_history_plan whp
    WHERE whp.workout_history_master_id = p_master_id
    ORDER BY whp.round;
END //

-- 사용자별 많이 하는 운동 통계 조회 (상위 10개)
-- Main 운동만 조회 (MAIN, AMRAP, EMOM)
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_GetUserTopExercises(
    IN p_user_id CHAR(36)
)
BEGIN
    SELECT 
        e.id as exercise_id,
        e.name_ko as exercise_name,
        e.name_en as exercise_name_en,
        e.target_muscles,
        e.equipment,
        e.level,
        e.characteristics,
        e.purpose,
        e.video_url,
        e.thumbnail_url,
        e.video_title,
        e.video_duration,
        e.is_active,
        COUNT(whd.exercises_id) as exercise_count,
        SUM(whd.duration) as total_duration,
        AVG(whd.duration) as avg_duration,
        MIN(whm.date) as first_workout_date,
        MAX(whm.date) as last_workout_date,
        wc.major_category_name as category_name,
        wc.id as category_id,
        ROUND(AVG(whd.duration), 1) as avg_duration_rounded,
        CASE 
            WHEN COUNT(whd.exercises_id) >= 10 THEN '자주함'
            WHEN COUNT(whd.exercises_id) >= 5 THEN '보통'
            ELSE '가끔'
        END as frequency_level,
        CASE 
            WHEN e.level = 'beginner' THEN '초급'
            WHEN e.level = 'intermediate' THEN '중급'
            WHEN e.level = 'advanced' THEN '고급'
            ELSE e.level
        END as level_ko
    FROM workout_history_detail whd
    INNER JOIN workout_history_master whm ON whd.workout_history_master_id = whm.id
    INNER JOIN exercises e ON whd.exercises_id = e.id and e.number <> 999997
    LEFT JOIN workout_categories wc ON e.workout_category_id = wc.id
    WHERE whm.user_id = p_user_id
        AND wc.gubun = 'MAIN' 
    GROUP BY e.id, e.name_ko, e.name_en, e.target_muscles, e.equipment, e.level, 
             e.characteristics, e.purpose, e.video_url, e.thumbnail_url, e.video_title,
             e.video_duration, e.is_active, wc.major_category_name, wc.id
    ORDER BY exercise_count DESC, total_duration DESC
    LIMIT 10;
END //

-- 운동구분 상세 조회
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_get_workout_category_by_id(
    IN p_category_id CHAR(36)
)
BEGIN
    SELECT 
        wc.id,
        wc.major_category,
        wc.minor_category,
        wc.menu_id,
        wc.major_category_name,
        wc.major_category_name as description, -- description 대신 major_category_name 사용
        wc.is_active,
        wc.sort_order,
        wc.created_at,
        wc.updated_at
    FROM workout_categories wc
    WHERE wc.id = p_category_id;
END //

-- 사용자 운동 기록 확인용 프로시저 (디버깅용)
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_CheckUserWorkoutData(
    IN p_user_id CHAR(36)
)
BEGIN
    -- 1. 마스터 기록 확인
    SELECT 'Master Records' as type, COUNT(*) as count 
    FROM workout_history_master whm 
    WHERE whm.user_id = p_user_id;
    
    -- 2. 상세 기록 확인
    SELECT 'Detail Records' as type, COUNT(*) as count 
    FROM workout_history_detail whd
    INNER JOIN workout_history_master whm ON whd.workout_history_master_id = whm.id
    WHERE whm.user_id = p_user_id;
    
    -- 3. 운동별 통계
    SELECT 
        e.name_ko as exercise_name,
        COUNT(*) as count,
        SUM(whd.duration) as total_duration
    FROM workout_history_detail whd
    INNER JOIN workout_history_master whm ON whd.workout_history_master_id = whm.id
    INNER JOIN exercises e ON whd.exercises_id = e.id
    WHERE whm.user_id = p_user_id
    GROUP BY e.id, e.name_ko
    ORDER BY count DESC
    LIMIT 5;
END //

-- 마스터 ID로 마스터 정보 조회 프로시저
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_GetWorkoutHistoryMasterById(
    IN p_master_id CHAR(36),
    IN p_user_id CHAR(36)
)
BEGIN
    SELECT 
        whm.id,
        whm.user_id,
        whm.date,
        whm.time,
        whm.workout_categories_id as original_category_id,
        COALESCE(wc.id, whm.workout_categories_id) as workout_categories_id,
        whm.method_type,
        whm.method_name,
        whm.memo,
        whm.dynamic_master_id,
        whm.static_master_id,
        whm.created_at,
        whm.updated_at,
        wc.major_category_name,
        CONCAT(
            LPAD(FLOOR(COALESCE(SUM(whd.duration), 0) / 60), 2, '0'),
            ':',
            LPAD(COALESCE(SUM(whd.duration), 0) % 60, 2, '0')
        ) as workout_time,
        COALESCE(SUM(whd.duration), 0) as total_workout_time
    FROM workout_history_master whm
    LEFT JOIN workout_history_detail whd ON whm.id = whd.workout_history_master_id
    LEFT JOIN workout_categories wc ON (whm.workout_categories_id = wc.id OR whm.workout_categories_id = wc.major_category)
    WHERE whm.id = p_master_id
      AND whm.user_id = p_user_id
    GROUP BY whm.id, whm.user_id, whm.date, whm.time, whm.workout_categories_id, 
             whm.method_type, whm.method_name, whm.memo, whm.dynamic_master_id, 
             whm.static_master_id, whm.created_at, whm.updated_at, wc.major_category_name;
END //

-- ============================================================================
-- 블루투스 기기 관리 프로시저
-- ============================================================================

-- 블루투스 기기 등록
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_RegisterBluetoothDevice(
    IN p_branch_id BIGINT,
    IN p_device_id VARCHAR(255),
    IN p_device_name VARCHAR(255),
    IN p_device_type VARCHAR(50),
    IN p_manufacturer VARCHAR(100),
    IN p_model VARCHAR(100),
    IN p_notes TEXT
)
BEGIN
    DECLARE v_device_uuid CHAR(36);
    DECLARE v_existing_count INT DEFAULT 0;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- 중복 확인
    SELECT COUNT(*) INTO v_existing_count
    FROM branch_bluetooth_devices
    WHERE branch_id = p_branch_id AND device_id = p_device_id;
    
    IF v_existing_count > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '이미 등록된 기기입니다';
    END IF;
    
    SET v_device_uuid = UUID();
    
    INSERT INTO branch_bluetooth_devices (
        id, branch_id, device_id, device_name, device_type,
        manufacturer, model, notes, is_active, created_at
    ) VALUES (
        v_device_uuid, p_branch_id, p_device_id, p_device_name, 
        COALESCE(p_device_type, 'heart_rate'),
        p_manufacturer, p_model, p_notes, TRUE, NOW()
    );
    
    SELECT 
        id, branch_id, device_id, device_name, device_type,
        manufacturer, model, is_active, notes, created_at
    FROM branch_bluetooth_devices
    WHERE id = v_device_uuid;
    
    COMMIT;
END //

-- 블루투스 기기 목록 조회
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_GetBluetoothDevices(
    IN p_branch_id BIGINT,
    IN p_is_active BOOLEAN
)
BEGIN
    SELECT 
        bbd.id,
        bbd.branch_id,
        b.name as branch_name,
        bbd.device_id,
        bbd.device_name,
        bbd.device_type,
        bbd.manufacturer,
        bbd.model,
        bbd.is_active,
        bbd.last_connected_at,
        bbd.last_connected_user_id,
        u.name as last_connected_user_name,
        bbd.notes,
        bbd.created_at,
        bbd.updated_at
    FROM branch_bluetooth_devices bbd
    LEFT JOIN branches b ON bbd.branch_id = b.id
    LEFT JOIN users u ON bbd.last_connected_user_id = u.id
    WHERE (p_branch_id IS NULL OR bbd.branch_id = p_branch_id)
      AND (p_is_active IS NULL OR bbd.is_active = p_is_active)
    ORDER BY bbd.created_at DESC;
END //

-- 블루투스 기기 삭제
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_DeleteBluetoothDevices(
    IN p_device_ids TEXT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    DELETE FROM branch_bluetooth_devices
    WHERE FIND_IN_SET(id, p_device_ids) > 0;
    
    SELECT ROW_COUNT() as deleted_count, 'success' as status;
    
    COMMIT;
END //

-- 블루투스 기기 연결 상태 업데이트
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_UpdateBluetoothDeviceConnection(
    IN p_device_id VARCHAR(255),
    IN p_user_id CHAR(36)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    UPDATE branch_bluetooth_devices
    SET last_connected_at = NOW(),
        last_connected_user_id = p_user_id,
        updated_at = NOW()
    WHERE device_id = p_device_id;
    
    SELECT ROW_COUNT() as affected_rows, 'success' as status;
    
    COMMIT;
END //

-- 많이 하는 운동 리스트 조회 프로시저
-- workout_history_detail 기준 (실제 운동 기록이 있는 운동만)
-- 지점별, 날짜별, 자극부위별 필터링 지원
-- Main 운동만 조회 (MAIN, AMRAP, EMOM)
CREATE OR REPLACE PROCEDURE sp_GetFrequentWorkouts(
    IN p_branch_id CHAR(36),
    IN p_start_date DATE,
    IN p_end_date DATE,
    IN p_target_muscle VARCHAR(100),
    IN p_limit INT
)
BEGIN
    DECLARE v_limit INT DEFAULT 10;
    
    IF p_limit IS NOT NULL THEN
        SET v_limit = p_limit;
    END IF;

    SELECT 
        e.id,
        e.name_ko as name,
        e.name_en,
        wc.major_category_name as category,
        e.characteristics as description,
        e.target_muscles,
        e.equipment,
        e.purpose,
        COALESCE(v.video_id, e.video_url) as video_url,
        COUNT(whd.exercises_id) as count
    FROM workout_history_detail whd
    INNER JOIN workout_history_master whm ON whd.workout_history_master_id = whm.id
    INNER JOIN exercises e ON whd.exercises_id = e.id
    INNER JOIN workout_categories wc ON e.workout_category_id = wc.id
    LEFT JOIN vimeo_videos v ON (
        v.is_active = TRUE
        AND (
          e.video_url = v.video_id
          OR (
            e.video_url IS NULL
            AND e.name_en IS NOT NULL
            AND e.workout_category_id = v.workout_category_id
            AND e.name_en = v.title
          )
        )
    )
    LEFT JOIN users u ON whm.user_id = u.id
    WHERE e.is_active = TRUE
      AND wc.gubun = 'MAIN'
      AND (p_branch_id IS NULL OR p_branch_id = '' OR u.branch_id = p_branch_id)
      AND (p_start_date IS NULL OR whm.date >= p_start_date)
      AND (p_end_date IS NULL OR whm.date <= p_end_date)
      AND (p_target_muscle IS NULL OR p_target_muscle = '' OR e.target_muscles LIKE CONCAT('%', p_target_muscle, '%'))
      AND e.number NOT IN (999997, 999998, 999999)
    GROUP BY e.id, e.name_ko, e.name_en, wc.major_category_name, e.characteristics, e.target_muscles, e.equipment, e.purpose, COALESCE(v.video_id, e.video_url)
    ORDER BY count DESC, e.name_ko ASC
    LIMIT v_limit;
END //

-- 공지사항 읽음 처리 및 조회수 증가 프로시저
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_mark_announcement_as_read(
    IN p_announcement_id BIGINT,
    IN p_user_id CHAR(36)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    -- 읽음 기록 추가 (이미 있으면 무시)
    INSERT IGNORE INTO announcement_reads (announcement_id, user_id, read_at)
    VALUES (p_announcement_id, p_user_id, CURRENT_TIMESTAMP);

    -- 조회수 증가
    UPDATE announcements 
    SET view_count = view_count + 1 
    WHERE id = p_announcement_id;

    SELECT 'success' as status;

    COMMIT;
END //
DELIMITER ;