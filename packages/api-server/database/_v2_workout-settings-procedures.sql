-- =============================================================================
-- WorkoutSettings / 관련 API 전용 프로시저 (한 파일 통합)
-- =============================================================================
-- 적용 예:
--   mysql -u USER -p DBNAME < packages/api-server/database/workout-settings-procedures.sql
-- 배포 시 database/procedures.sql 과 별도로 본 파일을 실행하는 것을 권장합니다.
-- (procedures.sql 에는 본 파일 내용을 넣지 않습니다 — 중복 정의 방지)
-- =============================================================================

DELIMITER //

-- 공용 workout_setting (시스템 기본 템플릿) 조회
CREATE OR REPLACE PROCEDURE sp_GetWorkoutSetting(
    IN p_method_type VARCHAR(20)
)
BEGIN
    IF p_method_type IS NULL OR p_method_type = '' THEN
        SELECT
            id,
            method_type,
            `round`,
            time,
            rest,
            water_break,
            reps,
            is_active,
            sort_order,
            created_at,
            updated_at
        FROM workout_setting
        WHERE is_active = TRUE
        ORDER BY method_type, sort_order;
    ELSE
        SELECT
            id,
            method_type,
            `round`,
            time,
            rest,
            water_break,
            reps,
            is_active,
            sort_order,
            created_at,
            updated_at
        FROM workout_setting
        WHERE method_type = p_method_type
          AND is_active = TRUE
        ORDER BY sort_order;
    END IF;
END //

-- 사용자별 workout_setting_profile 조회 (p_method_type 빈 문자열이면 전체 방식)
CREATE OR REPLACE PROCEDURE sp_GetWorkoutSettingProfile(
    IN p_owner_user_id CHAR(36),
    IN p_method_type VARCHAR(20)
)
BEGIN
    IF p_method_type IS NULL OR p_method_type = '' THEN
        SELECT
            id,
            method_type,
            round_no AS `round`,
            time_value AS time,
            rest_value AS rest,
            water_break,
            reps,
            is_active,
            sort_order,
            created_at,
            updated_at
        FROM workout_setting_profile
        WHERE owner_user_id = p_owner_user_id
          AND is_active = TRUE
        ORDER BY method_type, sort_order, round_no;
    ELSE
        SELECT
            id,
            method_type,
            round_no AS `round`,
            time_value AS time,
            rest_value AS rest,
            water_break,
            reps,
            is_active,
            sort_order,
            created_at,
            updated_at
        FROM workout_setting_profile
        WHERE owner_user_id = p_owner_user_id
          AND method_type = p_method_type
          AND is_active = TRUE
        ORDER BY sort_order, round_no;
    END IF;
END //

-- 사용자별 설정 일괄 저장 (JSON 배열: round, time, rest, waterBreak, reps, sortOrder, isActive 숫자 권장)
CREATE OR REPLACE PROCEDURE sp_SaveWorkoutSettingProfile(
    IN p_owner_user_id CHAR(36),
    IN p_method_type VARCHAR(20),
    IN p_rows_json JSON
)
BEGIN
    DECLARE v_idx INT DEFAULT 0;
    DECLARE v_len INT DEFAULT 0;
    DECLARE v_round INT;
    DECLARE v_time INT;
    DECLARE v_rest INT;
    DECLARE v_water INT;
    DECLARE v_reps INT;
    DECLARE v_sort INT;
    DECLARE v_active TINYINT(1);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    DELETE FROM workout_setting_profile
    WHERE owner_user_id = p_owner_user_id AND method_type = p_method_type;

    SET v_len = IFNULL(JSON_LENGTH(p_rows_json), 0);

    WHILE v_idx < v_len DO
        SET v_round = IFNULL(CAST(JSON_UNQUOTE(JSON_EXTRACT(p_rows_json, CONCAT('$[', v_idx, '].round'))) AS SIGNED), v_idx + 1);
        SET v_time = IFNULL(CAST(JSON_UNQUOTE(JSON_EXTRACT(p_rows_json, CONCAT('$[', v_idx, '].time'))) AS SIGNED), 0);
        SET v_rest = IFNULL(CAST(JSON_UNQUOTE(JSON_EXTRACT(p_rows_json, CONCAT('$[', v_idx, '].rest'))) AS SIGNED), 0);
        SET v_water = IFNULL(CAST(JSON_UNQUOTE(JSON_EXTRACT(p_rows_json, CONCAT('$[', v_idx, '].waterBreak'))) AS SIGNED), 0);
        SET v_reps = IFNULL(CAST(JSON_UNQUOTE(JSON_EXTRACT(p_rows_json, CONCAT('$[', v_idx, '].reps'))) AS SIGNED), 0);
        SET v_sort = IFNULL(CAST(JSON_UNQUOTE(JSON_EXTRACT(p_rows_json, CONCAT('$[', v_idx, '].sortOrder'))) AS SIGNED), v_idx + 1);
        SET v_active = IFNULL(CAST(JSON_UNQUOTE(JSON_EXTRACT(p_rows_json, CONCAT('$[', v_idx, '].isActive'))) AS SIGNED), 1);

        INSERT INTO workout_setting_profile (
            owner_user_id, method_type, round_no, time_value, rest_value,
            water_break, reps, sort_order, is_active
        ) VALUES (
            p_owner_user_id, p_method_type, v_round, v_time, v_rest,
            v_water, v_reps, v_sort, v_active
        );

        SET v_idx = v_idx + 1;
    END WHILE;

    COMMIT;
END //

CREATE OR REPLACE PROCEDURE sp_GetMonitorDefaultImageProfile(
    IN p_owner_user_id CHAR(36)
)
BEGIN
    SELECT image_kind, side, image_url
    FROM monitor_default_image_profile
    WHERE owner_user_id = p_owner_user_id
      AND is_active = TRUE;
END //

CREATE OR REPLACE PROCEDURE sp_UpsertMonitorDefaultImageProfile(
    IN p_owner_user_id CHAR(36),
    IN p_image_kind VARCHAR(10),
    IN p_side VARCHAR(10),
    IN p_image_url VARCHAR(2048)
)
BEGIN
    INSERT INTO monitor_default_image_profile (owner_user_id, image_kind, side, image_url, is_active)
    VALUES (p_owner_user_id, p_image_kind, p_side, p_image_url, TRUE)
    ON DUPLICATE KEY UPDATE
        image_url = VALUES(image_url),
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP;
END //

CREATE OR REPLACE PROCEDURE sp_DeleteMonitorDefaultImageProfileSide(
    IN p_owner_user_id CHAR(36),
    IN p_image_kind VARCHAR(10),
    IN p_side VARCHAR(10)
)
BEGIN
    DELETE FROM monitor_default_image_profile
    WHERE owner_user_id = p_owner_user_id
      AND image_kind = p_image_kind
      AND side = p_side;
END //

CREATE OR REPLACE PROCEDURE sp_GetMonitorDisplayTextProfile(
    IN p_owner_user_id CHAR(36)
)
BEGIN
    SELECT display_text
    FROM monitor_display_text_profile
    WHERE owner_user_id = p_owner_user_id
      AND is_active = TRUE
    LIMIT 1;
END //

CREATE OR REPLACE PROCEDURE sp_UpsertMonitorDisplayTextProfile(
    IN p_owner_user_id CHAR(36),
    IN p_display_text VARCHAR(500)
)
BEGIN
    INSERT INTO monitor_display_text_profile (owner_user_id, display_text, is_active)
    VALUES (p_owner_user_id, IFNULL(p_display_text, ''), TRUE)
    ON DUPLICATE KEY UPDATE
        display_text = VALUES(display_text),
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP;
END //

CREATE OR REPLACE PROCEDURE sp_GetSystemDefaultImages()
BEGIN
    SELECT image_kind, side, image_url
    FROM system_default_image
    WHERE is_active = TRUE;
END //

CREATE OR REPLACE PROCEDURE sp_UpsertSystemDefaultImage(
    IN p_image_kind VARCHAR(10),
    IN p_side VARCHAR(10),
    IN p_image_url VARCHAR(2048)
)
BEGIN
    INSERT INTO system_default_image (image_kind, side, image_url, is_active)
    VALUES (p_image_kind, p_side, p_image_url, TRUE)
    ON DUPLICATE KEY UPDATE
        image_url = VALUES(image_url),
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP;
END //

CREATE OR REPLACE PROCEDURE sp_DeleteSystemDefaultImageSide(
    IN p_image_kind VARCHAR(10),
    IN p_side VARCHAR(10)
)
BEGIN
    DELETE FROM system_default_image
    WHERE image_kind = p_image_kind AND side = p_side;
END //

CREATE OR REPLACE PROCEDURE sp_GetSystemDisplayText()
BEGIN
    SELECT display_text
    FROM system_display_text
    WHERE is_active = TRUE
    ORDER BY updated_at DESC
    LIMIT 1;
END //

CREATE OR REPLACE PROCEDURE sp_UpsertSystemDisplayText(
    IN p_display_text VARCHAR(500)
)
BEGIN
    IF EXISTS (SELECT 1 FROM system_display_text LIMIT 1) THEN
        UPDATE system_display_text
        SET display_text = IFNULL(p_display_text, ''),
            is_active = TRUE,
            updated_at = CURRENT_TIMESTAMP
        ORDER BY updated_at DESC
        LIMIT 1;
    ELSE
        INSERT INTO system_display_text (display_text, is_active)
        VALUES (IFNULL(p_display_text, ''), TRUE);
    END IF;
END //

CREATE OR REPLACE PROCEDURE sp_GetWorkoutExerciseMonitorConfig(
    IN p_master_id VARCHAR(36)
)
BEGIN
    SELECT exercise_id, image_kind, side, image_url, display_text
    FROM workout_exercise_monitor_config
    WHERE workout_history_master_id = p_master_id;
END //

CREATE OR REPLACE PROCEDURE sp_SaveWorkoutExerciseMonitorConfig(
    IN p_master_id VARCHAR(36),
    IN p_configs_json JSON
)
BEGIN
    DECLARE v_idx INT DEFAULT 0;
    DECLARE v_len INT DEFAULT 0;
    DECLARE v_exercise_id VARCHAR(255);
    DECLARE v_image_kind VARCHAR(10);
    DECLARE v_side VARCHAR(10);
    DECLARE v_image_url VARCHAR(2048);
    DECLARE v_display_text VARCHAR(500);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    DELETE FROM workout_exercise_monitor_config
    WHERE workout_history_master_id = p_master_id;

    SET v_len = IFNULL(JSON_LENGTH(p_configs_json), 0);

    WHILE v_idx < v_len DO
        SET v_exercise_id = JSON_UNQUOTE(JSON_EXTRACT(p_configs_json, CONCAT('$[', v_idx, '].exerciseId')));
        SET v_image_kind = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p_configs_json, CONCAT('$[', v_idx, '].imageKind'))), 'null');
        SET v_side = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p_configs_json, CONCAT('$[', v_idx, '].side'))), 'null');
        SET v_image_url = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p_configs_json, CONCAT('$[', v_idx, '].imageUrl'))), 'null');
        SET v_display_text = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p_configs_json, CONCAT('$[', v_idx, '].displayText'))), 'null');

        IF v_exercise_id IS NOT NULL AND v_exercise_id <> '' THEN
            INSERT INTO workout_exercise_monitor_config (
                workout_history_master_id, exercise_id, image_kind, side, image_url, display_text
            ) VALUES (
                p_master_id, v_exercise_id, v_image_kind, v_side, v_image_url, v_display_text
            );
        END IF;

        SET v_idx = v_idx + 1;
    END WHILE;

    COMMIT;
END //

CREATE OR REPLACE PROCEDURE sp_GetWorkoutMonitorDisplayImages(
    IN p_master_id VARCHAR(36)
)
BEGIN
    SELECT image_kind, side, image_url
    FROM workout_monitor_display_image
    WHERE workout_history_master_id = p_master_id
      AND is_active = TRUE;
END //

CREATE OR REPLACE PROCEDURE sp_GetWorkoutMonitorDisplayText(
    IN p_master_id VARCHAR(36)
)
BEGIN
    SELECT display_text
    FROM workout_monitor_display_text
    WHERE workout_history_master_id = p_master_id
      AND is_active = TRUE
    LIMIT 1;
END //

CREATE OR REPLACE PROCEDURE sp_UpsertWorkoutMonitorDisplayImage(
    IN p_master_id VARCHAR(36),
    IN p_image_kind VARCHAR(10),
    IN p_side VARCHAR(10),
    IN p_image_url VARCHAR(2048)
)
BEGIN
    INSERT INTO workout_monitor_display_image (
        workout_history_master_id, image_kind, side, image_url, is_active
    ) VALUES (
        p_master_id, p_image_kind, p_side, p_image_url, TRUE
    )
    ON DUPLICATE KEY UPDATE
        image_url = VALUES(image_url),
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP;
END //

CREATE OR REPLACE PROCEDURE sp_DeleteWorkoutMonitorDisplayImageSide(
    IN p_master_id VARCHAR(36),
    IN p_image_kind VARCHAR(10),
    IN p_side VARCHAR(10)
)
BEGIN
    DELETE FROM workout_monitor_display_image
    WHERE workout_history_master_id = p_master_id
      AND image_kind = p_image_kind
      AND side = p_side;
END //

CREATE OR REPLACE PROCEDURE sp_UpsertWorkoutMonitorDisplayText(
    IN p_master_id VARCHAR(36),
    IN p_display_text VARCHAR(500)
)
BEGIN
    INSERT INTO workout_monitor_display_text (workout_history_master_id, display_text, is_active)
    VALUES (p_master_id, IFNULL(p_display_text, ''), TRUE)
    ON DUPLICATE KEY UPDATE
        display_text = VALUES(display_text),
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP;
END //

DELIMITER ;
