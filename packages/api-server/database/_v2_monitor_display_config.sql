-- =============================================================================
-- 모니터 이미지·영상앱 표시 설정 확장 (좌/중/우, default/intro, 운동별 config)
-- 적용 순서: 본 파일 → workout-settings-procedures.sql (SP 갱신)
-- 적용: mysql -u USER -p DBNAME < packages/api-server/database/_v2_monitor_display_config.sql
-- =============================================================================

-- 1) monitor_default_image_profile: image_kind + center side
ALTER TABLE monitor_default_image_profile
    ADD COLUMN IF NOT EXISTS image_kind VARCHAR(10) NOT NULL DEFAULT 'default'
        COMMENT 'default=기본 이미지, intro=인트로 이미지'
        AFTER owner_user_id;

UPDATE monitor_default_image_profile SET image_kind = 'default' WHERE image_kind IS NULL OR image_kind = '';

-- 기존 UK 제거 후 새 UK (MySQL 8: IF NOT EXISTS on index may fail — drop if exists pattern)
SET @idx_exists = (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'monitor_default_image_profile'
      AND index_name = 'uk_owner_side'
);
SET @sql_drop = IF(@idx_exists > 0,
    'ALTER TABLE monitor_default_image_profile DROP INDEX uk_owner_side',
    'SELECT 1');
PREPARE stmt FROM @sql_drop;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_new_exists = (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'monitor_default_image_profile'
      AND index_name = 'uk_owner_kind_side'
);
SET @sql_add = IF(@idx_new_exists = 0,
    'ALTER TABLE monitor_default_image_profile ADD UNIQUE KEY uk_owner_kind_side (owner_user_id, image_kind, side)',
    'SELECT 1');
PREPARE stmt2 FROM @sql_add;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- 2) system_default_image: image_kind
ALTER TABLE system_default_image
    ADD COLUMN IF NOT EXISTS image_kind VARCHAR(10) NOT NULL DEFAULT 'default'
        COMMENT 'default=기본 이미지, intro=인트로 이미지'
        AFTER id;

UPDATE system_default_image SET image_kind = 'default' WHERE image_kind IS NULL OR image_kind = '';

SET @sys_idx_exists = (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'system_default_image'
      AND index_name = 'uk_side'
);
SET @sys_drop = IF(@sys_idx_exists > 0,
    'ALTER TABLE system_default_image DROP INDEX uk_side',
    'SELECT 1');
PREPARE stmt3 FROM @sys_drop;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

SET @sys_new_exists = (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'system_default_image'
      AND index_name = 'uk_kind_side'
);
SET @sys_add = IF(@sys_new_exists = 0,
    'ALTER TABLE system_default_image ADD UNIQUE KEY uk_kind_side (image_kind, side)',
    'SELECT 1');
PREPARE stmt4 FROM @sys_add;
EXECUTE stmt4;
DEALLOCATE PREPARE stmt4;

-- 3) 사용자 영상앱 표시 텍스트
CREATE TABLE IF NOT EXISTS monitor_display_text_profile (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    owner_user_id CHAR(36) NOT NULL COMMENT '데이터 소유자(users.id)',
    display_text VARCHAR(500) NOT NULL DEFAULT '' COMMENT '영상앱 표시 문자',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_owner (owner_user_id),
    CONSTRAINT fk_monitor_display_text_profile_owner
        FOREIGN KEY (owner_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='사용자별 영상앱 표시 텍스트';

-- 4) 시스템(super_admin) 영상앱 표시 텍스트
CREATE TABLE IF NOT EXISTS system_display_text (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    display_text VARCHAR(500) NOT NULL DEFAULT '' COMMENT '시스템 기본 영상앱 표시 문자',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='시스템 공통 영상앱 표시 텍스트';

INSERT INTO system_display_text (display_text, is_active)
SELECT '', TRUE FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM system_display_text LIMIT 1);

-- 5) 일자별 운동 — 운동별 모니터 설정
CREATE TABLE IF NOT EXISTS workout_exercise_monitor_config (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    workout_history_master_id VARCHAR(36) NOT NULL COMMENT 'workout_history_master.id',
    exercise_id VARCHAR(255) NOT NULL COMMENT 'exercises.id (catalog)',
    image_kind VARCHAR(10) NULL COMMENT 'default|intro (NULL이면 display_text 행)',
    side VARCHAR(10) NULL COMMENT 'left|center|right (display_text 행은 NULL)',
    image_url VARCHAR(2048) NULL COMMENT '이미지 URL',
    display_text VARCHAR(500) NULL COMMENT '영상앱 표시 (image_kind/side NULL)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_master_exercise (workout_history_master_id, exercise_id),
    CONSTRAINT fk_workout_exercise_monitor_config_master
        FOREIGN KEY (workout_history_master_id) REFERENCES workout_history_master(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='일자별 운동 — 운동별 모니터 이미지/텍스트';
