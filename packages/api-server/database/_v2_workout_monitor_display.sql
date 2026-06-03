-- =============================================================================
-- 일자별 운동( workout_history_master ) 단위 모니터 표시 설정
-- 적용: mysql -u USER -p DBNAME < packages/api-server/database/_v2_workout_monitor_display.sql
-- 이후 workout-settings-procedures.sql (SP 추가분) 적용
-- =============================================================================

CREATE TABLE IF NOT EXISTS workout_monitor_display_image (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    workout_history_master_id VARCHAR(36) NOT NULL COMMENT 'workout_history_master.id',
    image_kind VARCHAR(10) NOT NULL DEFAULT 'default' COMMENT 'default|intro',
    side VARCHAR(10) NOT NULL COMMENT 'left|center|right',
    image_url VARCHAR(2048) NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_master_kind_side (workout_history_master_id, image_kind, side),
    CONSTRAINT fk_workout_monitor_display_image_master
        FOREIGN KEY (workout_history_master_id) REFERENCES workout_history_master(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='일자별 운동 — 모니터 기본/인트로 이미지';

CREATE TABLE IF NOT EXISTS workout_monitor_display_text (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    workout_history_master_id VARCHAR(36) NOT NULL COMMENT 'workout_history_master.id',
    display_text VARCHAR(500) NOT NULL DEFAULT '' COMMENT '영상앱 표시 문자',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_master (workout_history_master_id),
    CONSTRAINT fk_workout_monitor_display_text_master
        FOREIGN KEY (workout_history_master_id) REFERENCES workout_history_master(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='일자별 운동 — 영상앱 표시 텍스트';
