-- devices 테이블 생성
-- Electron 디바이스 등록 및 관리용

CREATE TABLE IF NOT EXISTS devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(64) NOT NULL UNIQUE COMMENT 'Electron PC 고유 식별자 (하드웨어 기반 해시)',
    device_token VARCHAR(128) NULL UNIQUE COMMENT '인증용 토큰 (등록 완료 후 발급)',
    register_code VARCHAR(10) NULL COMMENT '등록용 임시 코드 (ABC123 형태)',
    register_code_expires_at DATETIME NULL COMMENT '등록 코드 만료 시간',
    store_id INT NULL COMMENT '연결된 매장 (branches.id)',
    display_label VARCHAR(100) NULL COMMENT '표시 이름 (1번 모니터, 메인 TV 등)',
    status ENUM('pending', 'approved', 'blocked') DEFAULT 'approved' COMMENT '상태: pending=대기, approved=승인, blocked=차단',
    last_seen_at DATETIME NULL COMMENT '마지막 연결 시간',
    ip_address VARCHAR(45) NULL COMMENT '마지막 연결 IP',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    registered_at DATETIME NULL COMMENT '등록 완료 시간',
    registered_by CHAR(36) NULL COMMENT '등록한 사용자 users.id',
    registered_by_userid VARCHAR(100) NULL COMMENT '등록한 사용자 users.userid',
    approved_at DATETIME NULL COMMENT '승인 시간 (추후 승인 기능용)',
    approved_by INT NULL COMMENT '승인한 관리자 (users.id)',
    
    INDEX idx_devices_store_id (store_id),
    INDEX idx_devices_register_code (register_code),
    INDEX idx_devices_status (status),
    INDEX idx_devices_registered_by (registered_by),
    INDEX idx_devices_registered_by_userid (registered_by_userid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 예시 쿼리들
-- 1. 등록코드로 디바이스 조회
-- SELECT * FROM devices WHERE register_code = 'ABC123' AND register_code_expires_at > NOW();

-- 2. 매장의 등록된 디바이스 목록
-- SELECT * FROM devices WHERE store_id = ? AND status = 'approved';

-- 3. 온라인 디바이스 (최근 1분 이내 연결)
-- SELECT * FROM devices WHERE store_id = ? AND last_seen_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE);
