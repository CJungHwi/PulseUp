-- 1. 공지사항 테이블에 view_count 컬럼 확인 및 추가
-- 이미 존재할 경우를 대비하여 주석 처리하거나 필요 시 직접 실행하십시오.
-- ALTER TABLE announcements ADD COLUMN view_count INT NOT NULL DEFAULT 0 COMMENT '총 조회수' AFTER end_date;

-- 2. 공지사항 읽음 상태 테이블 생성
CREATE TABLE IF NOT EXISTS announcement_reads (
    id bigint(20) PRIMARY KEY AUTO_INCREMENT COMMENT '읽음 상태 고유 ID',
    announcement_id bigint(20) NOT NULL COMMENT '공지사항 ID (announcements.id 참조)',
    user_id CHAR(36) NOT NULL COMMENT '사용자 ID (users.id 참조)',
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '읽은 일시',
    UNIQUE KEY uk_announcement_user (announcement_id, user_id),
    INDEX idx_announcement_id (announcement_id),
    INDEX idx_user_id (user_id),
    INDEX idx_read_at (read_at)
) ENGINE=InnoDB COMMENT='공지사항 읽음 상태 - 사용자별 공지사항 읽음 여부 추적';

-- 3. 공지사항 조회수 증가 프로시저 생성
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
